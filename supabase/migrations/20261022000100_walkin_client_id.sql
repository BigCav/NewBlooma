-- Walk-in sales never merge clients by name: an existing client is used only when its id is passed, otherwise a new client is made.
drop function if exists create_walkin_sale(text, uuid, int);
create or replace function create_walkin_sale(p_client_name text, p_service uuid, p_tip_pct int default 0, p_client uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_salon uuid := current_salon_id(); v_set salon_settings; v_svc services; v_client uuid; v_staff uuid; v_me uuid := current_staff_id();
  v_tip int; v_tax int; v_total int; v_sale uuid;
begin
  if v_salon is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_tip_pct < 0 or p_tip_pct > 100 then raise exception 'invalid_tip'; end if;
  if p_client is null and length(trim(coalesce(p_client_name, ''))) = 0 then raise exception 'client_required'; end if;
  select * into v_svc from services where id = p_service and salon_id = v_salon and active;
  if v_svc.id is null then raise exception 'service_not_found'; end if;
  select * into v_set from salon_settings where salon_id = v_salon;
  if p_client is not null then
    select id into v_client from clients where id = p_client and salon_id = v_salon;
    if v_client is null then raise exception 'client_not_found'; end if;
  else
    insert into clients (salon_id, name) values (v_salon, trim(p_client_name)) returning id into v_client;
  end if;
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
revoke all on function create_walkin_sale(text, uuid, int, uuid) from public, anon;
grant execute on function create_walkin_sale(text, uuid, int, uuid) to authenticated;
