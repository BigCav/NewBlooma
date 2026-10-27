-- Random schedules: build twelve different salons with random existing bookings and time blocked off, then check the booking engine's promises.
--  * every time the public page offers can really be booked, and once booked it is no longer offered
--  * the same time cannot be booked twice
--  * filling a whole day leaves nothing offered, nobody overlapping, and nothing outside opening hours, a stylist's own shift or a blocked time
create temp table fuzz_problems (msg text) on commit drop;
do $t$
declare
  tz text := 'Pacific/Auckland'; day date := (date_trunc('week', now() + interval '10 days'))::date;
  sa uuid; cat uuid; cl uuid; svcs uuid[]; sv uuid; st uuid[]; s uuid; dd int; i int; r record; k int; seed int; guard int; cnt int; t0 timestamptz;
  durs int[] := array[15, 30, 45, 60, 90, 120];
begin
  for seed in 1..12 loop
    perform setseed(seed / 100.0);
    svcs := '{}'; st := '{}';
    insert into salons (slug, name, timezone, currency) values ('t-r-' || substr(gen_random_uuid()::text, 1, 8), 'Random ' || seed, tz, 'NZD') returning id into sa;
    insert into salon_settings (salon_id, min_notice, booking_window) values (sa, 'none', '8w') on conflict (salon_id) do update set min_notice = 'none', booking_window = '8w';
    insert into opening_hours (salon_id, weekday, is_open, open_time, close_time) select sa, g, g < 6, time '09:00', time '17:00' from generate_series(0, 6) g
      on conflict (salon_id, weekday) do update set is_open = excluded.is_open, open_time = excluded.open_time, close_time = excluded.close_time;
    insert into service_categories (salon_id, name) values (sa, 'Hair') returning id into cat;
    foreach dd in array durs loop
      insert into services (salon_id, category_id, name, duration_min, price_cents) values (sa, cat, 'S' || dd, dd, 1000 + dd) returning id into sv;
      svcs := svcs || sv;
    end loop;
    for i in 1..3 loop
      insert into staff (salon_id, name, role_title, app_role) values (sa, 'Stylist ' || i, 'Stylist', 'stylist') returning id into s;
      st := st || s;
      insert into service_staff select unnest(svcs), s;
      insert into staff_shifts (staff_id, weekday, start_time, end_time) select s, wd, time '09:00' + (i - 1) * interval '30 minutes', time '17:00' - (i - 1) * interval '60 minutes' from generate_series(0, 5) wd;
    end loop;
    insert into clients (salon_id, name) values (sa, 'Random client') returning id into cl;
    for i in 1..9 loop
      s := st[1 + floor(random() * 3)::int];
      t0 := ((day + time '09:00') + (floor(random() * 30) * 15) * interval '1 minute') at time zone tz;
      begin
        insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status, notes) values (sa, cl, s, t0, t0 + durs[1 + floor(random() * 6)::int] * interval '1 minute', 'confirmed', 'pre');
      exception when others then null; end;
    end loop;
    for i in 1..3 loop
      s := st[1 + floor(random() * 3)::int];
      t0 := ((day + time '09:00') + (floor(random() * 30) * 15) * interval '1 minute') at time zone tz;
      insert into staff_blocks (salon_id, staff_id, kind, starts_at, ends_at) values (sa, s, 'lunch', t0, t0 + interval '45 minutes');
    end loop;

    for r in select x as sv_id, array[x] as arr from unnest(svcs) x loop
      for k in 1..3 loop
        s := null;
        select a.staff_id, a.starts_at into s, t0 from available_slots(sa, r.arr, null, day, day, 'public', 15) a order by random() limit 1;
        exit when s is null;
        begin perform create_booking(sa, cl, s, t0, r.arr, 'staff', 'run', 'public');
        exception when others then insert into fuzz_problems values ('seed ' || seed || ': an offered time was refused: ' || sqlerrm); end;
        select count(*) into cnt from available_slots(sa, r.arr, s, day, day, 'public', 15) a where a.starts_at = t0;
        if cnt <> 0 then insert into fuzz_problems values ('seed ' || seed || ': a booked time was still offered'); end if;
        begin perform create_booking(sa, cl, s, t0, r.arr, 'staff', 'run', 'public'); insert into fuzz_problems values ('seed ' || seed || ': the same time was booked twice');
        exception when others then null; end;
      end loop;
    end loop;

    guard := 0;
    loop
      s := null;
      select a.staff_id, a.starts_at into s, t0 from available_slots(sa, array[svcs[1]], null, day, day, 'public', 15) a order by a.starts_at limit 1;
      exit when s is null or guard > 400;
      guard := guard + 1;
      begin perform create_booking(sa, cl, s, t0, array[svcs[1]], 'staff', 'run', 'public');
      exception when others then insert into fuzz_problems values ('seed ' || seed || ': filling the day, an offered time was refused: ' || sqlerrm); exit; end;
    end loop;
    select count(*) into cnt from available_slots(sa, array[svcs[1]], null, day, day, 'public', 15);
    if cnt <> 0 then insert into fuzz_problems values ('seed ' || seed || ': times still offered after the day was full'); end if;
    select count(*) into cnt from bookings a join bookings b on a.staff_id = b.staff_id and a.id < b.id and a.status in ('pending', 'confirmed') and b.status in ('pending', 'confirmed')
      and tstzrange(a.starts_at, a.ends_at) && tstzrange(b.starts_at, b.ends_at) where a.salon_id = sa;
    if cnt <> 0 then insert into fuzz_problems values ('seed ' || seed || ': two bookings overlap for one stylist'); end if;
    select count(*) into cnt from bookings b where b.salon_id = sa and b.notes = 'run' and (b.starts_at < (day + time '09:00') at time zone tz or b.ends_at > (day + time '17:00') at time zone tz);
    if cnt <> 0 then insert into fuzz_problems values ('seed ' || seed || ': a booking outside opening hours'); end if;
    select count(*) into cnt from bookings b join staff_blocks sb on sb.staff_id = b.staff_id and tstzrange(b.starts_at, b.ends_at) && tstzrange(sb.starts_at, sb.ends_at) where b.salon_id = sa and b.notes = 'run';
    if cnt <> 0 then insert into fuzz_problems values ('seed ' || seed || ': a booking over time blocked off'); end if;
    select count(*) into cnt from bookings b join staff_shifts sh on sh.staff_id = b.staff_id and sh.weekday = extract(isodow from (b.starts_at at time zone tz))::int - 1
      where b.salon_id = sa and b.notes = 'run' and ((b.starts_at at time zone tz)::time < sh.start_time or (b.ends_at at time zone tz)::time > sh.end_time);
    if cnt <> 0 then insert into fuzz_problems values ('seed ' || seed || ': a booking outside the stylist''s own shift'); end if;
  end loop;
  perform pg_temp.ok((select count(*) from fuzz_problems) = 0, 'booking engine: ' || coalesce((select msg from fuzz_problems limit 1), ''));
end $t$;
