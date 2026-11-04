-- A daily self-check. Returns one row per kind of problem found (nothing when everything agrees). The cron route emails the salon owner
-- about each row and reports a failure, so a card payment that did not close its sale, or messages that are not going out, show up that day.
create or replace function health_problems() returns table (salon_id uuid, problem text, n int)
language sql stable security definer set search_path = public as $$
  select cp.salon_id, 'A card payment was approved but its sale is not marked paid by card', count(*)::int
    from card_payments cp join sales s on s.id = cp.sale_id
    where cp.status = 'approved' and not (s.status in ('paid', 'refunded') and s.method = 'card') group by cp.salon_id
  union all
  select s.salon_id, 'A sale is marked paid by card but has no approved card payment', count(*)::int
    from sales s where s.status = 'paid' and s.method = 'card' and not exists (select 1 from card_payments cp where cp.sale_id = s.id and cp.status in ('approved', 'refunded'))
    group by s.salon_id
  union all
  select salon_id, 'A card payment was flagged for review in the last 3 days', count(*)::int
    from card_payments where needs_review and created_at > now() - interval '3 days' group by salon_id
  union all
  select salon_id, 'A card payment has been waiting on the terminal for over 30 minutes', count(*)::int
    from card_payments where status = 'pending' and created_at < now() - interval '30 minutes' and created_at > now() - interval '2 days' group by salon_id
  union all
  select salon_id, 'Messages failed to send in the last day', count(*)::int
    from notifications_outbox where status = 'failed' and created_at > now() - interval '1 day' group by salon_id
  union all
  select salon_id, 'Messages have been waiting to send for over 3 hours', count(*)::int
    from notifications_outbox where status = 'queued' and send_after < now() - interval '3 hours' and created_at > now() - interval '2 days' group by salon_id
  union all
  select salon_id, 'A paid sale does not add up (subtotal + tip + tax)', count(*)::int
    from sales where status in ('paid', 'refunded') and paid_at > now() - interval '7 days'
      and total_cents <> subtotal_cents + tip_cents + case when tax_inclusive then 0 else tax_cents end group by salon_id
$$;
revoke all on function health_problems() from public, anon, authenticated;
grant execute on function health_problems() to service_role;
