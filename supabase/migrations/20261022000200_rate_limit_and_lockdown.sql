-- Simple sliding-window rate limiter for public endpoints (booking, waitlist, sign-up, password reset).
create table if not exists rate_hits (bucket text not null, at timestamptz not null default now());
create index if not exists rate_hits_bucket_at on rate_hits (bucket, at);
alter table rate_hits enable row level security;

create or replace function rate_hit(p_bucket text, p_max int, p_window_sec int) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if random() < 0.02 then delete from rate_hits where at < now() - interval '1 day'; end if;
  select count(*) into n from rate_hits where bucket = p_bucket and at > now() - make_interval(secs => p_window_sec);
  if n >= p_max then return false; end if;
  insert into rate_hits (bucket) values (p_bucket);
  return true;
end $$;
revoke all on function rate_hit(text, int, int) from public, anon, authenticated;
grant execute on function rate_hit(text, int, int) to service_role;

-- These are only ever called from the server with the service key; nobody should reach them straight from the browser.
revoke execute on function client_cancel(text, text), client_reschedule(text, timestamptz), submit_review(text, int, text, text), available_slots_excluding(uuid, uuid[], uuid, date, date, text, int, uuid), set_booking_ref() from public, anon, authenticated;
grant execute on function client_cancel(text, text), client_reschedule(text, timestamptz), submit_review(text, int, text, text), available_slots_excluding(uuid, uuid[], uuid, date, date, text, int, uuid) to service_role;
revoke execute on function client_overview() from public, anon;
grant execute on function client_overview() to authenticated, service_role;
