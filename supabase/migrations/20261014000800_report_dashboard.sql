-- Reports screen: booked revenue, appointments, rebook rate, series, services, team utilisation, heat map, client mix.
create or replace function report_kpis(v_salon uuid, v_tz text, p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = public as $$
  with b as (
    select id, client_id, staff_id, starts_at, status from bookings
    where salon_id = v_salon and status not in ('cancelled', 'no_show')
      and starts_at >= p_from::timestamp at time zone v_tz and starts_at < (p_to + 1)::timestamp at time zone v_tz
  ), cc as (
    select client_id, max(starts_at) as last_at from b where status = 'completed' group by client_id
  )
  select jsonb_build_object(
    'revenue_cents', coalesce((select sum(bs.price_cents) from booking_services bs join b on b.id = bs.booking_id), 0)::bigint,
    'appts', (select count(*) from b),
    'rebook_total', (select count(*) from cc),
    'rebooked', (select count(*) from cc where exists (
        select 1 from bookings x where x.salon_id = v_salon and x.client_id = cc.client_id
          and x.status not in ('cancelled', 'no_show') and x.starts_at > cc.last_at)),
    'clients', (select count(distinct client_id) from b),
    'new_clients', (select count(distinct b.client_id) from b where not exists (
        select 1 from bookings x where x.salon_id = v_salon and x.client_id = b.client_id
          and x.status not in ('cancelled', 'no_show') and x.starts_at < p_from::timestamp at time zone v_tz))
  );
$$;

create or replace function report_dashboard(p_from date, p_to date, p_prev_from date, p_prev_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_salon uuid := current_salon_id(); v_tz text; v_start timestamptz; v_end timestamptz; res jsonb;
begin
  if v_salon is null or not is_owner() then raise exception 'forbidden' using errcode = '42501'; end if;
  select timezone into v_tz from salons where id = v_salon;
  v_start := p_from::timestamp at time zone v_tz;
  v_end := (p_to + 1)::timestamp at time zone v_tz;
  select jsonb_build_object(
    'cur', report_kpis(v_salon, v_tz, p_from, p_to),
    'prev', report_kpis(v_salon, v_tz, p_prev_from, p_prev_to),
    'by_day', coalesce((select jsonb_agg(x order by x.d) from (
        select ((b.starts_at at time zone v_tz)::date)::text as d, sum(bs.price_cents)::bigint as cents
        from bookings b join booking_services bs on bs.booking_id = b.id
        where b.salon_id = v_salon and b.status not in ('cancelled', 'no_show') and b.starts_at >= v_start and b.starts_at < v_end
        group by 1) x), '[]'::jsonb),
    'by_hour', coalesce((select jsonb_agg(x order by x.hour) from (
        select extract(hour from (b.starts_at at time zone v_tz))::int as hour, sum(bs.price_cents)::bigint as cents
        from bookings b join booking_services bs on bs.booking_id = b.id
        where b.salon_id = v_salon and b.status not in ('cancelled', 'no_show') and b.starts_at >= v_start and b.starts_at < v_end
        group by 1) x), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(x order by x.cents desc) from (
        select s.name, count(distinct b.id)::int as count, sum(bs.price_cents)::bigint as cents
        from bookings b join booking_services bs on bs.booking_id = b.id join services s on s.id = bs.service_id
        where b.salon_id = v_salon and b.status not in ('cancelled', 'no_show') and b.starts_at >= v_start and b.starts_at < v_end
        group by s.id, s.name order by sum(bs.price_cents) desc limit 5) x), '[]'::jsonb),
    'team', coalesce((select jsonb_agg(x order by x.cents desc, x.name) from (
        select st.name,
          coalesce((select sum(bs.price_cents) from bookings b join booking_services bs on bs.booking_id = b.id
                    where b.staff_id = st.id and b.status not in ('cancelled', 'no_show') and b.starts_at >= v_start and b.starts_at < v_end), 0)::bigint as cents,
          coalesce((select sum(extract(epoch from (b.ends_at - b.starts_at)) / 60) from bookings b
                    where b.staff_id = st.id and b.status not in ('cancelled', 'no_show') and b.starts_at >= v_start and b.starts_at < v_end), 0)::int as booked_min,
          coalesce((select sum(extract(epoch from (sh.end_time - sh.start_time)) / 60) from generate_series(p_from, p_to, interval '1 day') g(d)
                    join staff_shifts sh on sh.staff_id = st.id and sh.weekday = extract(isodow from g.d)::int - 1), 0)::int as avail_min
        from staff st where st.salon_id = v_salon and st.active) x), '[]'::jsonb),
    'heat', coalesce((select jsonb_agg(jsonb_build_object('wd', a.wd, 'band', a.i, 'avail', a.m, 'booked', coalesce(k.m, 0)))
      from (
        select dy.wd, bd.i, sum(greatest(0, least(extract(hour from sh.end_time) * 60 + extract(minute from sh.end_time), bd.hi)
                                        - greatest(extract(hour from sh.start_time) * 60 + extract(minute from sh.start_time), bd.lo)))::int as m
        from (select extract(isodow from g.d)::int - 1 as wd from generate_series(p_to - 55, p_to, interval '1 day') g(d)) dy
        join staff_shifts sh on sh.weekday = dy.wd
        join staff st on st.id = sh.staff_id and st.active and st.salon_id = v_salon
        cross join (values (0, 0, 720), (1, 720, 900), (2, 900, 1440)) bd(i, lo, hi)
        group by dy.wd, bd.i) a
      left join (
        select t.wd, bd.i, sum(greatest(0, least(t.e, bd.hi) - greatest(t.s, bd.lo)))::int as m
        from (select extract(isodow from (b.starts_at at time zone v_tz))::int - 1 as wd,
                     extract(hour from (b.starts_at at time zone v_tz)) * 60 + extract(minute from (b.starts_at at time zone v_tz)) as s,
                     extract(hour from (b.starts_at at time zone v_tz)) * 60 + extract(minute from (b.starts_at at time zone v_tz)) + extract(epoch from (b.ends_at - b.starts_at)) / 60 as e
              from bookings b
              where b.salon_id = v_salon and b.status not in ('cancelled', 'no_show')
                and b.starts_at >= (p_to - 55)::timestamp at time zone v_tz and b.starts_at < v_end) t
        cross join (values (0, 0, 720), (1, 720, 900), (2, 900, 1440)) bd(i, lo, hi)
        group by t.wd, bd.i) k on k.wd = a.wd and k.i = a.i), '[]'::jsonb)
  ) into res;
  return res;
end $$;

revoke execute on function report_kpis(uuid, text, date, date) from public, anon, authenticated;
revoke execute on function report_dashboard(date, date, date, date) from public, anon, authenticated;
grant execute on function report_dashboard(date, date, date, date) to authenticated;
