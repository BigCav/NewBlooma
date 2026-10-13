alter table waitlist_entries add column if not exists added_by uuid references staff(id);
