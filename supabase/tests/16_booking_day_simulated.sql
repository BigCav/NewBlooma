-- A simulated booking day: clients book online (confirmed at once, or waiting for approval), double bookings are refused, requests are approved
-- and declined, clients move and cancel with the link in their email (in time and late, with good, expired and made-up links), staff cancel,
-- a no-show is recorded, visits are checked in and paid, a prepaid package is bought and used up, and at the end the emails queued, the
-- daily summary, payroll and the appointment counts all agree with what happened. Nothing is sent: the emails are only the queued records.

-- The database tests connect as the owner of the database, and is_service() also trusts that kind of connection, so row-level and
-- "is this your salon" checks would be skipped for the pretend users below. For this file only (the transaction is rolled back) it trusts
-- nothing but the service-role token, like the real API. The test itself plays the service role unless a helper has signed someone in.
create or replace function is_service() returns boolean language sql stable set search_path to 'public' as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role' $$;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- The sign-in helpers from the prelude, putting the service role back afterwards.
create function pg_temp.dml(uid uuid, q text) returns text language plpgsql as $$
declare r text; begin r := pg_temp.dml_as(uid, q); perform set_config('request.jwt.claims', '{"role":"service_role"}', true); return r; end $$;
create function pg_temp.idu(uid uuid, q text) returns uuid language plpgsql as $$
declare r uuid; begin
  begin r := pg_temp.id_as(uid, q); exception when others then perform set_config('request.jwt.claims', '{"role":"service_role"}', true); raise; end;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true); return r;
end $$;
create function pg_temp.jsonu(uid uuid, q text) returns jsonb language plpgsql as $$
declare r jsonb; begin r := pg_temp.json_as(uid, q); perform set_config('request.jwt.claims', '{"role":"service_role"}', true); return r; end $$;

create function pg_temp.try(q text) returns text language plpgsql as $$
begin execute q; return 'none'; exception when others then return sqlerrm; end $$;

-- A client books online: the booking's id, or 'ERR: <reason>'.
create function pg_temp.book(p_salon uuid, p_client uuid, p_staff uuid, p_at timestamptz, p_svc uuid) returns text language plpgsql as $$
begin return create_booking(p_salon, p_client, p_staff, p_at, array[p_svc], 'online', null, 'public')::text;
exception when others then return 'ERR: ' || sqlerrm; end $$;

create function pg_temp.mails(p_booking uuid, p_template text) returns int language sql as $$
  select count(*)::int from notifications_outbox where booking_id = p_booking and template = p_template $$;

create function pg_temp.link(p_booking uuid) returns text language sql as $$
  select token from booking_tokens where booking_id = p_booking and purpose = 'manage_booking' $$;

