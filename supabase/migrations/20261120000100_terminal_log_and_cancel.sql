-- Card terminal (Windcave HIT) certification support:
--  * hit_log: every request sent to and reply received from the terminal service, with a timestamp (the key is never stored).
--  * card_payments: which buttons the terminal currently allows (so Cancel and the signature buttons only send what is valid),
--    the surcharge and tip it reported (kept apart from the ticket amount), and whether a refund was to a different card.

create table if not exists public.hit_log (
  id bigint generated always as identity primary key,
  salon_id uuid not null references public.salons(id) on delete cascade,
  txn_ref text,
  direction text not null check (direction in ('request', 'response', 'error')),
  body text not null,
  http_status integer,
  at timestamptz not null default now()
);
create index if not exists hit_log_salon_at on public.hit_log (salon_id, at desc);
create index if not exists hit_log_salon_txn on public.hit_log (salon_id, txn_ref, at);
-- Only the server (service role) reads and writes this table; the owner downloads it through the app.
alter table public.hit_log enable row level security;

alter table public.card_payments
  add column if not exists ui_buttons jsonb,
  add column if not exists surcharge_cents integer not null default 0 check (surcharge_cents >= 0),
  add column if not exists tip_cents integer not null default 0 check (tip_cents >= 0),
  add column if not exists unmatched boolean not null default false;
