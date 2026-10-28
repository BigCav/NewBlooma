-- 1. Online bookings: an add-on only goes with a service it is offered with, and never on its own.
--    The booking page already only shows add-ons that way; this makes the database hold the same line against a hand-made request.
-- 2. Tips: the sale functions respect the "ask for a tip" setting (create_sale already did), so a tip cannot be added when the salon turned tips off.

create or replace function create_booking(p_salon uuid, p_client uuid, p_staff uuid, p_starts_at timestamptz, p_service_ids uuid[], p_source booking_source default 'staff', p_notes text default null, p_mode text default 'staff')
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare
  v_tz text; v_dur int; v_n int; v_set salon_settings; v_id uuid; v_status booking_status; v_email text; v_day date;
begin
  perform assert_salon_access(p_salon);
  if not exists (select 1 from clients where id = p_client and salon_id = p_salon) then raise exception 'client_not_found'; end if;
  if not exists (select 1 from staff where id = p_staff and salon_id = p_salon and active) then raise exception 'staff_not_found'; end if;
  select count(*), coalesce(sum(duration_min), 0) into v_n, v_dur from services where id = any(p_service_ids) and salon_id = p_salon and active;
  if v_n = 0 or v_n <> cardinality(p_service_ids) then raise exception 'service_not_found'; end if;
  if (select count(*) from service_staff where staff_id = p_staff and service_id = any(p_service_ids)) <> (select count(*) from services xs where xs.id = any(p_service_ids) and not xs.is_addon) then
    raise exception 'staff_cannot_perform';
  end if;
  if p_mode in ('public', 'offer') then
    if not exists (select 1 from services where id = any(p_service_ids) and not is_addon) then raise exception 'service_not_found'; end if;
    if exists (select 1 from services x where x.id = any(p_service_ids) and x.is_addon
               and not exists (select 1 from service_addons sa where sa.addon_id = x.id and sa.service_id = any(p_service_ids))) then
      raise exception 'service_not_found';
    end if;
  end if;

  select timezone into v_tz from salons where id = p_salon;
  select * into v_set from salon_settings where salon_id = p_salon;
  v_day := (p_starts_at at time zone v_tz)::date;

  if p_mode in ('public', 'offer') then
    if not exists (select 1 from available_slots(p_salon, p_service_ids, p_staff, v_day, v_day, case when p_mode = 'public' then 'public' else 'offer' end) a
                   where a.starts_at = p_starts_at) then
      raise exception 'slot_unavailable';
    end if;
  end if;

  v_status := case when p_source = 'online' and not v_set.auto_confirm then 'pending' else 'confirmed' end;
  insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status, source, notes)
  values (p_salon, p_client, p_staff, p_starts_at, p_starts_at + make_interval(mins => v_dur), v_status, p_source, nullif(trim(p_notes), ''))
  returning id into v_id;

  insert into booking_services (booking_id, service_id, price_cents, duration_min)
  select v_id, id, price_cents, duration_min from services where id = any(p_service_ids);

  insert into booking_tokens (salon_id, purpose, booking_id, expires_at)
  values (p_salon, 'manage_booking', v_id, p_starts_at + interval '30 days');

  if p_source = 'online' then
    insert into inbox_items (salon_id, type, client_id, booking_id, body)
    values (p_salon, (case when v_status = 'pending' then 'request' else 'booking' end)::inbox_type, p_client, v_id, null);
  end if;

  select email into v_email from clients where id = p_client;
  if v_email is not null and v_set.email_confirmations and v_status = 'confirmed' then
    insert into notifications_outbox (salon_id, booking_id, channel, to_address, template)
    values (p_salon, v_id, 'email', v_email, 'booking_confirmation') on conflict do nothing;
  end if;
  return v_id;
end $function$;

create or replace function set_sale_tip(p_sale uuid, p_pct integer)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare s sales; v_svc int; v_tip int; v_ask boolean;
begin
  select * into s from sales where id = p_sale for update;
  if s.id is null then raise exception 'sale_not_found'; end if;
  perform assert_salon_access(s.salon_id);
  if s.status <> 'pending' then raise exception 'sale_not_pending'; end if;
  if p_pct < 0 or p_pct > 100 then raise exception 'invalid_tip'; end if;
  if exists (select 1 from card_payments where sale_id = s.id and status in ('approved', 'pending')) then raise exception 'card_payment_in_progress'; end if;
  select ask_for_tip into v_ask from salon_settings where salon_id = s.salon_id;
  select coalesce(sum(price_cents::bigint * qty), 0) into v_svc from sale_items where sale_id = s.id and service_id is not null;
  v_tip := case when coalesce(v_ask, false) then round(v_svc * p_pct / 100.0)::int else 0 end;
  update sales set tip_cents = v_tip, total_cents = subtotal_cents + v_tip + case when tax_inclusive then 0 else tax_cents end where id = s.id;
end $function$;

create or replace function create_walkin_sale(p_client_name text, p_service uuid, p_tip_pct integer default 0, p_client uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
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
  v_tip := case when v_set.ask_for_tip then round(v_svc.price_cents * p_tip_pct / 100.0)::int else 0 end;
  v_tax := calc_tax_cents(v_svc.price_cents, v_set.tax_rate, v_set.tax_inclusive);
  v_total := v_svc.price_cents + v_tip + case when v_set.tax_inclusive then 0 else v_tax end;
  insert into sales (salon_id, client_id, staff_id, subtotal_cents, tip_cents, tax_rate, tax_inclusive, tax_cents, total_cents)
  values (v_salon, v_client, v_staff, v_svc.price_cents, v_tip, v_set.tax_rate, v_set.tax_inclusive, v_tax, v_total) returning id into v_sale;
  insert into sale_items (sale_id, service_id, label, qty, price_cents) values (v_sale, v_svc.id, v_svc.name, 1, v_svc.price_cents);
  return v_sale;
end $function$;
