-- If the offered time was taken before the client accepted, put them back to waiting and say so by returning null.
-- Raising an error here undid the reset, so the client stayed "offered" until the hold ran out and missed other openings.
create or replace function accept_offer(p_token text)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare t booking_tokens; e waitlist_entries; v_booking uuid;
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into t from booking_tokens where token = p_token and purpose = 'accept_offer' for update;
  if t.token is null or t.used_at is not null or t.expires_at < now() then raise exception 'offer_expired'; end if;
  select * into e from waitlist_entries where id = t.waitlist_id for update;
  if e.status <> 'offered' then raise exception 'offer_expired'; end if;
  begin
    v_booking := create_booking(e.salon_id, e.client_id, e.offered_staff_id, e.offered_start, array[e.service_id], 'waitlist', null, 'offer');
  exception when others then
    update waitlist_entries set status = 'waiting', offered_staff_id = null, offered_start = null, offer_expires_at = null where id = e.id;
    update booking_tokens set used_at = now() where token = p_token;
    return null;
  end;
  update waitlist_entries set status = 'booked', booking_id = v_booking where id = e.id;
  update booking_tokens set used_at = now() where token = p_token;
  return v_booking;
end $function$;
