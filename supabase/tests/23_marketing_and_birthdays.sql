-- Marketing and birthdays. Only the owner reaches the marketing tools; a stylist cannot read who a group message would reach, change the automatic messages or
-- read what was sent. A birthday is a day and a month only. The daily queue is for the server, never for a signed-in user, and it does not repeat itself.

do $t$
declare
  sa uuid := pg_temp.f('sa'); ua uuid := pg_temp.f('ua'); us uuid := pg_temp.f('us'); cla uuid := pg_temp.f('cla');
  r text; n1 int; n2 int;
begin
  ---------------------------------------------------------------- 1. Who may use the tools
  perform pg_temp.ok(pg_temp.dml_as(ua, 'select * from marketing_audience(''all'', 0, null)') like 'OK %', 'the owner could not list a group');
  perform pg_temp.ok(pg_temp.dml_as(us, 'select * from marketing_audience(''all'', 0, null)') like 'ERR%', 'a stylist listed a group of clients');
  r := pg_temp.dml_as(ua, format('insert into marketing_settings (salon_id, winback_on) values (%L, true)', sa));
  perform pg_temp.ok(r = 'OK 1', 'the owner could not switch on an automatic message: ' || r);
  r := pg_temp.dml_as(us, format('update marketing_settings set winback_on = false where salon_id = %L', sa));
  perform pg_temp.ok(r = 'OK 0' or r like 'ERR%', 'a stylist changed the automatic messages: ' || r);
  perform pg_temp.ok(pg_temp.dml_as(us, 'select * from marketing_settings') = 'OK 0', 'a stylist read the automatic messages');
  perform pg_temp.ok(pg_temp.dml_as(us, 'select * from marketing_log') = 'OK 0', 'a stylist read what was sent');

  ---------------------------------------------------------------- 2. The daily queue is for the server
  perform pg_temp.ok(pg_temp.dml_as(ua, 'select enqueue_marketing(false)') like 'ERR%', 'a signed-in owner ran the server-only queue');
  perform pg_temp.ok(pg_temp.dml_as(us, 'select enqueue_marketing(false)') like 'ERR%', 'a stylist ran the server-only queue');

  ---------------------------------------------------------------- 3. Birthdays are a day and a month in the year 2000
  update clients set marketing = true, birthday = make_date(2000, extract(month from now())::int, extract(day from now())::int), email = coalesce(email, 'bday@example.test') where id = cla;
  perform pg_temp.ok(pg_temp.dml_as(ua, format('update clients set birthday = %L where id = %L', '1990-05-05', cla)) like 'ERR%', 'a birthday with a real year was accepted');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('update clients set birthday = %L where id = %L', '2000-02-29', cla)) = 'OK 1', '29 February was refused');

  ---------------------------------------------------------------- 4. The queue sends a birthday once and never to someone who has not agreed
  update marketing_settings set birthday_on = true, winback_on = false where salon_id = sa;
  update clients set birthday = make_date(2000, extract(month from now() at time zone s.timezone)::int, extract(day from now() at time zone s.timezone)::int) from salons s where s.id = sa and clients.id = cla;
  update clients set marketing = false where id = cla;
  n1 := enqueue_marketing(false);
  perform pg_temp.ok(not exists (select 1 from notifications_outbox where template = 'birthday' and (payload ->> 'client_id')::uuid = cla), 'a client who has not agreed was sent a birthday message');
  update clients set marketing = true where id = cla;
  n1 := enqueue_marketing(false);
  n2 := enqueue_marketing(false);
  perform pg_temp.ok(n1 >= 1 and n2 = 0, format('the birthday message was not sent exactly once (first run %s, second run %s)', n1, n2));
end $t$;
