-- Two people (or one person double-tapping) starting a card payment on the same sale at the same moment could each pass the "is one already open?"
-- check and then both start one, which on a card terminal means two charges. The database now allows only one open card step (payment or refund)
-- per sale, so the second one is refused whatever the app code does.
create unique index if not exists card_payments_one_open_per_sale on card_payments (sale_id) where status = 'pending';

-- An on-screen card refund goes to Windcave first and is recorded afterwards, so two clicks could send two refund requests. The refund is claimed
-- first: only one caller gets true. A claim older than two minutes is treated as abandoned so a refund that failed part way can be tried again.
alter table card_payments add column if not exists refund_claimed_at timestamptz;

create or replace function claim_card_refund(p_payment uuid) returns boolean
language sql security definer set search_path to 'public' as $$
  with c as (
    update card_payments set refund_claimed_at = now()
    where id = p_payment and status = 'approved' and (refund_claimed_at is null or refund_claimed_at < now() - interval '2 minutes')
    returning 1)
  select exists (select 1 from c) $$;
revoke execute on function claim_card_refund(uuid) from public, anon, authenticated;
grant execute on function claim_card_refund(uuid) to service_role;
