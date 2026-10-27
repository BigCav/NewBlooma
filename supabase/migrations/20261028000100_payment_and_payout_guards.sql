-- Three money guards found by testing.
-- 1. A sale already paid one way cannot quietly be "paid" a second way (for example a card approved after cash was taken).
--    The caller records the clash for review instead of hiding it.
-- 2. Refunding a sale that was paid with a gift card does not put money back on a card the owner has since voided.
-- 3. A payout covers one real period, and no two payouts for the same person may overlap, so the same sales are never paid twice.

create or replace function public.finalize_sale(p_sale uuid, p_method pay_method) returns void
language plpgsql security definer set search_path to 'public' as $$
declare s sales; it sale_items;
begin
  select * into s from sales where id = p_sale for update;
  if s.id is null then raise exception 'sale_not_found'; end if;
  if s.status = 'paid' then
    if s.method is distinct from p_method then raise exception 'sale_already_paid_another_way'; end if;
    return;
  end if;
  if s.status <> 'pending' then raise exception 'sale_not_pending'; end if;
  update sales set status = 'paid', method = p_method, paid_at = now() where id = s.id;
  for it in select * from sale_items where sale_id = s.id and product_id is not null loop
    update products set stock = greatest(stock - it.qty, 0) where id = it.product_id;
  end loop;
  if s.booking_id is not null then update bookings set status = 'completed' where id = s.booking_id and status <> 'cancelled'; end if;
  perform audit(s.salon_id, 'paid', 'sale', s.id, jsonb_build_object('method', p_method, 'total_cents', s.total_cents));
end $$;

create or replace function public.refund_sale_internal(p_sale uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare s sales; it sale_items;
begin
  select * into s from sales where id = p_sale for update;
  if s.id is null then raise exception 'sale_not_found'; end if;
  if s.status <> 'paid' then raise exception 'sale_not_paid'; end if;
  if s.gift_card_id is not null then
    update gift_cards set balance_cents = balance_cents + s.total_cents where id = s.gift_card_id and voided_at is null;
  end if;
  for it in select * from sale_items where sale_id = s.id and product_id is not null loop
    update products set stock = stock + it.qty where id = it.product_id;
  end loop;
  update sales set status = 'refunded', refunded_at = now() where id = s.id;
  perform audit(s.salon_id, 'refunded', 'sale', s.id, jsonb_build_object('total_cents', s.total_cents));
end $$;

alter table public.payouts add constraint payouts_period_order check (period_end >= period_start);
alter table public.payouts add constraint payouts_no_overlap
  exclude using gist (staff_id with =, daterange(period_start, period_end, '[]') with &&);

create or replace function public.mark_payout_paid(p_staff uuid, p_from date, p_to date) returns void
language plpgsql security definer set search_path to 'public' as $$
declare r record; h numeric; v_salon uuid := current_salon_id(); v_tz text;
begin
  if v_salon is null or not is_owner() then raise exception 'owner_only' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 31 then raise exception 'bad_period'; end if;
  select timezone into v_tz from salons where id = v_salon;
  if p_to >= (now() at time zone v_tz)::date then raise exception 'period_open'; end if;
  select * into r from payroll_week(p_from, p_to) w where w.staff_id = p_staff;
  if r.staff_id is null then raise exception 'staff_not_found'; end if;
  if r.paid_at is not null then raise exception 'already_paid'; end if;
  if exists (select 1 from payouts where staff_id = p_staff and daterange(period_start, period_end, '[]') && daterange(p_from, p_to, '[]')) then raise exception 'period_overlap'; end if;
  select s.hours into h from payroll_summary(p_from, p_to) s where s.staff_id = p_staff;
  insert into payouts (salon_id, staff_id, period_start, period_end, hours, commission_pct, commission_cents,
                       service_cents, product_cents, product_pct, product_commission_cents, tips_cents)
  values (v_salon, p_staff, p_from, p_to, coalesce(h, 0), r.commission_pct, r.service_commission_cents,
          r.service_cents, r.product_cents, r.product_pct, r.product_commission_cents, r.tips_cents);
  perform audit(v_salon, 'payout', 'staff', p_staff, jsonb_build_object('from', p_from, 'to', p_to,
    'commission_cents', r.service_commission_cents + r.product_commission_cents, 'tips_cents', r.tips_cents));
end $$;
