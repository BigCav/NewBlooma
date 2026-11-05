-- The pictures at the top of a salon's public booking page: up to five, the first one is the large picture.
-- Files live in a public bucket (uploads go through a server action that checks the owner); the table keeps their order.
create table if not exists public.salon_photos (
  id         uuid primary key default gen_random_uuid(),
  salon_id   uuid not null references public.salons(id) on delete cascade,
  url        text not null,
  path       text not null,
  sort       smallint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists salon_photos_salon_idx on public.salon_photos (salon_id, sort);
alter table public.salon_photos enable row level security;
grant select, insert, update, delete on public.salon_photos to authenticated;
drop policy if exists owner_all on public.salon_photos;
create policy owner_all on public.salon_photos for all to authenticated
  using (salon_id = current_salon_id() and is_owner()) with check (salon_id = current_salon_id() and is_owner());

create or replace function public.salon_photos_limit() returns trigger language plpgsql set search_path to 'public' as $$
begin
  if (select count(*) from salon_photos where salon_id = new.salon_id) >= 5 then raise exception 'too_many_photos' using errcode = '23514'; end if;
  return new;
end $$;
drop trigger if exists salon_photos_limit on public.salon_photos;
create trigger salon_photos_limit before insert on public.salon_photos for each row execute function public.salon_photos_limit();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('salon-photos', 'salon-photos', true, 1572864, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1572864, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
