-- A busy salon after two years: four staff, 1,500 clients, about 20,000 bookings and the sales that go with them. Screens that feel instant with a few
-- dozen test bookings can crawl at this size, so the queries behind the heavy screens (the daily summary, reports, payroll, the client list, the
-- calendar day, free times for the booking page, the daily check) are timed here. Each must answer in under two seconds, and the timings are printed.

create temp table obs (t text) on commit drop;
grant all on obs to public;

-- Runs a query as the signed-in user and returns how many milliseconds it took (row security applies).
create function pg_temp.ms(uid uuid, q text) returns int language plpgsql as $$
declare t0 timestamptz; begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  t0 := clock_timestamp();
  begin execute q; exception when others then reset role; raise exception 'query failed: % -- %', q, sqlerrm; end;
  reset role;
  return (extract(epoch from clock_timestamp() - t0) * 1000)::int;
end $$;

-- The same for the server-only functions (run as the database owner, which is what the service key amounts to).
create function pg_temp.ms_service(q text) returns int language plpgsql as $$
declare t0 timestamptz := clock_timestamp(); begin
  execute q; return (extract(epoch from clock_timestamp() - t0) * 1000)::int;
end $$;

do $t$
declare
  tz text := 'Pacific/Auckland'; uo uuid := gen_random_uuid();
  sa uuid; cat uuid; svc uuid; own uuid; stylists uuid[] := '{}'; st uuid; clients uuid[] := '{}'; n int; t0 timestamptz := clock_timestamp();
  today date := (now() at time zone 'Pacific/Auckland')::date; ms int; slow text := ''; bookings_n int; sales_n int;
  w record;
