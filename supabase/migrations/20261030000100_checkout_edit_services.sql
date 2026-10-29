-- At checkout the services on the sale can be changed (something added or dropped part way through the visit).
-- Only the sale's lines change; the booking, its length and its time are left alone.
create or replace function set_sale_services(p_sale uuid, p_services uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare s sales; v_gross int; v_tax int;
begin
  select * into s from sales where id = p_sale for update;
  if s.id is null then raise exception 'sale_not_found'; end if;
  perform assert_salon_access(s.salon_id);
  if s.status <> 'pending' then raise exception 'sale_not_pending'; end if;
  if s.booking_id is null then raise exception 'no_booking'; end if;
  if s.discount_cents > 0 then raise exception 'discount_set'; end if;
  if exists (select 1 from card_payments where sale_id = s.id and status in ('approved', 'pending')) then raise exception 'card_payment_in_progress'; end if;

  delete from sale_items where sale_id = s.id and service_id is not null and not (service_id = any(coalesce(p_services, '{}')));
  insert into sale_items (sale_id, service_id, label, qty, price_cents)
    select s.id, sv.id, sv.name, 1, sv.price_cents from services sv
    where sv.id = any(coalesce(p_services, '{}')) and sv.salon_id = s.salon_id and sv.active
      and not exists (select 1 from sale_items si where si.sale_id = s.id and si.service_id = sv.id);

  select coalesce(sum(price_cents::bigint * qty), 0) into v_gross from sale_items where sale_id = s.id;
  if v_gross = 0 then raise exception 'empty_sale'; end if;
  v_tax := calc_tax_cents(v_gross, s.tax_rate, s.tax_inclusive);
  -- The tip is set again by set_sale_tip afterwards, from the new service total.
  update sales set subtotal_cents = v_gross, tax_cents = v_tax, tip_cents = 0,
    total_cents = v_gross + case when s.tax_inclusive then 0 else v_tax end where id = s.id;
end $$;

revoke all on function set_sale_services(uuid, uuid[]) from public, anon;
grant execute on function set_sale_services(uuid, uuid[]) to authenticated;
