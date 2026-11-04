-- The salon is emailed when a client moves their appointment from the link in their email, or asks for a different time.
-- It follows the "cancellations and changes" switch in Settings. A booking can be moved again later, so the earlier note about it is replaced
-- (the outbox keeps one row per booking and kind) and the new move is emailed too.
create or replace function queue_owner_notification() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_email text; v_new boolean; v_cancel boolean; v_tpl text;
begin
  if new.booking_id is null or new.type not in ('booking', 'request', 'cancellation', 'reschedule') then return new; end if;
  select s.email, st.notify_new_booking, st.notify_cancellation into v_email, v_new, v_cancel
  from salons s join salon_settings st on st.salon_id = s.id where s.id = new.salon_id;
  if v_email is null then return new; end if;
  if new.type = 'cancellation' then
    if coalesce(v_cancel, true) then v_tpl := 'owner_booking_cancelled'; end if;
  elsif new.type = 'reschedule' then
    if coalesce(v_cancel, true) then v_tpl := case when new.status = 'handled' then 'owner_booking_moved' else 'owner_reschedule_request' end; end if;
  else
    if coalesce(v_new, true) then v_tpl := 'owner_new_booking'; end if;
  end if;
  if v_tpl is null then return new; end if;
  if new.type = 'reschedule' then
    delete from notifications_outbox where booking_id = new.booking_id and template = v_tpl and channel = 'email';
  end if;
  insert into notifications_outbox (salon_id, booking_id, channel, to_address, template)
  values (new.salon_id, new.booking_id, 'email', v_email, v_tpl) on conflict do nothing;
  return new;
end $$;
revoke execute on function queue_owner_notification() from public, anon, authenticated;
