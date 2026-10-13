-- Public review page lets the client confirm the name shown with their review.
alter table reviews add column if not exists reviewer_name text;

create or replace function submit_review(p_token text, p_stars int, p_body text, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare t booking_tokens; b bookings;
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into t from booking_tokens where token = p_token and purpose = 'review' for update;
  if t.token is null or t.used_at is not null or t.expires_at < now() then raise exception 'link_expired'; end if;
  select * into b from bookings where id = t.booking_id;
  if b.status <> 'completed' then raise exception 'not_completed'; end if;
  insert into reviews (salon_id, booking_id, client_id, staff_id, stars, body, reviewer_name)
  values (b.salon_id, b.id, b.client_id, b.staff_id, p_stars, coalesce(nullif(trim(p_body), ''), 'No comment left.'), nullif(trim(p_name), ''));
  update booking_tokens set used_at = now() where token = p_token;
end $$;

grant execute on function submit_review(text, int, text, text) to service_role;
