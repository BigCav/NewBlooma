-- Also offer a start right after each booking or block ends, so a gap that does not line up with the 15 minute grid
-- (for example after a 25 minute trim) can still be filled instead of being lost.
create or replace function public.available_slots(p_salon uuid, p_service_ids uuid[], p_staff uuid, p_from date, p_to date, p_mode text default 'public', p_step integer default 15)
returns table(staff_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $function$
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
    where (select count(*) from service_staff ss where ss.staff_id = st.id and ss.service_id = any(p_service_ids)) = (select count(*) from services xs where xs.id = any(p_service_ids) and not xs.is_addon)
  ), slots as (
    select c.sid, (g.local_ts at time zone v_tz) as s
    from cand c,
         lateral generate_series(c.d::timestamp + c.ws, c.d::timestamp + c.we - make_interval(mins => v_dur), make_interval(mins => p_step)) as g(local_ts)
    union
    select c.sid, (e.ts at time zone v_tz) as s
    from cand c
    cross join lateral (
      select (b.ends_at at time zone v_tz) as ts from bookings b
        where b.staff_id = c.sid and b.status not in ('cancelled', 'no_show') and b.ends_at >= (c.d::timestamp at time zone v_tz) and b.ends_at < ((c.d + 1)::timestamp at time zone v_tz)
      union
      select (k.ends_at at time zone v_tz) from staff_blocks k
        where k.staff_id = c.sid and k.ends_at >= (c.d::timestamp at time zone v_tz) and k.ends_at < ((c.d + 1)::timestamp at time zone v_tz)
    ) e
    where e.ts >= c.d::timestamp + c.ws and e.ts <= c.d::timestamp + c.we - make_interval(mins => v_dur)
  )
  select sl.sid, sl.s, sl.s + make_interval(mins => v_dur)
  from slots sl
  where (p_mode = 'public' and sl.s >= now() + v_notice and sl.s < now() + v_window or p_mode <> 'public' and sl.s >= now())
    and not exists (select 1 from bookings b where b.staff_id = sl.sid and b.status not in ('cancelled', 'no_show')
                    and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(sl.s, sl.s + make_interval(mins => v_dur), '[)'))
    and not exists (select 1 from staff_blocks k where k.staff_id = sl.sid
                    and tstzrange(k.starts_at, k.ends_at, '[)') && tstzrange(sl.s, sl.s + make_interval(mins => v_dur), '[)'))
  order by sl.s, sl.sid;
end $function$;

create or replace function public.available_slots_excluding(p_salon uuid, p_service_ids uuid[], p_staff uuid, p_from date, p_to date, p_mode text, p_step integer, p_exclude uuid)
returns table(staff_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $function$
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
    where (select count(*) from service_staff ss where ss.staff_id = st.id and ss.service_id = any(p_service_ids)) = (select count(*) from services xs where xs.id = any(p_service_ids) and not xs.is_addon)
  ), slots as (
    select c.sid, (g.local_ts at time zone v_tz) as s
    from cand c,
         lateral generate_series(c.d::timestamp + c.ws, c.d::timestamp + c.we - make_interval(mins => v_dur), make_interval(mins => p_step)) as g(local_ts)
    union
    select c.sid, (e.ts at time zone v_tz) as s
    from cand c
    cross join lateral (
      select (b.ends_at at time zone v_tz) as ts from bookings b
        where b.staff_id = c.sid and (p_exclude is null or b.id <> p_exclude) and b.status not in ('cancelled', 'no_show') and b.ends_at >= (c.d::timestamp at time zone v_tz) and b.ends_at < ((c.d + 1)::timestamp at time zone v_tz)
      union
      select (k.ends_at at time zone v_tz) from staff_blocks k
        where k.staff_id = c.sid and k.ends_at >= (c.d::timestamp at time zone v_tz) and k.ends_at < ((c.d + 1)::timestamp at time zone v_tz)
    ) e
    where e.ts >= c.d::timestamp + c.ws and e.ts <= c.d::timestamp + c.we - make_interval(mins => v_dur)
  )
  select sl.sid, sl.s, sl.s + make_interval(mins => v_dur)
  from slots sl
  where (p_mode = 'public' and sl.s >= now() + v_notice and sl.s < now() + v_window or p_mode <> 'public' and sl.s >= now())
    and not exists (select 1 from bookings b where b.staff_id = sl.sid and (p_exclude is null or b.id <> p_exclude) and b.status not in ('cancelled', 'no_show')
                    and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(sl.s, sl.s + make_interval(mins => v_dur), '[)'))
    and not exists (select 1 from staff_blocks k where k.staff_id = sl.sid
                    and tstzrange(k.starts_at, k.ends_at, '[)') && tstzrange(sl.s, sl.s + make_interval(mins => v_dur), '[)'))
  order by sl.s, sl.sid;
end $function$;
