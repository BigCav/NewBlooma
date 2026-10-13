-- Client self-service: move an appointment, and cancel with an optional reason.
-- available_slots_excluding is available_slots that ignores one booking (the one being moved).
create or replace function available_slots_excluding(
  p_salon uuid, p_service_ids uuid[], p_staff uuid, p_from date, p_to date,
  p_mode text, p_step int, p_exclude uuid
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
    and not exists (select 1 from bookings b where b.staff_id = sl.sid and (p_exclude is null or b.id <> p_exclude) and b.status not in ('cancelled', 'no_show')
                    and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(sl.s, sl.s + make_interval(mins => v_dur), '[)'))
    and not exists (select 1 from staff_blocks k where k.staff_id = sl.sid
                    and tstzrange(k.starts_at, k.ends_at, '[)') && tstzrange(sl.s, sl.s + make_interval(mins => v_dur), '[)'))
  order by sl.s, sl.sid;
end $$;

create or replace function client_reschedule(p_token text, p_starts_at timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t booking_tokens; b bookings; v_tz text; v_dur int; v_day date; v_old timestamptz; v_ids uuid[];
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into t from booking_tokens where token = p_token and purpose = 'manage_booking';
  if t.token is null or t.expires_at < now() then raise exception 'link_expired'; end if;
  select * into b from bookings where id = t.booking_id for update;
  if b.status not in ('pending', 'confirmed') or b.starts_at <= now() then raise exception 'not_reschedulable'; end if;
  select timezone into v_tz from salons where id = b.salon_id;
  select array_agg(service_id), coalesce(sum(duration_min), 0) into v_ids, v_dur from booking_services where booking_id = b.id;
  v_day := (p_starts_at at time zone v_tz)::date;
  if not exists (select 1 from available_slots_excluding(b.salon_id, v_ids, b.staff_id, v_day, v_day, 'public', 15, b.id) a where a.starts_at = p_starts_at) then
    raise exception 'slot_unavailable';
  end if;
  v_old := b.starts_at;
  update bookings set starts_at = p_starts_at, ends_at = p_starts_at + make_interval(mins => v_dur) where id = b.id;
  insert into inbox_items (salon_id, type, client_id, booking_id, body, status)
  values (b.salon_id, 'reschedule', b.client_id, b.id, 'Moved by the client from ' || to_char(v_old at time zone v_tz, 'Dy DD Mon HH24:MI') || ' to ' || to_char(p_starts_at at time zone v_tz, 'Dy DD Mon HH24:MI') || '.', 'handled');
  return jsonb_build_object('starts_at', p_starts_at, 'ends_at', p_starts_at + make_interval(mins => v_dur));
end $$;

create or replace function client_cancel(p_token text, p_reason text) returns jsonb
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
  insert into inbox_items (salon_id, type, client_id, booking_id, body)
  values (b.salon_id, 'cancellation', b.client_id, b.id, case when nullif(trim(p_reason), '') is null then null else 'Reason: ' || trim(p_reason) end);
  return jsonb_build_object('late', v_late, 'starts_at', b.starts_at);
end $$;

-- New overloads only: the original available_slots(...) and client_cancel(text) are left untouched.
grant execute on function available_slots_excluding(uuid, uuid[], uuid, date, date, text, int, uuid), client_reschedule(text, timestamptz), client_cancel(text, text) to service_role;
