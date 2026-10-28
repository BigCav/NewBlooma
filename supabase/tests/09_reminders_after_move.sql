-- Moving an appointment clears its old reminders (so they are worked out again for the new time) and leaves other messages alone.
do $t$
declare sa uuid := pg_temp.f('sa'); bka uuid := pg_temp.f('bka'); n int;
begin
  insert into notifications_outbox (salon_id, booking_id, channel, to_address, template, status) values
    (sa, bka, 'email', 'ca@t.test', 'reminder_24h', 'sent'),
    (sa, bka, 'sms', '0211111111', 'reminder_2h', 'sent'),
    (sa, bka, 'email', 'ca@t.test', 'booking_confirmation', 'sent');
  update bookings set notes = 'touched' where id = bka;
  select count(*) into n from notifications_outbox where booking_id = bka and template like 'reminder%';
  perform pg_temp.ok(n = 2, 'reminders were cleared although the time did not change');
  update bookings set starts_at = starts_at + interval '1 day', ends_at = ends_at + interval '1 day' where id = bka;
  select count(*) into n from notifications_outbox where booking_id = bka and template like 'reminder%';
  perform pg_temp.ok(n = 0, 'old reminders stayed after the appointment moved');
  select count(*) into n from notifications_outbox where booking_id = bka and template = 'booking_confirmation';
  perform pg_temp.ok(n = 1, 'the confirmation record was removed');
end $t$;
