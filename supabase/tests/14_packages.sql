-- Prepaid packages: only owners set them up, a package works once its sale is paid, a use comes off at checkout and comes back if the visit
-- is voided or refunded, packages expire and run out, and a used purchase cannot be refunded.
create function pg_temp.try(q text) returns text language plpgsql as $$
begin execute q; return 'none'; exception when others then return sqlerrm; end $$;

do $t$
declare
  tz text := 'Pacific/Auckland'; uo uuid := gen_random_uuid(); us uuid := gen_random_uuid(); t timestamptz := now() + interval '1 day';
  sa uuid; cat uuid; svc uuid; own uuid; sty uuid; cl uuid; pk uuid; pk2 uuid; psale uuid; psale2 uuid; cp uuid; cp2 uuid;
  bk uuid; bk2 uuid; bk3 uuid; v1 uuid; v2 uuid; v3 uuid; left_ int; tot int; sub int; msg text; worked boolean; st text; bst text;
  use_json text;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (uo, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pk-owner@t.test'),
    (us, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pk-stylist@t.test');
  insert into salons (slug, name, timezone, currency) values ('t-pk-' || substr(gen_random_uuid()::text, 1, 8), 'Packages', tz, 'NZD') returning id into sa;
  insert into salon_settings (salon_id, tax_rate, tax_inclusive, ask_for_tip, accept_cash) values (sa, 15, true, true, true)
    on conflict (salon_id) do update set tax_rate = 15, tax_inclusive = true, ask_for_tip = true, accept_cash = true;
  insert into service_categories (salon_id, name) values (sa, 'Hair') returning id into cat;
  insert into services (salon_id, category_id, name, duration_min, price_cents) values (sa, cat, 'Blow dry', 30, 5000) returning id into svc;
  insert into staff (salon_id, name, role_title, app_role, user_id) values (sa, 'Owner', 'Owner', 'owner', uo) returning id into own;
  insert into staff (salon_id, name, role_title, app_role, user_id) values (sa, 'Stylist', 'Stylist', 'stylist', us) returning id into sty;
  insert into service_staff values (svc, own), (svc, sty);
  insert into clients (salon_id, name) values (sa, 'Client') returning id into cl;

  -- only owners set packages up
  perform set_config('request.jwt.claims', json_build_object('sub', us, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin insert into service_packages (salon_id, service_id, name, uses, price_cents) values (sa, svc, 'Nope', 5, 20000); worked := true; exception when others then worked := false; end;
  reset role;
  perform pg_temp.ok(not worked, 'a stylist created a package');

  perform set_config('request.jwt.claims', json_build_object('sub', uo, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into service_packages (salon_id, service_id, name, uses, price_cents) values (sa, svc, '5 blow dries', 5, 20000) returning id into pk;
  insert into service_packages (salon_id, service_id, name, uses, price_cents, valid_days) values (sa, svc, 'Short pass', 2, 8000, 1) returning id into pk2;
  reset role;

  -- selling: a pending sale, the package is not usable until it is paid
  psale := create_package_sale('', pk, cl);
  select id, uses_left into cp, left_ from client_package_status where sale_id = psale;
  perform pg_temp.ok(left_ = 5, 'a new package did not have all its uses');
  select total_cents into tot from sales where id = psale;
  perform pg_temp.ok(tot = 20000, 'the package sale total is wrong');

  insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status) values (sa, cl, own, t, t + interval '30 minutes', 'confirmed') returning id into bk;
  insert into booking_services (booking_id, service_id, price_cents, duration_min) values (bk, svc, 5000, 30);
  v1 := create_sale(bk, null, '[]'::jsonb, 0, null);
  use_json := json_build_array(json_build_object('client_package_id', cp, 'service_id', svc))::text;
  msg := pg_temp.try(format('select apply_packages_to_sale(%L, %L::jsonb)', v1, use_json));
  perform pg_temp.ok(msg = 'package_not_paid', 'an unpaid package was used: ' || msg);

  perform complete_sale(psale, 'cash');
  perform apply_packages_to_sale(v1, use_json::jsonb);
  select subtotal_cents, total_cents into sub, tot from sales where id = v1;
  perform pg_temp.ok(sub = 0 and tot = 0, 'using a package did not clear the service price');
  select uses_left into left_ from client_package_status where id = cp;
  perform pg_temp.ok(left_ = 4, 'a use was not taken off');

  -- a visit that still has something to pay cannot be closed as a package visit
  insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status) values (sa, cl, own, t + interval '2 hours', t + interval '150 minutes', 'confirmed') returning id into bk2;
  insert into booking_services (booking_id, service_id, price_cents, duration_min) values (bk2, svc, 5000, 30);
  v2 := create_sale(bk2, null, '[]'::jsonb, 0, null);
  msg := pg_temp.try(format('select complete_sale(%L, ''package'')', v2));
  perform pg_temp.ok(msg = 'package_needs_zero_total', 'a sale with money to pay was closed as a package visit: ' || msg);

  -- a voided visit gives its use back
  perform apply_packages_to_sale(v2, use_json::jsonb);
  select uses_left into left_ from client_package_status where id = cp;
  perform pg_temp.ok(left_ = 3, 'the second use was not taken off');
  perform void_pending_sale(v2);
  select uses_left into left_ from client_package_status where id = cp;
  perform pg_temp.ok(left_ = 4, 'a voided visit did not give its use back');

  perform complete_sale(v1, 'package');
  select status::text into bst from bookings where id = bk;
  perform pg_temp.ok(bst = 'completed', 'the covered visit was not completed');

  -- a purchase that has been used cannot be refunded; refunding the visit frees the use first
  msg := pg_temp.try(format('select refund_sale(%L)', psale));
  perform pg_temp.ok(msg = 'package_partly_used', 'a used package purchase was refunded: ' || msg);
  perform refund_sale(v1);
  select uses_left into left_ from client_package_status where id = cp;
  perform pg_temp.ok(left_ = 5, 'a refunded visit did not give its use back');
  perform refund_sale(psale);
  select sale_status::text into st from client_package_status where id = cp;
  perform pg_temp.ok(st = 'refunded', 'a refunded purchase is still usable');
  insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status) values (sa, cl, own, t + interval '4 hours', t + interval '270 minutes', 'confirmed') returning id into bk3;
  insert into booking_services (booking_id, service_id, price_cents, duration_min) values (bk3, svc, 5000, 30);
  v3 := create_sale(bk3, null, '[]'::jsonb, 0, null);
  msg := pg_temp.try(format('select apply_packages_to_sale(%L, %L::jsonb)', v3, use_json));
  perform pg_temp.ok(msg = 'package_not_paid', 'a refunded package was used: ' || msg);
  perform void_pending_sale(v3);

  -- expiry and running out
  psale2 := create_package_sale('', pk2, cl);
  perform complete_sale(psale2, 'cash');
  select id into cp2 from client_package_status where sale_id = psale2;
  use_json := json_build_array(json_build_object('client_package_id', cp2, 'service_id', svc))::text;
  v3 := create_sale(bk3, null, '[]'::jsonb, 0, null);
  perform apply_packages_to_sale(v3, use_json::jsonb);
  perform void_pending_sale(v3);
  update sales set paid_at = now() - interval '3 days' where id = psale2;
  v3 := create_sale(bk3, null, '[]'::jsonb, 0, null);
  msg := pg_temp.try(format('select apply_packages_to_sale(%L, %L::jsonb)', v3, use_json));
  perform pg_temp.ok(msg = 'package_expired', 'an expired package was used: ' || msg);
  update client_packages set valid_days = null where id = cp2;
  perform apply_packages_to_sale(v3, use_json::jsonb);
  perform complete_sale(v3, 'package');
  insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status) values (sa, cl, sty, t, t + interval '30 minutes', 'confirmed') returning id into bk;
  insert into booking_services (booking_id, service_id, price_cents, duration_min) values (bk, svc, 5000, 30);
  v1 := create_sale(bk, null, '[]'::jsonb, 0, null);
  perform apply_packages_to_sale(v1, use_json::jsonb);
  perform complete_sale(v1, 'package');
  insert into bookings (salon_id, client_id, staff_id, starts_at, ends_at, status) values (sa, cl, sty, t + interval '2 hours', t + interval '150 minutes', 'confirmed') returning id into bk2;
  insert into booking_services (booking_id, service_id, price_cents, duration_min) values (bk2, svc, 5000, 30);
  v2 := create_sale(bk2, null, '[]'::jsonb, 0, null);
  msg := pg_temp.try(format('select apply_packages_to_sale(%L, %L::jsonb)', v2, use_json));
  perform pg_temp.ok(msg = 'package_used_up', 'a used up package was used again: ' || msg);
end $t$;
