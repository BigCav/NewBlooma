-- Prepaid packages: a service sold in a bundle ("5 blow-dries for the price of 4"). Selling one is an ordinary sale (so payment, receipts,
-- refunds and reports all work as they do today); using one at checkout sets that service line to nothing to pay.
--
-- The line that sells a package is a service line (service_id set) that also carries package_id, so reports and commission count the
-- money as service income when it is taken. Lines that use a package are priced at 0.
--
-- A client's package is usable once the sale that bought it is paid. Uses left = uses bought minus uses on pending or paid sales, so a
-- voided or refunded visit gives its use back and a refunded purchase switches the package off, with no extra bookkeeping.

create table service_packages (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references salons(id) on delete cascade,
  service_id  uuid not null references services(id),
  name        text not null check (length(trim(name)) between 1 and 80),
  uses        int  not null check (uses between 2 and 100),
  price_cents int  not null check (price_cents > 0),
  valid_days  int  check (valid_days between 1 and 3650),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index service_packages_salon on service_packages (salon_id, active);

create table client_packages (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references salons(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  package_id  uuid references service_packages(id),
  service_id  uuid not null references services(id),
  name        text not null,
  uses_total  int  not null check (uses_total >= 1),
  price_cents int  not null check (price_cents >= 0),
  valid_days  int,
  sale_id     uuid not null unique references sales(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index client_packages_client on client_packages (salon_id, client_id);

alter table sale_items add column package_id uuid references service_packages(id);

create table package_uses (
  id                uuid primary key default gen_random_uuid(),
  salon_id          uuid not null references salons(id) on delete cascade,
  client_package_id uuid not null references client_packages(id) on delete cascade,
  sale_id           uuid not null references sales(id) on delete cascade,
  sale_item_id      uuid not null unique references sale_items(id) on delete cascade,
  created_at        timestamptz not null default now()
);
create index package_uses_cp on package_uses (client_package_id);

alter table service_packages enable row level security;
alter table client_packages enable row level security;
alter table package_uses enable row level security;
grant select, insert, update, delete on service_packages to authenticated;
grant select on client_packages, package_uses to authenticated;
create policy staff_read on service_packages for select to authenticated using (salon_id = current_salon_id());
create policy owner_write on service_packages for all to authenticated
  using (salon_id = current_salon_id() and is_owner())
  with check (salon_id = current_salon_id() and is_owner() and exists (select 1 from services s where s.id = service_id and s.salon_id = current_salon_id()));
create policy staff_read on client_packages for select to authenticated using (salon_id = current_salon_id());
create policy staff_read on package_uses for select to authenticated using (salon_id = current_salon_id());

-- What each client package has left, and until when.
create view client_package_status with (security_invoker = true) as
select cp.id, cp.salon_id, cp.client_id, cp.package_id, cp.service_id, cp.name, cp.uses_total, cp.price_cents, cp.valid_days, cp.sale_id, cp.created_at,
       s.status as sale_status, s.paid_at,
       (cp.uses_total - (select count(*) from package_uses u join sales us on us.id = u.sale_id
                         where u.client_package_id = cp.id and us.status in ('pending', 'paid')))::int as uses_left,
       case when cp.valid_days is null or s.paid_at is null then null else s.paid_at + make_interval(days => cp.valid_days) end as expires_at
from client_packages cp join sales s on s.id = cp.sale_id;
grant select on client_package_status to authenticated;

-- Sell a package: a pending sale for the client (created from the name when new), paid like any other sale.
create or replace function create_package_sale(p_client_name text, p_package uuid, p_client uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_salon uuid := current_salon_id(); v_set salon_settings; v_pk service_packages; v_client uuid; v_staff uuid; v_me uuid := current_staff_id();
  v_tax int; v_total int; v_sale uuid;
begin
  if v_salon is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_client is null and length(trim(coalesce(p_client_name, ''))) = 0 then raise exception 'client_required'; end if;
  select * into v_pk from service_packages where id = p_package and salon_id = v_salon and active;
  if v_pk.id is null then raise exception 'package_not_found'; end if;
  select * into v_set from salon_settings where salon_id = v_salon;
  if p_client is not null then
    select id into v_client from clients where id = p_client and salon_id = v_salon;
    if v_client is null then raise exception 'client_not_found'; end if;
  else
    insert into clients (salon_id, name) values (v_salon, trim(p_client_name)) returning id into v_client;
  end if;
  select st.id into v_staff from service_staff ss join staff st on st.id = ss.staff_id
    where ss.service_id = v_pk.service_id and st.active and st.salon_id = v_salon order by (st.id = v_me) desc, st.name limit 1;
  if v_staff is null then v_staff := v_me; end if;
  v_tax := calc_tax_cents(v_pk.price_cents, v_set.tax_rate, v_set.tax_inclusive);
  v_total := v_pk.price_cents + case when v_set.tax_inclusive then 0 else v_tax end;
  insert into sales (salon_id, client_id, staff_id, description, subtotal_cents, tip_cents, tax_rate, tax_inclusive, tax_cents, total_cents)
  values (v_salon, v_client, v_staff, v_pk.name, v_pk.price_cents, 0, v_set.tax_rate, v_set.tax_inclusive, v_tax, v_total) returning id into v_sale;
  insert into sale_items (sale_id, service_id, package_id, label, qty, price_cents) values (v_sale, v_pk.service_id, v_pk.id, v_pk.name, 1, v_pk.price_cents);
  insert into client_packages (salon_id, client_id, package_id, service_id, name, uses_total, price_cents, valid_days, sale_id)
  values (v_salon, v_client, v_pk.id, v_pk.service_id, v_pk.name, v_pk.uses, v_pk.price_cents, v_pk.valid_days, v_sale);
  return v_sale;
end $$;
revoke all on function create_package_sale(text, uuid, uuid) from public, anon;
grant execute on function create_package_sale(text, uuid, uuid) to authenticated;

-- Use packages on a visit's pending sale: each use sets one matching service line to 0 and takes one use from the package.
-- p_uses is [{ "client_package_id": ..., "service_id": ... }]. Call it before the discount and tip are set.
create or replace function apply_packages_to_sale(p_sale uuid, p_uses jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare s sales; u jsonb; cp client_package_status; v_item sale_items; v_gross bigint; v_tax int;
begin
  select * into s from sales where id = p_sale for update;
  if s.id is null then raise exception 'sale_not_found'; end if;
  perform assert_salon_access(s.salon_id);
  if s.status <> 'pending' then raise exception 'sale_not_pending'; end if;
  if s.booking_id is null or s.client_id is null then raise exception 'no_booking'; end if;
  if s.discount_cents > 0 then raise exception 'discount_set'; end if;
  if exists (select 1 from card_payments where sale_id = s.id and status in ('approved', 'pending')) then raise exception 'card_payment_in_progress'; end if;

  for u in select * from jsonb_array_elements(coalesce(p_uses, '[]'::jsonb)) loop
    select * into cp from client_package_status
      where id = (u ->> 'client_package_id')::uuid and salon_id = s.salon_id and client_id = s.client_id;
    if cp.id is null then raise exception 'package_not_found'; end if;
    if cp.sale_status <> 'paid' then raise exception 'package_not_paid'; end if;
    if cp.expires_at is not null and cp.expires_at <= now() then raise exception 'package_expired'; end if;
    if cp.uses_left < 1 then raise exception 'package_used_up'; end if;
    select * into v_item from sale_items si
      where si.sale_id = s.id and si.service_id = cp.service_id and si.package_id is null and si.price_cents > 0
        and not exists (select 1 from package_uses pu where pu.sale_item_id = si.id)
      order by si.price_cents desc limit 1;
    if v_item.id is null then raise exception 'package_service_not_on_sale'; end if;
    update sale_items set price_cents = 0, label = left(label || ' (package)', 120) where id = v_item.id;
    insert into package_uses (salon_id, client_package_id, sale_id, sale_item_id) values (s.salon_id, cp.id, s.id, v_item.id);
  end loop;

  select coalesce(sum(price_cents::bigint * qty), 0) into v_gross from sale_items where sale_id = s.id;
  v_tax := calc_tax_cents(v_gross::int, s.tax_rate, s.tax_inclusive);
  -- The tip is set again by set_sale_tip afterwards, from what is left on the service lines.
  update sales set subtotal_cents = v_gross, tax_cents = v_tax, tip_cents = 0,
    total_cents = v_gross + case when s.tax_inclusive then 0 else v_tax end where id = s.id;
end $$;
revoke all on function apply_packages_to_sale(uuid, jsonb) from public, anon;
grant execute on function apply_packages_to_sale(uuid, jsonb) to authenticated;

-- Closing a visit with the package method is only allowed when there is nothing to pay, and a purchase that has been used cannot be refunded.
do $$
declare d text; n text;
begin
  select pg_get_functiondef(oid) into d from pg_proc where pronamespace = 'public'::regnamespace and proname = 'complete_sale';
  n := replace(d, 'if p_method = ''card'' then raise exception ''card_must_use_provider''; end if;',
    'if p_method = ''package'' and s.total_cents > 0 then raise exception ''package_needs_zero_total''; end if;' || chr(10) ||
    '  if p_method = ''card'' then raise exception ''card_must_use_provider''; end if;');
  if n = d then raise exception 'complete_sale patch did not apply'; end if;
  execute n;

  select pg_get_functiondef(oid) into d from pg_proc where pronamespace = 'public'::regnamespace and proname = 'refund_sale_internal';
  n := replace(d, 'if s.status <> ''paid'' then raise exception ''sale_not_paid''; end if;',
    'if s.status <> ''paid'' then raise exception ''sale_not_paid''; end if;' || chr(10) ||
    '  if exists (select 1 from client_packages cp join package_uses u on u.client_package_id = cp.id join sales us on us.id = u.sale_id where cp.sale_id = s.id and us.status in (''pending'', ''paid'')) then raise exception ''package_partly_used''; end if;');
  if n = d then raise exception 'refund_sale_internal patch did not apply'; end if;
  execute n;
end $$;
