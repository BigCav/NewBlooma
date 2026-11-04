-- A simulated shop day with the card machine faked. Windcave's answers are stood in for by three helpers that do exactly what the app's
-- settleOnline / pollTerminal / refundByCard do with a reply (write the card_payments row, then call finalize_sale or refund_sale_internal),
-- so every rule in the database around card money is exercised without a card: in-flight locks, declines and retries, the same approval arriving
-- twice, an approval for the wrong amount, stock, tips, tax, refunds, and finally that the daily summary, the till and payroll agree with the sales.

create function pg_temp.id_as(uid uuid, q text) returns uuid language plpgsql as $$
declare r uuid; begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin execute q into r; reset role; return r; exception when others then reset role; raise; end;
end $$;

create function pg_temp.json_as(uid uuid, q text) returns jsonb language plpgsql as $$
declare r jsonb; begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin execute q into r; reset role; return r; exception when others then reset role; return jsonb_build_object('error', sqlstate); end;
end $$;

-- The customer taps their card: the app records the attempt for the sale's current total.
create function pg_temp.card_start(p_sale uuid, p_kind card_kind) returns text language plpgsql as $$
declare s sales; t text := 'SIM' || substr(gen_random_uuid()::text, 1, 12); begin
  select * into s from sales where id = p_sale;
  insert into card_payments (salon_id, sale_id, kind, txn_ref, amount_cents) values (s.salon_id, p_sale, p_kind, t, s.total_cents);
  return t;
end $$;

-- Windcave says "approved" for p_paid cents (null = the right amount). Same checks as the app: a wrong amount is flagged and the sale is NOT paid.
create function pg_temp.card_approve(p_txn text, p_paid int default null) returns text language plpgsql as $$
declare cp card_payments; begin
  select * into cp from card_payments where txn_ref = p_txn;
  if cp.status = 'approved' then perform finalize_sale(cp.sale_id, 'card'); return 'approved'; end if;
  if cp.status <> 'pending' then return cp.status::text; end if; -- like pollTerminal: an attempt that already ended is never re-opened
  if coalesce(p_paid, cp.amount_cents) <> cp.amount_cents then
    update card_payments set status = 'error', needs_review = true, review_note = 'Approved amount differs from sale total' where id = cp.id;
    return 'review';
  end if;
  update card_payments set status = 'approved', dps_txn_ref = 'DPS' || p_txn, auth_code = '123456', resolved_at = now() where id = cp.id;
  begin perform finalize_sale(cp.sale_id, 'card');
  exception when others then update card_payments set needs_review = true, review_note = 'Approved but sale not finalised: ' || sqlerrm where id = cp.id; return 'review'; end;
  return 'approved';
end $$;

create function pg_temp.card_decline(p_txn text) returns void language sql as $$
  update card_payments set status = 'declined', response_text = 'DECLINED', resolved_at = now() where txn_ref = p_txn;
$$;

-- A matched refund: the card payment and the sale both end up refunded.
create function pg_temp.card_refund(p_sale uuid) returns void language plpgsql as $$ begin
  update card_payments set status = 'refunded', resolved_at = now() where sale_id = p_sale and status = 'approved';
  perform refund_sale_internal(p_sale);
end $$;

do $t$
declare
  tz text := 'Pacific/Auckland'; monday date := (date_trunc('week', now() + interval '10 days'))::date; today date := (now() at time zone 'Pacific/Auckland')::date;
  sa uuid := pg_temp.f('sa'); ua uuid := pg_temp.f('ua'); us uuid := pg_temp.f('us');
  cla uuid := pg_temp.f('cla'); stfa uuid := pg_temp.f('stfa'); stfs uuid := pg_temp.f('stfs'); svca uuid := pg_temp.f('svca');
  bk uuid; s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid; s6 uuid; s7 uuid; pid uuid; gid uuid; t text; t2 text; r text; j jsonb; n int; paid1 timestamptz;
  exp_total int; exp_refund int; exp_tips int; exp_card int; exp_cash int; exp_gift int; exp_cash_drawer int;
