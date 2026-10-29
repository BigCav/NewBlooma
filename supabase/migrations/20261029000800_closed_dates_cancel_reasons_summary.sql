-- 1. Closed dates (holidays, a break, a refit): days the salon is shut even though the weekly hours say open. No online or waitlist-offer
--    time is offered on them; existing bookings are left alone for the owner to move or cancel.
-- 2. Why a booking was cancelled (cancel_reason), recorded for staff cancellations and client cancellations from their link.
-- 3. Daily sales summary (takings, payment methods, tax, discounts, tips, refunds, team, cancellations) and a till cash-up per day.

create table if not exists closed_periods (
  id         uuid primary key default gen_random_uuid(),
  salon_id   uuid not null references salons(id) on delete cascade,
  starts_on  date not null,
  ends_on    date not null,
  reason     text check (reason is null or length(reason) <= 80),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 366)
);
create index if not exists closed_periods_idx on closed_periods (salon_id, starts_on, ends_on);
alter table closed_periods enable row level security;
grant select, insert, update, delete on closed_periods to authenticated;
create policy staff_read on closed_periods for select to authenticated using (salon_id = current_salon_id());
create policy owner_write on closed_periods for all to authenticated
  using (salon_id = current_salon_id() and is_owner()) with check (salon_id = current_salon_id() and is_owner());

alter table bookings add column if not exists cancel_reason text check (cancel_reason is null or length(cancel_reason) <= 200);

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
  update bookings set status = 'cancelled', cancelled_at = now(), cancelled_late = v_late, cancel_reason = 'Client cancelled' where id = b.id;
  insert into inbox_items (salon_id, type, client_id, booking_id, body)
  values (b.salon_id, 'cancellation', b.client_id, b.id, case when nullif(trim(p_reason), '') is null then null else 'Reason: ' || trim(p_reason) end);
  return jsonb_build_object('late', v_late, 'starts_at', b.starts_at);
end $$;

-- Cash that should be in the drawer for a window: cash taken less cash refunded. Used by the summary and the cash-up, never called by clients.
create or replace function cash_in_drawer(p_salon uuid, p_from timestamptz, p_to timestamptz) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(total_cents) from sales where salon_id = p_salon and method = 'cash' and status in ('paid', 'refunded') and paid_at >= p_from and paid_at < p_to), 0)::int
       - coalesce((select sum(total_cents) from sales where salon_id = p_salon and method = 'cash' and status = 'refunded' and refunded_at >= p_from and refunded_at < p_to), 0)::int
