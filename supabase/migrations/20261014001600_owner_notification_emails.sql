-- Email the salon owner about new online bookings and client cancellations, following the two
-- "Tell me about..." switches in Settings. Inbox items are only created for those client-driven events.
create or replace function queue_owner_notification() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_email text; v_new boolean; v_cancel boolean;
begin
  if new.booking_id is null or new.type not in ('booking', 'request', 'cancellation') then return new; end if;
  select s.email, st.notify_new_booking, st.notify_cancellation into v_email, v_new, v_cancel
  from salons s join salon_settings st on st.salon_id = s.id where s.id = new.salon_id;
  if v_email is null then return new; end if;
  if new.type = 'cancellation' and coalesce(v_cancel, true) then
    insert into notifications_outbox (salon_id, booking_id, channel, to_address, template)
    values (new.salon_id, new.booking_id, 'email', v_email, 'owner_booking_cancelled') on conflict do nothing;
  elsif new.type <> 'cancellation' and coalesce(v_new, true) then
    insert into notifications_outbox (salon_id, booking_id, channel, to_address, template)
    values (new.salon_id, new.booking_id, 'email', v_email, 'owner_new_booking') on conflict do nothing;
  end if;
  return new;
end $$;
revoke execute on function queue_owner_notification() from public, anon, authenticated;
drop trigger if exists inbox_owner_email on inbox_items;
create trigger inbox_owner_email after insert on inbox_items for each row execute function queue_owner_notification();
