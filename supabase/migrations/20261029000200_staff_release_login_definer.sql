-- The trigger that expires a removed member's invites runs as whoever removes them (the owner), and the owner cannot update invites
-- directly, so it must run with its own rights. Not callable by anyone.
create or replace function staff_release_login() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if old.active and not new.active then
    new.user_id := null;
    update staff_invites set expires_at = least(expires_at, now()) where staff_id = new.id and accepted_at is null;
  end if;
  return new;
end $$;
revoke execute on function staff_release_login() from public, anon, authenticated;
