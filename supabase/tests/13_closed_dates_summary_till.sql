-- Closed dates, cancellation reasons, the daily sales summary and the till cash-up.
create function pg_temp.summ(uid uuid, d1 date, d2 date) returns jsonb language plpgsql as $$
declare r jsonb; begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin select sales_summary(d1, d2) into r; reset role; return r;
  exception when others then reset role; return jsonb_build_object('error', sqlstate); end;
end $$;

do $t$
declare
  tz text := 'Pacific/Auckland'; monday date := (date_trunc('week', now() + interval '10 days'))::date; today date := (now() at time zone 'Pacific/Auckland')::date;
  sa uuid := pg_temp.f('sa'); ua uuid := pg_temp.f('ua'); us uuid := pg_temp.f('us'); ub uuid := pg_temp.f('ub');
  cla uuid := pg_temp.f('cla'); stfa uuid := pg_temp.f('stfa'); stfs uuid := pg_temp.f('stfs'); svca uuid := pg_temp.f('svca');
  n int; bk uuid; tok text; worked boolean; r jsonb; cp uuid; s1 uuid; reason text;
begin
  -- closed dates
  select count(*) into n from available_slots(sa, array[svca], null, monday, monday, 'public', 15);
  perform pg_temp.ok(n > 0, 'the fixture day had no time to begin with');
  perform pg_temp.ok(pg_temp.dml_as(us, format('insert into closed_periods (salon_id, starts_on, ends_on) values (%L, %L, %L)', sa, monday, monday)) like 'ERR%', 'a stylist closed the salon');
  perform pg_temp.ok(pg_temp.dml_as(ub, format('insert into closed_periods (salon_id, starts_on, ends_on) values (%L, %L, %L)', sa, monday, monday)) like 'ERR%', 'another salon closed this salon');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('insert into closed_periods (salon_id, starts_on, ends_on) values (%L, %L, %L)', sa, monday + 1, monday)) like 'ERR%', 'a period that ends before it starts was accepted');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('insert into closed_periods (salon_id, starts_on, ends_on, reason) values (%L, %L, %L, %L)', sa, monday, monday + 1, 'Holiday')) = 'OK 1', 'owner could not add a closed period');
  perform pg_temp.ok(pg_temp.cnt_as(us, format('select 1 from closed_periods where salon_id = %L', sa)) = '1', 'a stylist could not see the closed dates');
  perform pg_temp.ok(pg_temp.cnt_as(ub, format('select 1 from closed_periods where salon_id = %L', sa)) = '0', 'another salon saw these closed dates');
  select count(*) into n from available_slots(sa, array[svca], null, monday, monday + 1, 'public', 15);
  perform pg_temp.ok(n = 0, 'online time was still offered on closed days: ' || n);
  select count(*) into n from available_slots(sa, array[svca], null, monday + 2, monday + 2, 'public', 15);
  perform pg_temp.ok(n > 0, 'the day after the closure was also closed');
  select count(*) into n from available_slots_excluding(sa, array[svca], null, monday, monday, 'public', 15, null);
  perform pg_temp.ok(n = 0, 'the move-an-appointment search offered a closed day');
  worked := false; begin perform create_booking(sa, cla, stfa, ((monday + time '10:00') at time zone tz), array[svca], 'online', null, 'public'); worked := true; exception when others then null; end;
  perform pg_temp.ok(not worked, 'an online booking was made on a closed day');

  bk := create_booking(sa, cla, stfa, (((monday + 2) + time '10:00') at time zone tz), array[svca], 'online', null, 'public');
  select token into tok from booking_tokens where booking_id = bk and purpose = 'manage_booking';
  worked := false; begin perform client_reschedule(tok, ((monday + time '11:00') at time zone tz)); worked := true; exception when others then null; end;
  perform pg_temp.ok(not worked, 'a client moved their appointment onto a closed day');
  worked := false; begin perform client_reschedule(tok, (((monday + 2) + time '11:00') at time zone tz)); worked := true; exception when others then null; end;
  perform pg_temp.ok(worked, 'a client could not move to an open day');
  select id into cp from closed_periods where salon_id = sa limit 1;
  perform pg_temp.ok(pg_temp.dml_as(ua, format('delete from closed_periods where id = %L', cp)) = 'OK 1', 'owner could not remove the closed period');
  select count(*) into n from available_slots(sa, array[svca], null, monday, monday, 'public', 15);
  perform pg_temp.ok(n > 0, 'removing the closed period did not reopen the day');

  -- cancellation reasons
  perform client_cancel(tok, 'sick');
  select cancel_reason into reason from bookings where id = bk;
  perform pg_temp.ok(reason = 'Client cancelled', 'a client cancellation was recorded as: ' || coalesce(reason, 'nothing'));
  perform pg_temp.ok(pg_temp.dml_as(ua, format('update bookings set cancel_reason = repeat(''x'', 201) where id = %L', bk)) like 'ERR%', 'a 201 character reason was accepted');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('update bookings set cancel_reason = %L where id = %L', 'Salon closed', bk)) = 'OK 1', 'staff could not record a reason');

  -- daily summary: three sales today (cash with tip and tax on top, card with a discount and tax included, a refunded cash sale) and a gift card
  insert into sales (salon_id, client_id, staff_id, status, method, subtotal_cents, tip_cents, tax_rate, tax_inclusive, tax_cents, total_cents, paid_at)
    values (sa, cla, stfa, 'paid', 'cash', 5000, 500, 15, false, 750, 6250, now()) returning id into s1;
  insert into sale_items (sale_id, service_id, label, qty, price_cents) values (s1, svca, 'Cut A', 1, 5000);
  insert into sales (salon_id, client_id, staff_id, status, method, subtotal_cents, discount_cents, tax_rate, tax_inclusive, tax_cents, total_cents, paid_at)
    values (sa, cla, stfs, 'paid', 'card', 8000, 1000, 15, true, 1043, 8000, now());
  insert into sales (salon_id, client_id, staff_id, status, method, subtotal_cents, tax_rate, tax_inclusive, tax_cents, total_cents, paid_at, refunded_at)
    values (sa, cla, stfa, 'refunded', 'cash', 3000, 15, true, 391, 3000, now(), now());
  insert into gift_cards (salon_id, code, balance_cents, original_cents) values (sa, 'SUMMARYGC', 2000, 2000);
  insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status, cancel_reason) values
    (sa, cla, stfa, now(), now() + interval '30 minutes', 'cancelled', 'Salon closed'),
    (sa, cla, stfs, now(), now() + interval '30 minutes', 'cancelled', null);

  r := pg_temp.summ(ua, today, today);
  perform pg_temp.ok((r->>'sales_count')::int = 3, 'sales counted: ' || coalesce(r->>'sales_count', r::text));
  perform pg_temp.ok((r->>'total_cents')::int = 17250, 'total taken: ' || (r->>'total_cents'));
  perform pg_temp.ok((r->>'sales_cents')::int = 16000, 'sales before tip and tax: ' || (r->>'sales_cents'));
  perform pg_temp.ok((r->>'discount_cents')::int = 1000, 'discounts: ' || (r->>'discount_cents'));
  perform pg_temp.ok((r->>'tips_cents')::int = 500, 'tips: ' || (r->>'tips_cents'));
  perform pg_temp.ok((r->>'tax_cents')::int = 2184, 'tax: ' || (r->>'tax_cents'));
  perform pg_temp.ok((r->>'refund_cents')::int = 3000 and (r->>'refund_count')::int = 1, 'refunds: ' || (r->>'refund_cents'));
  perform pg_temp.ok((r->>'cash_expected_cents')::int = 6250, 'cash that should be in the drawer: ' || (r->>'cash_expected_cents'));
  perform pg_temp.ok(jsonb_array_length(r->'by_method') = 2, 'payment methods listed: ' || jsonb_array_length(r->'by_method'));
  perform pg_temp.ok((select (m->>'cents')::int from jsonb_array_elements(r->'by_method') m where m->>'method' = 'cash') = 9250, 'cash taken is wrong');
  perform pg_temp.ok((select (m->>'refund_cents')::int from jsonb_array_elements(r->'by_method') m where m->>'method' = 'cash') = 3000, 'cash refunded is wrong');
  perform pg_temp.ok(jsonb_array_length(r->'tax_by_rate') = 2, 'tax lines: ' || jsonb_array_length(r->'tax_by_rate'));
  perform pg_temp.ok(jsonb_array_length(r->'by_staff') = 2, 'team lines: ' || jsonb_array_length(r->'by_staff'));
  perform pg_temp.ok((r->'gift_cards_sold'->>'count')::int = 1 and (r->'gift_cards_sold'->>'cents')::int = 2000, 'gift cards sold');
  perform pg_temp.ok(jsonb_array_length(r->'appointments'->'cancelled') = 2, 'cancellation reasons listed: ' || (r->'appointments'->>'cancelled'));
  perform pg_temp.ok(exists (select 1 from jsonb_array_elements(r->'appointments'->'cancelled') c where c->>'reason' = 'No reason recorded'), 'a cancellation with no reason was not labelled');
  perform pg_temp.ok(pg_temp.summ(us, today, today) ->> 'error' = '42501', 'a stylist read the sales summary');
  perform pg_temp.ok((pg_temp.summ(ub, today, today) ->> 'total_cents')::int = 5000, 'another salon''s summary included these sales');
  perform pg_temp.ok(pg_temp.summ(ua, today, today - 1) ->> 'error' is not null, 'a backwards date range was accepted');
  perform pg_temp.ok(pg_temp.summ(ua, today - 400, today) ->> 'error' is not null, 'a 400 day range was accepted');

  -- till cash-up
  perform pg_temp.ok(pg_temp.dml_as(us, format('select close_till(%L, 6000, null)', today)) like 'ERR%', 'a stylist closed the till');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select close_till(%L, 6000, null)', today + 1)) like 'ERR%', 'the till was closed for tomorrow');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select close_till(%L, -1, null)', today)) like 'ERR%', 'a negative cash count was accepted');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select close_till(%L, 6000, %L)', today, 'short $2.50')) = 'OK 1', 'owner could not close the till');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select close_till(%L, 6250, null)', today)) = 'OK 1', 'the till could not be re-counted');
  select count(*) into n from till_closes where salon_id = sa and day = today;
  perform pg_temp.ok(n = 1, 'closing the till twice left ' || n || ' records');
  r := pg_temp.summ(ua, today, today);
  perform pg_temp.ok((r->'till'->>'counted_cents')::int = 6250 and (r->'till'->>'expected_cents')::int = 6250, 'the cash-up was not shown on the summary: ' || coalesce(r->>'till', 'none'));
  perform pg_temp.ok(pg_temp.cnt_as(us, format('select 1 from till_closes where salon_id = %L', sa)) = '0', 'a stylist could read cash-ups');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('insert into till_closes (salon_id, day, expected_cents, counted_cents) values (%L, %L, 0, 0)', sa, today - 3)) like 'ERR%', 'cash-ups could be written directly');
end $t$;
