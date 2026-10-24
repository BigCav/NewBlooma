-- Client forms: what the salon asks before a visit, and what clients answered.

create table form_templates (
  id            uuid primary key default gen_random_uuid(),
  salon_id      uuid not null references salons(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  valid_months  int  not null default 12 check (valid_months in (0, 3, 6, 12)),   -- 0 = every visit
  how           text not null default 'client' check (how in ('client', 'salon', 'staff')),
  miss          text not null default 'warn' check (miss in ('warn', 'ask')),
  consent_text  text check (consent_text is null or char_length(consent_text) <= 1000),
  ask_photos    boolean not null default false,
  is_patch_test boolean not null default false,
  active        boolean not null default true,
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);
create index form_templates_idx on form_templates (salon_id) where active;

create table form_template_categories (
  template_id uuid not null references form_templates(id) on delete cascade,
  category_id uuid not null references service_categories(id) on delete cascade,
  primary key (template_id, category_id)
);

create table form_questions (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references form_templates(id) on delete cascade,
  label         text not null check (char_length(label) between 1 and 200),
  qtype         text not null check (qtype in ('short', 'yesno', 'one', 'many', 'long')),
  required      boolean not null default false,
  options       text[] not null default '{}',
  detail_prompt text check (detail_prompt is null or char_length(detail_prompt) <= 120),
  sort          int not null default 0
);
create index form_questions_idx on form_questions (template_id, sort);

create table form_submissions (
  id           uuid primary key default gen_random_uuid(),
  salon_id     uuid not null references salons(id) on delete cascade,
  template_id  uuid not null references form_templates(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  booking_id   uuid references bookings(id) on delete set null,
  answers      jsonb not null default '[]'::jsonb,        -- [{ "q": question text, "a": answer text }] as the client saw it
  signed_name  text,
  photos_ok    boolean,
  flagged      boolean not null default false,            -- a patch test with a reaction
  performed_on date,                                      -- patch tests: the day it was applied (validity counts from here)
  recorded_by  uuid references staff(id) on delete set null,
  completed_at timestamptz not null default now()
);
create index form_submissions_idx on form_submissions (client_id, template_id, completed_at desc);

alter table form_templates enable row level security;
alter table form_template_categories enable row level security;
alter table form_questions enable row level security;
alter table form_submissions enable row level security;

grant select, insert, update, delete on form_templates, form_template_categories, form_questions to authenticated;
grant select, insert, update on form_submissions to authenticated;

create policy staff_read on form_templates for select to authenticated using (salon_id = current_salon_id());
create policy owner_write on form_templates for all to authenticated
  using (is_owner() and salon_id = current_salon_id()) with check (is_owner() and salon_id = current_salon_id());

create policy staff_read on form_template_categories for select to authenticated
  using (exists (select 1 from form_templates t where t.id = template_id and t.salon_id = current_salon_id()));
create policy owner_write on form_template_categories for all to authenticated
  using (is_owner() and exists (select 1 from form_templates t where t.id = template_id and t.salon_id = current_salon_id()))
  with check (is_owner() and exists (select 1 from form_templates t where t.id = template_id and t.salon_id = current_salon_id()));

create policy staff_read on form_questions for select to authenticated
  using (exists (select 1 from form_templates t where t.id = template_id and t.salon_id = current_salon_id()));
create policy owner_write on form_questions for all to authenticated
  using (is_owner() and exists (select 1 from form_templates t where t.id = template_id and t.salon_id = current_salon_id()))
  with check (is_owner() and exists (select 1 from form_templates t where t.id = template_id and t.salon_id = current_salon_id()));

create policy staff_read on form_submissions for select to authenticated using (salon_id = current_salon_id());
create policy staff_insert on form_submissions for insert to authenticated with check (salon_id = current_salon_id());
create policy staff_update on form_submissions for update to authenticated
  using (salon_id = current_salon_id()) with check (salon_id = current_salon_id());
