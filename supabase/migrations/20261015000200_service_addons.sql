-- Add-ons: a service flagged is_addon that is offered with chosen parent services. Because an add-on is a service row, bookings,
-- sales, commission and reports already handle it; the only special rule is that staff do not need to be assigned to it.
alter table services add column if not exists is_addon boolean not null default false;

create table if not exists service_addons (
  addon_id   uuid not null references services(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  primary key (addon_id, service_id)
);
alter table service_addons enable row level security;
grant select, insert, update, delete on service_addons to authenticated;
create policy staff_read on service_addons for select to authenticated using (exists (select 1 from services s where s.id = addon_id and s.salon_id = current_salon_id()));
create policy owner_write on service_addons for all to authenticated
  using (is_owner() and exists (select 1 from services s where s.id = addon_id and s.salon_id = current_salon_id()) and exists (select 1 from services s where s.id = service_id and s.salon_id = current_salon_id()))
  with check (is_owner() and exists (select 1 from services s where s.id = addon_id and s.salon_id = current_salon_id()) and exists (select 1 from services s where s.id = service_id and s.salon_id = current_salon_id()));

-- Staff must be able to perform every non-add-on service in the booking.
do $$
declare r record; d text; n text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
           where ns.nspname = 'public' and p.proname in ('available_slots', 'available_slots_excluding', 'create_booking') loop
    d := pg_get_functiondef(r.oid);
    n := replace(d, 'ss.service_id = any(p_service_ids)) = v_n', 'ss.service_id = any(p_service_ids)) = (select count(*) from services xs where xs.id = any(p_service_ids) and not xs.is_addon)');
    n := replace(n, 'service_id = any(p_service_ids)) <> v_n', 'service_id = any(p_service_ids)) <> (select count(*) from services xs where xs.id = any(p_service_ids) and not xs.is_addon)');
    if n = d then raise exception 'add-on patch did not apply to %', r.proname; end if;
    execute n;
  end loop;
end $$;
