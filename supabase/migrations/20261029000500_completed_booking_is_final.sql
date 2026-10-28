-- A completed visit is the record of a paid sale. Nothing in the app moves a booking out of "completed", but a stray click on Cancel or
-- No-show (or a direct call) could, which also emailed the client that their visit had been cancelled. Completed is now final.
create or replace function bookings_completed_is_final() returns trigger language plpgsql as $$
begin
  if old.status = 'completed' and new.status is distinct from old.status then
    raise exception 'booking_not_editable' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists bookings_completed_is_final on bookings;
create trigger bookings_completed_is_final before update of status on bookings for each row execute function bookings_completed_is_final();
