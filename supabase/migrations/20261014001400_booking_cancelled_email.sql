-- Queue a cancellation email whenever a confirmed booking is cancelled, whoever cancels it
-- (staff, an edit that removes the booking, or the client's own link). Pending requests are skipped:
-- declining one already sends its own message with the reason.
create or replace function queue_cancellation_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_email text; v_on boolean;
begin
  if new.status = 'cancelled' and old.status in ('confirmed', 'checked_in', 'in_progress') and new.starts_at > now() then
    select email into v_email from clients where id = new.client_id;
    select coalesce(email_confirmations, true) into v_on from salon_settings where salon_id = new.salon_id;
    if v_email is not null and coalesce(v_on, true) then
      insert into notifications_outbox (salon_id, booking_id, channel, to_address, template)
      values (new.salon_id, new.id, 'email', v_email, 'booking_cancelled') on conflict do nothing;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists bookings_cancel_email on bookings;
create trigger bookings_cancel_email after update of status on bookings
  for each row when (new.status is distinct from old.status) execute function queue_cancellation_email();
