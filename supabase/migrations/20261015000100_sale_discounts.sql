-- Checkout discounts. subtotal_cents stays the amount charged before tip and tax (so totals, tax, reports and refunds keep working);
-- discount_cents records how much was taken off the item total, and discount_note says why.
alter table sales
  add column if not exists discount_cents int not null default 0 check (discount_cents >= 0),
  add column if not exists discount_note text;

create or replace function set_sale_discount(p_sale uuid, p_kind text, p_value numeric, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare s sales; v_gross int; v_disc int; v_sub int; v_tax int; v_role staff_role;
begin
  select * into s from sales where id = p_sale for update;
  if s.id is null then raise exception 'sale_not_found'; end if;
  perform assert_salon_access(s.salon_id);
  select app_role into v_role from staff where user_id = auth.uid() and active;
  if v_role is null or v_role = 'stylist' then raise exception 'owner_only' using errcode = '42501'; end if;
  if s.status <> 'pending' then raise exception 'sale_not_pending'; end if;
  if exists (select 1 from card_payments where sale_id = s.id and status in ('approved', 'pending')) then raise exception 'card_payment_in_progress'; end if;
  select coalesce(sum(price_cents::bigint * qty), 0) into v_gross from sale_items where sale_id = s.id;
  if p_kind is null or p_kind = 'none' or coalesce(p_value, 0) <= 0 then v_disc := 0;
  elsif p_kind = 'percent' then
    if p_value > 100 then raise exception 'invalid_discount'; end if;
    v_disc := round(v_gross * p_value / 100.0)::int;
  elsif p_kind = 'amount' then v_disc := round(p_value)::int;  -- cents
  else raise exception 'invalid_discount'; end if;
  if v_disc >= v_gross and v_disc > 0 then raise exception 'discount_too_large'; end if;
  v_sub := v_gross - v_disc;
  v_tax := calc_tax_cents(v_sub, s.tax_rate, s.tax_inclusive);
  update sales set discount_cents = v_disc, discount_note = case when v_disc > 0 then nullif(left(trim(coalesce(p_note, '')), 60), '') end,
    subtotal_cents = v_sub, tax_cents = v_tax,
    total_cents = v_sub + s.tip_cents + case when s.tax_inclusive then 0 else v_tax end where id = s.id;
  perform audit(s.salon_id, 'discount', 'sale', s.id, jsonb_build_object('discount_cents', v_disc, 'note', nullif(trim(coalesce(p_note, '')), '')));
end $$;

revoke all on function set_sale_discount(uuid, text, numeric, text) from public, anon;
grant execute on function set_sale_discount(uuid, text, numeric, text) to authenticated;

-- Editing the price of a discounted sale would leave the discount out of step; ask to remove it first.
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
  if s.discount_cents > 0 then raise exception 'remove_discount_first'; end if;
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

-- Commission is earned on what the client actually paid for services, so a sale's discount is shared across its items.
create or replace function payroll_week(p_from date, p_to date)
returns table (staff_id uuid, staff_name text, role_title text, service_cents bigint, product_cents bigint, tips_cents bigint,
               commission_pct numeric, product_pct numeric, service_commission_cents bigint, product_commission_cents bigint, paid_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_salon uuid := current_salon_id(); v_tz text; v_start timestamptz; v_end timestamptz; v_ppct numeric;
begin
  if v_salon is null or not is_owner() then raise exception 'owner_only' using errcode = '42501'; end if;
  select timezone into v_tz from salons where id = v_salon;
  select coalesce(max(product_commission_pct), 10) into v_ppct from salon_settings where salon_id = v_salon;
  v_start := p_from::timestamp at time zone v_tz;
  v_end := (p_to + 1)::timestamp at time zone v_tz;
  return query
  select st.id, st.name, st.role_title,
    coalesce(po.service_cents::bigint, b.svc), coalesce(po.product_cents::bigint, b.prod), coalesce(po.tips_cents::bigint, b.tips),
    coalesce(po.commission_pct, st.commission_pct)::numeric,
    coalesce(po.product_pct, v_ppct)::numeric,
    coalesce(po.commission_cents::bigint, round(b.svc * st.commission_pct / 100.0)::bigint),
    coalesce(po.product_commission_cents::bigint, round(b.prod * v_ppct / 100.0)::bigint),
    po.paid_at
  from staff st
  left join payouts po on po.staff_id = st.id and po.period_start = p_from and po.period_end = p_to
  cross join lateral (
    select
      coalesce((select sum(x.svc - case when x.d > 0 then round(x.d::numeric * x.svc / nullif(x.gross, 0)) else 0 end)
                from (select s.discount_cents as d,
                             coalesce(sum(si.price_cents::bigint * si.qty) filter (where si.service_id is not null), 0) as svc,
                             sum(si.price_cents::bigint * si.qty) as gross
                      from sales s join sale_items si on si.sale_id = s.id
                      where s.staff_id = st.id and s.status = 'paid' and s.paid_at >= v_start and s.paid_at < v_end
                      group by s.id) x), 0)::bigint as svc,
      coalesce((select sum(x.prod - case when x.d > 0 then round(x.d::numeric * x.prod / nullif(x.gross, 0)) else 0 end)
                from (select s.discount_cents as d,
                             coalesce(sum(si.price_cents::bigint * si.qty) filter (where si.product_id is not null), 0) as prod,
                             sum(si.price_cents::bigint * si.qty) as gross
                      from sales s join sale_items si on si.sale_id = s.id
                      where s.staff_id = st.id and s.status = 'paid' and s.paid_at >= v_start and s.paid_at < v_end
                      group by s.id) x), 0)::bigint as prod,
      coalesce((select sum(s.tip_cents) from sales s
                where s.staff_id = st.id and s.status = 'paid' and s.paid_at >= v_start and s.paid_at < v_end), 0)::bigint as tips
  ) b
  where st.salon_id = v_salon and (st.active or po.id is not null)
  order by st.name;
end $$;
