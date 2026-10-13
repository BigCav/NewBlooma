-- Aster & Co: core schema. No seed data. Money is integer cents. Every tenant row carries salon_id.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------- Enums ----------
create type staff_role      as enum ('owner', 'stylist', 'reception');
create type booking_status  as enum ('pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show');
create type booking_source  as enum ('online', 'staff', 'waitlist');
create type waitlist_status as enum ('waiting', 'offered', 'booked', 'removed');
create type sale_status     as enum ('pending', 'paid', 'refunded');
create type pay_method      as enum ('card', 'cash', 'gift_card');
create type inbox_type      as enum ('request', 'reschedule', 'message', 'cancellation', 'booking');
create type inbox_status    as enum ('new', 'handled', 'declined');
create type block_kind      as enum ('lunch', 'break', 'time_off', 'other');
create type token_purpose   as enum ('manage_booking', 'accept_offer', 'review');
create type card_kind       as enum ('online', 'terminal');
create type card_status     as enum ('pending', 'approved', 'declined', 'cancelled', 'error', 'refunded');

-- ---------- Salon ----------
create table salons (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$'),
  name        text not null check (length(trim(name)) > 0),
  phone       text,
  email       text,
  address     text,
  timezone    text not null,
  currency    char(3) not null,
  created_at  timestamptz not null default now()
);

create table salon_settings (
  salon_id             uuid primary key references salons(id) on delete cascade,
  online_booking       boolean not null default true,
  booking_window       text    not null default '4w'  check (booking_window in ('1w','2w','4w','8w')),
  min_notice           text    not null default '2h'  check (min_notice in ('none','1h','2h','24h')),
  auto_confirm         boolean not null default true,
  free_cancel_before   text    not null default '24h' check (free_cancel_before in ('2h','24h','48h')),
  accept_card          boolean not null default true,
  accept_cash          boolean not null default true,
  accept_gift_cards    boolean not null default true,
  ask_for_tip          boolean not null default true,
  suggested_tip_pct    smallint not null default 0    check (suggested_tip_pct in (0,10,15,20)),
  tax_rate             numeric(5,2) not null default 15 check (tax_rate between 0 and 30),
  tax_inclusive        boolean not null default true,
  email_confirmations  boolean not null default true,
  remind_24h           boolean not null default true,
  remind_2h            boolean not null default false,
  notify_new_booking   boolean not null default true,
  notify_cancellation  boolean not null default true,
  updated_at           timestamptz not null default now()
);

create table salon_payment_settings (
  salon_id            uuid primary key references salons(id) on delete cascade,
  online_cards_enabled boolean not null default false,
  terminal_enabled    boolean not null default false,
  terminal_station_id text,
  updated_at          timestamptz not null default now()
);

-- Windcave credentials, stored encrypted by the app. No client policy: service role only.
create table salon_payment_secrets (
  salon_id     uuid primary key references salons(id) on delete cascade,
  online_user  text,
  online_key   text,
  hit_user     text,
  hit_key      text,
  updated_at   timestamptz not null default now()
);

create table opening_hours (
  salon_id    uuid not null references salons(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),   -- 0 = Monday
  is_open     boolean not null,
  open_time   time not null,
  close_time  time not null,
  primary key (salon_id, weekday),
  check (close_time > open_time)
);