$$;
revoke all on function cash_in_drawer(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function cash_in_drawer(uuid, timestamptz, timestamptz) to service_role;

create table if not exists till_closes (
  id             uuid primary key default gen_random_uuid(),
  salon_id       uuid not null references salons(id) on delete cascade,
  day            date not null,
  expected_cents int not null,
  counted_cents  int not null check (counted_cents >= 0),
  note           text check (note is null or length(note) <= 300),
  closed_by      uuid references staff(id) on delete set null,
  closed_at      timestamptz not null default now(),
  unique (salon_id, day)
);
alter table till_closes enable row level security;
grant select on till_closes to authenticated;
create policy staff_read on till_closes for select to authenticated
  using (salon_id = current_salon_id() and exists (select 1 from staff s where s.user_id = auth.uid() and s.active and s.app_role <> 'stylist'));

create or replace function close_till(p_day date, p_counted integer, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_salon uuid := current_salon_id(); v_tz text; v_exp int; v_today date;
begin
  if v_salon is null or not exists (select 1 from staff where user_id = auth.uid() and active and app_role <> 'stylist') then raise exception 'forbidden' using errcode = '42501'; end if;
  select timezone into v_tz from salons where id = v_salon;
  v_today := (now() at time zone v_tz)::date;
  if p_day is null or p_day > v_today or p_day < v_today - 366 then raise exception 'invalid_day'; end if;
  if p_counted is null or p_counted < 0 or p_counted > 100000000 then raise exception 'invalid_amount'; end if;
  v_exp := cash_in_drawer(v_salon, p_day::timestamp at time zone v_tz, (p_day + 1)::timestamp at time zone v_tz);
  insert into till_closes (salon_id, day, expected_cents, counted_cents, note, closed_by)
  values (v_salon, p_day, v_exp, p_counted, nullif(left(trim(coalesce(p_note, '')), 300), ''), current_staff_id())
  on conflict (salon_id, day) do update set expected_cents = excluded.expected_cents, counted_cents = excluded.counted_cents, note = excluded.note, closed_by = excluded.closed_by, closed_at = now();
  return jsonb_build_object('expected', v_exp, 'counted', p_counted, 'difference', p_counted - v_exp);
end $$;
revoke all on function close_till(date, integer, text) from public, anon;
grant execute on function close_till(date, integer, text) to authenticated, service_role;

create or replace function sales_summary(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_salon uuid := current_salon_id(); v_tz text; v_a timestamptz; v_b timestamptz; r jsonb;
begin
  if v_salon is null or not exists (select 1 from staff where user_id = auth.uid() and active and app_role <> 'stylist') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then raise exception 'invalid_range'; end if;
  select timezone into v_tz from salons where id = v_salon;
  v_a := p_from::timestamp at time zone v_tz; v_b := (p_to + 1)::timestamp at time zone v_tz;
  with paid as (
    select * from sales where salon_id = v_salon and status in ('paid', 'refunded') and paid_at >= v_a and paid_at < v_b
  ), refunded as (
    select * from sales where salon_id = v_salon and status = 'refunded' and refunded_at >= v_a and refunded_at < v_b
  ), items as (
    select coalesce(sum(i.price_cents::bigint * i.qty) filter (where i.service_id is not null), 0) as services,
           coalesce(sum(i.price_cents::bigint * i.qty) filter (where i.product_id is not null), 0) as products
    from sale_items i join paid p on p.id = i.sale_id
  )
  select jsonb_build_object(
    'sales_count', (select count(*) from paid),
    'services_cents', (select services from items),
    'products_cents', (select products from items),
    'discount_cents', (select coalesce(sum(discount_cents), 0) from paid),
    'sales_cents', (select coalesce(sum(subtotal_cents), 0) from paid),
    'tips_cents', (select coalesce(sum(tip_cents), 0) from paid),
    'tax_cents', (select coalesce(sum(tax_cents), 0) from paid),
    'total_cents', (select coalesce(sum(total_cents), 0) from paid),
    'refund_count', (select count(*) from refunded),
    'refund_cents', (select coalesce(sum(total_cents), 0) from refunded),
    'by_method', (select coalesce(jsonb_agg(jsonb_build_object('method', m.method, 'count', m.n, 'cents', m.c, 'refund_cents', coalesce(rf.c, 0)) order by m.method), '[]')
                  from (select method, count(*) n, sum(total_cents) c from paid group by method) m
                  left join (select method, sum(total_cents) c from refunded group by method) rf on rf.method = m.method),
    'tax_by_rate', (select coalesce(jsonb_agg(jsonb_build_object('rate', t.tax_rate, 'inclusive', t.tax_inclusive, 'sales_cents', t.s, 'tax_cents', t.x) order by t.tax_rate), '[]')
                    from (select tax_rate, tax_inclusive, sum(subtotal_cents) s, sum(tax_cents) x from paid group by tax_rate, tax_inclusive) t),
    'by_staff', (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(st.name, 'Unassigned'), 'count', g.n, 'sales_cents', g.s, 'tips_cents', g.tp) order by g.s desc), '[]')
                 from (select staff_id, count(*) n, sum(subtotal_cents) s, sum(tip_cents) tp from paid group by staff_id) g left join staff st on st.id = g.staff_id),
    'cash_expected_cents', cash_in_drawer(v_salon, v_a, v_b),
    'till', (select to_jsonb(t) - 'salon_id' from till_closes t where t.salon_id = v_salon and p_from = p_to and t.day = p_from),
    'gift_cards_sold', (select jsonb_build_object('count', count(*), 'cents', coalesce(sum(original_cents), 0)) from gift_cards where salon_id = v_salon and issued_at >= v_a and issued_at < v_b),
    'appointments', jsonb_build_object(
      'completed', (select count(*) from bookings where salon_id = v_salon and status = 'completed' and starts_at >= v_a and starts_at < v_b),
      'no_shows', (select count(*) from bookings where salon_id = v_salon and status = 'no_show' and starts_at >= v_a and starts_at < v_b),
      'cancelled', (select coalesce(jsonb_agg(jsonb_build_object('reason', x.reason, 'count', x.n) order by x.n desc), '[]')
                    from (select coalesce(cancel_reason, 'No reason recorded') reason, count(*) n from bookings
                          where salon_id = v_salon and status = 'cancelled' and starts_at >= v_a and starts_at < v_b group by 1) x))
  ) into r;
  return r;
end $$;
revoke all on function sales_summary(date, date) from public, anon;
grant execute on function sales_summary(date, date) to authenticated, service_role;

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
                 and not exists (select 1 from closed_periods cp where cp.salon_id = p_salon and dd::date between cp.starts_on and cp.ends_on)
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
                 and not exists (select 1 from closed_periods cp where cp.salon_id = p_salon and dd::date between cp.starts_on and cp.ends_on)
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
