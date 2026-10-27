-- Booking rules: no double booking, what the public booking page offers, and data limits.
do $t$
declare
  tz text := 'Pacific/Auckland';
  monday date := (date_trunc('week', now() + interval '10 days'))::date;
  sunday date := (date_trunc('week', now() + interval '10 days'))::date + 6;
  t timestamptz := ((date_trunc('week', now() + interval '10 days'))::date + time '10:00') at time zone tz;
  sa uuid := pg_temp.f('sa'); stfa uuid := pg_temp.f('stfa'); stfs uuid := pg_temp.f('stfs'); cla uuid := pg_temp.f('cla'); svca uuid := pg_temp.f('svca'); bka uuid := pg_temp.f('bka');
  n int; r text; id2 uuid;
begin
  -- the fixture booking is stfa 10:00-10:30
  -- overlapping the same stylist is refused, in every way it can overlap
  foreach r in array array['10:00|10:30', '10:15|10:45', '09:45|10:15', '09:30|11:00', '10:05|10:10'] loop
    perform pg_temp.ok(pg_temp.err_of(format('insert into bookings (salon_id,client_id,staff_id,starts_at,ends_at) values (%L,%L,%L,%L,%L)', sa, cla, stfa,
      (monday + split_part(r, '|', 1)::time) at time zone tz, (monday + split_part(r, '|', 2)::time) at time zone tz)) = '23P01', 'overlap ' || r || ' was allowed');
  end loop;
  -- back to back is fine, and a different stylist can have the same time
  perform pg_temp.ok(pg_temp.err_of(format('insert into bookings (salon_id,client_id,staff_id,starts_at,ends_at) values (%L,%L,%L,%L,%L)', sa, cla, stfa, t + interval '30 minutes', t + interval '60 minutes')) = 'none', 'back to back booking refused');
  perform pg_temp.ok(pg_temp.err_of(format('insert into bookings (salon_id,client_id,staff_id,starts_at,ends_at) values (%L,%L,%L,%L,%L)', sa, cla, stfs, t, t + interval '30 minutes')) = 'none', 'two stylists at the same time refused');
  perform pg_temp.ok(pg_temp.err_of(format('insert into bookings (salon_id,client_id,staff_id,starts_at,ends_at) values (%L,%L,%L,%L,%L)', sa, cla, stfa, t, t)) = '23514', 'zero length booking allowed');
  -- cancelling frees the time; a no-show also frees it
  update bookings set status = 'cancelled' where id = bka;
  perform pg_temp.ok(pg_temp.err_of(format('insert into bookings (salon_id,client_id,staff_id,starts_at,ends_at) values (%L,%L,%L,%L,%L)', sa, cla, stfa, t, t + interval '30 minutes')) = 'none', 'cancelled booking still blocked the time');
  -- reinstating a cancelled booking into a time that has since been taken is refused
  perform pg_temp.ok(pg_temp.err_of(format('update bookings set status = ''confirmed'' where id = %L', bka)) = '23P01', 'reinstated booking double booked the stylist');

  -- the staff booking function refuses a taken time and accepts a free one
  perform pg_temp.ok(pg_temp.err_of(format('select create_booking(%L,%L,%L,%L,array[%L]::uuid[])', sa, cla, stfa, t, svca)) <> 'none', 'create_booking took a taken time');
  perform pg_temp.ok(pg_temp.err_of(format('select create_booking(%L,%L,%L,%L,array[%L]::uuid[])', sa, cla, stfa, t + interval '3 hours', svca)) = 'none', 'create_booking refused a free time');
  perform pg_temp.ok(pg_temp.err_of(format('select create_booking(%L,%L,%L,%L,array[%L]::uuid[])', sa, cla, stfa, t + interval '4 hours', pg_temp.f('svcb'))) <> 'none', 'create_booking used another salon''s service');

  -- the public page: closed day, opening hours, and never over an existing booking
  perform pg_temp.ok((select count(*) from available_slots(sa, array[svca], null, sunday, sunday, 'public', 15)) = 0, 'slots offered on a closed day');
  select count(*) into n from available_slots(sa, array[svca], null, monday, monday, 'public', 15);
  perform pg_temp.ok(n > 0, 'no slots on an open day');
  perform pg_temp.ok((select count(*) from available_slots(sa, array[svca], null, monday, monday, 'public', 15)
    where starts_at < (monday + time '09:00') at time zone tz or ends_at > (monday + time '17:00') at time zone tz) = 0, 'slot outside opening hours');
  -- stfs already has a booking 10:00-10:30 and stfa a booking 10:30-11:00 and 10:00-10:30 (refilled above)
  perform pg_temp.ok((select count(*) from available_slots(sa, array[svca], stfa, monday, monday, 'public', 15)
    where starts_at < t + interval '60 minutes' and ends_at > t) = 0, 'slot offered over a booked time');
  perform pg_temp.ok((select count(*) from available_slots(sa, array[svca], stfa, monday, monday, 'public', 15) where starts_at = t + interval '60 minutes') = 1, 'time right after a booking not offered');

  -- time blocked off disappears from the page
  insert into staff_blocks (salon_id, staff_id, kind, starts_at, ends_at) values (sa, stfa, 'lunch', (monday + time '13:00') at time zone tz, (monday + time '14:00') at time zone tz);
  perform pg_temp.ok((select count(*) from available_slots(sa, array[svca], stfa, monday, monday, 'public', 15)
    where starts_at < (monday + time '14:00') at time zone tz and ends_at > (monday + time '13:00') at time zone tz) = 0, 'slot offered during a block');

  -- switched-off online booking offers nothing; a service nobody can do offers nothing
  update services set online_bookable = false where id = svca;
  perform pg_temp.ok((select count(*) from available_slots(sa, array[svca], null, monday, monday, 'public', 15)) = 0, 'slots offered for a service switched off online');
  update services set online_bookable = true where id = svca;
  update staff set online_bookable = false where id = stfa;
  perform pg_temp.ok((select count(*) from available_slots(sa, array[svca], stfa, monday, monday, 'public', 15)) = 0, 'slots offered for a stylist switched off online');
  update staff set online_bookable = true where id = stfa;

  -- the public page never offers a time in the past
  perform pg_temp.ok((select count(*) from available_slots(sa, array[svca], null, current_date - 3, current_date - 3, 'public', 15)) = 0, 'slots offered in the past');
