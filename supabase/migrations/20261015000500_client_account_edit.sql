-- Customers can edit their own details and change their password. The salon's client record follows the account.
create or replace function client_update_details(p_account uuid, p_name text, p_email text, p_phone text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a client_accounts; v_email text := lower(trim(p_email));
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into a from client_accounts where id = p_account for update;
  if a.id is null then raise exception 'account_not_found'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'name_required'; end if;
  if v_email <> a.email then
    if exists (select 1 from client_accounts where salon_id = a.salon_id and email = v_email) then raise exception 'email_taken'; end if;
    if exists (select 1 from clients where salon_id = a.salon_id and lower(email) = v_email) then raise exception 'email_taken'; end if;
    update clients set email = v_email where salon_id = a.salon_id and lower(email) = a.email;
  end if;
  update client_accounts set name = trim(p_name), phone = trim(coalesce(p_phone, '')), email = v_email where id = a.id;
  update clients set name = trim(p_name), phone = nullif(trim(coalesce(p_phone, '')), '') where salon_id = a.salon_id and lower(email) = v_email;
end $$;

-- Changing the password signs out every other device and returns a fresh session for this one.
create or replace function client_set_password(p_account uuid, p_password text) returns text
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'password_too_short'; end if;
  update client_accounts set password_hash = crypt(p_password, gen_salt('bf', 10)), failed_logins = 0, locked_until = null where id = p_account;
  if not found then raise exception 'account_not_found'; end if;
  delete from client_sessions where account_id = p_account;
  return client_new_session(p_account);
end $$;

revoke execute on function client_update_details(uuid, text, text, text), client_set_password(uuid, text) from public, anon, authenticated;
grant execute on function client_update_details(uuid, text, text, text), client_set_password(uuid, text) to service_role;
