-- Row-level security. Staff see only their own salon. Owners manage configuration.
-- Public (client-facing) access goes through server routes using the service role, never directly.

-- SECURITY DEFINER helpers avoid RLS recursion on `staff`.
create or replace function current_salon_id() returns uuid
language sql stable security definer set search_path = public as $$
  select salon_id from staff where user_id = auth.uid() and active limit 1
$$;

create or replace function current_staff_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from staff where user_id = auth.uid() and active limit 1
$$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid() and active and app_role = 'owner')
$$;

revoke all on function current_salon_id(), current_staff_id(), is_owner() from public, anon;
grant execute on function current_salon_id(), current_staff_id(), is_owner() to authenticated, service_role;

-- Start from nothing, then grant narrowly.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

do $$
declare t text;
begin
  -- Tables any signed-in staff member of the salon can read and write.
  foreach t in array array['clients','bookings','staff_blocks','waitlist_entries','products','gift_cards','inbox_items'] loop
    execute format('alter table %I enable row level security', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('create policy staff_all on %I for all to authenticated using (salon_id = current_salon_id()) with check (salon_id = current_salon_id())', t);
  end loop;

  -- Tables staff can read; only owners can change.
  foreach t in array array['salon_settings','salon_payment_settings','opening_hours','staff','service_categories','services'] loop
    execute format('alter table %I enable row level security', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('create policy staff_read on %I for select to authenticated using (salon_id = current_salon_id())', t);
    execute format('create policy owner_write on %I for all to authenticated using (salon_id = current_salon_id() and is_owner()) with check (salon_id = current_salon_id() and is_owner())', t);
  end loop;

  -- Read-only for staff; written only by security-definer functions or the service role.
  foreach t in array array['sales','card_payments','reviews'] loop
    execute format('alter table %I enable row level security', t);
    execute format('grant select on %I to authenticated', t);
    execute format('create policy staff_read on %I for select to authenticated using (salon_id = current_salon_id())', t);
  end loop;

  -- Service-role only (RLS on, no policies).
  foreach t in array array['salon_payment_secrets','booking_tokens','notifications_outbox'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- salons
alter table salons enable row level security;
grant select, update on salons to authenticated;
create policy staff_read on salons for select to authenticated using (id = current_salon_id());
create policy owner_update on salons for update to authenticated using (id = current_salon_id() and is_owner()) with check (id = current_salon_id() and is_owner());

-- staff_shifts, service_staff: through parent
alter table staff_shifts enable row level security;
grant select, insert, update, delete on staff_shifts to authenticated;
create policy staff_read on staff_shifts for select to authenticated using (exists (select 1 from staff s where s.id = staff_id and s.salon_id = current_salon_id()));
create policy owner_write on staff_shifts for all to authenticated using (is_owner() and exists (select 1 from staff s where s.id = staff_id and s.salon_id = current_salon_id())) with check (is_owner() and exists (select 1 from staff s where s.id = staff_id and s.salon_id = current_salon_id()));

alter table service_staff enable row level security;
grant select, insert, update, delete on service_staff to authenticated;
create policy staff_read on service_staff for select to authenticated using (exists (select 1 from services s where s.id = service_id and s.salon_id = current_salon_id()));
create policy owner_write on service_staff for all to authenticated using (is_owner() and exists (select 1 from services s where s.id = service_id and s.salon_id = current_salon_id())) with check (is_owner() and exists (select 1 from services s where s.id = service_id and s.salon_id = current_salon_id()));

-- booking_services and sale_items: read through parent, written by functions
alter table booking_services enable row level security;
grant select on booking_services to authenticated;
create policy staff_read on booking_services for select to authenticated using (exists (select 1 from bookings b where b.id = booking_id and b.salon_id = current_salon_id()));

alter table sale_items enable row level security;
grant select on sale_items to authenticated;
create policy staff_read on sale_items for select to authenticated using (exists (select 1 from sales s where s.id = sale_id and s.salon_id = current_salon_id()));

-- reviews: staff may only write the reply
grant update (reply, replied_at) on reviews to authenticated;
create policy staff_reply on reviews for update to authenticated using (salon_id = current_salon_id()) with check (salon_id = current_salon_id());

-- timesheets: staff manage their own; owners manage all
alter table timesheets enable row level security;
grant select, insert, update on timesheets to authenticated;
create policy own_or_owner on timesheets for all to authenticated
  using (salon_id = current_salon_id() and (staff_id = current_staff_id() or is_owner()))
  with check (salon_id = current_salon_id() and (staff_id = current_staff_id() or is_owner()));

-- staff_invites and audit_log: owners only
alter table staff_invites enable row level security;
grant select on staff_invites to authenticated;
create policy owner_read on staff_invites for select to authenticated using (salon_id = current_salon_id() and is_owner());

alter table audit_log enable row level security;
grant select on audit_log to authenticated;
create policy owner_read on audit_log for select to authenticated using (salon_id = current_salon_id() and is_owner());

-- payouts: owners only
alter table payouts enable row level security;
grant select on payouts to authenticated;
create policy owner_read on payouts for select to authenticated using (salon_id = current_salon_id() and is_owner());
