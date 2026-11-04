-- The daily self-check finds nothing when books and card payments agree, and names each kind of problem when they do not.
do $t$
declare sa uuid := pg_temp.f('sa'); s uuid; s2 uuid; n int;
begin
  select count(*) into n from health_problems() where salon_id = sa;
  perform pg_temp.ok(n = 0, 'the check reported a problem on a clean salon');

  insert into sales (salon_id, status, subtotal_cents, tax_rate, tax_inclusive, tax_cents, total_cents) values (sa, 'pending', 5000, 15, true, 652, 5000) returning id into s;
  insert into card_payments (salon_id, sale_id, kind, txn_ref, amount_cents, status) values (sa, s, 'terminal', 'H1' || substr(gen_random_uuid()::text, 1, 10), 5000, 'approved');
  perform pg_temp.ok((select count(*) from health_problems() where salon_id = sa and problem like '%approved but its sale is not marked paid%') = 1, 'an approved card payment on an unpaid sale was not reported');

  insert into card_payments (salon_id, sale_id, kind, txn_ref, amount_cents, status, created_at) values (sa, s, 'terminal', 'H2' || substr(gen_random_uuid()::text, 1, 10), 5000, 'pending', now() - interval '1 hour');
  perform pg_temp.ok((select count(*) from health_problems() where salon_id = sa and problem like '%waiting on the terminal%') = 1, 'a card payment stuck on the terminal was not reported');

  insert into sales (salon_id, status, method, subtotal_cents, tax_rate, tax_inclusive, tax_cents, total_cents, paid_at) values (sa, 'paid', 'card', 5000, 15, true, 652, 5000, now()) returning id into s2;
  perform pg_temp.ok((select count(*) from health_problems() where salon_id = sa and problem like '%paid by card but has no approved card payment%') = 1, 'a card sale with no approved payment was not reported');

  insert into card_payments (salon_id, sale_id, kind, txn_ref, amount_cents, status, needs_review, review_note) values (sa, s2, 'terminal', 'H3' || substr(gen_random_uuid()::text, 1, 10), 5000, 'error', true, 'amount differs');
  perform pg_temp.ok((select count(*) from health_problems() where salon_id = sa and problem like '%flagged for review%') = 1, 'a flagged card payment was not reported');

  insert into notifications_outbox (salon_id, channel, to_address, template, status) values (sa, 'email', 'x@t.test', 'booking_confirmation', 'failed');
  perform pg_temp.ok((select count(*) from health_problems() where salon_id = sa and problem like 'Messages failed%') = 1, 'a failed message was not reported');

  perform pg_temp.ok((select count(*) from health_problems() where salon_id = pg_temp.f('sb')) = 0, 'another salon''s check picked up this salon''s problems');
end $t$;
