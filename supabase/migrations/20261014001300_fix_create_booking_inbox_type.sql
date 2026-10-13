-- Online bookings failed: the CASE expression was text, not inbox_type.
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
    values (p_salon, (case when v_status = 'pending' then 'request' else 'booking' end)::inbox_type, p_client, v_id, null);
  end if;

  select email into v_email from clients where id = p_client;
  if v_email is not null and v_set.email_confirmations and v_status = 'confirmed' then
    insert into notifications_outbox (salon_id, booking_id, channel, to_address, template)
    values (p_salon, v_id, 'email', v_email, 'booking_confirmation') on conflict do nothing;
  end if;
  return v_id;
end $$;