do $t$
declare
  tz text := 'Pacific/Auckland'; day date := (date_trunc('week', now() + interval '10 days'))::date; today date := (now() at time zone 'Pacific/Auckland')::date;
  uo uuid := gen_random_uuid(); us uuid := gen_random_uuid(); ub uuid := pg_temp.f('ub');
  sa uuid; cat uuid; svc uuid; own uuid; sty uuid; sty2 uuid; pk uuid; cpk uuid; pkg_sale uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid;
  b1 uuid; b2 uuid; b3 uuid; b3b uuid; b4 uuid; b5 uuid; b6 uuid; b7 uuid; b8 uuid; b9 uuid; b10 uuid; b11 uuid; b11b uuid; b12 uuid; b13 uuid; b14 uuid; b15 uuid; b16 uuid; bx uuid;
  s9 uuid; s10 uuid; s11 uuid; s11b uuid; s12 uuid; s13 uuid; s14 uuid; s15 uuid; s16 uuid;
  r text; j jsonb; n int; left_ int; tok text; obs text := '';
  use_json text;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (uo, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bd-owner@t.test'),
    (us, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bd-stylist@t.test');
  insert into salons (slug, name, timezone, currency, email) values ('t-bd-' || substr(gen_random_uuid()::text, 1, 8), 'Booking Day', tz, 'NZD', 'owner@shop.test') returning id into sa;
  insert into salon_settings (salon_id, min_notice, booking_window, online_booking, auto_confirm, email_confirmations, free_cancel_before, notify_new_booking, notify_cancellation, tax_rate, tax_inclusive, ask_for_tip, accept_cash)
    values (sa, 'none', '8w', true, true, true, '24h', true, true, 15, true, true, true)
    on conflict (salon_id) do update set min_notice = 'none', booking_window = '8w', online_booking = true, auto_confirm = true, email_confirmations = true, free_cancel_before = '24h',
      notify_new_booking = true, notify_cancellation = true, tax_rate = 15, tax_inclusive = true, ask_for_tip = true, accept_cash = true;
  insert into opening_hours (salon_id, weekday, is_open, open_time, close_time) select sa, g, g < 6, time '09:00', time '17:00' from generate_series(0, 6) g
    on conflict (salon_id, weekday) do update set is_open = excluded.is_open, open_time = excluded.open_time, close_time = excluded.close_time;
  insert into service_categories (salon_id, name) values (sa, 'Hair') returning id into cat;
  insert into services (salon_id, category_id, name, duration_min, price_cents) values (sa, cat, 'Cut', 60, 5000) returning id into svc;
  insert into staff (salon_id, name, role_title, app_role, user_id) values (sa, 'A Owner', 'Owner', 'owner', uo) returning id into own;
  insert into staff (salon_id, name, role_title, app_role, user_id, commission_pct) values (sa, 'B Stylist', 'Stylist', 'stylist', us, 40) returning id into sty;
  insert into staff (salon_id, name, role_title, app_role, commission_pct) values (sa, 'C Stylist', 'Stylist', 'stylist', 50) returning id into sty2;
  insert into service_staff values (svc, sty), (svc, sty2);
  insert into staff_shifts (staff_id, weekday, start_time, end_time) select s, g, time '09:00', time '17:00' from unnest(array[sty, sty2]) s, generate_series(0, 5) g;
  insert into clients (salon_id, name, email, phone) values (sa, 'Client One', 'c1@t.test', '0211000001') returning id into c1;
  insert into clients (salon_id, name, email, phone) values (sa, 'Client Two', 'c2@t.test', '0211000002') returning id into c2;
  insert into clients (salon_id, name, email, phone) values (sa, 'Client Three', 'c3@t.test', '0211000003') returning id into c3;
  insert into clients (salon_id, name, email, phone) values (sa, 'Client Four', 'c4@t.test', '0211000004') returning id into c4;
  insert into clients (salon_id, name, email, phone) values (sa, 'Client Five', 'c5@t.test', '0211000005') returning id into c5;
  insert into clients (salon_id, name, email, phone) values (sa, 'Client Six', 'c6@t.test', '0211000006') returning id into c6;

  ---------------------------------------------------------------- 1. Online booking, confirmed straight away
  r := pg_temp.book(sa, c1, sty, (day + time '10:00') at time zone tz, svc);
  perform pg_temp.ok(r not like 'ERR%', 'a normal online booking was refused: ' || r);
  b1 := r::uuid;
  perform pg_temp.ok((select status from bookings where id = b1) = 'confirmed', 'an online booking should be confirmed at once when approval is off');
  perform pg_temp.ok((select ends_at - starts_at from bookings where id = b1) = interval '60 minutes', 'the booking length should be the service length');
  perform pg_temp.ok(pg_temp.mails(b1, 'booking_confirmation') = 1, 'the client should get one confirmation email');
  perform pg_temp.ok((select to_address from notifications_outbox where booking_id = b1 and template = 'booking_confirmation') = 'c1@t.test', 'the confirmation is for the wrong address');
  perform pg_temp.ok(pg_temp.mails(b1, 'owner_new_booking') = 1 and (select to_address from notifications_outbox where booking_id = b1 and template = 'owner_new_booking') = 'owner@shop.test', 'the salon should be emailed about the new booking, once');
  perform pg_temp.ok(pg_temp.link(b1) is not null, 'the booking has no manage link');
  perform pg_temp.ok((select count(*) from inbox_items where booking_id = b1 and type = 'booking') = 1, 'the new booking should appear once in the inbox');

  ---------------------------------------------------------------- 2. Double bookings and times outside opening hours are refused
  perform pg_temp.ok(pg_temp.book(sa, c2, sty, (day + time '10:00') at time zone tz, svc) like '%slot_unavailable%', 'the same time with the same stylist was booked twice');
  perform pg_temp.ok(pg_temp.book(sa, c2, sty, (day + time '10:30') at time zone tz, svc) like '%slot_unavailable%', 'a time overlapping another booking was accepted');
  perform pg_temp.ok(pg_temp.book(sa, c2, sty, (day + time '09:30') at time zone tz, svc) like '%slot_unavailable%', 'a booking that runs into the next one was accepted');
  perform pg_temp.ok(pg_temp.book(sa, c2, sty, (day + time '08:00') at time zone tz, svc) like '%slot_unavailable%', 'a booking before opening was accepted');
  perform pg_temp.ok(pg_temp.book(sa, c2, sty, (day + time '16:30') at time zone tz, svc) like '%slot_unavailable%', 'a booking that runs past closing was accepted');
  perform pg_temp.ok(pg_temp.book(sa, c2, sty, ((day + 6) + time '10:00') at time zone tz, svc) like '%slot_unavailable%', 'a booking on a closed day (Sunday) was accepted');
  perform pg_temp.ok(pg_temp.book(sa, c2, sty, (now() - interval '1 day'), svc) like '%slot_unavailable%', 'a booking in the past was accepted');
  perform pg_temp.ok(pg_temp.book(sa, gen_random_uuid(), sty, (day + time '12:00') at time zone tz, svc) like 'ERR%', 'a booking for a client that does not exist was accepted');
  b2 := pg_temp.book(sa, c2, sty2, (day + time '10:00') at time zone tz, svc)::uuid; -- the other stylist is free at the same time
  perform pg_temp.ok(b2 is not null, 'the second stylist was not bookable at the same time');
  r := pg_temp.book(sa, c3, sty, (day + time '11:00') at time zone tz, svc);
  perform pg_temp.ok(r not like 'ERR%', 'the hour straight after another booking should be free: ' || r);
  update bookings set status = 'cancelled' where id = r::uuid; -- only a probe: put the time back

  ---------------------------------------------------------------- 3. A request that waits for approval: approved, then declined
  update salon_settings set auto_confirm = false where salon_id = sa;
  b3 := pg_temp.book(sa, c3, sty, (day + time '12:00') at time zone tz, svc)::uuid;
  perform pg_temp.ok((select status from bookings where id = b3) = 'pending', 'a request should wait for approval when approval is on');
  perform pg_temp.ok(pg_temp.mails(b3, 'booking_confirmation') = 0, 'the client was told they were confirmed before anyone approved');
  perform pg_temp.ok((select count(*) from inbox_items where booking_id = b3 and type = 'request' and status = 'new') = 1, 'the request should wait in the inbox once');
  perform pg_temp.ok(pg_temp.mails(b3, 'owner_new_booking') = 1, 'the salon should be emailed about the request');
  perform pg_temp.ok(pg_temp.book(sa, c4, sty, (day + time '12:30') at time zone tz, svc) like '%slot_unavailable%', 'a request waiting for approval should still hold its time');
  perform pg_temp.ok(pg_temp.dml(ub, format('select confirm_booking(%L)', b3)) like 'ERR%', 'another salon''s owner approved this salon''s request');
  perform pg_temp.ok((select status from bookings where id = b3) = 'pending', 'the other salon changed the request');
  perform pg_temp.ok(pg_temp.dml(uo, format('select confirm_booking(%L)', b3)) = 'OK 1', 'the owner could not approve the request');
  perform pg_temp.ok((select status from bookings where id = b3) = 'confirmed', 'the approved request is not confirmed');
  perform pg_temp.ok(pg_temp.mails(b3, 'booking_confirmation') = 1, 'approving should send exactly one confirmation');
  perform pg_temp.ok((select count(*) from inbox_items where booking_id = b3 and type = 'request' and status = 'handled') = 1, 'the request should be marked handled once approved');
  perform pg_temp.ok(pg_temp.dml(uo, format('select confirm_booking(%L)', b3)) like 'ERR%', 'a booking was approved twice');
  perform pg_temp.ok(pg_temp.mails(b3, 'booking_confirmation') = 1, 'approving twice sent a second confirmation');

  b3b := pg_temp.book(sa, c4, sty, (day + time '14:00') at time zone tz, svc)::uuid; -- a second request, which the salon declines
  perform pg_temp.ok((select status from bookings where id = b3b) = 'pending', 'second request is not pending');
  perform pg_temp.dml(uo, format('update bookings set status = ''cancelled'', cancelled_at = now() where id = %L', b3b)); -- what declining does
  perform pg_temp.dml(uo, format('update inbox_items set status = ''declined'', unread = false where booking_id = %L and type = ''request''', b3b));
  perform pg_temp.ok((select status from bookings where id = b3b) = 'cancelled', 'a declined request is still on the calendar');
  perform pg_temp.ok(pg_temp.mails(b3b, 'booking_cancelled') = 0, 'a declined request also sent a "cancelled" email on top of the decline message');
  r := pg_temp.book(sa, c5, sty, (day + time '14:00') at time zone tz, svc);
  perform pg_temp.ok(r not like 'ERR%', 'a declined request kept its time: ' || r);
  update bookings set status = 'cancelled' where id = r::uuid; -- only a probe
  update salon_settings set auto_confirm = true where salon_id = sa;

  ---------------------------------------------------------------- 4. The client moves their appointment with the link in their email
  tok := pg_temp.link(b1);
  b4 := pg_temp.book(sa, c4, sty, (day + time '15:00') at time zone tz, svc)::uuid;
  perform pg_temp.ok(pg_temp.try(format('select client_reschedule(%L, %L)', tok, (day + time '15:30') at time zone tz)) like '%slot_unavailable%', 'moved onto another client''s appointment');
  perform pg_temp.ok(pg_temp.try(format('select client_reschedule(%L, %L)', tok, ((day + 6) + time '10:00') at time zone tz)) like '%slot_unavailable%', 'moved to a closed day');
  perform pg_temp.ok(pg_temp.try(format('select client_reschedule(%L, %L)', tok, (day + time '16:30') at time zone tz)) like '%slot_unavailable%', 'moved to run past closing');
  perform pg_temp.ok((select starts_at from bookings where id = b1) = (day + time '10:00') at time zone tz, 'a refused move still changed the booking');
  perform pg_temp.ok(pg_temp.try(format('select client_reschedule(%L, %L)', tok, (day + time '11:00') at time zone tz)) = 'none', 'a move to a free time was refused');
  j := (select jsonb_build_object('s', starts_at, 'e', ends_at, 'st', status) from bookings where id = b1);
  perform pg_temp.ok((j ->> 's')::timestamptz = (day + time '11:00') at time zone tz and (j ->> 'e')::timestamptz = (day + time '12:00') at time zone tz and j ->> 'st' = 'confirmed', 'a moved booking has the wrong time, length or status: ' || j::text);
  perform pg_temp.ok((select count(*) from inbox_items where booking_id = b1 and type = 'reschedule') = 1, 'the salon should see one note that the client moved');
  perform pg_temp.ok(pg_temp.mails(b1, 'booking_confirmation') = 1, 'moving sent a second confirmation or lost the first');
  perform pg_temp.ok(pg_temp.mails(b1, 'owner_booking_moved') = 1 and (select to_address from notifications_outbox where booking_id = b1 and template = 'owner_booking_moved') = 'owner@shop.test', 'the salon should be emailed when a client moves their appointment');
  r := pg_temp.book(sa, c5, sty, (day + time '10:00') at time zone tz, svc);
  perform pg_temp.ok(r not like 'ERR%', 'the time the client left was not freed: ' || r);
  update bookings set status = 'cancelled' where id = r::uuid; -- only a probe
  -- a request to be moved by the salon (no time chosen) just reaches the inbox
  perform pg_temp.ok(pg_temp.try(format('select client_request_reschedule(%L, ''Could we go later in the day?'')', tok)) = 'none', 'a reschedule request was refused');
  perform pg_temp.ok((select count(*) from inbox_items where booking_id = b1 and type = 'reschedule' and body like 'Could we%') = 1, 'the reschedule request did not reach the inbox');
  perform pg_temp.ok(pg_temp.mails(b1, 'owner_reschedule_request') = 1, 'the salon should be emailed when a client asks for a different time');
  perform pg_temp.ok((select status from inbox_items where booking_id = b1 and type = 'reschedule' and body like 'Could we%') = 'new', 'a reschedule request should wait for staff');
  -- moving again emails the salon again (the earlier note about this booking is replaced)
  update notifications_outbox set status = 'sent' where booking_id = b1 and template = 'owner_booking_moved';
  perform pg_temp.ok(pg_temp.try(format('select client_reschedule(%L, %L)', tok, (day + time '10:00') at time zone tz)) = 'none', 'moving back to the first time was refused');
  perform pg_temp.ok(pg_temp.mails(b1, 'owner_booking_moved') = 1 and (select status from notifications_outbox where booking_id = b1 and template = 'owner_booking_moved') = 'queued', 'a second move did not email the salon again');
  update notifications_outbox set status = 'sent' where booking_id = b1 and template = 'owner_booking_moved';
  perform pg_temp.ok(pg_temp.try(format('select client_reschedule(%L, %L)', tok, (day + time '11:00') at time zone tz)) = 'none', 'moving to 11:00 again was refused'); -- back where the later steps expect it

  ---------------------------------------------------------------- 5. The client cancels with the link: in time, with a reason
  tok := pg_temp.link(b4);
  j := (select client_cancel(tok, 'I am unwell'));
  perform pg_temp.ok((j ->> 'late')::boolean = false, 'a cancellation days ahead was called late');
  perform pg_temp.ok((select status from bookings where id = b4) = 'cancelled' and (select cancelled_late from bookings where id = b4) = false and (select cancel_reason from bookings where id = b4) = 'Client cancelled', 'the cancelled booking was not recorded properly');
  perform pg_temp.ok(pg_temp.mails(b4, 'booking_cancelled') = 1 and (select to_address from notifications_outbox where booking_id = b4 and template = 'booking_cancelled') = 'c4@t.test', 'the client should get one cancellation email');
  perform pg_temp.ok(pg_temp.mails(b4, 'owner_booking_cancelled') = 1, 'the salon should be emailed about the cancellation, once');
  perform pg_temp.ok((select body from inbox_items where booking_id = b4 and type = 'cancellation') = 'Reason: I am unwell', 'the reason did not reach the inbox');
  perform pg_temp.ok(pg_temp.try(format('select client_cancel(%L, null)', tok)) like '%not_cancellable%', 'a booking was cancelled twice');
  perform pg_temp.ok(pg_temp.try(format('select client_reschedule(%L, %L)', tok, (day + time '15:00') at time zone tz)) like '%not_reschedulable%', 'a cancelled booking was moved');
  perform pg_temp.ok(pg_temp.try(format('select client_request_reschedule(%L, ''x'')', tok)) like '%not_reschedulable%', 'a cancelled booking took a reschedule request');
  perform pg_temp.ok(pg_temp.mails(b4, 'booking_cancelled') = 1 and pg_temp.mails(b4, 'owner_booking_cancelled') = 1, 'cancelling twice queued more emails');
  b5 := pg_temp.book(sa, c5, sty, (day + time '15:00') at time zone tz, svc)::uuid;
  perform pg_temp.ok(b5 is not null, 'a cancelled booking kept its time');

  -- links that should not work
  update booking_tokens set expires_at = now() - interval '1 day' where booking_id = b5 and purpose = 'manage_booking';
  perform pg_temp.ok(pg_temp.try(format('select client_cancel(%L, null)', pg_temp.link(b5))) like '%link_expired%', 'an expired link cancelled a booking');
  perform pg_temp.ok(pg_temp.try('select client_cancel(''not-a-real-link'', null)') like '%link_expired%', 'a made-up link cancelled something');
  perform pg_temp.ok(pg_temp.try('select client_reschedule(''not-a-real-link'', now() + interval ''3 days'')') like '%link_expired%', 'a made-up link moved something');
  perform pg_temp.ok((select status from bookings where id = b5) = 'confirmed', 'a bad link changed the booking');
  update booking_tokens set expires_at = now() + interval '30 days' where booking_id = b5;

  ---------------------------------------------------------------- 6. A late cancellation (inside the free-cancellation window) is marked late
  b6 := pg_temp.idu(uo, format('select create_booking(%L, %L, %L, %L, array[%L]::uuid[], ''staff'', null, ''staff'')', sa, c6, sty2, now() + interval '3 hours', svc));
  j := (select client_cancel(pg_temp.link(b6), null));
  perform pg_temp.ok((j ->> 'late')::boolean = true and (select cancelled_late from bookings where id = b6) = true, 'a cancellation 3 hours before was not marked late');
  perform pg_temp.ok((select count(*) from inbox_items where booking_id = b6 and type = 'cancellation' and body is null) = 1, 'a cancellation without a reason should still reach the inbox');

  ---------------------------------------------------------------- 7. The salon cancels, with a reason
  b7 := pg_temp.idu(uo, format('select create_booking(%L, %L, %L, %L, array[%L]::uuid[], ''staff'', null, ''staff'')', sa, c1, sty2, ((day + 1) + time '10:00') at time zone tz, svc));
  perform pg_temp.ok(pg_temp.mails(b7, 'booking_confirmation') = 1, 'a booking made by staff should email the client a confirmation');
  perform pg_temp.ok(pg_temp.dml(uo, format('update bookings set status = ''cancelled'', cancelled_at = now(), cancel_reason = ''Stylist unwell'' where id = %L', b7)) = 'OK 1', 'the owner could not cancel');
  perform pg_temp.ok(pg_temp.mails(b7, 'booking_cancelled') = 1, 'the client should be told when the salon cancels');
  perform pg_temp.ok(pg_temp.mails(b7, 'owner_booking_cancelled') = 0, 'the salon was emailed about its own cancellation');
  perform pg_temp.dml(uo, format('update bookings set status = ''cancelled'' where id = %L', b7));
  perform pg_temp.ok(pg_temp.mails(b7, 'booking_cancelled') = 1, 'saving a cancelled booking again sent another email');
  perform pg_temp.ok(pg_temp.try(format('select client_cancel(%L, null)', pg_temp.link(b7))) like '%not_cancellable%', 'a booking the salon cancelled could be cancelled again by the client');

  ---------------------------------------------------------------- 8. A no-show: only a past appointment, cannot be billed, is counted
  insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status) values (sa, c6, sty, now() - interval '3 hours', now() - interval '2 hours', 'confirmed') returning id into b8;
  insert into booking_services (booking_id, service_id, price_cents, duration_min) values (b8, svc, 5000, 60);
  perform pg_temp.ok(pg_temp.dml(uo, format('update bookings set status = ''no_show'' where id = %L', b8)) = 'OK 1', 'the owner could not record a no-show');
  begin perform pg_temp.idu(uo, format('select create_sale(%L, null, ''[]''::jsonb, 0, null)', b8)); r := 'billed'; exception when others then r := sqlerrm; end;
  perform pg_temp.ok(r like '%booking_not_billable%', 'a no-show should not be billable, got: ' || r);
  perform pg_temp.ok(pg_temp.mails(b8, 'booking_cancelled') = 0, 'a no-show queued a cancellation email');
  perform pg_temp.ok(pg_temp.try(format('select client_cancel(%L, null)', pg_temp.link(b8))) not like 'none', 'a no-show could be cancelled by the client');

  ---------------------------------------------------------------- 9. A visit: check in, start, pay with a tip; then the booking is final
  b10 := pg_temp.book(sa, c1, sty, ((day + 2) + time '10:00') at time zone tz, svc)::uuid;
  perform pg_temp.ok(pg_temp.dml(uo, format('update bookings set status = ''checked_in'' where id = %L', b10)) = 'OK 1', 'check-in failed');
  perform pg_temp.ok(pg_temp.dml(uo, format('update bookings set status = ''in_progress'' where id = %L', b10)) = 'OK 1', 'starting the visit failed');
  s10 := pg_temp.idu(uo, format('select create_sale(%L, null, ''[]''::jsonb, 10, null)', b10));
  perform pg_temp.ok((select subtotal_cents from sales where id = s10) = 5000 and (select tip_cents from sales where id = s10) = 500 and (select total_cents from sales where id = s10) = 5500 and (select tax_cents from sales where id = s10) = 652,
    'the visit''s sale is wrong: ' || (select format('sub %s tip %s total %s tax %s', subtotal_cents, tip_cents, total_cents, tax_cents) from sales where id = s10));
  perform pg_temp.ok((select staff_id from sales where id = s10) = sty and (select client_id from sales where id = s10) = c1, 'the sale belongs to the wrong stylist or client');
  perform pg_temp.ok(pg_temp.dml(uo, format('select complete_sale(%L, ''cash'')', s10)) = 'OK 1', 'the visit could not be paid in cash');
  perform pg_temp.ok((select status from bookings where id = b10) = 'completed' and (select status from sales where id = s10) = 'paid', 'paying did not complete the booking');
  perform pg_temp.ok(pg_temp.try(format('select client_cancel(%L, null)', pg_temp.link(b10))) like '%not_cancellable%', 'a paid visit could be cancelled by the client');
  perform pg_temp.ok(pg_temp.try(format('select client_reschedule(%L, %L)', pg_temp.link(b10), ((day + 2) + time '13:00') at time zone tz)) like '%not_reschedulable%', 'a paid visit could be moved by the client');

  ---------------------------------------------------------------- 10. Cancelling a booking that already has a sale waiting for payment
  b11 := pg_temp.book(sa, c2, sty, ((day + 2) + time '11:00') at time zone tz, svc)::uuid;
  s11 := pg_temp.idu(uo, format('select create_sale(%L, null, ''[]''::jsonb, 0, null)', b11));
  perform pg_temp.dml(uo, format('update bookings set status = ''cancelled'', cancelled_at = now(), cancel_reason = ''Client asked'' where id = %L', b11));
  perform pg_temp.ok(not exists (select 1 from sales where id = s11), 'cancelling a booking left its unpaid sale open on the Sales list');
  -- but a sale with a card payment under way is left for staff to deal with
  b11b := pg_temp.book(sa, c2, sty, ((day + 2) + time '11:00') at time zone tz, svc)::uuid;
  s11b := pg_temp.idu(uo, format('select create_sale(%L, null, ''[]''::jsonb, 0, null)', b11b));
  insert into card_payments (salon_id, sale_id, kind, txn_ref, amount_cents) values (sa, s11b, 'terminal', 'BD' || substr(gen_random_uuid()::text, 1, 10), 5000);
  perform pg_temp.dml(uo, format('update bookings set status = ''cancelled'', cancelled_at = now(), cancel_reason = ''Client asked'' where id = %L', b11b));
  perform pg_temp.ok((select status from sales where id = s11b) = 'pending', 'a sale with a card payment under way was removed when its booking was cancelled');
  -- a no-show also clears the open sale
  insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status) values (sa, c5, sty2, now() - interval '5 hours', now() - interval '4 hours', 'confirmed') returning id into b9;
  insert into booking_services (booking_id, service_id, price_cents, duration_min) values (b9, svc, 5000, 60);
  s9 := pg_temp.idu(uo, format('select create_sale(%L, null, ''[]''::jsonb, 0, null)', b9));
  perform pg_temp.dml(uo, format('update bookings set status = ''no_show'' where id = %L', b9));
  perform pg_temp.ok(not exists (select 1 from sales where id = s9), 'a no-show left its unpaid sale open on the Sales list');

  ---------------------------------------------------------------- 11. A prepaid package: bought, used on two visits, a cancelled visit costs nothing, used up
  insert into service_packages (salon_id, service_id, name, uses, price_cents) values (sa, svc, '3 cuts', 3, 12000) returning id into pk;
  pkg_sale := pg_temp.idu(uo, format('select create_package_sale(null, %L, %L)', pk, c1));
  select id into cpk from client_packages where sale_id = pkg_sale;
  perform pg_temp.ok((select total_cents from sales where id = pkg_sale) = 12000, 'the package sale total is wrong');
  perform pg_temp.ok(pg_temp.dml(uo, format('select complete_sale(%L, ''cash'')', pkg_sale)) = 'OK 1', 'the package could not be paid');
  use_json := format('[{"client_package_id": "%s", "service_id": "%s"}]', cpk, svc);

  b12 := pg_temp.book(sa, c1, sty, ((day + 3) + time '10:00') at time zone tz, svc)::uuid;
  s12 := pg_temp.idu(uo, format('select create_sale(%L, null, ''[]''::jsonb, 0, null)', b12));
  perform pg_temp.dml(uo, format('select apply_packages_to_sale(%L, %L::jsonb)', s12, use_json));
  perform pg_temp.ok((select total_cents from sales where id = s12) = 0, 'a package visit still has money to pay');
  perform pg_temp.ok(pg_temp.dml(uo, format('select complete_sale(%L, ''package'')', s12)) = 'OK 1', 'the package visit could not be closed');
  select uses_left into left_ from client_package_status where id = cpk;
  perform pg_temp.ok(left_ = 2, 'first visit should leave 2 uses, not ' || left_);
  perform pg_temp.ok((select status from bookings where id = b12) = 'completed', 'the package visit''s booking was not completed');

  b13 := pg_temp.book(sa, c1, sty, ((day + 3) + time '11:00') at time zone tz, svc)::uuid; -- a booking that is cancelled before checkout takes no use
  perform pg_temp.dml(uo, format('update bookings set status = ''cancelled'', cancelled_at = now(), cancel_reason = ''Client asked'' where id = %L', b13));
  select uses_left into left_ from client_package_status where id = cpk;
  perform pg_temp.ok(left_ = 2, 'a cancelled booking used up a package visit');

  b14 := pg_temp.book(sa, c1, sty, ((day + 3) + time '12:00') at time zone tz, svc)::uuid;
  s14 := pg_temp.idu(uo, format('select create_sale(%L, null, ''[]''::jsonb, 0, null)', b14));
  perform pg_temp.dml(uo, format('select apply_packages_to_sale(%L, %L::jsonb)', s14, use_json));
  perform pg_temp.dml(uo, format('select complete_sale(%L, ''package'')', s14));
  select uses_left into left_ from client_package_status where id = cpk;
  perform pg_temp.ok(left_ = 1, 'second visit should leave 1 use, not ' || left_);

  -- a visit with the last use that is then cancelled before it is paid
  b15 := pg_temp.book(sa, c1, sty, ((day + 3) + time '13:00') at time zone tz, svc)::uuid;
  s15 := pg_temp.idu(uo, format('select create_sale(%L, null, ''[]''::jsonb, 0, null)', b15));
  perform pg_temp.dml(uo, format('select apply_packages_to_sale(%L, %L::jsonb)', s15, use_json));
  select uses_left into left_ from client_package_status where id = cpk;
  perform pg_temp.ok(left_ = 0, 'a use held on an open sale should be counted');
  perform pg_temp.dml(uo, format('update bookings set status = ''cancelled'', cancelled_at = now(), cancel_reason = ''Client asked'' where id = %L', b15));
  select uses_left into left_ from client_package_status where id = cpk;
  perform pg_temp.ok(left_ = 1 and not exists (select 1 from sales where id = s15), 'cancelling a booking should give back a package use held by its open sale');

  b16 := pg_temp.book(sa, c1, sty, ((day + 3) + time '14:00') at time zone tz, svc)::uuid;
  s16 := pg_temp.idu(uo, format('select create_sale(%L, null, ''[]''::jsonb, 0, null)', b16));
  perform pg_temp.dml(uo, format('select apply_packages_to_sale(%L, %L::jsonb)', s16, use_json));
  perform pg_temp.dml(uo, format('select complete_sale(%L, ''package'')', s16));
  select uses_left into left_ from client_package_status where id = cpk;
  perform pg_temp.ok(left_ = 0, 'third visit should use the package up');
  s13 := pg_temp.idu(uo, format('select create_sale(%L, null, ''[]''::jsonb, 0, null)', pg_temp.book(sa, c1, sty, ((day + 4) + time '10:00') at time zone tz, svc)::uuid));
  perform pg_temp.ok(pg_temp.try(format('select apply_packages_to_sale(%L, %L::jsonb)', s13, use_json)) like '%package_used_up%', 'a used up package was used again');
  perform pg_temp.ok((select total_cents from sales where id = s13) = 5000, 'a refused package use changed the price');

  ---------------------------------------------------------------- 12. The books agree with the day
  perform pg_temp.ok((select count(*) from bookings b where b.salon_id = sa and b.status = 'completed' and not exists (select 1 from sales s where s.booking_id = b.id and s.status = 'paid')) = 0, 'a completed booking has no paid sale');
  perform pg_temp.ok((select count(*) from sales s join bookings b on b.id = s.booking_id where s.salon_id = sa and s.status = 'paid' and b.status <> 'completed') = 0, 'a paid visit is not completed');
  perform pg_temp.ok((select count(*) from bookings b where b.salon_id = sa and b.status in ('pending', 'confirmed') and pg_temp.link(b.id) is null) = 0, 'a live booking has no manage link');
  perform pg_temp.ok((select count(*) from (select booking_id, template, channel from notifications_outbox where salon_id = sa and booking_id is not null group by 1, 2, 3 having count(*) > 1) d) = 0, 'a booking was sent the same email twice');
  perform pg_temp.ok((select count(*) from notifications_outbox where salon_id = sa and template in ('booking_cancelled', 'owner_booking_cancelled') and booking_id in (select id from bookings where status <> 'cancelled')) = 0, 'a cancellation email exists for a booking that is not cancelled');

  j := pg_temp.jsonu(uo, format('select sales_summary(%L, %L)', today - 1, day + 10));
  perform pg_temp.ok(j ->> 'error' is null, 'the summary failed: ' || coalesce(j ->> 'error', ''));
  -- paid on the day: the 55.00 cash visit, the 120.00 package bought in cash, and three 0.00 package visits
  perform pg_temp.ok((j ->> 'sales_count')::int = 5, 'summary counted ' || (j ->> 'sales_count') || ' sales, expected 5');
  perform pg_temp.ok((j ->> 'total_cents')::int = 5500 + 12000, 'summary total ' || (j ->> 'total_cents') || ', expected 17500');
  perform pg_temp.ok((j ->> 'tips_cents')::int = 500, 'summary tips ' || (j ->> 'tips_cents') || ', expected 500');
  perform pg_temp.ok((select (m ->> 'cents')::int from jsonb_array_elements(j -> 'by_method') m where m ->> 'method' = 'cash') = 17500, 'cash takings are wrong');
  perform pg_temp.ok((select (m ->> 'count')::int from jsonb_array_elements(j -> 'by_method') m where m ->> 'method' = 'package') = 3, 'three package visits should show under the package method');
  perform pg_temp.ok((j ->> 'cash_expected_cents')::int = 17500, 'cash expected in the drawer is wrong: ' || (j ->> 'cash_expected_cents'));
  perform pg_temp.ok((j -> 'appointments' ->> 'completed')::int = 4, 'completed appointments: ' || (j -> 'appointments' ->> 'completed') || ', expected 4');
  perform pg_temp.ok((j -> 'appointments' ->> 'no_shows')::int = 2, 'no-shows: ' || (j -> 'appointments' ->> 'no_shows') || ', expected 2');
  -- cancelled: b3b declined (no reason), b4 client, b6 client late, b7 salon, b11 + b13 + b15 salon-side with a reason
  perform pg_temp.ok((select coalesce(sum((x ->> 'count')::int), 0) from jsonb_array_elements(j -> 'appointments' -> 'cancelled') x) = (select count(*) from bookings where salon_id = sa and status = 'cancelled' and starts_at between (today - 1)::timestamptz and (day + 11)::timestamptz),
    'cancelled appointments in the summary do not match the calendar');
  perform pg_temp.ok((select (x ->> 'count')::int from jsonb_array_elements(j -> 'appointments' -> 'cancelled') x where x ->> 'reason' = 'Client cancelled') = 2, 'client cancellations should be counted under "Client cancelled"');
  perform pg_temp.ok((select (x ->> 'count')::int from jsonb_array_elements(j -> 'appointments' -> 'cancelled') x where x ->> 'reason' = 'Stylist unwell') = 1, 'the salon''s own reason was lost from the summary');

  -- payroll: service money on a paid sale goes to the stylist on that sale, commission on it; package visits earn nothing, the package purchase earns on the day it is paid
  j := pg_temp.jsonu(uo, format('select jsonb_agg(to_jsonb(w)) from payroll_week(%L, %L) w', today - 1, day + 10));
  perform pg_temp.ok(j ->> 'error' is null, 'payroll failed: ' || coalesce(j ->> 'error', ''));
  perform pg_temp.ok((select (w ->> 'tips_cents')::int from jsonb_array_elements(j) w where w ->> 'staff_id' = sty::text) = 500, 'the tip on the paid visit should be the stylist''s');
  perform pg_temp.ok((select coalesce(sum((w ->> 'service_cents')::int), 0) from jsonb_array_elements(j) w) = 5000 + 12000, 'payroll service money should be the visit plus the package purchase');
  perform pg_temp.ok((select sum((w ->> 'service_commission_cents')::int) from jsonb_array_elements(j) w where w ->> 'staff_id' = sty::text) = round((select coalesce(sum(si.price_cents * si.qty), 0) from sales s join sale_items si on si.sale_id = s.id where s.staff_id = sty and s.status = 'paid' and si.service_id is not null) * 0.40),
    'the stylist''s commission is not 40 percent of their service money');

  perform pg_temp.ok(pg_temp.jsonu(us, format('select sales_summary(%L, %L)', today - 1, day + 10)) ->> 'error' = '42501', 'a stylist saw the takings');
  -- the "cancellations and changes" switch in Settings turns the salon's emails about moves and cancellations off
  update salon_settings set notify_cancellation = false where salon_id = sa;
  bx := pg_temp.book(sa, c6, sty, ((day + 5) + time '10:00') at time zone tz, svc)::uuid;
  perform pg_temp.ok(pg_temp.try(format('select client_reschedule(%L, %L)', pg_temp.link(bx), ((day + 5) + time '11:00') at time zone tz)) = 'none', 'a move was refused');
  perform pg_temp.ok(pg_temp.mails(bx, 'owner_booking_moved') = 0, 'a move emailed the salon although that switch is off');
  perform pg_temp.ok(pg_temp.try(format('select client_cancel(%L, null)', pg_temp.link(bx))) = 'none', 'a cancellation was refused');
  perform pg_temp.ok(pg_temp.mails(bx, 'owner_booking_cancelled') = 0, 'a cancellation emailed the salon although that switch is off');
  raise notice 'OBSERVATIONS:%', coalesce(nullif(obs, ''), ' none');
end $t$;
