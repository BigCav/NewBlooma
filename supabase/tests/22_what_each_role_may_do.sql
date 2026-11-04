-- Who may do what inside one salon. A stylist can look after clients and clock themselves in, but cannot change the salon's settings, prices, hours,
-- products, gift cards or team, cannot promote themselves, cannot clock someone else in, and cannot read colleagues' pay rates. The owner can do all
-- of those (and reads pay rates through the payroll screen, not from the table). Strangers are covered in test 18, other salons in test 01.

do $t$
declare
  sa uuid := pg_temp.f('sa'); ua uuid := pg_temp.f('ua'); us uuid := pg_temp.f('us'); stfa uuid := pg_temp.f('stfa'); stfs uuid := pg_temp.f('stfs'); cla uuid := pg_temp.f('cla');
  rec record; r text; j jsonb; bad text := '';
begin
  update staff set commission_pct = 10 where id = stfa;
  update staff set commission_pct = 40 where id = stfs;

  ---------------------------------------------------------------- 1. Pay rates are private
  r := pg_temp.dml_as(us, 'select commission_pct from staff');
  perform pg_temp.ok(r like 'ERR%', 'a stylist could read commission rates: ' || r);
  perform pg_temp.ok(pg_temp.dml_as(us, 'select id, name, role_title, app_role, photo_url, active from staff') = 'OK 2', 'a stylist could not read the team list');
  perform pg_temp.ok(pg_temp.dml_as(us, 'select * from staff') like 'ERR%', 'select * on staff should be refused now that one column is private');
  j := pg_temp.json_as(ua, format('select jsonb_agg(commission_pct order by staff_name) from payroll_week(%L, %L)', current_date, current_date));
  perform pg_temp.ok(j ->> 'error' is null and (j ->> 0)::numeric = 10 and (j ->> 1)::numeric = 40, 'the owner could not see pay rates on the payroll screen: ' || coalesce(j::text, 'null'));
  perform pg_temp.ok(pg_temp.json_as(us, format('select jsonb_agg(commission_pct) from payroll_week(%L, %L)', current_date, current_date)) ->> 'error' is not null, 'a stylist got the payroll figures');

  ---------------------------------------------------------------- 2. What a stylist must not be able to change
  for rec in select * from (values
    ('salon settings',            format('update salon_settings set tax_rate = 0 where salon_id = %L', sa)),
    ('the salon''s details',      format('update salons set name = ''Hacked'' where id = %L', sa)),
    ('opening hours',             format('update opening_hours set is_open = false where salon_id = %L', sa)),
    ('a service price',           format('update services set price_cents = 1 where salon_id = %L', sa)),
    ('removing a service',        format('delete from services where salon_id = %L', sa)),
    ('adding a service',          format('insert into services (salon_id, category_id, name, duration_min, price_cents) values (%L, (select id from service_categories where salon_id = %L limit 1), ''x'', 30, 1)', sa, sa)),
    ('adding a product',          format('insert into products (salon_id, name, price_cents, stock) values (%L, ''x'', 1, 1)', sa)),
    ('issuing a gift card',       format('insert into gift_cards (salon_id, code, balance_cents, original_cents) values (%L, ''STYLISTGC'', 100, 100)', sa)),
    ('anyone''s commission',      format('update staff set commission_pct = 100 where salon_id = %L', sa)),
    ('promoting themselves',      format('update staff set app_role = ''owner'' where id = %L', stfs)),
    ('removing the owner',        format('update staff set active = false where id = %L', stfa)),
    ('adding a team member',      format('insert into staff (salon_id, name, role_title, app_role) values (%L, ''Mallory'', ''Owner'', ''owner'')', sa)),
    ('card payment settings',     format('update salon_payment_settings set online_cards_enabled = true where salon_id = %L', sa)),
    ('someone''s shifts',         format('update staff_shifts set end_time = time ''23:00'' where staff_id = %L', stfa)),
    ('removing a client',         format('delete from clients where salon_id = %L', sa)),
    ('a sale''s total',           format('update sales set total_cents = 0 where salon_id = %L', sa)),
    ('clocking someone else in',  format('insert into timesheets (salon_id, staff_id, clock_in) values (%L, %L, now())', sa, stfa))
  ) v(what, q) loop
    r := pg_temp.dml_as(us, rec.q);
    if r like 'OK %' and r <> 'OK 0' then bad := bad || 'stylist-' || rec.what || ' (' || r || '); '; end if;
  end loop;

  ---------------------------------------------------------------- 3. What a stylist can do
  for rec in select * from (values
    ('edit a client',      format('update clients set phone = ''0299999999'' where id = %L', cla)),
    ('add a client',       format('insert into clients (salon_id, name) values (%L, ''Added by a stylist'')', sa)),
    ('write a note',       format('insert into client_notes (salon_id, client_id, body) values (%L, %L, ''a note'')', sa, cla)),
    ('clock themselves in', format('insert into timesheets (salon_id, staff_id, clock_in) values (%L, %L, now())', sa, stfs))
  ) v(what, q) loop
    r := pg_temp.dml_as(us, rec.q);
    if r <> 'OK 1' then bad := bad || 'stylist-cannot-' || rec.what || ' (' || r || '); '; end if;
  end loop;

  ---------------------------------------------------------------- 4. What the owner can do
  for rec in select * from (values
    ('change settings',    format('update salon_settings set tax_rate = 10 where salon_id = %L', sa)),
    ('change a price',     format('update services set price_cents = 5500 where salon_id = %L', sa)),
    ('add a product',      format('insert into products (salon_id, name, price_cents, stock) values (%L, ''Owner product'', 1000, 5)', sa)),
    ('issue a gift card',  format('insert into gift_cards (salon_id, code, balance_cents, original_cents) values (%L, ''OWNERGC'', 5000, 5000)', sa)),
    ('set a commission',   format('update staff set commission_pct = 45 where id = %L', stfs)),
    ('clock in',           format('insert into timesheets (salon_id, staff_id, clock_in) values (%L, %L, now())', sa, stfa))
  ) v(what, q) loop
    r := pg_temp.dml_as(ua, rec.q);
    if r not like 'OK %' or r = 'OK 0' then bad := bad || 'owner-cannot-' || rec.what || ' (' || r || '); '; end if;
  end loop;
  perform pg_temp.ok((select commission_pct from staff where id = stfs) = 45, 'the owner''s change to a commission did not stick');

  ---------------------------------------------------------------- 5. Salon money and mail a stylist cannot reach, however the app screens look
  perform pg_temp.ok(pg_temp.json_as(us, format('select report_summary(%L, %L)', current_date, current_date)) ->> 'error' is not null, 'a stylist read the salon-wide revenue report');
  perform pg_temp.ok(pg_temp.json_as(ua, format('select report_summary(%L, %L)', current_date, current_date)) ->> 'error' is null, 'the owner could not read the revenue report');
  perform pg_temp.ok(pg_temp.dml_as(us, 'select request_reviews()') like 'ERR%', 'a stylist emailed clients asking for reviews');
  perform pg_temp.ok(pg_temp.dml_as(ua, 'select request_reviews()') = 'OK 1', 'the owner could not ask clients for reviews');
  perform pg_temp.ok(pg_temp.dml_as(us, format('select adjust_product_stock(%L, 5)', (select id from products where salon_id = sa limit 1))) like 'ERR%', 'a stylist changed a stock count');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select adjust_product_stock(%L, 5)', (select id from products where salon_id = sa limit 1))) = 'OK 1', 'the owner could not change a stock count');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select * from gift_cards where salon_id = %L', sa)) <> 'OK 0', 'the owner could not see the gift cards');
  perform pg_temp.ok(pg_temp.dml_as(us, format('select * from gift_cards where salon_id = %L', sa)) = 'OK 0', 'a stylist could list gift card codes');

  perform pg_temp.ok(bad = '', 'role rules broken: ' || bad);
end $t$;