-- ---------- Team ----------
create table staff (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references salons(id) on delete cascade,
  user_id         uuid unique references auth.users(id) on delete set null,
  name            text not null check (length(trim(name)) > 0),
  role_title      text not null,
  app_role        staff_role not null default 'stylist',
  online_bookable boolean not null default true,
  commission_pct  numeric(4,1) not null default 0 check (commission_pct between 0 and 100),
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index staff_salon_idx on staff (salon_id) where active;

create table staff_invites (
  token        text primary key default encode(gen_random_bytes(24), 'hex'),
  salon_id     uuid not null references salons(id) on delete cascade,
  staff_id     uuid not null references staff(id) on delete cascade,
  expires_at   timestamptz not null default now() + interval '14 days',
  accepted_at  timestamptz
);

create table staff_shifts (
  staff_id    uuid not null references staff(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  primary key (staff_id, weekday),
  check (end_time > start_time)
);

create table staff_blocks (
  id         uuid primary key default gen_random_uuid(),
  salon_id   uuid not null references salons(id) on delete cascade,
  staff_id   uuid not null references staff(id) on delete cascade,
  kind       block_kind not null default 'other',
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  note       text,
  check (ends_at > starts_at)
);
create index staff_blocks_idx on staff_blocks (staff_id, starts_at);

-- ---------- Services ----------
create table service_categories (
  id        uuid primary key default gen_random_uuid(),
  salon_id  uuid not null references salons(id) on delete cascade,
  name      text not null check (length(trim(name)) > 0),
  sort      int not null default 0,
  unique (salon_id, name)
);

create table services (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references salons(id) on delete cascade,
  category_id     uuid not null references service_categories(id),
  name            text not null check (length(trim(name)) > 0),
  description     text,
  duration_min    int not null check (duration_min > 0),
  price_cents     int not null check (price_cents >= 0),
  online_bookable boolean not null default true,
  active          boolean not null default true
);
create index services_idx on services (salon_id, category_id) where active;

create table service_staff (
  service_id  uuid not null references services(id) on delete cascade,
  staff_id    uuid not null references staff(id) on delete cascade,
  primary key (service_id, staff_id)
);

-- ---------- Clients ----------
create table clients (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references salons(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index clients_name_idx on clients (salon_id, lower(name));
create unique index clients_email_idx on clients (salon_id, lower(email)) where email is not null;

-- ---------- Bookings ----------
create table bookings (
  id             uuid primary key default gen_random_uuid(),
  salon_id       uuid not null references salons(id) on delete cascade,
  client_id      uuid not null references clients(id),
  staff_id       uuid not null references staff(id),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  status         booking_status not null default 'confirmed',
  source         booking_source not null default 'staff',
  notes          text,
  cancelled_at   timestamptz,
  cancelled_late boolean not null default false,
  created_at     timestamptz not null default now(),
  check (ends_at > starts_at),
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status not in ('cancelled', 'no_show'))
);
create index bookings_salon_idx on bookings (salon_id, starts_at);
create index bookings_client_idx on bookings (client_id, starts_at desc);

create table booking_services (
  booking_id    uuid not null references bookings(id) on delete cascade,
  service_id    uuid not null references services(id),
  price_cents   int not null check (price_cents >= 0),
  duration_min  int not null check (duration_min > 0),
  primary key (booking_id, service_id)
);

-- ---------- Waitlist ----------
create table waitlist_entries (
  id                uuid primary key default gen_random_uuid(),
  salon_id          uuid not null references salons(id) on delete cascade,
  client_id         uuid not null references clients(id),
  service_id        uuid not null references services(id),
  staff_id          uuid references staff(id),
  weekdays          smallint[] not null default '{0,1,2,3,4,5,6}',
  earliest_time     time,
  latest_time       time,
  status            waitlist_status not null default 'waiting',
  offered_staff_id  uuid references staff(id),
  offered_start     timestamptz,
  offer_expires_at  timestamptz,
  booking_id        uuid references bookings(id),
  created_at        timestamptz not null default now()
);
create index waitlist_idx on waitlist_entries (salon_id, status);

create table booking_tokens (
  token        text primary key default encode(gen_random_bytes(24), 'hex'),
  salon_id     uuid not null references salons(id) on delete cascade,
  purpose      token_purpose not null,
  booking_id   uuid references bookings(id) on delete cascade,
  waitlist_id  uuid references waitlist_entries(id) on delete cascade,
  expires_at   timestamptz not null,
  used_at      timestamptz
);

-- ---------- Products and gift cards ----------
create table products (
  id             uuid primary key default gen_random_uuid(),
  salon_id       uuid not null references salons(id) on delete cascade,
  name           text not null check (length(trim(name)) > 0),
  brand          text,
  category       text,
  sku            text,
  price_cents    int not null check (price_cents >= 0),
  stock          int not null default 0,
  reorder_level  int not null default 0,
  active         boolean not null default true,
  unique (salon_id, sku)
);

create table gift_cards (
  id             uuid primary key default gen_random_uuid(),
  salon_id       uuid not null references salons(id) on delete cascade,
  code           text not null,
  balance_cents  int not null check (balance_cents >= 0),
  issued_at      timestamptz not null default now(),
  unique (salon_id, code)
);

-- ---------- Sales ----------
create table sales (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references salons(id) on delete cascade,
  booking_id      uuid references bookings(id),
  client_id       uuid references clients(id),
  staff_id        uuid references staff(id),
  description     text,
  status          sale_status not null default 'pending',
  method          pay_method,
  subtotal_cents  int not null check (subtotal_cents >= 0),
  tip_cents       int not null default 0 check (tip_cents >= 0),
  tax_rate        numeric(5,2) not null,
  tax_inclusive   boolean not null,
  tax_cents       int not null check (tax_cents >= 0),
  total_cents     int not null check (total_cents >= 0),
  gift_card_id    uuid references gift_cards(id),
  paid_at         timestamptz,
  refunded_at     timestamptz,
  created_at      timestamptz not null default now(),
  check (total_cents = subtotal_cents + tip_cents + case when tax_inclusive then 0 else tax_cents end)
);
create index sales_idx on sales (salon_id, created_at desc);
create unique index sales_one_open_per_booking on sales (booking_id) where booking_id is not null and status <> 'refunded';

create table sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references sales(id) on delete cascade,
  product_id   uuid references products(id),
  service_id   uuid references services(id),
  label        text not null,
  qty          int not null default 1 check (qty > 0),
  price_cents  int not null check (price_cents >= 0),
  check ((product_id is not null) <> (service_id is not null))
);

create table card_payments (
  id             uuid primary key default gen_random_uuid(),
  salon_id       uuid not null references salons(id) on delete cascade,
  sale_id        uuid not null references sales(id) on delete cascade,
  kind           card_kind not null,
  txn_ref        text not null unique,           -- our merchant reference
  session_id     text,                           -- Windcave hosted session id (online)
  dps_txn_ref    text,                           -- Windcave transaction reference
  status         card_status not null default 'pending',
  amount_cents   int not null check (amount_cents > 0),
  response_code  text,
  response_text  text,
  auth_code      text,
  needs_review   boolean not null default false,
  review_note    text,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);
create index card_payments_sale_idx on card_payments (sale_id);

-- ---------- Reviews, inbox, notifications ----------
create table reviews (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references salons(id) on delete cascade,
  booking_id  uuid not null unique references bookings(id),
  client_id   uuid not null references clients(id),
  staff_id    uuid not null references staff(id),
  stars       smallint not null check (stars between 1 and 5),
  body        text not null check (length(trim(body)) > 0),
  reply       text,
  replied_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index reviews_idx on reviews (salon_id, created_at desc);

create table inbox_items (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references salons(id) on delete cascade,
  type        inbox_type not null,
  client_id   uuid references clients(id),
  booking_id  uuid references bookings(id),
  body        text,
  unread      boolean not null default true,
  status      inbox_status not null default 'new',
  created_at  timestamptz not null default now()
);
create index inbox_idx on inbox_items (salon_id, unread, created_at desc);

create table notifications_outbox (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references salons(id) on delete cascade,
  booking_id  uuid references bookings(id) on delete cascade,
  channel     text not null check (channel in ('email', 'sms')),
  to_address  text not null,
  template    text not null,
  payload     jsonb not null default '{}',
  status      text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  attempts    int not null default 0,
  error       text,
  send_after  timestamptz not null default now(),
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index outbox_idx on notifications_outbox (status, send_after);
create unique index outbox_once on notifications_outbox (booking_id, template, channel) where booking_id is not null;

-- ---------- Payroll ----------
create table timesheets (
  id         uuid primary key default gen_random_uuid(),
  salon_id   uuid not null references salons(id) on delete cascade,
  staff_id   uuid not null references staff(id) on delete cascade,
  clock_in   timestamptz not null,
  clock_out  timestamptz,
  check (clock_out is null or clock_out > clock_in)
);
create unique index one_open_shift on timesheets (staff_id) where clock_out is null;

create table payouts (
  id               uuid primary key default gen_random_uuid(),
  salon_id         uuid not null references salons(id) on delete cascade,
  staff_id         uuid not null references staff(id),
  period_start     date not null,
  period_end       date not null,
  hours            numeric(7,2) not null,
  commission_pct   numeric(4,1) not null,
  commission_cents int not null,
  paid_at          timestamptz not null default now(),
  unique (staff_id, period_start, period_end)
);

create table audit_log (
  id          bigint generated always as identity primary key,
  salon_id    uuid not null references salons(id) on delete cascade,
  actor_id    uuid,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index audit_idx on audit_log (salon_id, created_at desc);
