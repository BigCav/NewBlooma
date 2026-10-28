-- A reminder is sent once per booking. Moving the appointment used to leave the old reminder on record, so a booking moved after its
-- reminder went out never got another one for the new time. Moving a booking now clears its reminders so they are worked out again.
create or replace function bookings_reset_reminders() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.starts_at is distinct from old.starts_at then
    delete from notifications_outbox where booking_id = new.id and template in ('reminder_24h', 'reminder_2h');
  end if;
  return new;
end $$;
revoke execute on function bookings_reset_reminders() from public, anon, authenticated;
drop trigger if exists bookings_reset_reminders on bookings;
create trigger bookings_reset_reminders after update of starts_at on bookings for each row execute function bookings_reset_reminders();
