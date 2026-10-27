-- 1. A row may only point at rows of its own salon (staff, clients, bookings, templates...). Without this a signed-in user could book
--    another salon's stylist from their own salon and block that calendar.
create or replace function public.enforce_same_salon() returns trigger language plpgsql security definer set search_path = public as $$
declare a text; col text; tbl text; ref uuid; owner_salon uuid; j jsonb := to_jsonb(new);
begin
  foreach a in array tg_argv loop
    col := split_part(a, ':', 1); tbl := split_part(a, ':', 2);
    ref := nullif(j ->> col, '')::uuid;
    if ref is null then continue; end if;
    execute format('select salon_id from public.%I where id = $1', tbl) into owner_salon using ref;
    if owner_salon is distinct from (j ->> 'salon_id')::uuid then raise exception 'cross_salon_reference' using errcode = '42501'; end if;
  end loop;
  return new;
end $$;
revoke execute on function public.enforce_same_salon() from public, anon, authenticated;

create trigger same_salon_bookings before insert or update on public.bookings for each row execute function public.enforce_same_salon('client_id:clients', 'staff_id:staff');
create trigger same_salon_blocks before insert or update on public.staff_blocks for each row execute function public.enforce_same_salon('staff_id:staff');
create trigger same_salon_notes before insert or update on public.client_notes for each row execute function public.enforce_same_salon('client_id:clients');
create trigger same_salon_inbox before insert or update on public.inbox_items for each row execute function public.enforce_same_salon('client_id:clients', 'booking_id:bookings');
create trigger same_salon_waitlist before insert or update on public.waitlist_entries for each row execute function public.enforce_same_salon('client_id:clients', 'service_id:services', 'staff_id:staff', 'offered_staff_id:staff', 'booking_id:bookings');
create trigger same_salon_forms before insert or update on public.form_submissions for each row execute function public.enforce_same_salon('client_id:clients', 'booking_id:bookings', 'template_id:form_templates');
create trigger same_salon_timesheets before insert or update on public.timesheets for each row execute function public.enforce_same_salon('staff_id:staff');

create or replace function public.enforce_service_staff_same_salon() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select salon_id from services where id = new.service_id) is distinct from (select salon_id from staff where id = new.staff_id) then raise exception 'cross_salon_reference' using errcode = '42501'; end if;
  return new;
end $$;
revoke execute on function public.enforce_service_staff_same_salon() from public, anon, authenticated;
create trigger same_salon_service_staff before insert or update on public.service_staff for each row execute function public.enforce_service_staff_same_salon();

-- 2. Money and stock: only the owner writes gift cards and products directly (the app already says so); everyone on the team can read them.
drop policy if exists staff_all on public.gift_cards;
create policy staff_read on public.gift_cards for select to authenticated using (salon_id = current_salon_id());
create policy owner_write on public.gift_cards for all to authenticated using (salon_id = current_salon_id() and is_owner()) with check (salon_id = current_salon_id() and is_owner());
drop policy if exists staff_all on public.products;
create policy staff_read on public.products for select to authenticated using (salon_id = current_salon_id());
create policy owner_write on public.products for all to authenticated using (salon_id = current_salon_id() and is_owner()) with check (salon_id = current_salon_id() and is_owner());

create or replace function public.adjust_product_stock(p_product uuid, p_delta integer) returns integer language plpgsql security definer set search_path = public as $$
declare r int;
begin
  if current_salon_id() is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_delta is null or abs(p_delta) > 100000 then raise exception 'invalid_delta'; end if;
  update products set stock = greatest(0, stock + p_delta) where id = p_product and salon_id = current_salon_id() returning stock into r;
  return r;
end $$;

-- 3. Deleting bookings and clients is an owner action (the app never deletes bookings, it cancels them).
drop policy if exists staff_all on public.bookings;
create policy staff_read on public.bookings for select to authenticated using (salon_id = current_salon_id());
create policy staff_insert on public.bookings for insert to authenticated with check (salon_id = current_salon_id());
create policy staff_update on public.bookings for update to authenticated using (salon_id = current_salon_id()) with check (salon_id = current_salon_id());
create policy owner_delete on public.bookings for delete to authenticated using (salon_id = current_salon_id() and is_owner());
drop policy if exists staff_all on public.clients;
create policy staff_read on public.clients for select to authenticated using (salon_id = current_salon_id());
create policy staff_insert on public.clients for insert to authenticated with check (salon_id = current_salon_id());
create policy staff_update on public.clients for update to authenticated using (salon_id = current_salon_id()) with check (salon_id = current_salon_id());
create policy owner_delete on public.clients for delete to authenticated using (salon_id = current_salon_id() and is_owner());
