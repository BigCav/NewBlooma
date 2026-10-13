create table if not exists inbox_messages (
  id         uuid primary key default gen_random_uuid(),
  salon_id   uuid not null references salons(id) on delete cascade,
  item_id    uuid not null references inbox_items(id) on delete cascade,
  mine       boolean not null default true,
  body       text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists inbox_messages_idx on inbox_messages (item_id, created_at);
alter table inbox_messages enable row level security;
grant select, insert, update, delete on inbox_messages to authenticated;
create policy staff_all on inbox_messages for all to authenticated
  using (salon_id = current_salon_id()) with check (salon_id = current_salon_id());
