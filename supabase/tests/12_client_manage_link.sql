-- What a client can do with the link in their confirmation email: move or cancel their own appointment, within the rules.
do $t$
declare
  tz text := 'Pacific/Auckland'; day date := (date_trunc('week', now() + interval '10 days'))::date;
  sa uuid; cat uuid; cl uuid; cl2 uuid; st uuid; a uuid; bk uuid; bk2 uuid; tok text; t1 timestamptz; t2 timestamptz; t3 timestamptz; worked boolean; n int; st_after text;

begin
  insert into salons (slug, name, timezone, currency) values ('t-m-' || substr(gen_random_uuid()::text, 1, 8), 'Manage', tz, 'NZD') returning id into sa;
  insert into salon_settings (salon_id, min_notice, booking_window, online_booking) values (sa, 'none', '8w', true)
    on conflict (salon_id) do update set min_notice = 'none', booking_window = '8w', online_booking = true;
  insert into opening_hours (salon_id, weekday, is_open, open_time, close_time) select sa, g, g < 6, time '09:00', time '17:00' from generate_series(0, 6) g
    on conflict (salon_id, weekday) do update set is_open = excluded.is_open, open_time = excluded.open_time, close_time = excluded.close_time;
  insert into service_categories (salon_id, name) values (sa, 'Hair') returning id into cat;
  insert into services (salon_id, category_id, name, duration_min, price_cents) values (sa, cat, 'Cut', 60, 5000) returning id into a;
  insert into staff (salon_id, name, role_title, app_role) values (sa, 'Stylist', 'Stylist', 'stylist') returning id into st;
  insert into service_staff values (a, st);
  insert into staff_shifts (staff_id, weekday, start_time, end_time) select st, g, time '09:00', time '17:00' from generate_series(0, 5) g;
  insert into clients (salon_id, name) values (sa, 'Mine') returning id into cl;
  insert into clients (salon_id, name) values (sa, 'Other') returning id into cl2;

  t1 := ((day + time '10:00') at time zone tz);  -- my appointment
  t2 := ((day + time '13:00') at time zone tz);  -- someone else's
  t3 := ((day + time '15:00') at time zone tz);  -- time blocked off
  bk := create_booking(sa, cl, st, t1, array[a], 'online', null, 'public');
  bk2 := create_booking(sa, cl2, st, t2, array[a], 'online', null, 'public');
  insert into staff_blocks (salon_id, staff_id, kind, starts_at, ends_at) values (sa, st, 'lunch', t3, t3 + interval '45 minutes');
  select token into tok from booking_tokens where booking_id = bk and purpose = 'manage_booking';

  worked := false; begin perform client_reschedule(tok, t2); worked := true; exception when others then null; end;
  perform pg_temp.ok(not worked, 'client moved onto another client''s appointment');
  worked := false; begin perform client_reschedule(tok, t2 - interval '30 minutes'); worked := true; exception when others then null; end;
  perform pg_temp.ok(not worked, 'client moved into a time that overlaps another appointment');
  worked := false; begin perform client_reschedule(tok, t3); worked := true; exception when others then null; end;
  perform pg_temp.ok(not worked, 'client moved onto blocked time');
  worked := false; begin perform client_reschedule(tok, ((day + 6 + time '10:00') at time zone tz)); worked := true; exception when others then null; end;
  perform pg_temp.ok(not worked, 'client moved to a day the salon is closed');
  worked := false; begin perform client_reschedule(tok, ((day + time '16:30') at time zone tz)); worked := true; exception when others then null; end;
  perform pg_temp.ok(not worked, 'client moved to a time that runs past closing');
  worked := false; begin perform client_reschedule(tok, t1 + interval '30 minutes'); worked := true; exception when others then null; end;
  perform pg_temp.ok(worked, 'client could not nudge their own appointment by 30 minutes');
  worked := false; begin perform client_reschedule(tok, ((day + time '11:00') at time zone tz)); worked := true; exception when others then null; end;
  perform pg_temp.ok(worked, 'client could not move to a free time');

  perform client_cancel(tok, 'sick');
  select status::text into st_after from bookings where id = bk;
  perform pg_temp.ok(st_after = 'cancelled', 'client could not cancel');
  worked := false; begin perform client_reschedule(tok, ((day + time '12:00') at time zone tz)); worked := true; exception when others then null; end;
  perform pg_temp.ok(not worked, 'a cancelled appointment was moved');
  worked := false; begin perform client_cancel(tok, 'again'); worked := true; exception when others then null; end;
  perform pg_temp.ok(not worked, 'a cancelled appointment was cancelled twice');
  select count(*) into n from inbox_items where booking_id = bk and type = 'cancellation';
  perform pg_temp.ok(n = 1, 'the salon was told about the cancellation ' || n || ' times');

  -- the freed time can be booked by someone else
  worked := false; begin perform create_booking(sa, cl2, st, ((day + time '11:00') at time zone tz), array[a], 'online', null, 'public'); worked := true; exception when others then null; end;
  perform pg_temp.ok(worked, 'a cancelled appointment kept its time');
end $t$;

-- an offer whose time was taken puts the client back on the waitlist instead of leaving them stuck on "offered"
do $t$
declare
  tz text := 'Pacific/Auckland'; day date := (date_trunc('week', now() + interval '10 days'))::date;
  sa uuid; cat uuid; cl uuid; cl2 uuid; st uuid; a uuid; w uuid; tok text; t1 timestamptz; res uuid; s text; used timestamptz;
begin
  insert into salons (slug, name, timezone, currency) values ('t-o-' || substr(gen_random_uuid()::text, 1, 8), 'Offer', tz, 'NZD') returning id into sa;
  insert into salon_settings (salon_id, min_notice, booking_window, online_booking) values (sa, 'none', '8w', true)
    on conflict (salon_id) do update set min_notice = 'none', booking_window = '8w', online_booking = true;
  insert into opening_hours (salon_id, weekday, is_open, open_time, close_time) select sa, g, g < 6, time '09:00', time '17:00' from generate_series(0, 6) g
    on conflict (salon_id, weekday) do update set is_open = excluded.is_open, open_time = excluded.open_time, close_time = excluded.close_time;
  insert into service_categories (salon_id, name) values (sa, 'Hair') returning id into cat;
  insert into services (salon_id, category_id, name, duration_min, price_cents) values (sa, cat, 'Cut', 60, 5000) returning id into a;
  insert into staff (salon_id, name, role_title, app_role) values (sa, 'Stylist', 'Stylist', 'stylist') returning id into st;
  insert into service_staff values (a, st);
  insert into staff_shifts (staff_id, weekday, start_time, end_time) select st, g, time '09:00', time '17:00' from generate_series(0, 5) g;
  insert into clients (salon_id, name, email) values (sa, 'Waiting', 'w@example.com') returning id into cl;
  insert into clients (salon_id, name) values (sa, 'Quick') returning id into cl2;
  insert into waitlist_entries (salon_id, client_id, service_id) values (sa, cl, a) returning id into w;
  t1 := ((day + time '10:00') at time zone tz);
  tok := offer_waitlist_slot(w, st, t1);
  perform create_booking(sa, cl2, st, t1, array[a], 'online', null, 'public');
  res := accept_offer(tok);
  select status::text into s from waitlist_entries where id = w;
  select used_at into used from booking_tokens where token = tok;
  perform pg_temp.ok(res is null, 'accepting a taken offer made a booking');
  perform pg_temp.ok(s = 'waiting', 'a client whose offer was taken was left as ' || s);
  perform pg_temp.ok(used is not null, 'the taken offer link stayed usable');
end $t$;
