-- Team photos: a public bucket (uploads go through a server action using the owner's session check) and a url on the staff row.
alter table staff add column if not exists photo_url text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-photos', 'staff-photos', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
