-- Gift cards remember what they were issued for, who they are for, and whether the salon voided them.
alter table gift_cards
  add column if not exists original_cents int,
  add column if not exists for_name text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_cents int not null default 0;
update gift_cards g set original_cents = g.balance_cents + coalesce((select sum(s.total_cents) from sales s where s.gift_card_id = g.id and s.status = 'paid'), 0) where g.original_cents is null;
alter table gift_cards alter column original_cents set not null;
