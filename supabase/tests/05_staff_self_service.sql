-- What a team member can do to their own records by calling the database directly: clock in and out honestly, and nothing else.
do $t$
declare
  sa uuid := pg_temp.f('sa'); ua uuid := pg_temp.f('ua'); us uuid := pg_temp.f('us'); stfs uuid := pg_temp.f('stfs'); tid uuid;
begin
  -- clocking in and out as the app does it
  perform pg_temp.ok(pg_temp.dml_as(us, format('insert into timesheets (salon_id,staff_id,clock_in) values (%L,%L,now() - interval ''1 minute'')', sa, stfs)) = 'OK 1', 'stylist could not clock in');
  perform pg_temp.ok(pg_temp.dml_as(us, format('update timesheets set clock_out = now() where staff_id = %L and clock_out is null', stfs)) = 'OK 1', 'stylist could not clock out');

  -- but not write their own hours
  perform pg_temp.ok(pg_temp.dml_as(us, format('insert into timesheets (salon_id,staff_id,clock_in,clock_out) values (%L,%L,now() - interval ''20 hours'', now() - interval ''5 hours'')', sa, stfs)) like 'ERR%', 'stylist added a made-up shift');
  perform pg_temp.ok(pg_temp.dml_as(us, format('insert into timesheets (salon_id,staff_id,clock_in) values (%L,%L,now() - interval ''6 hours'')', sa, stfs)) like 'ERR%', 'stylist clocked in at an earlier time');
  perform pg_temp.ok(pg_temp.dml_as(us, format('insert into timesheets (salon_id,staff_id,clock_in) values (%L,%L,now() + interval ''6 hours'')', sa, stfs)) like 'ERR%', 'stylist clocked in at a later time');
  perform set_config('request.jwt.claims', '', true); -- back to the server's own login for set-up
  insert into timesheets (salon_id, staff_id, clock_in, clock_out) values (sa, stfs, now() - interval '30 hours', now() - interval '29 hours') returning id into tid;
  perform pg_temp.ok(pg_temp.dml_as(us, format('update timesheets set clock_in = now() - interval ''40 hours'' where id = %L', tid)) like 'ERR%' or (select clock_in from timesheets where id = tid) > now() - interval '31 hours', 'stylist moved the start of a finished shift');
  perform pg_temp.ok(pg_temp.dml_as(us, format('update timesheets set clock_out = now() where id = %L', tid)) like 'ERR%' or (select clock_out from timesheets where id = tid) < now() - interval '28 hours', 'stylist stretched a finished shift');
  perform pg_temp.ok(pg_temp.dml_as(us, format('delete from timesheets where id = %L', tid)) in ('OK 0') or pg_temp.dml_as(us, format('delete from timesheets where id = %L', tid)) like 'ERR%', 'stylist deleted a finished shift');
  perform pg_temp.ok((select count(*) from timesheets where id = tid) = 1, 'the finished shift is gone');

  -- the owner can still fix a missed clock-out
  perform pg_temp.ok(pg_temp.dml_as(ua, format('update timesheets set clock_out = clock_in + interval ''2 hours'' where id = %L', tid)) = 'OK 1', 'owner could not edit a shift');
end $t$;

-- reviews belong to the client who wrote them: staff may reply but not change or create them
do $t$
declare sa uuid := pg_temp.f('sa'); us uuid := pg_temp.f('us'); cla uuid := pg_temp.f('cla'); stfa uuid := pg_temp.f('stfa'); bka uuid := pg_temp.f('bka'); rid uuid;
begin
  insert into reviews (salon_id, booking_id, client_id, staff_id, stars, body, reviewer_name) values (sa, bka, cla, stfa, 2, 'Not great', 'Client A') returning id into rid;
  perform pg_temp.ok(pg_temp.dml_as(us, format('update reviews set stars = 5, body = ''Amazing'' where id = %L', rid)) like 'ERR%' or (select stars from reviews where id = rid) = 2, 'stylist rewrote a review');
  perform pg_temp.ok(pg_temp.dml_as(us, format('delete from reviews where id = %L', rid)) like 'ERR%' or (select count(*) from reviews where id = rid) = 1, 'stylist deleted a review');
  perform pg_temp.ok(pg_temp.dml_as(us, format('insert into reviews (salon_id,booking_id,client_id,staff_id,stars,body) values (%L,%L,%L,%L,5,''Fab'')', sa, pg_temp.f('bka'), cla, stfa)) like 'ERR%', 'stylist wrote a fake review');
end $t$;
