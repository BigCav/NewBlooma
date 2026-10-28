-- A completed visit cannot be cancelled, marked no-show or reopened; other bookings still change normally.
do $t$
declare sa uuid := pg_temp.f('sa'); ua uuid := pg_temp.f('ua'); bka uuid := pg_temp.f('bka');
begin
  perform pg_temp.ok(pg_temp.dml_as(ua, format('update bookings set status = ''checked_in'' where id = %L', bka)) = 'OK 1', 'owner could not check a booking in');
  update bookings set status = 'completed' where id = bka;
  perform pg_temp.ok(pg_temp.dml_as(ua, format('update bookings set status = ''cancelled'', cancelled_at = now() where id = %L', bka)) like 'ERR%', 'a completed visit was cancelled');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('update bookings set status = ''no_show'' where id = %L', bka)) like 'ERR%', 'a completed visit was marked no-show');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('update bookings set status = ''confirmed'' where id = %L', bka)) like 'ERR%', 'a completed visit was reopened');
  perform pg_temp.ok((select status from bookings where id = bka) = 'completed', 'the visit is no longer completed');
  perform pg_temp.ok(not exists (select 1 from notifications_outbox where booking_id = bka and template like '%cancel%'), 'a cancellation email was queued for a completed visit');
end $t$;
