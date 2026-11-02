-- At checkout from the Sales page the retail products on a pending sale can be changed, as they can at the calendar's checkout.
-- Only the product lines change; the services stay as they are. The tip is set again by set_sale_tip afterwards.
create or replace function set_sale_products(p_sale uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare s sales; it jsonb; pr products; v_qty int; v_gross int; v_tax int;
begin
  select * into s from sales where id = p_sale for update;
  if s.id is null then raise exception 'sale_not_found'; end if;
  perform assert_salon_access(s.salon_id);
  if s.status <> 'pending' then raise exception 'sale_not_pending'; end if;
  if s.discount_cents > 0 then raise exception 'discount_set'; end if;
  if exists (select 1 from card_payments where sale_id = s.id and status in ('approved', 'pending')) then raise exception 'card_payment_in_progress'; end if;

  delete from sale_items where sale_id = s.id and product_id is not null;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_qty := (it ->> 'qty')::int;
    if v_qty is null or v_qty < 1 then continue; end if;
    select * into pr from products where id = (it ->> 'product_id')::uuid and salon_id = s.salon_id and active;
    if pr.id is null then raise exception 'invalid_product'; end if;
    if pr.stock < v_qty then raise exception 'insufficient_stock'; end if;
    insert into sale_items (sale_id, product_id, label, qty, price_cents) values (s.id, pr.id, pr.name, v_qty, pr.price_cents);
  end loop;

  select coalesce(sum(price_cents::bigint * qty), 0) into v_gross from sale_items where sale_id = s.id;
  if v_gross = 0 then raise exception 'empty_sale'; end if;
  v_tax := calc_tax_cents(v_gross, s.tax_rate, s.tax_inclusive);
  update sales set subtotal_cents = v_gross, tax_cents = v_tax, tip_cents = 0,
    total_cents = v_gross + case when s.tax_inclusive then 0 else v_tax end where id = s.id;
end $$;

revoke all on function set_sale_products(uuid, jsonb) from public, anon;
grant execute on function set_sale_products(uuid, jsonb) to authenticated;