begin
  update salon_settings set accept_cash = true, accept_card = true, accept_gift_cards = true, ask_for_tip = true, tax_rate = 15, tax_inclusive = true where salon_id = sa;
  update staff set commission_pct = 40 where id = stfa;
  update staff set commission_pct = 50 where id = stfs;
  insert into products (salon_id, name, price_cents, stock) values (sa, 'Serum', 3000, 5) returning id into pid;

  ---------------------------------------------------------------- 1. Booked cut, 20% tip, paid on the terminal
  bk := create_booking(sa, cla, stfa, (((monday + 3) + time '14:00') at time zone tz), array[svca], 'staff', null, 'staff');
  s1 := pg_temp.id_as(ua, format('select create_sale(%L, null, ''[]''::jsonb, 20)', bk));
  perform pg_temp.ok((select subtotal_cents from sales where id = s1) = 5000, 'the cut should be $50.00');
  perform pg_temp.ok((select tip_cents from sales where id = s1) = 1000, 'a 20 percent tip on $50 should be $10.00');
  perform pg_temp.ok((select total_cents from sales where id = s1) = 6000, 'the bill should be $60.00: ' || (select total_cents from sales where id = s1));
  perform pg_temp.ok((select tax_cents from sales where id = s1) = calc_tax_cents(5000, 15, true) and (select tax_cents from sales where id = s1) = 652, 'GST included in $50.00 should be $6.52');

  t := pg_temp.card_start(s1, 'terminal');
  -- while the customer is tapping, nothing about the sale may change and no other way of paying may sneak in
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select set_sale_tip(%L, 0)', s1)) like 'ERR%', 'tip changed while the card was in progress');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select set_sale_discount(%L, ''percent'', 10)', s1)) like 'ERR%', 'discount applied while the card was in progress');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select complete_sale(%L, ''cash'')', s1)) like 'ERR%', 'cash was taken while the card was in progress');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select void_pending_sale(%L)', s1)) like 'ERR%', 'a sale was voided while the card was in progress');
  perform pg_temp.ok((select status from sales where id = s1) = 'pending', 'the sale left pending before Windcave answered');

  perform pg_temp.ok(pg_temp.card_approve(t) = 'approved', 'a good approval was not accepted');
  perform pg_temp.ok((select status from sales where id = s1) = 'paid' and (select method from sales where id = s1) = 'card', 'the approved sale is not paid by card');
  perform pg_temp.ok((select status from bookings where id = bk) = 'completed', 'paying did not complete the booking');
  perform pg_temp.ok((select paid_at from sales where id = s1) is not null, 'a paid sale has no paid time');
  select paid_at into paid1 from sales where id = s1;
  -- Windcave's notification and the till's own poll both arrive: the second must change nothing
  perform pg_temp.ok(pg_temp.card_approve(t) = 'approved', 'the same approval arriving twice was refused');
  perform pg_temp.ok((select paid_at from sales where id = s1) = paid1, 'the same approval arriving twice moved the paid time');
  perform pg_temp.ok((select count(*) from card_payments where sale_id = s1 and status = 'approved') = 1, 'one sale has more than one approved card payment');
  perform pg_temp.ok((select count(*) from audit_log where entity_id = s1 and action = 'paid') = 1, 'one payment was logged ' || (select count(*) from audit_log where entity_id = s1 and action = 'paid') || ' times');
  -- a paid sale is closed to every change
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select complete_sale(%L, ''cash'')', s1)) like 'ERR%', 'a card-paid sale was paid again with cash');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select set_sale_tip(%L, 5)', s1)) like 'ERR%', 'a card-paid sale was re-tipped');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select void_pending_sale(%L)', s1)) like 'ERR%', 'a card-paid sale was voided');

  ---------------------------------------------------------------- 2. Declined, retried with a new tip, paid online
  s2 := pg_temp.id_as(ua, format('select create_walkin_sale(''Walk In'', %L, 0, %L)', svca, cla));
  t := pg_temp.card_start(s2, 'online'); perform pg_temp.card_decline(t);
  perform pg_temp.ok((select status from sales where id = s2) = 'pending', 'a declined card paid the sale');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select set_sale_tip(%L, 10)', s2)) = 'OK 1', 'a declined card left the sale locked');
  perform pg_temp.ok((select total_cents from sales where id = s2) = 5500, 'a 10 percent tip should make $55.00');
  t2 := pg_temp.card_start(s2, 'online');
  perform pg_temp.ok((select amount_cents from card_payments where txn_ref = t2) = 5500, 'the retry did not charge the new total');
  r := pg_temp.card_approve(t2);
  perform pg_temp.ok(r = 'approved' and (select status from sales where id = s2) = 'paid', 'the retry was not paid');
  perform pg_temp.ok((select count(*) from card_payments where sale_id = s2 and status = 'approved') = 1 and (select count(*) from card_payments where sale_id = s2 and status = 'declined') = 1, 'the attempts are not recorded as one decline and one approval');
  perform pg_temp.ok(pg_temp.card_approve(t) is not null and (select status from card_payments where txn_ref = t) = 'declined', 'a declined attempt came back to life');

  ---------------------------------------------------------------- 3. Windcave approves a different amount: flagged, sale NOT paid
  s3 := pg_temp.id_as(ua, format('select create_walkin_sale(''Walk In 2'', %L, 0, %L)', svca, cla));
  t := pg_temp.card_start(s3, 'terminal');
  perform pg_temp.ok(pg_temp.card_approve(t, 4000) = 'review', 'an approval for the wrong amount was accepted');
  perform pg_temp.ok((select status from sales where id = s3) = 'pending', 'the sale was marked paid on a wrong-amount approval');
  perform pg_temp.ok((select needs_review from card_payments where txn_ref = t), 'a wrong-amount approval was not flagged for review');
  perform pg_temp.dml_as(ua, format('select complete_sale(%L, ''cash'')', s3));
  perform pg_temp.ok((select status from sales where id = s3) = 'paid' and (select method from sales where id = s3) = 'cash', 'the customer could not pay again in cash after the flagged card');

  ---------------------------------------------------------------- 4. Product sale by card: stock goes down on payment, back up on refund
  s4 := pg_temp.id_as(ua, format('select create_sale(null, %L, jsonb_build_array(jsonb_build_object(''product_id'', %L, ''qty'', 2)))', cla, pid));
  perform pg_temp.ok((select total_cents from sales where id = s4) = 6000, 'two serums should be $60.00');
  t := pg_temp.card_start(s4, 'terminal');
  perform pg_temp.ok((select stock from products where id = pid) = 5, 'stock changed before the card was approved');
  perform pg_temp.card_approve(t);
  perform pg_temp.card_approve(t);
  perform pg_temp.ok((select stock from products where id = pid) = 3, 'stock after selling 2 of 5 should be 3, not ' || (select stock from products where id = pid));
  perform pg_temp.card_refund(s4);
  perform pg_temp.ok((select status from sales where id = s4) = 'refunded' and (select status from card_payments where txn_ref = t) = 'refunded', 'a card refund did not mark both the sale and the card payment');
  perform pg_temp.ok((select stock from products where id = pid) = 5, 'a refund did not put the stock back');
  perform pg_temp.ok(pg_temp.err_of(format('select refund_sale_internal(%L)', s4)) <> 'none', 'a card sale was refunded twice');
  perform pg_temp.ok((select stock from products where id = pid) = 5, 'a second refund put the stock back twice');
  perform pg_temp.ok(pg_temp.err_of(format('select finalize_sale(%L, ''card'')', s4)) <> 'none', 'a refunded sale was paid again by a late approval');

  ---------------------------------------------------------------- 5. Walk-in with a 15% tip refunded after paying by card (tip must come back out of the day)
  s5 := pg_temp.id_as(ua, format('select create_walkin_sale(''Walk In 3'', %L, 15, %L)', svca, cla));
  perform pg_temp.card_approve(pg_temp.card_start(s5, 'online'));
  perform pg_temp.ok((select total_cents from sales where id = s5) = 5750, 'a 15 percent tip should make $57.50');
  perform pg_temp.card_refund(s5);

  ---------------------------------------------------------------- 6. A gift card sale and a cash sale by the other stylist
  insert into gift_cards (salon_id, code, balance_cents, original_cents) values (sa, 'SIMGC', 20000, 20000) returning id into gid;
  s6 := pg_temp.id_as(ua, format('select create_walkin_sale(''Gift Walk In'', %L, 0, %L)', svca, cla));
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select complete_sale(%L, ''gift_card'', ''SIMGC'')', s6)) = 'OK 1', 'the gift card sale did not go through');
  perform pg_temp.ok((select balance_cents from gift_cards where id = gid) = 15000, 'a $50 sale should take $50 off the gift card');
  s7 := pg_temp.id_as(ua, format('select create_walkin_sale(''Cash Walk In'', %L, 0, %L)', svca, cla));
  update sales set staff_id = stfs where id = s7;
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select complete_sale(%L, ''cash'')', s7)) = 'OK 1', 'the cash sale did not go through');

  ---------------------------------------------------------------- 7. The books must agree with the till: every approved card is a paid sale for the same money
  perform pg_temp.ok((select count(*) from card_payments cp join sales s on s.id = cp.sale_id where cp.status = 'approved' and (s.status <> 'paid' or s.method <> 'card' or s.total_cents <> cp.amount_cents)) = 0,
    'an approved card payment does not match its sale');
  perform pg_temp.ok((select count(*) from sales s where s.method = 'card' and s.status = 'paid' and not exists (select 1 from card_payments cp where cp.sale_id = s.id and cp.status = 'approved')) = 0,
    'a sale is marked paid by card with no approved card payment behind it');
  perform pg_temp.ok((select count(*) from card_payments where needs_review and sale_id in (s1, s2, s4, s5, s6, s7)) = 0, 'a clean payment was flagged for review');
  perform pg_temp.ok((select count(*) from sales where total_cents <> subtotal_cents + tip_cents + case when tax_inclusive then 0 else tax_cents end) = 0, 'a sale does not add up');

  -- the daily summary against the sales themselves
  select coalesce(sum(total_cents), 0), coalesce(sum(total_cents) filter (where status = 'refunded'), 0), coalesce(sum(tip_cents), 0), -- the summary is gross (taken, tips, tax) with refunds as one line below; payroll tips are the net ones
         coalesce(sum(total_cents) filter (where method = 'card' and status = 'paid'), 0), coalesce(sum(total_cents) filter (where method = 'cash'), 0),
         coalesce(sum(total_cents) filter (where method = 'gift_card' and status = 'paid'), 0)
    into exp_total, exp_refund, exp_tips, exp_card, exp_cash, exp_gift
    from sales where salon_id = sa and status in ('paid', 'refunded') and (paid_at at time zone tz)::date = today;
  exp_cash_drawer := exp_cash;
  j := pg_temp.json_as(ua, format('select sales_summary(%L, %L)', today, today));
  perform pg_temp.ok(j ->> 'error' is null, 'the summary failed: ' || coalesce(j ->> 'error', ''));
  perform pg_temp.ok((j ->> 'sales_count')::int = 7, 'summary counted ' || (j ->> 'sales_count') || ' sales, expected 7');
  perform pg_temp.ok((j ->> 'total_cents')::int = exp_total, 'summary total ' || (j ->> 'total_cents') || ' but the sales add to ' || exp_total);
  perform pg_temp.ok((j ->> 'refund_cents')::int = exp_refund and (j ->> 'refund_count')::int = 2, 'summary refunds ' || (j ->> 'refund_cents') || ' but refunded sales add to ' || exp_refund);
  perform pg_temp.ok((j ->> 'tips_cents')::int = exp_tips, 'summary tips ' || (j ->> 'tips_cents') || ' but tips on the day''s sales add to ' || exp_tips);
  perform pg_temp.ok((select sum((m ->> 'cents')::int) from jsonb_array_elements(j -> 'by_method') m) = (j ->> 'total_cents')::int, 'the payment methods do not add up to the total');
  perform pg_temp.ok((select (m ->> 'cents')::int from jsonb_array_elements(j -> 'by_method') m where m ->> 'method' = 'card') = exp_card + 6000 + 5750, 'card takings are wrong (paid then refunded cards stay in takings; refunds are listed apart)');
  perform pg_temp.ok((select (m ->> 'refund_cents')::int from jsonb_array_elements(j -> 'by_method') m where m ->> 'method' = 'card') = 6000 + 5750, 'card refunds are wrong');
  perform pg_temp.ok((j ->> 'cash_expected_cents')::int = exp_cash_drawer, 'cash expected in the drawer ' || (j ->> 'cash_expected_cents') || ', the cash sales add to ' || exp_cash_drawer);
  perform pg_temp.ok(pg_temp.json_as(us, format('select sales_summary(%L, %L)', today, today)) ->> 'error' = '42501', 'a stylist saw the day''s takings');

  -- cash-up: counting exactly what is expected shows no difference, and being $2.50 short shows $2.50
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select close_till(%L, %s, null)', today, exp_cash_drawer - 250)) = 'OK 1', 'the till could not be closed');
  j := pg_temp.json_as(ua, format('select sales_summary(%L, %L)', today, today));
  perform pg_temp.ok((j -> 'till' ->> 'counted_cents')::int - (j -> 'till' ->> 'expected_cents')::int = -250, 'a $2.50 short till did not show as short: ' || coalesce(j ->> 'till', 'none'));

  -- payroll: only paid sales earn commission and tips; refunded ones earn nothing; the discount-free service money is what commission is on
  j := pg_temp.json_as(ua, format('select jsonb_agg(to_jsonb(w)) from payroll_week(%L, %L) w', today, today));
  perform pg_temp.ok(j ->> 'error' is null, 'payroll failed: ' || coalesce(j ->> 'error', ''));
  -- stfa: s1 $50 + s2 $50 (+ s3 cash $50 has the first stylist too) + s6 gift $50 paid; s5 refunded; s4 is products only and refunded
  select coalesce(sum(si.price_cents * si.qty), 0) into n from sales s join sale_items si on si.sale_id = s.id where s.staff_id = stfa and s.status = 'paid' and si.service_id is not null and (s.paid_at at time zone tz)::date = today;
  perform pg_temp.ok((select (w ->> 'service_cents')::int from jsonb_array_elements(j) w where w ->> 'staff_id' = stfa::text) = n, 'payroll service money for the owner is wrong: ' || (select w ->> 'service_cents' from jsonb_array_elements(j) w where w ->> 'staff_id' = stfa::text) || ' vs ' || n);
  perform pg_temp.ok((select (w ->> 'tips_cents')::int from jsonb_array_elements(j) w where w ->> 'staff_id' = stfa::text) = (select coalesce(sum(tip_cents), 0) from sales where staff_id = stfa and status = 'paid' and (paid_at at time zone tz)::date = today),
    'payroll tips for the owner are wrong (a refunded sale''s tip must not count)');
  perform pg_temp.ok((select (w ->> 'service_commission_cents')::int from jsonb_array_elements(j) w where w ->> 'staff_id' = stfa::text) = round(n * 0.40), 'commission at 40 percent is wrong');
  perform pg_temp.ok((select (w ->> 'service_cents')::int from jsonb_array_elements(j) w where w ->> 'staff_id' = stfs::text) = 5000 and (select (w ->> 'service_commission_cents')::int from jsonb_array_elements(j) w where w ->> 'staff_id' = stfs::text) = 2500,
    'the second stylist should have $50.00 of services and $25.00 commission at 50 percent');
end $t$;
