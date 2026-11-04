-- Anyone can sign up (the email has to be confirmed first), and from then on they are "signed in" to the database even though they belong to no salon.
-- This plays such a stranger against two real-looking salons: they must not be able to read a single row of a salon's private data, change or delete
-- anything of its, add themselves to its team, or run any of the staff or money functions on its records. Then they start a salon of their own and the
-- same must hold for them as an owner of that new salon.

-- As in the other booking-day style tests: trust only the service-role token, like the real API (the test connection itself is the database owner).
create or replace function is_service() returns boolean language sql stable set search_path to 'public' as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role' $$;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

create temp table obs (t text) on commit drop;
grant all on obs to public;

-- Runs a statement as the signed-in user. 'ALLOWED <rows>' when it worked, or 'DENIED: <reason>'.
create function pg_temp.try_as(uid uuid, q text) returns text language plpgsql as $$
declare n bigint; r text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin execute q; get diagnostics n = row_count; r := 'ALLOWED ' || n;
  exception when others then r := 'DENIED: ' || sqlerrm; end;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  return r;
end $$;

do $t$
declare
  st uuid := gen_random_uuid(); st2 uuid := gen_random_uuid();
  sa uuid := pg_temp.f('sa'); sb uuid := pg_temp.f('sb');
  rec record; r text; n int; bad text := ''; fut timestamptz := now() + interval '9 days';
  prod uuid; slug_a text; d text := current_date::text;
  hrs text := '(select jsonb_agg(jsonb_build_object(''weekday'', g, ''is_open'', g < 6, ''open'', ''09:00'', ''close'', ''17:00'')) from generate_series(0, 6) g)';
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (st, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stranger@t.test'),
    (st2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'newowner@t.test');
  select id into prod from products where salon_id = sb limit 1;
  select slug into slug_a from salons where id = sa;

  ---------------------------------------------------------------- 1. Reading: a stranger sees no rows of any table
  for rec in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'select') order by 1 loop
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin execute format('select count(*) from public.%I', rec.relname) into n; exception when others then n := -1; end;
    reset role; perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    if n <> 0 then insert into obs values ('SEES ' || rec.relname || ' rows=' || n); bad := bad || rec.relname || ' '; end if;
  end loop;

  ---------------------------------------------------------------- 2. Deleting and changing: nothing of the salons' can be touched
  for rec in select c.relname, exists(select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'salon_id') has_salon
             from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'delete') order by 1 loop
    r := pg_temp.try_as(st, format('delete from public.%I', rec.relname));
    if r like 'ALLOWED%' and r <> 'ALLOWED 0' then insert into obs values ('DELETED from ' || rec.relname || ': ' || r); bad := bad || 'del-' || rec.relname || ' '; end if;
  end loop;
  for rec in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'update')
             and exists(select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'salon_id') order by 1 loop
    r := pg_temp.try_as(st, format('update public.%I set salon_id = salon_id', rec.relname));
    if r like 'ALLOWED%' and r <> 'ALLOWED 0' then insert into obs values ('CHANGED ' || rec.relname || ': ' || r); bad := bad || 'upd-' || rec.relname || ' '; end if;
  end loop;
  r := pg_temp.try_as(st, 'update public.salons set name = ''Hacked''');
  if r <> 'ALLOWED 0' then insert into obs values ('RENAMED a salon: ' || r); bad := bad || 'salons-upd '; end if;

  ---------------------------------------------------------------- 3. Adding things to a salon that is not theirs, including themselves to its team
  for rec in select * from (values
    ('staff as owner', format('insert into staff (salon_id, name, role_title, app_role, user_id) values (%L, ''Mallory'', ''Owner'', ''owner'', %L)', sa, st)),
    ('staff as stylist', format('insert into staff (salon_id, name, role_title, app_role, user_id) values (%L, ''Mallory'', ''Stylist'', ''stylist'', %L)', sa, st)),
    ('client', format('insert into clients (salon_id, name, email) values (%L, ''Spam'', ''spam@t.test'')', sa)),
    ('gift card', format('insert into gift_cards (salon_id, code, balance_cents, original_cents) values (%L, ''FREEMONEY'', 100000, 100000)', sa)),
    ('product', format('insert into products (salon_id, name, price_cents, stock) values (%L, ''x'', 1, 1)', sa)),
    ('inbox item', format('insert into inbox_items (salon_id, type, body) values (%L, ''message'', ''hi'')', sa)),
    ('booking', format('insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status) values (%L, %L, %L, %L, %L, ''confirmed'')', sa, pg_temp.f('cla'), pg_temp.f('stfa'), fut, fut + interval '30 minutes')),
    ('payment settings', format('insert into salon_payment_settings (salon_id) values (%L)', sa)),
    ('salon settings', format('insert into salon_settings (salon_id) values (%L)', sb)),
    ('service', format('insert into services (salon_id, category_id, name, duration_min, price_cents) values (%L, (select id from service_categories where salon_id = %L limit 1), ''x'', 30, 1)', sa, sa))
  ) v(what, q) loop
    r := pg_temp.try_as(st, rec.q);
    if r like 'ALLOWED%' then insert into obs values ('ADDED ' || rec.what || ': ' || r); bad := bad || 'ins-' || rec.what || ' '; end if;
  end loop;
  perform pg_temp.ok((select count(*) from staff where user_id = st) = 0, 'the stranger got onto a salon''s team');

  ---------------------------------------------------------------- 4. Staff and money functions on someone else's records
  for rec in select * from (values
    ('confirm_booking', format('select confirm_booking(%L)', pg_temp.f('bka'))),
    ('edit_booking', format('select edit_booking(%L, %L, null, null)', pg_temp.f('bka'), fut)),
    ('create_booking (public)', format('select create_booking(%L, %L, %L, %L, array[%L]::uuid[], ''online'', null, ''public'')', sa, pg_temp.f('cla'), pg_temp.f('stfa'), fut, pg_temp.f('svca'))),
    ('create_booking (staff)', format('select create_booking(%L, %L, %L, %L, array[%L]::uuid[], ''staff'', null, ''staff'')', sa, pg_temp.f('cla'), pg_temp.f('stfa'), fut, pg_temp.f('svca'))),
    ('create_sale', format('select create_sale(%L, %L, ''[]''::jsonb, 0, ''x'')', pg_temp.f('bka'), pg_temp.f('cla'))),
    ('create_walkin_sale', format('select create_walkin_sale(''x'', %L, 0, null)', pg_temp.f('svca'))),
    ('complete_sale', format('select complete_sale(%L, ''cash'', null)', pg_temp.f('saleb'))),
    ('refund_sale', format('select refund_sale(%L)', pg_temp.f('saleb'))),
    ('void_pending_sale', format('select void_pending_sale(%L)', pg_temp.f('saleb'))),
    ('set_sale_tip', format('select set_sale_tip(%L, 50)', pg_temp.f('saleb'))),
    ('set_sale_discount', format('select set_sale_discount(%L, ''percent'', 100, ''x'')', pg_temp.f('saleb'))),
    ('set_sale_products', format('select set_sale_products(%L, ''[]''::jsonb)', pg_temp.f('saleb'))),
    ('set_sale_services', format('select set_sale_services(%L, array[%L]::uuid[])', pg_temp.f('saleb'), pg_temp.f('svcb'))),
    ('set_sale_service_price', format('select set_sale_service_price(%L, 1)', pg_temp.f('saleb'))),
    ('apply_packages_to_sale', format('select apply_packages_to_sale(%L, ''[]''::jsonb)', pg_temp.f('saleb'))),
    ('adjust_product_stock', format('select adjust_product_stock(%L, 99)', prod)),
    ('close_till', format('select close_till(%L, 0, ''x'')', d::date)),
    ('mark_payout_paid', format('select mark_payout_paid(%L, %L, %L)', pg_temp.f('stfa'), d::date, d::date)),
    ('create_staff_invite', format('select create_staff_invite(%L)', pg_temp.f('stfa'))),
    ('create_package_sale', format('select create_package_sale(''x'', %L, null)', gen_random_uuid())),
    ('offer_waitlist_slot', format('select offer_waitlist_slot(%L, %L, %L, 10)', gen_random_uuid(), pg_temp.f('stfa'), fut)),
    ('waitlist_matches', format('select waitlist_matches(%L)', gen_random_uuid())),
    ('payroll_summary', format('select payroll_summary(%L, %L)', d::date, d::date)),
    ('payroll_week', format('select payroll_week(%L, %L)', d::date, d::date)),
    ('report_summary', format('select report_summary(%L, %L)', d::date, d::date)),
    ('report_dashboard', format('select report_dashboard(%L, %L, %L, %L)', d::date, d::date, d::date, d::date)),
    ('sales_summary', format('select sales_summary(%L, %L)', d::date, d::date)),
    ('client_overview', 'select client_overview()'),
    ('request_reviews', 'select request_reviews()'),
    ('accept_staff_invite (made up)', 'select accept_staff_invite(''not-a-real-token'')'),
    ('setup_salon with a taken web address', format('select setup_salon(''x'', %L, null, null, null, ''Pacific/Auckland'', ''NZD'', %s, ''Mallory'', ''[]''::jsonb, ''[]''::jsonb)', slug_a, hrs)),
    ('create_salon with a taken web address', format('select create_salon(''x'', %L, null, null, null, ''Pacific/Auckland'', ''NZD'', %s, ''Mallory'', ''Owner'')', slug_a, hrs))
  ) v(what, q) loop
    r := pg_temp.try_as(st, rec.q);
    insert into obs values (rpad(rec.what, 42) || r);
    -- Functions that only report (a total, a list) are fine when they come back empty; the ones that change something must be refused.
    if r like 'ALLOWED%' and rec.what not in ('payroll_summary', 'payroll_week', 'report_summary', 'report_dashboard', 'sales_summary', 'client_overview', 'request_reviews', 'waitlist_matches') then
      bad := bad || 'fn-' || rec.what || ' ';
    end if;
  end loop;

  ---------------------------------------------------------------- 5. The same stranger starts a salon of their own: now an owner, but of that salon only
  r := pg_temp.try_as(st2, format('select create_salon(''My Salon'', ''t-mine-'' || substr(gen_random_uuid()::text, 1, 6), null, null, null, ''Pacific/Auckland'', ''NZD'', %s, ''New Owner'', ''Owner'')', hrs));
  insert into obs values ('start a salon of their own: ' || r);
  perform pg_temp.ok(r like 'ALLOWED%', 'someone who signed up could not start a salon: ' || r);
  perform pg_temp.ok((select count(*) from staff where user_id = st2 and app_role = 'owner') = 1, 'the new owner is not the owner of their own salon');
  for rec in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'select')
             and exists(select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'salon_id') order by 1 loop
    perform set_config('request.jwt.claims', json_build_object('sub', st2, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin execute format('select count(*) from public.%I where salon_id in (%L, %L)', rec.relname, sa, sb) into n; exception when others then n := -1; end;
    reset role; perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    if n <> 0 then insert into obs values ('NEW OWNER SEES ' || rec.relname || ' of salon A or B rows=' || n); bad := bad || 'newowner-' || rec.relname || ' '; end if;
  end loop;
  foreach r in array array[
    format('delete from public.clients where salon_id in (%L, %L)', sa, sb),
    format('update public.staff set app_role = ''owner'' where salon_id in (%L, %L)', sa, sb),
    format('update public.sales set total_cents = 0 where salon_id = %L', sb)] loop
    n := coalesce(substring(pg_temp.try_as(st2, r) from 'ALLOWED (\d+)')::int, 0);
    if n <> 0 then insert into obs values ('NEW OWNER changed rows with: ' || r); bad := bad || 'newowner-write '; end if;
  end loop;

  insert into obs values (case when bad = '' then 'ALL REFUSED' else 'GOT THROUGH: ' || bad end);
  raise notice 'OBSERVATIONS:%', (select string_agg(t, E'\n') from obs);
  perform pg_temp.ok(bad = '', 'a stranger got through: ' || bad);
end $t$;
