alter table clients
  add column if not exists allergies text[] not null default '{}',
  add column if not exists patch_test_on date,
  add column if not exists colour_formula text,
  add column if not exists reminders boolean not null default true,
  add column if not exists marketing boolean not null default false;

create table if not exists client_notes (
  id         uuid primary key default gen_random_uuid(),
  salon_id   uuid not null references salons(id) on delete cascade,
  client_id  uuid not null references clients(id) on delete cascade,
  body       text not null check (length(btrim(body)) > 0),
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);
create index if not exists client_notes_idx on client_notes (client_id, created_at desc);
alter table client_notes enable row level security;
grant select, insert, update, delete on client_notes to authenticated;
create policy staff_all on client_notes for all to authenticated
  using (salon_id = current_salon_id()) with check (salon_id = current_salon_id());
