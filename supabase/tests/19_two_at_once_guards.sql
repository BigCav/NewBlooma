-- Things that must hold even when two people (or one person tapping twice) act at the same moment. The database, not the app code, is what makes them
-- true, so each is checked here by trying the second action and expecting it to be refused: two bookings for one stylist at one time, a second card
-- payment or card refund on a sale already waiting for one, a second sale for one booking, a second client with the same email, a refund claimed twice,
-- and a public form used past its limit.

create function pg_temp.err(q text) returns text language plpgsql as $$
begin execute q; return 'none'; exception when others then return sqlstate; end $$;

do $t$
declare
  sa uuid := pg_temp.f('sa'); stf uuid := pg_temp.f('stfa'); cl uuid := pg_temp.f('cla'); bk uuid := pg_temp.f('bka');
  t0 timestamptz := (date_trunc('week', now() + interval '10 days')::date + time '13:00') at time zone 'Pacific/Auckland';
  sale uuid; sale2 uuid; cp uuid; n int; ok1 boolean; ok2 boolean;
begin
  ---------------------------------------------------------------- Two bookings, one stylist, one time
  perform pg_temp.ok(pg_temp.err(format('insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status) values (%L, %L, %L, %L, %L, ''confirmed'')', sa, cl, stf, t0, t0 + interval '30 minutes')) = 'none', 'the first booking was refused');
  perform pg_temp.ok(pg_temp.err(format('insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status) values (%L, %L, %L, %L, %L, ''confirmed'')', sa, cl, stf, t0 + interval '15 minutes', t0 + interval '45 minutes')) = '23P01', 'two overlapping bookings for one stylist were both accepted');
  perform pg_temp.ok(pg_temp.err(format('insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status) values (%L, %L, %L, %L, %L, ''confirmed'')', sa, cl, stf, t0 + interval '30 minutes', t0 + interval '60 minutes')) = 'none', 'a booking starting exactly when another ends was refused');

  ---------------------------------------------------------------- One open sale per booking
  insert into sales (salon_id, booking_id, client_id, staff_id, status, subtotal_cents, tax_rate, tax_inclusive, tax_cents, total_cents)
    values (sa, bk, cl, stf, 'pending', 5000, 0, false, 0, 5000) returning id into sale;
  perform pg_temp.ok(pg_temp.err(format('insert into sales (salon_id, booking_id, client_id, staff_id, status, subtotal_cents, tax_rate, tax_inclusive, tax_cents, total_cents) values (%L, %L, %L, %L, ''pending'', 5000, 0, false, 0, 5000)', sa, bk, cl, stf)) = '23505', 'a second sale was opened for the same booking');

  ---------------------------------------------------------------- One open card step per sale
  insert into card_payments (salon_id, sale_id, kind, txn_ref, amount_cents) values (sa, sale, 'terminal', 'TMtest000000000001', 5000);
  perform pg_temp.ok(pg_temp.err(format('insert into card_payments (salon_id, sale_id, kind, txn_ref, amount_cents) values (%L, %L, ''terminal'', ''TMtest000000000002'', 5000)', sa, sale)) = '23505', 'a second card payment was started on a sale already waiting for one');
  perform pg_temp.ok(pg_temp.err(format('insert into card_payments (salon_id, sale_id, kind, txn_ref, amount_cents) values (%L, %L, ''online'', ''ONtest000000000003'', 5000)', sa, sale)) = '23505', 'an on-screen payment was started while the terminal was waiting');
  update card_payments set status = 'approved' where txn_ref = 'TMtest000000000001';
  perform pg_temp.ok(pg_temp.err(format('insert into card_payments (salon_id, sale_id, kind, txn_ref, amount_cents) values (%L, %L, ''terminal'', ''RFtest000000000004'', 5000)', sa, sale)) = 'none', 'a refund could not be started once the payment was approved');
  perform pg_temp.ok(pg_temp.err(format('insert into card_payments (salon_id, sale_id, kind, txn_ref, amount_cents) values (%L, %L, ''terminal'', ''RFtest000000000005'', 5000)', sa, sale)) = '23505', 'a second refund was started while one was waiting');

  ---------------------------------------------------------------- A card refund can be claimed once
  select id into cp from card_payments where txn_ref = 'TMtest000000000001';
  ok1 := claim_card_refund(cp); ok2 := claim_card_refund(cp);
  perform pg_temp.ok(ok1 and not ok2, 'the refund could be claimed twice (first ' || ok1 || ', second ' || ok2 || ')');
  update card_payments set refund_claimed_at = null where id = cp; -- Windcave declined: it may be tried again
  perform pg_temp.ok(claim_card_refund(cp), 'a declined refund could not be tried again');
  update card_payments set refund_claimed_at = now() - interval '3 minutes' where id = cp; -- left hanging: after two minutes it is free again
  perform pg_temp.ok(claim_card_refund(cp), 'a stale claim was never released');
  update card_payments set status = 'refunded' where id = cp;
  perform pg_temp.ok(not claim_card_refund(cp), 'a refunded payment could be claimed for refund again');

  ---------------------------------------------------------------- One client per email in a salon, however it is typed
  insert into clients (salon_id, name, email) values (sa, 'Dup One', 'dup@t.test');
  perform pg_temp.ok(pg_temp.err(format('insert into clients (salon_id, name, email) values (%L, ''Dup Two'', ''DUP@t.test'')', sa)) = '23505', 'the same email was accepted twice in one salon with different capitals');
  perform pg_temp.ok(pg_temp.err(format('insert into clients (salon_id, name, email) values (%L, ''Dup Other Salon'', ''dup@t.test'')', pg_temp.f('sb'))) = 'none', 'the same email could not be used in a different salon');

  ---------------------------------------------------------------- A public form stops after its limit
  n := 0; for i in 1..8 loop if rate_hit('t-form-' || sa, 5, 60) then n := n + 1; end if; end loop;
  perform pg_temp.ok(n = 5, 'the limit of 5 let ' || n || ' through');
  perform pg_temp.ok(rate_hit('t-form-other', 5, 60), 'one visitor''s limit stopped a different visitor');
end $t$;
