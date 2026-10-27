-- Taking payment: tips, discounts, price edits, gift cards, stock, refunds, tax and the rule that one sale is paid only once.
-- (Calls that check "is this my salon" through is_service() cannot be tried from a direct database login, so cross-salon calls are covered in 01.)
do $t$
declare
  sa uuid := pg_temp.f('sa'); sb uuid := pg_temp.f('sb'); ua uuid := pg_temp.f('ua'); us uuid := pg_temp.f('us'); ub uuid := pg_temp.f('ub');
  cla uuid := pg_temp.f('cla'); stfa uuid := pg_temp.f('stfa'); svca uuid := pg_temp.f('svca'); svcb uuid := pg_temp.f('svcb');
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; pid uuid; gid uuid; vid uuid; r text; n int;
begin
  update salon_settings set accept_cash = true, accept_gift_cards = true, ask_for_tip = true, tax_rate = 0, tax_inclusive = false where salon_id = sa;

  -- tax maths
  perform pg_temp.ok(calc_tax_cents(10000, 15, false) = 1500, 'tax added on top');
  perform pg_temp.ok(calc_tax_cents(11500, 15, true) = 1500, 'tax included in the price');
  perform pg_temp.ok(calc_tax_cents(1, 15, false) = 0, 'tax on one cent');
  perform pg_temp.ok(calc_tax_cents(0, 15, false) = 0, 'tax on nothing');

  -- a walk-in sale for $50
  insert into sales (salon_id, client_id, staff_id, subtotal_cents, tax_rate, tax_inclusive, tax_cents, total_cents) values (sa, cla, stfa, 5000, 0, false, 0, 5000) returning id into s1;
  insert into sale_items (sale_id, service_id, label, qty, price_cents) values (s1, svca, 'Cut A', 1, 5000);

  -- tips: 0 to 100 percent only
  foreach r in array array['-1', '101', '1000000'] loop
    perform pg_temp.ok(pg_temp.dml_as(ua, format('select set_sale_tip(%L, %s)', s1, r)) like 'ERR%', 'tip of ' || r || ' percent was accepted');
  end loop;
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select set_sale_tip(%L, 20)', s1)) = 'OK 1', 'owner could not set a tip');
  perform pg_temp.ok((select tip_cents from sales where id = s1) = 1000 and (select total_cents from sales where id = s1) = 6000, 'a 20 percent tip is wrong');
  perform pg_temp.ok(pg_temp.dml_as(us, format('select set_sale_tip(%L, 0)', s1)) = 'OK 1', 'a stylist could not remove a tip while taking payment');

  -- discounts and price edits are for the owner only
  perform pg_temp.ok(pg_temp.dml_as(us, format('select set_sale_discount(%L, ''percent'', 10, ''x'')', s1)) like 'ERR%', 'stylist gave a discount');
  perform pg_temp.ok(pg_temp.dml_as(us, format('select set_sale_service_price(%L, 100)', s1)) like 'ERR%', 'stylist changed a price');
  foreach r in array array['''percent'', 100', '''percent'', 101', '''amount'', 5000', '''amount'', 999999999', '''bogus'', 10'] loop
    perform pg_temp.ok(pg_temp.dml_as(ua, format('select set_sale_discount(%L, %s)', s1, r)) like 'ERR%', 'a discount of ' || r || ' was accepted');
  end loop;
  perform pg_temp.ok((select discount_cents from sales where id = s1) = 0, 'a refused discount still changed the sale');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select set_sale_discount(%L, ''amount'', 1000, ''friend'')', s1)) = 'OK 1', 'owner could not discount');
  perform pg_temp.ok((select total_cents from sales where id = s1) = 4000, 'a $10 discount on $50 should total $40 (tip is 0 now)');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select set_sale_service_price(%L, 6000)', s1)) like 'ERR%', 'price edited while a discount was on');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select set_sale_discount(%L, ''none'', 0)', s1)) = 'OK 1' and (select total_cents from sales where id = s1) = 5000, 'removing a discount did not restore the total');
  foreach r in array array['0', '-5', '2147483648'] loop
    perform pg_temp.ok(pg_temp.dml_as(ua, format('select set_sale_service_price(%L, %s)', s1, r)) like 'ERR%', 'price of ' || r || ' cents was accepted');
  end loop;
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select set_sale_service_price(%L, 6000)', s1)) = 'OK 1' and (select total_cents from sales where id = s1) = 6000, 'owner price edit did not carry through');

  -- every sale always adds up
  perform pg_temp.ok((select count(*) from sales where total_cents <> subtotal_cents + tip_cents + case when tax_inclusive then 0 else tax_cents end) = 0, 'a sale does not add up');

  -- gift cards: right salon, enough money, not voided, never below zero
  insert into gift_cards (salon_id, code, balance_cents, original_cents) values (sa, 'SMALLCARD', 1000, 1000), (sa, 'BIGCARD', 20000, 20000) returning id into gid;
  select id into gid from gift_cards where code = 'BIGCARD' and salon_id = sa;
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select complete_sale(%L, ''gift_card'', ''TESTGIFT100'')', s1)) like 'ERR%', 'paid with another salon''s gift card');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select complete_sale(%L, ''gift_card'', ''SMALLCARD'')', s1)) like 'ERR%', 'paid with a card that is too small');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select complete_sale(%L, ''gift_card'', ''NOSUCH'')', s1)) like 'ERR%', 'paid with a card that does not exist');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select complete_sale(%L, ''card'')', s1)) like 'ERR%', 'staff marked a card payment with no card taken');
  perform pg_temp.ok((select balance_cents from gift_cards where code = 'SMALLCARD' and salon_id = sa) = 1000 and (select status from sales where id = s1) = 'pending', 'a refused payment changed something');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select complete_sale(%L, ''gift_card'', ''BIGCARD'')', s1)) = 'OK 1', 'owner could not pay with a good gift card');
  perform pg_temp.ok((select balance_cents from gift_cards where id = gid) = 14000 and (select status from sales where id = s1) = 'paid', 'gift card balance after a $60 sale should be $140');
  -- a paid sale cannot be paid, discounted, tipped or repriced again
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select complete_sale(%L, ''cash'')', s1)) like 'ERR%', 'a paid sale was paid again');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select set_sale_tip(%L, 50)', s1)) like 'ERR%', 'a paid sale was tipped');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select set_sale_discount(%L, ''percent'', 50)', s1)) like 'ERR%', 'a paid sale was discounted');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select set_sale_service_price(%L, 1)', s1)) like 'ERR%', 'a paid sale was repriced');
  -- a second payer for a sale that is already paid (for example a card approved after cash was taken) must be flagged, not swallowed
  perform pg_temp.ok(pg_temp.err_of(format('select finalize_sale(%L, ''card'')', s1)) <> 'none', 'a gift card sale was quietly marked as also paid by card');
  perform pg_temp.ok(pg_temp.err_of(format('select finalize_sale(%L, ''gift_card'')', s1)) = 'none', 'finishing the same payment twice should be harmless');

  -- refunds: owner only, once only, and the money comes back
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select refund_sale(%L)', s1)) = 'OK 1', 'owner could not refund');
  perform pg_temp.ok((select balance_cents from gift_cards where id = gid) = 20000, 'refund did not return the money to the gift card');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select refund_sale(%L)', s1)) like 'ERR%', 'a sale was refunded twice');
  perform pg_temp.ok((select balance_cents from gift_cards where id = gid) = 20000, 'a second refund added money again');

  -- a refund must not bring a voided gift card back to life
  insert into sales (salon_id, client_id, staff_id, subtotal_cents, tax_rate, tax_inclusive, tax_cents, total_cents) values (sa, cla, stfa, 5000, 0, false, 0, 5000) returning id into s2;
  insert into sale_items (sale_id, service_id, label, qty, price_cents) values (s2, svca, 'Cut A', 1, 5000);
  perform pg_temp.dml_as(ua, format('select complete_sale(%L, ''gift_card'', ''BIGCARD'')', s2));
  update gift_cards set voided_cents = balance_cents, balance_cents = 0, voided_at = now() where id = gid;
  perform pg_temp.dml_as(ua, format('select refund_sale(%L)', s2));
  perform pg_temp.ok((select balance_cents from gift_cards where id = gid) = 0, 'refunding to a voided gift card put money back on it');

  -- products: stock is checked, taken on payment and put back on refund
  insert into products (salon_id, name, price_cents, stock) values (sa, 'Conditioner', 3000, 3) returning id into pid;
  foreach r in array array['5', '0', '-1', '99999999999'] loop
    perform pg_temp.ok(pg_temp.dml_as(ua, format('select create_sale(null, %L, jsonb_build_array(jsonb_build_object(''product_id'', %L, ''qty'', %s)))', cla, pid, r)) like 'ERR%', 'a sale of ' || r || ' units was accepted with 3 in stock');
  end loop;
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select create_sale(null, %L, jsonb_build_array(jsonb_build_object(''product_id'', %L, ''qty'', 1)), 150)', cla, pid)) like 'ERR%', 'tip of 150 percent accepted on create');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select create_sale(null, %L, jsonb_build_array(jsonb_build_object(''product_id'', %L, ''qty'', 1)))', cla, (select id from products where name = 'Shampoo B'))) like 'ERR%', 'sold another salon''s product');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select create_sale(null, %L, ''[]''::jsonb)', cla)) like 'ERR%', 'an empty sale was created');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select create_sale(null, %L, jsonb_build_array(jsonb_build_object(''product_id'', %L, ''qty'', 2)))', cla, pid)) = 'OK 1', 'owner could not create a product sale');
  select id into s3 from sales where salon_id = sa and id not in (s1, s2) order by created_at desc limit 1;
  perform pg_temp.ok((select subtotal_cents from sales where id = s3) = 6000, 'two conditioners should be $60');
  perform pg_temp.ok((select stock from products where id = pid) = 3, 'stock changed before payment');
  perform pg_temp.dml_as(ua, format('select complete_sale(%L, ''cash'')', s3));
  perform pg_temp.ok((select stock from products where id = pid) = 1, 'stock after selling 2 of 3 should be 1');
  perform pg_temp.dml_as(ua, format('select refund_sale(%L)', s3));
  perform pg_temp.ok((select stock from products where id = pid) = 3, 'refund did not put the stock back');

  -- a booking is billed once, and never when it was cancelled
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select create_sale(%L, null)', pg_temp.f('bka'))) = 'OK 1', 'owner could not bill a booking');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select create_sale(%L, null)', pg_temp.f('bka'))) like 'ERR%', 'one booking was billed twice');
  update bookings set status = 'cancelled' where id = pg_temp.f('bka');
  delete from sales where booking_id = pg_temp.f('bka');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select create_sale(%L, null)', pg_temp.f('bka'))) like 'ERR%', 'a cancelled booking was billed');

  -- walk-in sales use this salon's service and client only
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select create_walkin_sale(''Walk In'', %L, 0)', svcb)) like 'ERR%', 'walk-in sale of another salon''s service');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select create_walkin_sale(''x'', %L, 0, %L)', svca, pg_temp.f('clb'))) like 'ERR%', 'walk-in sale for another salon''s client');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select create_walkin_sale(''x'', %L, 101)', svca)) like 'ERR%', 'walk-in tip of 101 percent');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select create_walkin_sale(''   '', %L, 0)', svca)) like 'ERR%', 'walk-in sale with no client name');
end $t$;

