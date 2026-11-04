-- New Zealand moves its clocks twice a year (forward at 2am on the last Sunday of September, back at 3am on the first Sunday of April) and a
-- 9am appointment must stay at 9am on either side. This checks that days are cut at the salon's own midnight (a sale at 11:30pm belongs to that
-- evening, not the next day in UTC), that the day with the clock change is counted as one day, that the same local times are offered before, on
-- and after a change, and that an hour-long appointment across the missing hour still ends an hour later in real time.

create function pg_temp.local_of(t timestamptz) returns text language sql as $$ select to_char(t at time zone 'Pacific/Auckland', 'YYYY-MM-DD HH24:MI') $$;
create function pg_temp.at_nz(s text) returns timestamptz language sql as $$ select s::timestamp at time zone 'Pacific/Auckland' $$;

do $t$
declare
  sa uuid := pg_temp.f('sa'); stf uuid := pg_temp.f('stfa'); cl uuid := pg_temp.f('cla'); svc uuid := pg_temp.f('svca'); uo uuid := pg_temp.f('ua');
  j jsonb; n int; r text; sv60 uuid; b1 uuid; b2 uuid; lo text; hi text;
begin
  -- The offsets are what this test assumes: 13 hours ahead of UTC in summer, 12 in winter.
  perform pg_temp.ok(pg_temp.at_nz('2026-09-27 12:00') = '2026-09-26 23:00+00'::timestamptz, 'the spring change is not where this test expects it');
  perform pg_temp.ok(pg_temp.at_nz('2026-09-26 12:00') = '2026-09-26 00:00+00'::timestamptz, 'winter offset is not 12 hours');
  perform pg_temp.ok(pg_temp.at_nz('2027-04-03 12:00') = '2027-04-02 23:00+00'::timestamptz, 'summer offset is not 13 hours');
  perform pg_temp.ok(pg_temp.at_nz('2027-04-04 12:00') = '2027-04-04 00:00+00'::timestamptz, 'the autumn change is not where this test expects it');

  ---------------------------------------------------------------- 1. Daily totals around the 2026 spring change (clocks forward on Sunday 27 September: that day is 23 hours long)
  insert into sales (salon_id, client_id, staff_id, status, method, subtotal_cents, tax_rate, tax_inclusive, tax_cents, total_cents, paid_at) values
    (sa, cl, stf, 'paid', 'cash', 1000, 0, false, 0, 1000, pg_temp.at_nz('2026-09-26 23:30')),  -- Saturday night
    (sa, cl, stf, 'paid', 'cash', 2000, 0, false, 0, 2000, pg_temp.at_nz('2026-09-27 00:30')),  -- Sunday, just after midnight
    (sa, cl, stf, 'paid', 'cash', 3000, 0, false, 0, 3000, pg_temp.at_nz('2026-09-27 12:00')),  -- Sunday midday (after the change)
    (sa, cl, stf, 'paid', 'cash', 4000, 0, false, 0, 4000, pg_temp.at_nz('2026-09-27 23:30')),  -- Sunday night
    (sa, cl, stf, 'paid', 'cash', 5000, 0, false, 0, 5000, pg_temp.at_nz('2026-09-28 00:30'));  -- Monday, just after midnight
  j := pg_temp.json_as(uo, format('select sales_summary(%L, %L)', date '2026-09-26', date '2026-09-26'));
  perform pg_temp.ok((j ->> 'total_cents')::int = 1000, 'Saturday should have 1000, it has ' || (j ->> 'total_cents'));
  j := pg_temp.json_as(uo, format('select sales_summary(%L, %L)', date '2026-09-27', date '2026-09-27'));
  perform pg_temp.ok((j ->> 'total_cents')::int = 9000 and (j ->> 'sales_count')::int = 3, 'the day the clocks changed should have 3 sales and 9000, it has ' || (j ->> 'sales_count') || ' and ' || (j ->> 'total_cents'));
  j := pg_temp.json_as(uo, format('select sales_summary(%L, %L)', date '2026-09-28', date '2026-09-28'));
  perform pg_temp.ok((j ->> 'total_cents')::int = 5000, 'Monday should have 5000, it has ' || (j ->> 'total_cents'));
  j := pg_temp.json_as(uo, format('select sales_summary(%L, %L)', date '2026-09-26', date '2026-09-28'));
  perform pg_temp.ok((j ->> 'total_cents')::int = 15000 and (j ->> 'sales_count')::int = 5, 'the three days together should be 5 sales and 15000, not lose or double count any');

  ---------------------------------------------------------------- 2. The same local times are offered before, on and after the autumn change (clocks back on Sunday 4 April 2027: that day is 25 hours long)
  update opening_hours set is_open = true where salon_id = sa and weekday = 6; -- Sunday is closed by default in these tests
  insert into staff_shifts (staff_id, weekday, start_time, end_time) values (stf, 6, time '09:00', time '17:00');
  select id into sv60 from services where salon_id = sa limit 1;
  update services set duration_min = 60 where id = sv60;
  for r in select unnest(array['2027-04-03', '2027-04-04', '2027-04-05']) loop
    select count(*), min(pg_temp.local_of(starts_at)), max(pg_temp.local_of(starts_at)) into n, lo, hi from available_slots(sa, array[sv60], stf, r::date, r::date, 'staff', 30);
    perform pg_temp.ok(n = 15, r || ': expected 15 half-hour starts for a one-hour service from 9 to 5, got ' || n);
    perform pg_temp.ok(lo = r || ' 09:00' and hi = r || ' 16:00', r || ': first and last starts should be 09:00 and 16:00, got ' || lo || ' and ' || hi);
  end loop;

  ---------------------------------------------------------------- 3. A 9am booking is 9am whichever side of the change, and lasts an hour
  b1 := create_booking(sa, cl, stf, pg_temp.at_nz('2027-04-03 09:00'), array[sv60], 'staff', null, 'staff');
  b2 := create_booking(sa, cl, stf, pg_temp.at_nz('2027-04-04 09:00'), array[sv60], 'staff', null, 'staff');
  perform pg_temp.ok((select pg_temp.local_of(starts_at) from bookings where id = b1) = '2027-04-03 09:00', 'Saturday 9am booking moved');
  perform pg_temp.ok((select pg_temp.local_of(starts_at) from bookings where id = b2) = '2027-04-04 09:00', 'the booking on the day the clocks went back moved');
  perform pg_temp.ok((select ends_at - starts_at from bookings where id = b2) = interval '60 minutes', 'an hour-long appointment is not an hour long on the change day');
  perform pg_temp.ok((select starts_at from bookings where id = b2) - (select starts_at from bookings where id = b1) = interval '24 hours' + interval '1 hour', 'Sunday 9am should be 25 hours after Saturday 9am in real time');
  -- and it is offered no more on the day it is taken
  perform pg_temp.ok((select count(*) from available_slots(sa, array[sv60], stf, date '2027-04-04', date '2027-04-04', 'staff', 30) where pg_temp.local_of(starts_at) = '2027-04-04 09:00') = 0, 'a taken 9am was offered again');
  perform pg_temp.ok((select count(*) from available_slots(sa, array[sv60], stf, date '2027-04-04', date '2027-04-04', 'staff', 30)) = 13, 'a one-hour booking at 9am should remove the 9:00 and 9:30 starts, leaving 13 of 15');

  ---------------------------------------------------------------- 4. An appointment across the missing hour (clocks forward on Sunday 26 September 2027) still lasts its real length
  update opening_hours set open_time = time '00:00', close_time = time '06:00' where salon_id = sa and weekday = 6;
  update staff_shifts set start_time = time '00:00', end_time = time '06:00' where staff_id = stf and weekday = 6;
  b1 := create_booking(sa, cl, stf, pg_temp.at_nz('2027-09-26 01:30'), array[sv60], 'staff', null, 'staff');
  perform pg_temp.ok((select ends_at - starts_at from bookings where id = b1) = interval '60 minutes', 'an hour-long appointment across the missing hour is not an hour long');
  perform pg_temp.ok((select pg_temp.local_of(ends_at) from bookings where id = b1) = '2027-09-26 03:30', 'it should end at 03:30 on the clock, because 02:00 to 03:00 does not exist that night: ' || (select pg_temp.local_of(ends_at) from bookings where id = b1));
  perform pg_temp.ok(pg_temp.err_of(format('select create_booking(%L, %L, %L, %L, array[%L]::uuid[], ''staff'', null, ''staff'')', sa, cl, stf, pg_temp.at_nz('2027-09-26 03:00'), sv60)) <> 'none', 'a booking starting at 03:00 overlaps the one that runs until 03:30');
  perform pg_temp.ok(pg_temp.err_of(format('select create_booking(%L, %L, %L, %L, array[%L]::uuid[], ''staff'', null, ''staff'')', sa, cl, stf, pg_temp.at_nz('2027-09-26 03:30'), sv60)) = 'none', 'a booking right after it was refused');

  raise notice 'CLOCK CHANGES AND MIDNIGHT OK';
end $t$;
