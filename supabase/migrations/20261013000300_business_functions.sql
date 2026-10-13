-- Business rules live here so every client (web, mobile, API) gets identical behaviour.

-- True only for the server (service role JWT) or a direct admin SQL session. Never inspects current_user,
-- because inside SECURITY DEFINER functions that is always the function owner.
create or replace function is_service() returns boolean
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
      or session_user in ('postgres', 'supabase_admin', 'service_role')
$$;

create or replace function assert_salon_access(p_salon uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_service() and p_salon is distinct from current_salon_id() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create or replace function audit(p_salon uuid, p_action text, p_entity text, p_entity_id uuid, p_detail jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into audit_log (salon_id, actor_id, action, entity, entity_id, detail)
  values (p_salon, auth.uid(), p_action, p_entity, p_entity_id, p_detail)
$$;

-- Tax portion of a subtotal. $100 at 15% inclusive -> 1304 cents; exclusive -> 1500 cents.
create or replace function calc_tax_cents(subtotal int, rate numeric, inclusive boolean) returns int
language sql immutable as $$
  select case when inclusive then round(subtotal * rate / (100 + rate))::int
              else round(subtotal * rate / 100)::int end
$$;

-- ---------- Onboarding ----------
create or replace function create_salon(
  p_name text, p_slug text, p_phone text, p_email text, p_address text,
  p_timezone text, p_currency text, p_hours jsonb, p_owner_name text, p_owner_title text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_salon uuid; v_staff uuid; h jsonb;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if exists (select 1 from staff where user_id = auth.uid()) then raise exception 'already_has_salon'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then raise exception 'invalid_timezone'; end if;
  if jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) <> 7 then raise exception 'hours_must_have_7_days'; end if;

  insert into salons (slug, name, phone, email, address, timezone, currency)
  values (lower(trim(p_slug)), trim(p_name), nullif(trim(p_phone), ''), nullif(trim(p_email), ''), nullif(trim(p_address), ''), p_timezone, upper(p_currency))
  returning id into v_salon;

  insert into salon_settings (salon_id) values (v_salon);
  insert into salon_payment_settings (salon_id) values (v_salon);

  for h in select * from jsonb_array_elements(p_hours) loop
    insert into opening_hours (salon_id, weekday, is_open, open_time, close_time)
    values (v_salon, (h ->> 'weekday')::smallint, (h ->> 'is_open')::boolean, (h ->> 'open')::time, (h ->> 'close')::time);
  end loop;

  insert into staff (salon_id, user_id, name, role_title, app_role)
  values (v_salon, auth.uid(), trim(p_owner_name), trim(p_owner_title), 'owner')
  returning id into v_staff;

  insert into staff_shifts (staff_id, weekday, start_time, end_time)
  select v_staff, weekday, open_time, close_time from opening_hours where salon_id = v_salon and is_open;

  perform audit(v_salon, 'create', 'salon', v_salon);
  return v_salon;
end $$;

-- ---------- Availability ----------
-- p_mode: 'public' = online rules apply (online flag, notice, window); 'staff' / 'offer' = only real constraints.
create or replace function available_slots(
  p_salon uuid, p_service_ids uuid[], p_staff uuid, p_from date, p_to date,
  p_mode text default 'public', p_step int default 15
) returns table (staff_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_tz text; v_dur int; v_n int; v_set salon_settings; v_notice interval; v_window interval;
begin
  perform assert_salon_access(p_salon);
  if p_to < p_from or p_to - p_from > 62 then raise exception 'invalid_range'; end if;
  select timezone into v_tz from salons where id = p_salon;
  select count(*), coalesce(sum(duration_min), 0) into v_n, v_dur
    from services where id = any(p_service_ids) and salon_id = p_salon and active and (p_mode <> 'public' or online_bookable);
  if v_n = 0 or v_n <> cardinality(p_service_ids) then return; end if;
  select * into v_set from salon_settings where salon_id = p_salon;
  if p_mode = 'public' and not v_set.online_booking then return; end if;
  v_notice := case v_set.min_notice when 'none' then interval '0' when '1h' then interval '1 hour' when '2h' then interval '2 hours' else interval '24 hours' end;
  v_window := (case v_set.booking_window when '1w' then 7 when '2w' then 14 when '4w' then 28 else 56 end) * interval '1 day';

  return query
  with cand as (
    select st.id as sid, dd::date as d,
           greatest(h.open_time, sh.start_time) as ws, least(h.close_time, sh.end_time) as we
    from generate_series(p_from, p_to, interval '1 day') dd
    join opening_hours h on h.salon_id = p_salon and h.is_open and h.weekday = extract(isodow from dd)::int - 1
    join staff st on st.salon_id = p_salon and st.active and (p_staff is null or st.id = p_staff)
                 and (p_mode <> 'public' or st.online_bookable)
    join staff_shifts sh on sh.staff_id = st.id and sh.weekday = h.weekday
    where (select count(*) from service_staff ss where ss.staff_id = st.id and ss.service_id = any(p_service_ids)) = v_n
  ), slots as (
    select c.sid, (g.local_ts at time zone v_tz) as s
    from cand c,
         lateral generate_series(c.d::timestamp + c.ws, c.d::timestamp + c.we - make_interval(mins => v_dur), make_interval(mins => p_step)) as g(local_ts)
  )
  select sl.sid, sl.s, sl.s + make_interval(mins => v_dur)
  from slots sl
  where (p_mode = 'public' and sl.s >= now() + v_notice and sl.s < now() + v_window or p_mode <> 'public' and sl.s >= now())
    and not exists (select 1 from bookings b where b.staff_id = sl.sid and b.status not in ('cancelled', 'no_show')
                    and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(sl.s, sl.s + make_interval(mins => v_dur), '[)'))
    and not exists (select 1 from staff_blocks k where k.staff_id = sl.sid
                    and tstzrange(k.starts_at, k.ends_at, '[)') && tstzrange(sl.s, sl.s + make_interval(mins => v_dur), '[)'))
  order by sl.s, sl.sid;
end $$;

-- ---------- Bookings ----------
-- p_mode: 'staff' (staff override, no availability check), 'public' (full online rules), 'offer' (waitlist accept).
create or replace function create_booking(
  p_salon uuid, p_client uuid, p_staff uuid, p_starts_at timestamptz, p_service_ids uuid[],
  p_source booking_source default 'staff', p_notes text default null, p_mode text default 'staff'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tz text; v_dur int; v_n int; v_set salon_settings; v_id uuid; v_status booking_status; v_email text; v_day date;
begin
  perform assert_salon_access(p_salon);
  if not exists (select 1 from clients where id = p_client and salon_id = p_salon) then raise exception 'client_not_found'; end if;
  if not exists (select 1 from staff where id = p_staff and salon_id = p_salon and active) then raise exception 'staff_not_found'; end if;
  select count(*), coalesce(sum(duration_min), 0) into v_n, v_dur from services where id = any(p_service_ids) and salon_id = p_salon and active;
  if v_n = 0 or v_n <> cardinality(p_service_ids) then raise exception 'service_not_found'; end if;
  if (select count(*) from service_staff where staff_id = p_staff and service_id = any(p_service_ids)) <> v_n then
    raise exception 'staff_cannot_perform';
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
    values (p_salon, case when v_status = 'pending' then 'request' else 'booking' end, p_client, v_id, null);
  end if;

  select email into v_email from clients where id = p_client;
  if v_email is not null and v_set.email_confirmations and v_status = 'confirmed' then
    insert into notifications_outbox (salon_id, booking_id, channel, to_address, template)
    values (p_salon, v_id, 'email', v_email, 'booking_confirmation') on conflict do nothing;
  end if;
  return v_id;
end $$;

-- Staff approve a pending online request.
create or replace function confirm_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings; v_email text; v_set salon_settings;
begin
  select * into b from bookings where id = p_booking for update;
  if b.id is null then raise exception 'booking_not_found'; end if;
  perform assert_salon_access(b.salon_id);
  if b.status <> 'pending' then raise exception 'booking_not_pending'; end if;
  update bookings set status = 'confirmed' where id = b.id;
  update inbox_items set status = 'handled', unread = false where booking_id = b.id and type = 'request';
  select * into v_set from salon_settings where salon_id = b.salon_id;
  select email into v_email from clients where id = b.client_id;
  if v_email is not null and v_set.email_confirmations then
    insert into notifications_outbox (salon_id, booking_id, channel, to_address, template)
    values (b.salon_id, b.id, 'email', v_email, 'booking_confirmation') on conflict do nothing;
  end if;
end $$;

-- ---------- Sales ----------
create or replace function create_sale(p_booking uuid, p_client uuid, p_items jsonb default '[]', p_tip_pct int default 0, p_description text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_salon uuid := current_salon_id(); b bookings; v_set salon_settings; v_sale uuid; v_svc int := 0; v_prod int := 0;
  v_sub int; v_tip int; v_tax int; v_total int; it jsonb; pr products; v_qty int; v_client uuid := p_client;
begin
  if v_salon is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_tip_pct < 0 or p_tip_pct > 100 then raise exception 'invalid_tip'; end if;
  select * into v_set from salon_settings where salon_id = v_salon;

  if p_booking is not null then
    select * into b from bookings where id = p_booking and salon_id = v_salon;
    if b.id is null then raise exception 'booking_not_found'; end if;
    if b.status in ('cancelled', 'no_show') then raise exception 'booking_not_billable'; end if;
    select id into v_sale from sales where booking_id = p_booking and status <> 'refunded';
    if v_sale is not null then raise exception 'sale_already_exists'; end if;
    select coalesce(sum(price_cents), 0) into v_svc from booking_services where booking_id = p_booking;
    v_client := b.client_id;
  end if;

  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_qty := (it ->> 'qty')::int;
    select * into pr from products where id = (it ->> 'product_id')::uuid and salon_id = v_salon and active;
    if pr.id is null or v_qty is null or v_qty < 1 then raise exception 'invalid_product'; end if;
    v_prod := v_prod + pr.price_cents * v_qty;
  end loop;

  v_sub := v_svc + v_prod;
  if v_sub = 0 then raise exception 'empty_sale'; end if;
  v_tip := case when v_set.ask_for_tip then round(v_svc * p_tip_pct / 100.0)::int else 0 end;
  v_tax := calc_tax_cents(v_sub, v_set.tax_rate, v_set.tax_inclusive);
  v_total := v_sub + v_tip + case when v_set.tax_inclusive then 0 else v_tax end;

  insert into sales (salon_id, booking_id, client_id, staff_id, description, subtotal_cents, tip_cents, tax_rate, tax_inclusive, tax_cents, total_cents)
  values (v_salon, p_booking, v_client, b.staff_id, nullif(trim(p_description), ''), v_sub, v_tip, v_set.tax_rate, v_set.tax_inclusive, v_tax, v_total)
  returning id into v_sale;

  if p_booking is not null then
    insert into sale_items (sale_id, service_id, label, qty, price_cents)
    select v_sale, bs.service_id, s.name, 1, bs.price_cents from booking_services bs join services s on s.id = bs.service_id where bs.booking_id = p_booking;
  end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into pr from products where id = (it ->> 'product_id')::uuid;
    insert into sale_items (sale_id, product_id, label, qty, price_cents) values (v_sale, pr.id, pr.name, (it ->> 'qty')::int, pr.price_cents);
  end loop;
  return v_sale;
end $$;

create or replace function void_pending_sale(p_sale uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s sales;
begin
  select * into s from sales where id = p_sale for update;
  if s.id is null then raise exception 'sale_not_found'; end if;
  perform assert_salon_access(s.salon_id);
  if s.status <> 'pending' then raise exception 'sale_not_pending'; end if;
  if exists (select 1 from card_payments where sale_id = s.id and status in ('approved', 'pending')) then raise exception 'card_payment_in_progress'; end if;
  delete from sales where id = s.id;
end $$;

create or replace function finalize_sale(p_sale uuid, p_method pay_method) returns void
language plpgsql security definer set search_path = public as $$
declare s sales; it sale_items;
begin
  select * into s from sales where id = p_sale for update;
  if s.id is null then raise exception 'sale_not_found'; end if;
  if s.status = 'paid' then return; end if;
  if s.status <> 'pending' then raise exception 'sale_not_pending'; end if;
  update sales set status = 'paid', method = p_method, paid_at = now() where id = s.id;
  for it in select * from sale_items where sale_id = s.id and product_id is not null loop
    update products set stock = stock - it.qty where id = it.product_id;
  end loop;
  if s.booking_id is not null then update bookings set status = 'completed' where id = s.booking_id and status <> 'cancelled'; end if;
  perform audit(s.salon_id, 'paid', 'sale', s.id, jsonb_build_object('method', p_method, 'total_cents', s.total_cents));
end $$;

create or replace function complete_sale(p_sale uuid, p_method pay_method, p_gift_code text default null) returns void
language plpgsql security definer set search_path = public as $$
declare s sales; v_set salon_settings; g gift_cards;
begin
  select * into s from sales where id = p_sale for update;
  if s.id is null then raise exception 'sale_not_found'; end if;
  perform assert_salon_access(s.salon_id);
  if s.status <> 'pending' then raise exception 'sale_not_pending'; end if;
  select * into v_set from salon_settings where salon_id = s.salon_id;
  if p_method = 'card' then raise exception 'card_must_use_provider'; end if;
  if p_method = 'cash' and not v_set.accept_cash then raise exception 'method_disabled'; end if;
  if p_method = 'gift_card' then
    if not v_set.accept_gift_cards then raise exception 'method_disabled'; end if;
    select * into g from gift_cards where salon_id = s.salon_id and code = trim(p_gift_code) for update;
    if g.id is null then raise exception 'gift_card_not_found'; end if;
    if g.balance_cents < s.total_cents then raise exception 'gift_card_insufficient'; end if;
    update gift_cards set balance_cents = balance_cents - s.total_cents where id = g.id;
    update sales set gift_card_id = g.id where id = s.id;
  end if;
  perform finalize_sale(s.id, p_method);
end $$;

create or replace function refund_sale_internal(p_sale uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s sales; it sale_items;
begin
  select * into s from sales where id = p_sale for update;
  if s.id is null then raise exception 'sale_not_found'; end if;
  if s.status <> 'paid' then raise exception 'sale_not_paid'; end if;
  if s.gift_card_id is not null then update gift_cards set balance_cents = balance_cents + s.total_cents where id = s.gift_card_id; end if;
  for it in select * from sale_items where sale_id = s.id and product_id is not null loop
    update products set stock = stock + it.qty where id = it.product_id;
  end loop;
  update sales set status = 'refunded', refunded_at = now() where id = s.id;
  perform audit(s.salon_id, 'refunded', 'sale', s.id, jsonb_build_object('total_cents', s.total_cents));
end $$;

-- Cash and gift-card refunds, owner only. Card refunds go through the payment provider route.
create or replace function refund_sale(p_sale uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s sales;
begin
  select * into s from sales where id = p_sale;
  if s.id is null then raise exception 'sale_not_found'; end if;
  perform assert_salon_access(s.salon_id);
  if not is_service() and not is_owner() then raise exception 'owner_only' using errcode = '42501'; end if;
  if s.method = 'card' and not is_service() then raise exception 'card_refund_via_provider'; end if;
  perform refund_sale_internal(p_sale);
end $$;

-- ---------- Waitlist ----------
create or replace function waitlist_matches(p_entry uuid) returns table (staff_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare e waitlist_entries; v_tz text;
begin
  select * into e from waitlist_entries where id = p_entry;
  if e.id is null then raise exception 'entry_not_found'; end if;
  perform assert_salon_access(e.salon_id);
  select timezone into v_tz from salons where id = e.salon_id;
  return query
  select a.staff_id, a.starts_at, a.ends_at
  from available_slots(e.salon_id, array[e.service_id], e.staff_id, (now() at time zone v_tz)::date, (now() at time zone v_tz)::date + 13, 'offer') a
  where (extract(isodow from (a.starts_at at time zone v_tz))::int - 1) = any(e.weekdays)
    and (e.earliest_time is null or (a.starts_at at time zone v_tz)::time >= e.earliest_time)
    and (e.latest_time is null or (a.ends_at at time zone v_tz)::time <= e.latest_time);
end $$;

create or replace function offer_waitlist_slot(p_entry uuid, p_staff uuid, p_start timestamptz, p_hold_minutes int default 240) returns text
language plpgsql security definer set search_path = public as $$
declare e waitlist_entries; v_token text; v_email text; v_phone text;
begin
  select * into e from waitlist_entries where id = p_entry for update;
  if e.id is null then raise exception 'entry_not_found'; end if;
  perform assert_salon_access(e.salon_id);
  if e.status <> 'waiting' then raise exception 'entry_not_waiting'; end if;
  if not exists (select 1 from waitlist_matches(p_entry) m where m.staff_id = p_staff and m.starts_at = p_start) then raise exception 'slot_unavailable'; end if;
  select email, phone into v_email, v_phone from clients where id = e.client_id;
  if v_email is null and v_phone is null then raise exception 'client_unreachable'; end if;

  update waitlist_entries set status = 'offered', offered_staff_id = p_staff, offered_start = p_start,
         offer_expires_at = least(now() + make_interval(mins => p_hold_minutes), p_start) where id = e.id;
  insert into booking_tokens (salon_id, purpose, waitlist_id, expires_at)
  values (e.salon_id, 'accept_offer', e.id, least(now() + make_interval(mins => p_hold_minutes), p_start))
  returning token into v_token;
  if v_email is not null then
    insert into notifications_outbox (salon_id, channel, to_address, template, payload)
    values (e.salon_id, 'email', v_email, 'waitlist_offer', jsonb_build_object('token', v_token, 'starts_at', p_start));
  end if;
  if v_phone is not null then
    insert into notifications_outbox (salon_id, channel, to_address, template, payload)
    values (e.salon_id, 'sms', v_phone, 'waitlist_offer', jsonb_build_object('token', v_token, 'starts_at', p_start));
  end if;
  return v_token;
end $$;

-- Called by the server (service role) when the client taps the link in their offer.
create or replace function accept_offer(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare t booking_tokens; e waitlist_entries; v_booking uuid;
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into t from booking_tokens where token = p_token and purpose = 'accept_offer' for update;
  if t.token is null or t.used_at is not null or t.expires_at < now() then raise exception 'offer_expired'; end if;
  select * into e from waitlist_entries where id = t.waitlist_id for update;
  if e.status <> 'offered' then raise exception 'offer_expired'; end if;
  begin
    v_booking := create_booking(e.salon_id, e.client_id, e.offered_staff_id, e.offered_start, array[e.service_id], 'waitlist', null, 'offer');
  exception when others then
    update waitlist_entries set status = 'waiting', offered_staff_id = null, offered_start = null, offer_expires_at = null where id = e.id;
    update booking_tokens set used_at = now() where token = p_token;
    raise exception 'slot_unavailable';
  end;
  update waitlist_entries set status = 'booked', booking_id = v_booking where id = e.id;
  update booking_tokens set used_at = now() where token = p_token;
  return v_booking;
end $$;

create or replace function expire_offers() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  update booking_tokens set used_at = now() where purpose = 'accept_offer' and used_at is null and expires_at < now();
  with x as (
    update waitlist_entries set status = 'waiting', offered_staff_id = null, offered_start = null, offer_expires_at = null
    where status = 'offered' and offer_expires_at < now() returning 1)
  select count(*) into n from x;
  return n;
end $$;

-- ---------- Client self-service (service role, token based) ----------
create or replace function client_cancel(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t booking_tokens; b bookings; v_set salon_settings; v_cut interval; v_late boolean;
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into t from booking_tokens where token = p_token and purpose = 'manage_booking';
  if t.token is null or t.expires_at < now() then raise exception 'link_expired'; end if;
  select * into b from bookings where id = t.booking_id for update;
  if b.status not in ('pending', 'confirmed') or b.starts_at <= now() then raise exception 'not_cancellable'; end if;
  select * into v_set from salon_settings where salon_id = b.salon_id;
  v_cut := case v_set.free_cancel_before when '2h' then interval '2 hours' when '24h' then interval '24 hours' else interval '48 hours' end;
  v_late := b.starts_at - v_cut < now();
  update bookings set status = 'cancelled', cancelled_at = now(), cancelled_late = v_late where id = b.id;
  insert into inbox_items (salon_id, type, client_id, booking_id) values (b.salon_id, 'cancellation', b.client_id, b.id);
  return jsonb_build_object('late', v_late, 'starts_at', b.starts_at);
end $$;

create or replace function client_request_reschedule(p_token text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare t booking_tokens; b bookings;
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into t from booking_tokens where token = p_token and purpose = 'manage_booking';
  if t.token is null or t.expires_at < now() then raise exception 'link_expired'; end if;
  select * into b from bookings where id = t.booking_id;
  if b.status not in ('pending', 'confirmed') or b.starts_at <= now() then raise exception 'not_reschedulable'; end if;
  insert into inbox_items (salon_id, type, client_id, booking_id, body) values (b.salon_id, 'reschedule', b.client_id, b.id, nullif(trim(p_body), ''));
end $$;

create or replace function request_reviews() returns int
language plpgsql security definer set search_path = public as $$
declare v_salon uuid := current_salon_id(); b record; n int := 0; v_tok text;
begin
  if v_salon is null then raise exception 'forbidden' using errcode = '42501'; end if;
  for b in
    select bk.id, c.email from bookings bk join clients c on c.id = bk.client_id
    where bk.salon_id = v_salon and bk.status = 'completed' and bk.ends_at > now() - interval '14 days' and c.email is not null
      and not exists (select 1 from reviews r where r.booking_id = bk.id)
      and not exists (select 1 from booking_tokens t where t.booking_id = bk.id and t.purpose = 'review')
  loop
    insert into booking_tokens (salon_id, purpose, booking_id, expires_at) values (v_salon, 'review', b.id, now() + interval '30 days') returning token into v_tok;
    insert into notifications_outbox (salon_id, booking_id, channel, to_address, template, payload)
    values (v_salon, b.id, 'email', b.email, 'review_request', jsonb_build_object('token', v_tok)) on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function submit_review(p_token text, p_stars int, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare t booking_tokens; b bookings;
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into t from booking_tokens where token = p_token and purpose = 'review' for update;
  if t.token is null or t.used_at is not null or t.expires_at < now() then raise exception 'link_expired'; end if;
  select * into b from bookings where id = t.booking_id;
  if b.status <> 'completed' then raise exception 'not_completed'; end if;
  insert into reviews (salon_id, booking_id, client_id, staff_id, stars, body) values (b.salon_id, b.id, b.client_id, b.staff_id, p_stars, p_body);
  update booking_tokens set used_at = now() where token = p_token;
end $$;

-- ---------- Reminders (run from a scheduler) ----------
create or replace function enqueue_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; c int;
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into notifications_outbox (salon_id, booking_id, channel, to_address, template)
  select b.salon_id, b.id, 'email', cl.email, 'reminder_24h'
  from bookings b join clients cl on cl.id = b.client_id join salon_settings s on s.salon_id = b.salon_id
  where s.remind_24h and cl.email is not null and b.status = 'confirmed'
    and b.starts_at > now() and b.starts_at <= now() + interval '24 hours' and b.created_at < b.starts_at - interval '24 hours'
  on conflict do nothing;
  get diagnostics c = row_count; n := n + c;
  insert into notifications_outbox (salon_id, booking_id, channel, to_address, template)
  select b.salon_id, b.id, 'sms', cl.phone, 'reminder_2h'
  from bookings b join clients cl on cl.id = b.client_id join salon_settings s on s.salon_id = b.salon_id
  where s.remind_2h and cl.phone is not null and b.status = 'confirmed'
    and b.starts_at > now() and b.starts_at <= now() + interval '2 hours' and b.created_at < b.starts_at - interval '2 hours'
  on conflict do nothing;
  get diagnostics c = row_count; n := n + c;
  return n;
end $$;

-- ---------- Team ----------
create or replace function create_staff_invite(p_staff uuid) returns text
language plpgsql security definer set search_path = public as $$
declare s staff; v_token text;
begin
  select * into s from staff where id = p_staff;
  if s.id is null then raise exception 'staff_not_found'; end if;
  perform assert_salon_access(s.salon_id);
  if not is_service() and not is_owner() then raise exception 'owner_only' using errcode = '42501'; end if;
  if s.user_id is not null then raise exception 'already_linked'; end if;
  insert into staff_invites (salon_id, staff_id) values (s.salon_id, s.id) returning token into v_token;
  return v_token;
end $$;

create or replace function accept_staff_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare i staff_invites;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if exists (select 1 from staff where user_id = auth.uid()) then raise exception 'already_has_salon'; end if;
  select * into i from staff_invites where token = p_token for update;
  if i.token is null or i.accepted_at is not null or i.expires_at < now() then raise exception 'invite_expired'; end if;
  update staff set user_id = auth.uid() where id = i.staff_id and user_id is null;
  if not found then raise exception 'invite_expired'; end if;
  update staff_invites set accepted_at = now() where token = p_token;
  return i.salon_id;
end $$;

-- ---------- Payroll ----------
-- Commission = commission % x service subtotal of paid sales (excludes tips, tax, products).
create or replace function payroll_summary(p_from date, p_to date)
returns table (staff_id uuid, staff_name text, hours numeric, service_subtotal_cents bigint, commission_pct numeric, commission_cents bigint, paid_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_salon uuid := current_salon_id(); v_tz text; v_start timestamptz; v_end timestamptz;
begin
  if v_salon is null or not is_owner() then raise exception 'owner_only' using errcode = '42501'; end if;
  select timezone into v_tz from salons where id = v_salon;
  v_start := p_from::timestamp at time zone v_tz;
  v_end := (p_to + 1)::timestamp at time zone v_tz;
  return query
  select st.id, st.name,
    coalesce((select round(sum(extract(epoch from (least(coalesce(t.clock_out, now()), v_end) - greatest(t.clock_in, v_start))) / 3600.0), 2)
              from timesheets t where t.staff_id = st.id and t.clock_in < v_end and coalesce(t.clock_out, now()) > v_start), 0)::numeric,
    base.cents,
    coalesce(po.commission_pct, st.commission_pct)::numeric,
    coalesce(po.commission_cents::bigint, round(base.cents * st.commission_pct / 100.0)::bigint),
    po.paid_at
  from staff st
  left join payouts po on po.staff_id = st.id and po.period_start = p_from and po.period_end = p_to
  cross join lateral (
    select coalesce(sum(si.price_cents::bigint * si.qty), 0)::bigint as cents
    from sale_items si join sales s on s.id = si.sale_id
    where s.staff_id = st.id and s.status = 'paid' and s.paid_at >= v_start and s.paid_at < v_end and si.service_id is not null
  ) base
  where st.salon_id = v_salon and (st.active or po.id is not null)
  order by st.name;
end $$;

create or replace function mark_payout_paid(p_staff uuid, p_from date, p_to date) returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_salon uuid := current_salon_id();
begin
  if v_salon is null or not is_owner() then raise exception 'owner_only' using errcode = '42501'; end if;
  select * into r from payroll_summary(p_from, p_to) where staff_id = p_staff;
  if r.staff_id is null then raise exception 'staff_not_found'; end if;
  if r.paid_at is not null then raise exception 'already_paid'; end if;
  insert into payouts (salon_id, staff_id, period_start, period_end, hours, commission_pct, commission_cents)
  values (v_salon, p_staff, p_from, p_to, r.hours, r.commission_pct, r.commission_cents);
  perform audit(v_salon, 'payout', 'staff', p_staff, jsonb_build_object('from', p_from, 'to', p_to, 'commission_cents', r.commission_cents));
end $$;

-- ---------- Reports ----------
create or replace function report_summary(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_salon uuid := current_salon_id(); v_tz text; v_start timestamptz; v_end timestamptz; res jsonb;
begin
  if v_salon is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select timezone into v_tz from salons where id = v_salon;
  v_start := p_from::timestamp at time zone v_tz;
  v_end := (p_to + 1)::timestamp at time zone v_tz;
  select jsonb_build_object(
    'revenue_cents', coalesce((select sum(total_cents) from sales where salon_id = v_salon and status = 'paid' and paid_at >= v_start and paid_at < v_end), 0),
    'net_cents', coalesce((select sum(subtotal_cents - case when tax_inclusive then tax_cents else 0 end) from sales where salon_id = v_salon and status = 'paid' and paid_at >= v_start and paid_at < v_end), 0),
    'tips_cents', coalesce((select sum(tip_cents) from sales where salon_id = v_salon and status = 'paid' and paid_at >= v_start and paid_at < v_end), 0),
    'sales_count', (select count(*) from sales where salon_id = v_salon and status = 'paid' and paid_at >= v_start and paid_at < v_end),
    'bookings_total', (select count(*) from bookings where salon_id = v_salon and starts_at >= v_start and starts_at < v_end),
    'bookings_completed', (select count(*) from bookings where salon_id = v_salon and status = 'completed' and starts_at >= v_start and starts_at < v_end),
    'bookings_cancelled', (select count(*) from bookings where salon_id = v_salon and status = 'cancelled' and starts_at >= v_start and starts_at < v_end),
    'bookings_no_show', (select count(*) from bookings where salon_id = v_salon and status = 'no_show' and starts_at >= v_start and starts_at < v_end),
    'new_clients', (select count(*) from clients where salon_id = v_salon and created_at >= v_start and created_at < v_end),
    'by_staff', coalesce((select jsonb_agg(x order by x.revenue_cents desc) from (
        select st.id as staff_id, st.name, coalesce(sum(s.total_cents), 0)::bigint as revenue_cents
        from staff st left join sales s on s.staff_id = st.id and s.status = 'paid' and s.paid_at >= v_start and s.paid_at < v_end
        where st.salon_id = v_salon group by st.id, st.name) x), '[]'::jsonb),
    'top_services', coalesce((select jsonb_agg(x order by x.revenue_cents desc) from (
        select si.label as name, sum(si.qty)::int as count, sum(si.price_cents::bigint * si.qty) as revenue_cents
        from sale_items si join sales s on s.id = si.sale_id
        where s.salon_id = v_salon and s.status = 'paid' and s.paid_at >= v_start and s.paid_at < v_end and si.service_id is not null
        group by si.label order by sum(si.price_cents::bigint * si.qty) desc limit 8) x), '[]'::jsonb),
    'by_hour', coalesce((select jsonb_agg(x order by x.hour) from (
        select extract(hour from (starts_at at time zone v_tz))::int as hour, count(*)::int as count
        from bookings where salon_id = v_salon and status not in ('cancelled', 'no_show') and starts_at >= v_start and starts_at < v_end
        group by 1) x), '[]'::jsonb)
  ) into res;
  return res;
end $$;

-- ---------- Function privileges ----------
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
grant execute on function
  create_salon(text, text, text, text, text, text, text, jsonb, text, text),
  available_slots(uuid, uuid[], uuid, date, date, text, int),
  create_booking(uuid, uuid, uuid, timestamptz, uuid[], booking_source, text, text),
  confirm_booking(uuid),
  create_sale(uuid, uuid, jsonb, int, text),
  void_pending_sale(uuid),
  complete_sale(uuid, pay_method, text),
  refund_sale(uuid),
  waitlist_matches(uuid),
  offer_waitlist_slot(uuid, uuid, timestamptz, int),
  request_reviews(),
  create_staff_invite(uuid),
  accept_staff_invite(text),
  payroll_summary(date, date),
  mark_payout_paid(uuid, date, date),
  report_summary(date, date),
  calc_tax_cents(int, numeric, boolean),
  current_salon_id(), current_staff_id(), is_owner()
to authenticated;

grant execute on all functions in schema public to service_role;