-- paying the team: a week can be paid once, only when it is over, and no two paid weeks may overlap
do $t$
declare
  sa uuid := pg_temp.f('sa'); ua uuid := pg_temp.f('ua'); us uuid := pg_temp.f('us'); stfs uuid := pg_temp.f('stfs'); cla uuid := pg_temp.f('cla');
  d0 date := (date_trunc('week', now() + interval '12 hours'))::date - 14; sid uuid;
begin
  update staff set commission_pct = 40 where id = stfs;
  insert into sales (salon_id, client_id, staff_id, status, method, subtotal_cents, tax_rate, tax_inclusive, tax_cents, total_cents, paid_at)
    values (sa, cla, stfs, 'paid', 'cash', 10000, 0, false, 0, 10000, ((d0 + 2)::timestamp + time '11:00') at time zone 'Pacific/Auckland') returning id into sid;
  insert into sale_items (sale_id, label, qty, price_cents, service_id) values (sid, 'Cut', 1, 10000, pg_temp.f('svca'));
  perform pg_temp.ok(pg_temp.dml_as(us, format('select mark_payout_paid(%L, %L, %L)', stfs, d0, d0 + 6)) like 'ERR%', 'stylist marked a payout paid');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select mark_payout_paid(%L, %L, %L)', stfs, d0 + 7, d0 + 7 + 6 + 14)) like 'ERR%', 'a week that is not over yet was paid');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select mark_payout_paid(%L, %L, %L)', stfs, d0 + 6, d0)) like 'ERR%', 'a backwards pay period was accepted');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select mark_payout_paid(%L, %L, %L)', stfs, d0, d0 + 6)) = 'OK 1', 'owner could not pay a finished week');
  perform pg_temp.ok((select commission_cents from payouts where staff_id = stfs and period_start = d0) = 4000, 'commission should be 40 percent of $100');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select mark_payout_paid(%L, %L, %L)', stfs, d0, d0 + 6)) like 'ERR%', 'the same week was paid twice');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select mark_payout_paid(%L, %L, %L)', stfs, d0 - 3, d0 + 3)) like 'ERR%', 'an overlapping period paid the same sales twice');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select mark_payout_paid(%L, %L, %L)', stfs, d0, d0 + 13)) like 'ERR%', 'a longer period containing a paid week was paid');
end $t$;
