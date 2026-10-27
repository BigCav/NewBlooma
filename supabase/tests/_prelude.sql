-- Shared set-up for the database tests. The runner sends this first, then one test file, all inside a transaction that is rolled back,
-- so nothing is ever left behind. Two salons are built: A (owner, stylist, one client, one booking) and B (owner, client, booking, sale, gift card, note, message).

create temp table fx (k text primary key, v uuid) on commit drop;
grant all on fx to public;

create function pg_temp.f(key text) returns uuid language sql stable as $$ select v from fx where k = key $$;

-- Fails the test run with a clear message when a condition is not true.
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', msg; end if;
end $$;

-- Runs a count query as a signed-in user (row security applies). Returns the count, or 'ERR <sqlstate>'.
create function pg_temp.cnt_as(uid uuid, q text) returns text language plpgsql as $$
declare n bigint; begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin execute 'select count(*) from (' || q || ') x' into n; reset role; return n::text;
  exception when others then reset role; return 'ERR ' || sqlstate; end;
end $$;

-- Runs a write as a signed-in user. Returns 'OK <rows changed>' or 'ERR <sqlstate>'.
create function pg_temp.dml_as(uid uuid, q text) returns text language plpgsql as $$
declare n bigint; begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin execute q; get diagnostics n = row_count; reset role; return 'OK ' || n;
  exception when others then reset role; return 'ERR ' || sqlstate; end;
end $$;

-- Runs a statement and returns its error code, or 'none' when it worked.
create function pg_temp.err_of(q text) returns text language plpgsql as $$
begin
  execute q; return 'none';
exception when others then return sqlstate;
end $$;

do $fixture$
declare
  tz text := 'Pacific/Auckland';
  monday date := (date_trunc('week', now() + interval '10 days'))::date;
  ua uuid := gen_random_uuid(); us uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  sa uuid; sb uuid; cata uuid; catb uuid; svca uuid; svcb uuid; stfa uuid; stfs uuid; stfb uuid; cla uuid; clb uuid; bka uuid; bkb uuid; saleb uuid;
  t timestamptz := (monday + time '10:00') at time zone tz;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (ua, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a-owner@t.test'),
    (us, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a-stylist@t.test'),
    (ub, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b-owner@t.test');
  insert into salons (slug, name, timezone, currency) values ('t-a-' || substr(gen_random_uuid()::text, 1, 6), 'Test Salon A', tz, 'NZD') returning id into sa;
  insert into salons (slug, name, timezone, currency) values ('t-b-' || substr(gen_random_uuid()::text, 1, 6), 'Test Salon B', tz, 'NZD') returning id into sb;
  insert into salon_settings (salon_id, min_notice, booking_window) values (sa, 'none', '8w'), (sb, 'none', '8w') on conflict (salon_id) do update set min_notice = 'none', booking_window = '8w';
  insert into opening_hours (salon_id, weekday, is_open, open_time, close_time)
    select s, d, d < 6, time '09:00', time '17:00' from unnest(array[sa, sb]) s, generate_series(0, 6) d on conflict (salon_id, weekday) do update set is_open = excluded.is_open, open_time = excluded.open_time, close_time = excluded.close_time;
  insert into service_categories (salon_id, name) values (sa, 'Hair') returning id into cata;
  insert into service_categories (salon_id, name) values (sb, 'Hair') returning id into catb;
  insert into services (salon_id, category_id, name, duration_min, price_cents) values (sa, cata, 'Cut A', 30, 5000) returning id into svca;
  insert into services (salon_id, category_id, name, duration_min, price_cents) values (sb, catb, 'Cut B', 30, 5000) returning id into svcb;
  insert into staff (salon_id, name, role_title, app_role, user_id) values (sa, 'A Owner', 'Owner', 'owner', ua) returning id into stfa;
  insert into staff (salon_id, name, role_title, app_role, user_id) values (sa, 'A Stylist', 'Stylist', 'stylist', us) returning id into stfs;
  insert into staff (salon_id, name, role_title, app_role, user_id) values (sb, 'B Owner', 'Owner', 'owner', ub) returning id into stfb;
  insert into service_staff values (svca, stfa), (svca, stfs), (svcb, stfb);
  insert into staff_shifts (staff_id, weekday, start_time, end_time) select s, d, time '09:00', time '17:00' from unnest(array[stfa, stfs, stfb]) s, generate_series(0, 5) d;
  insert into clients (salon_id, name, email, phone) values (sa, 'Client A', 'ca@t.test', '0211111111') returning id into cla;
  insert into clients (salon_id, name, email, phone) values (sb, 'Client B', 'cb@t.test', '0222222222') returning id into clb;
  insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status) values (sa, cla, stfa, t, t + interval '30 minutes', 'confirmed') returning id into bka;
  insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status) values (sb, clb, stfb, t, t + interval '30 minutes', 'completed') returning id into bkb;
  insert into sales (salon_id, booking_id, client_id, staff_id, status, method, subtotal_cents, tax_rate, tax_inclusive, tax_cents, total_cents, paid_at)
    values (sb, bkb, clb, stfb, 'paid', 'cash', 5000, 0, false, 0, 5000, now()) returning id into saleb;
  insert into gift_cards (salon_id, code, balance_cents, original_cents) values (sb, 'TESTGIFT100', 10000, 10000);
  insert into client_notes (salon_id, client_id, body) values (sb, clb, 'private B note');
  insert into inbox_items (salon_id, type, client_id, body) values (sb, 'message', clb, 'private B message');
  insert into products (salon_id, name, price_cents, stock) values (sb, 'Shampoo B', 2500, 10);

  insert into fx values ('ua', ua), ('us', us), ('ub', ub), ('sa', sa), ('sb', sb), ('svca', svca), ('svcb', svcb), ('stfa', stfa), ('stfs', stfs), ('stfb', stfb),
    ('cla', cla), ('clb', clb), ('bka', bka), ('bkb', bkb), ('saleb', saleb);
end $fixture$;
