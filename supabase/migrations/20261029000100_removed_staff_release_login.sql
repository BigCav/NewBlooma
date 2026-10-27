-- Removing a team member only switched them off but kept their login attached to the old row. Because one login can
-- belong to one team row, that person could never join another salon or start their own ("already has a salon").
-- Switching someone off now frees their login, and a pending invite for them stops working.
create or replace function staff_release_login() returns trigger language plpgsql as $$
begin
  if old.active and not new.active then
    new.user_id := null;
    update staff_invites set expires_at = least(expires_at, now()) where staff_id = new.id and accepted_at is null;
  end if;
  return new;
end $$;

drop trigger if exists staff_release_login on staff;
create trigger staff_release_login before update of active on staff for each row execute function staff_release_login();

update staff set user_id = null where not active and user_id is not null;

create or replace function accept_staff_invite(p_token text) returns uuid language plpgsql security definer set search_path to 'public' as $$
declare i staff_invites;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if exists (select 1 from staff where user_id = auth.uid()) then raise exception 'already_has_salon'; end if;
  select * into i from staff_invites where token = p_token for update;
  if i.token is null or i.accepted_at is not null or i.expires_at < now() then raise exception 'invite_expired'; end if;
  update staff set user_id = auth.uid() where id = i.staff_id and user_id is null and active;
  if not found then raise exception 'invite_expired'; end if;
  update staff_invites set accepted_at = now() where token = p_token;
  return i.salon_id;
end $$;