end $t$;

-- data limits and uniqueness
do $t$
declare sa uuid := pg_temp.f('sa'); cla uuid := pg_temp.f('cla');
begin
  perform pg_temp.ok(pg_temp.err_of(format('insert into clients (salon_id,name) values (%L,%L)', sa, repeat('x', 201))) = '23514', 'a 201 character name was accepted');
  perform pg_temp.ok(pg_temp.err_of(format('insert into clients (salon_id,name,email) values (%L,%L,%L)', sa, 'Dup', 'CA@T.TEST')) = '23505', 'the same email in other capitals was accepted twice');
  perform pg_temp.ok(pg_temp.err_of(format('insert into clients (salon_id,name,email) values (%L,%L,%L)', pg_temp.f('sb'), 'Same Email Other Salon', 'ca@t.test')) = 'none', 'the same email in another salon was refused');
  perform pg_temp.ok(pg_temp.err_of(format('insert into clients (salon_id,name) values (%L,%L)', sa, '   ')) = '23514', 'a blank name was accepted');
  perform pg_temp.ok(pg_temp.err_of(format('insert into client_notes (salon_id,client_id,body) values (%L,%L,%L)', sa, cla, repeat('n', 5001))) = '23514', 'a 5001 character note was accepted');
  perform pg_temp.ok(pg_temp.err_of(format('insert into clients (salon_id,name) values (%L,%L)', sa, '<script>alert(1)</script>')) = 'none', 'hostile text must be stored as plain text, not refused');
end $t$;
