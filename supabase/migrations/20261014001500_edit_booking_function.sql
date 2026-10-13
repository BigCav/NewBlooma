-- Changes a booking's services and start time in one step. booking_services is read-only for signed-in users
-- (prices and durations are snapshots), so edits go through this function.
create or replace function edit_booking(p_booking uuid, p_starts_at timestamptz, p_remove uuid[], p_add uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings; v_dur int;
begin
  select * into b from bookings where id = p_booking for update;
  if b.id is null then raise exception 'booking_not_found'; end if;
  perform assert_salon_access(b.salon_id);
  if b.status in ('cancelled', 'no_show', 'completed') then raise exception 'booking_not_editable'; end if;

  delete from booking_services where booking_id = p_booking and service_id = any(coalesce(p_remove, '{}'::uuid[]));
  insert into booking_services (booking_id, service_id, price_cents, duration_min)
    select p_booking, s.id, s.price_cents, s.duration_min
    from services s
    where s.id = any(coalesce(p_add, '{}'::uuid[])) and s.salon_id = b.salon_id and s.active
      and not exists (select 1 from booking_services x where x.booking_id = p_booking and x.service_id = s.id);

  select coalesce(sum(duration_min), 0) into v_dur from booking_services where booking_id = p_booking;
  if v_dur <= 0 then raise exception 'booking_needs_service'; end if;
  update bookings set starts_at = p_starts_at, ends_at = p_starts_at + make_interval(mins => v_dur) where id = p_booking;
end $$;
revoke execute on function edit_booking(uuid, timestamptz, uuid[], uuid[]) from public, anon;
grant execute on function edit_booking(uuid, timestamptz, uuid[], uuid[]) to authenticated;
