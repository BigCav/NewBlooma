-- One row per client with visit stats. Runs as the caller, so row level security limits it to their salon.
create or replace function client_overview()
returns table (
  id uuid, name text, email text, phone text, created_at timestamptz,
  visits int, spent_cents bigint, last_at timestamptz, last_service text,
  next_at timestamptz, next_status booking_status, usual_staff text
)
language sql stable security invoker set search_path = public as $$
  select c.id, c.name, c.email, c.phone, c.created_at,
         coalesce(v.n, 0)::int, coalesce(sp.t, 0)::bigint, v.last_at, ls.svc,
         nx.starts_at, nx.status, us.nm
  from clients c
  left join lateral (select count(*) n, max(b.starts_at) last_at from bookings b where b.client_id = c.id and b.status = 'completed') v on true
  left join lateral (select sum(s.total_cents) t from sales s where s.client_id = c.id and s.status = 'paid') sp on true
  left join lateral (
    select string_agg(sv.name, ' + ' order by sv.name) svc
    from booking_services bs join services sv on sv.id = bs.service_id
    where bs.booking_id = (select b.id from bookings b where b.client_id = c.id and b.status = 'completed' order by b.starts_at desc limit 1)
  ) ls on true
  left join lateral (
    select b.starts_at, b.status from bookings b
    where b.client_id = c.id and b.status in ('pending','confirmed','checked_in','in_progress') and b.ends_at > now()
    order by b.starts_at limit 1
  ) nx on true
  left join lateral (
    select st.name nm from bookings b join staff st on st.id = b.staff_id
    where b.client_id = c.id and b.status not in ('cancelled','no_show')
    group by st.name order by count(*) desc, st.name limit 1
  ) us on true
  order by c.name;
$$;
grant execute on function client_overview() to authenticated;
