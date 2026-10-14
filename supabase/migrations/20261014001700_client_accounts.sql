-- Customer accounts, fully separate from staff (Supabase auth). Per salon; opaque session tokens; bcrypt passwords.
create table if not exists client_accounts (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  email text not null check (email = lower(email)),
  name text not null default '', phone text not null default '',
  password_hash text not null,
  failed_logins int not null default 0, locked_until timestamptz,
  created_at timestamptz not null default now(),
  unique (salon_id, email)
);
create table if not exists client_sessions (
  token_hash text primary key,
  account_id uuid not null references client_accounts(id) on delete cascade,
  expires_at timestamptz not null, created_at timestamptz not null default now()
);
alter table client_accounts enable row level security;
alter table client_sessions enable row level security;
revoke all on client_accounts, client_sessions from public, anon, authenticated;
grant all on client_accounts, client_sessions to service_role;

create or replace function client_new_session(p_account uuid) returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_token text := encode(gen_random_bytes(32), 'hex');
begin
  delete from client_sessions where account_id = p_account and expires_at < now();
  insert into client_sessions (token_hash, account_id, expires_at) values (encode(digest(v_token, 'sha256'), 'hex'), p_account, now() + interval '30 days');
  return v_token;
end $$;

create or replace function client_register(p_salon uuid, p_name text, p_email text, p_phone text, p_password text) returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'password_too_short'; end if;
  begin
    insert into client_accounts (salon_id, email, name, phone, password_hash)
    values (p_salon, lower(trim(p_email)), trim(p_name), trim(p_phone), crypt(p_password, gen_salt('bf', 10))) returning id into v_id;
  exception when unique_violation then raise exception 'account_exists';
  end;
  return client_new_session(v_id);
end $$;

create or replace function client_login(p_salon uuid, p_email text, p_password text) returns text language plpgsql security definer set search_path = public, extensions as $$
declare a client_accounts;
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into a from client_accounts where salon_id = p_salon and email = lower(trim(p_email)) for update;
  if a.id is null then raise exception 'bad_login'; end if;
  if a.locked_until is not null and a.locked_until > now() then raise exception 'too_many_attempts'; end if;
  if crypt(coalesce(p_password, ''), a.password_hash) <> a.password_hash then
    if a.failed_logins + 1 >= 5 then update client_accounts set failed_logins = 0, locked_until = now() + interval '15 minutes' where id = a.id;
    else update client_accounts set failed_logins = failed_logins + 1 where id = a.id; end if;
    return null; -- reported by return value so the failed attempt persists
  end if;
  update client_accounts set failed_logins = 0, locked_until = null where id = a.id;
  return client_new_session(a.id);
end $$;

create or replace function client_session(p_token text, p_salon uuid) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object('id', a.id, 'name', a.name, 'email', a.email, 'phone', a.phone) into r
  from client_sessions s join client_accounts a on a.id = s.account_id
  where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and s.expires_at > now() and a.salon_id = p_salon;
  return r;
end $$;

create or replace function client_logout(p_token text) returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from client_sessions where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
end $$;

create or replace function client_update(p_account uuid, p_name text, p_phone text) returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  update client_accounts set name = coalesce(nullif(trim(p_name), ''), name), phone = coalesce(nullif(trim(p_phone), ''), phone) where id = p_account;
end $$;

revoke execute on function client_new_session, client_register, client_login, client_session, client_logout, client_update from public, anon, authenticated;
grant execute on function client_new_session, client_register, client_login, client_session, client_logout, client_update to service_role;
revoke execute on function queue_cancellation_email() from public, anon, authenticated;
