-- The EFTPOS receipt text Windcave's terminal sends back for a payment or refund (the terminal has no printer, so the POS shows and prints it).
-- A list of { stage: 'signature' | 'final' | 'merchant', width, text }, kept exactly as received.
alter table public.card_payments add column if not exists receipts jsonb not null default '[]'::jsonb;
