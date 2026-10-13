-- Sales screen: change the tip or the service price of an open sale in place, and ring up a walk-in service sale.
create or replace function set_sale_tip(p_sale uuid, p_pct int) returns void
language plpgsql security definer set search_path = public as $$
declare s sales; v_svc int; v_tip int;
begin
  select * into s from sales where id = p_sale for update;
  if s.id is null then raise exception 'sale_not_found'; end if;
  perform assert_salon_access(s.salon_id);
  if s.status <> 'pending' then raise exception 'sale_not_pending'; end if;
  if p_pct < 0 or p_pct > 100 then raise exception 'invalid_tip'; end if;
  if exists (select 1 from card_payments where sale_id = s.id and status in ('approved', 'pending')) then raise exception 'card_payment_in_progress'; end if;
  select coalesce(sum(price_cents::bigint * qty), 0) into v_svc from sale_items where sale_id = s.id and service_id is not null;
  v_tip := round(v_svc * p_pct / 100.0)::int;
  update sales set tip_cents = v_tip, total_cents = subtotal_cents + v_tip + case when tax_inclusive then 0 else tax_cents end where id = s.id;
end $$;

create or replace function set_sale_service_price(p_sale uuid, p_cents int) returns void
language plpgsql security definer set search_path = public as $$
declare s sales; it sale_items; v_n int; v_old int; v_pct numeric; v_sub int; v_tip int; v_tax int; v_role staff_role;
begin
  select * into s from sales where id = p_sale for update;
  if s.id is null then raise exception 'sale_not_found'; end if;
  perform assert_salon_access(s.salon_id);
  select app_role into v_role from staff where user_id = auth.uid() and active;
  if v_role is null or v_role = 'stylist' then raise exception 'owner_only' using errcode = '42501'; end if;
  if s.status <> 'pending' then raise exception 'sale_not_pending'; end if;
  if p_cents is null or p_cents <= 0 then raise exception 'invalid_price'; end if;
  if exists (select 1 from card_payments where sale_id = s.id and status in ('approved', 'pending')) then raise exception 'card_payment_in_progress'; end if;
  select count(*) into v_n from sale_items where sale_id = s.id and service_id is not null;
  if v_n <> 1 then raise exception 'price_not_editable'; end if;
  select * into it from sale_items where sale_id = s.id and service_id is not null;
  v_old := it.price_cents * it.qty;
  v_pct := case when v_old > 0 then s.tip_cents * 100.0 / v_old else 0 end;
  update sale_items set price_cents = p_cents where id = it.id;
  v_sub := s.subtotal_cents - v_old + p_cents * it.qty;
  v_tip := round(p_cents * it.qty * v_pct / 100.0)::int;
  v_tax := calc_tax_cents(v_sub, s.tax_rate, s.tax_inclusive);
  update sales set subtotal_cents = v_sub, tip_cents = v_tip, tax_cents = v_tax,
    total_cents = v_sub + v_tip + case when s.tax_inclusive then 0 else v_tax end where id = s.id;
  perform audit(s.salon_id, 'price_edit', 'sale', s.id, jsonb_build_object('from_cents', v_old, 'to_cents', p_cents));
end $$;

create or replace function create_walkin_sale(p_client_name text, p_service uuid, p_tip_pct int default 0) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_salon uuid := current_salon_id(); v_set salon_settings; v_svc services; v_client uuid; v_staff uuid; v_me uuid := current_staff_id();
  v_tip int; v_tax int; v_total int; v_sale uuid;
begin
  if v_salon is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_tip_pct < 0 or p_tip_pct > 100 then raise exception 'invalid_tip'; end if;
  if length(trim(coalesce(p_client_name, ''))) = 0 then raise exception 'client_required'; end if;
  select * into v_svc from services where id = p_service and salon_id = v_salon and active;
  if v_svc.id is null then raise exception 'service_not_found'; end if;
  select * into v_set from salon_settings where salon_id = v_salon;
  select id into v_client from clients where salon_id = v_salon and lower(name) = lower(trim(p_client_name)) order by created_at limit 1;
  if v_client is null then insert into clients (salon_id, name) values (v_salon, trim(p_client_name)) returning id into v_client; end if;
  select st.id into v_staff from service_staff ss join staff st on st.id = ss.staff_id
    where ss.service_id = v_svc.id and st.active and st.salon_id = v_salon order by (st.id = v_me) desc, st.name limit 1;
  if v_staff is null then raise exception 'staff_cannot_perform'; end if;
  v_tip := round(v_svc.price_cents * p_tip_pct / 100.0)::int;
  v_tax := calc_tax_cents(v_svc.price_cents, v_set.tax_rate, v_set.tax_inclusive);
  v_total := v_svc.price_cents + v_tip + case when v_set.tax_inclusive then 0 else v_tax end;
  insert into sales (salon_id, client_id, staff_id, subtotal_cents, tip_cents, tax_rate, tax_inclusive, tax_cents, total_cents)
  values (v_salon, v_client, v_staff, v_svc.price_cents, v_tip, v_set.tax_rate, v_set.tax_inclusive, v_tax, v_total) returning id into v_sale;
  insert into sale_items (sale_id, service_id, label, qty, price_cents) values (v_sale, v_svc.id, v_svc.name, 1, v_svc.price_cents);
  return v_sale;
end $$;

revoke all on function set_sale_tip(uuid, int), set_sale_service_price(uuid, int), create_walkin_sale(text, uuid, int) from public, anon;
grant execute on function set_sale_tip(uuid, int), set_sale_service_price(uuid, int), create_walkin_sale(text, uuid, int) to authenticated;
