-- Sanity limits so nobody can store megabytes in a name or note, whatever route the write takes.
alter table public.clients add constraint clients_name_len check (char_length(name) <= 200);
alter table public.clients add constraint clients_email_len check (email is null or char_length(email) <= 254);
alter table public.clients add constraint clients_phone_len check (phone is null or char_length(phone) <= 40);
alter table public.clients add constraint clients_formula_len check (colour_formula is null or char_length(colour_formula) <= 2000);
alter table public.bookings add constraint bookings_notes_len check (notes is null or char_length(notes) <= 2000);
alter table public.client_notes add constraint client_notes_len check (char_length(body) <= 5000);
alter table public.staff add constraint staff_name_len check (char_length(name) <= 200);
alter table public.inbox_messages add constraint inbox_messages_len check (char_length(body) <= 2000);
alter table public.inbox_items add constraint inbox_items_len check (body is null or char_length(body) <= 4000);