begin
  insert into auth.users (id, instance_id, aud, role, email) values (uo, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vol-owner@t.test');
  insert into salons (slug, name, timezone, currency, email) values ('t-vol-' || substr(gen_random_uuid()::text, 1, 8), 'Busy Salon', tz, 'NZD', 'owner@vol.test') returning id into sa;
  insert into salon_settings (salon_id, min_notice, booking_window, online_booking, auto_confirm, tax_rate, tax_inclusive)
    values (sa, 'none', '8w', true, true, 15, true)
    on conflict (salon_id) do update set min_notice = 'none', booking_window = '8w', online_booking = true, auto_confirm = true, tax_rate = 15, tax_inclusive = true;
  insert into opening_hours (salon_id, weekday, is_open, open_time, close_time) select sa, g, g < 6, time '09:00', time '17:00' from generate_series(0, 6) g
    on conflict (salon_id, weekday) do update set is_open = excluded.is_open, open_time = excluded.open_time, close_time = excluded.close_time;
  insert into service_categories (salon_id, name) values (sa, 'Hair') returning id into cat;
  insert into services (salon_id, category_id, name, duration_min, price_cents) values (sa, cat, 'Cut', 45, 6000) returning id into svc;
  insert into staff (salon_id, name, role_title, app_role, user_id, commission_pct) values (sa, 'Owner', 'Owner', 'owner', uo, 0) returning id into own;
  for i in 1..3 loop
    insert into staff (salon_id, name, role_title, app_role, commission_pct) values (sa, 'Stylist ' || i, 'Stylist', 'stylist', 40) returning id into st;
    stylists := stylists || st;
  end loop;
  stylists := stylists || own;
  insert into service_staff select svc, s from unnest(stylists) s;
  insert into staff_shifts (staff_id, weekday, start_time, end_time) select s, g, time '09:00', time '17:00' from unnest(stylists) s, generate_series(0, 5) g;
  insert into clients (salon_id, name, email, phone) select sa, 'Client ' || g, 'c' || g || '@vol.test', '021' || lpad(g::text, 7, '0') from generate_series(1, 1500) g;
  select array_agg(id) into clients from clients where salon_id = sa;
  insert into obs values ('set-up: ' || (extract(epoch from clock_timestamp() - t0) * 1000)::int || ' ms');

  -- Two years of eight one-hour slots a day per person, six days a week, plus the next eight weeks.
  t0 := clock_timestamp();
  insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status, source)
    select sa, clients[1 + floor(random() * 1500)::int], s, ((d + time '09:00' + k * interval '1 hour') at time zone tz), ((d + time '09:00' + k * interval '1 hour' + interval '45 minutes') at time zone tz),
           case when d >= today then 'confirmed'::booking_status when random() < 0.08 then 'cancelled' when random() < 0.02 then 'no_show' else 'completed' end, 'staff'
    from generate_series(today - 730, today + 56, interval '1 day') g(d2), lateral (select d2::date d) dd, unnest(stylists) s, generate_series(0, 6) k
    where extract(isodow from d) < 7 and random() < 0.85;
  get diagnostics bookings_n = row_count;
  insert into obs values (bookings_n || ' bookings added in ' || (extract(epoch from clock_timestamp() - t0) * 1000)::int || ' ms');
  insert into booking_services (booking_id, service_id, price_cents, duration_min) select id, svc, 6000, 45 from bookings where salon_id = sa;

  t0 := clock_timestamp();
  with s as (
    insert into sales (salon_id, booking_id, client_id, staff_id, status, method, subtotal_cents, tip_cents, tax_rate, tax_inclusive, tax_cents, total_cents, paid_at)
      select sa, b.id, b.client_id, b.staff_id, 'paid', case when random() < 0.6 then 'card'::pay_method else 'cash'::pay_method end, 6000, 0, 15, true, 783, 6000, b.ends_at
      from bookings b where b.salon_id = sa and b.status = 'completed' returning id)
  insert into sale_items (sale_id, service_id, label, qty, price_cents) select id, svc, 'Cut', 1, 6000 from s;
  get diagnostics sales_n = row_count;
  insert into obs values (sales_n || ' paid sales added in ' || (extract(epoch from clock_timestamp() - t0) * 1000)::int || ' ms');

  analyze bookings; analyze sales; analyze clients; analyze sale_items; analyze booking_services;

  -- The timings, each as it would be asked by the app.
  for w in select * from (values
    ('free times for one day (booking page)',  format('select count(*) from available_slots(%L, array[%L]::uuid[], null, %L, %L, ''public'', 15)', sa, svc, today + 3, today + 3), true),
    ('free times for a week (booking page)',   format('select count(*) from available_slots(%L, array[%L]::uuid[], null, %L, %L, ''public'', 15)', sa, svc, today + 1, today + 7), true),
    ('daily summary, one day',                 format('select sales_summary(%L, %L)', today - 3, today - 3), true),
    ('summary, a month',                       format('select sales_summary(%L, %L)', today - 30, today - 1), true),
    ('summary, a year',                        format('select sales_summary(%L, %L)', today - 365, today - 1), true),
    ('reports dashboard, 30 days vs before',   format('select report_dashboard(%L, %L, %L, %L)', today - 30, today - 1, today - 60, today - 31), true),
    ('reports dashboard, a year vs before',    format('select report_dashboard(%L, %L, %L, %L)', today - 365, today - 1, today - 730, today - 366), true),
    ('reports summary, a year',                format('select report_summary(%L, %L)', today - 365, today - 1), true),
    ('payroll, a month',                       format('select payroll_summary(%L, %L)', today - 30, today - 1), true),
    ('payroll, a week',                        format('select payroll_week(%L, %L)', today - 7, today - 1), true),
    ('client list with their last visit',      'select client_overview()', true),
    ('clients, all rows by name',              'select id, name, email, phone from clients order by name', true),
    ('calendar, one day with names',           format('select b.id, b.starts_at, c.name, s.name from bookings b join clients c on c.id = b.client_id join staff s on s.id = b.staff_id where b.starts_at >= %L and b.starts_at < %L', (today + 2)::timestamp at time zone tz, (today + 3)::timestamp at time zone tz), true),
    ('calendar, one week with names',          format('select b.id, b.starts_at, c.name, s.name from bookings b join clients c on c.id = b.client_id join staff s on s.id = b.staff_id where b.starts_at >= %L and b.starts_at < %L', (today + 1)::timestamp at time zone tz, (today + 8)::timestamp at time zone tz), true),
    ('sales list, newest 200',                 'select s.id, s.total_cents, s.status, c.name from sales s left join clients c on c.id = s.client_id order by s.created_at desc limit 200', true),
    ('one client''s history',                  format('select b.starts_at, b.status from bookings b where b.client_id = %L order by b.starts_at desc', clients[7]), true),
    ('searching a client by name',             'select id, name from clients where name ilike ''%client 77%'' limit 20', true)
  ) v(label, q, as_user) loop
    ms := pg_temp.ms(uo, w.q);
    insert into obs values (rpad(w.label, 42) || ms || ' ms');
    if ms > 2000 then slow := slow || w.label || ' (' || ms || ' ms); '; end if;
  end loop;
  for w in select * from (values
    ('daily check (health_problems)',          'select count(*) from health_problems()'),
    ('reminders (enqueue_reminders)',          'select enqueue_reminders()')
  ) v(label, q) loop
    ms := pg_temp.ms_service(w.q);
    insert into obs values (rpad(w.label, 42) || ms || ' ms');
    if ms > 2000 then slow := slow || w.label || ' (' || ms || ' ms); '; end if;
  end loop;

  raise notice 'OBSERVATIONS:%', E'\n' || (select string_agg(t, E'\n') from obs);
  if slow <> '' then raise exception 'too slow with two years of data: %', slow; end if;
end $t$;
