-- Online bookings keep add-ons attached to a service they are offered with, and tips follow the salon's tip setting.
do $t$
declare
  tz text := 'Pacific/Auckland'; day date := (date_trunc('week', now() + interval '10 days'))::date;
  sa uuid; cat uuid; cl uuid; st uuid; a uuid; b uuid; ad uuid; t0 timestamptz; sale uuid; tip int; worked boolean;
begin
  insert into salons (slug, name, timezone, currency) values ('t-a-' || substr(gen_random_uuid()::text, 1, 8), 'Addons', tz, 'NZD') returning id into sa;
  insert into salon_settings (salon_id, min_notice, booking_window, ask_for_tip) values (sa, 'none', '8w', false)
    on conflict (salon_id) do update set min_notice = 'none', booking_window = '8w', ask_for_tip = false;
  insert into opening_hours (salon_id, weekday, is_open, open_time, close_time) select sa, g, true, time '09:00', time '17:00' from generate_series(0, 6) g
    on conflict (salon_id, weekday) do update set is_open = true, open_time = excluded.open_time, close_time = excluded.close_time;
  insert into service_categories (salon_id, name) values (sa, 'Hair') returning id into cat;
  insert into services (salon_id, category_id, name, duration_min, price_cents) values (sa, cat, 'A', 30, 5000) returning id into a;
  insert into services (salon_id, category_id, name, duration_min, price_cents) values (sa, cat, 'B', 30, 5000) returning id into b;
  insert into services (salon_id, category_id, name, duration_min, price_cents, is_addon) values (sa, cat, 'Add-on', 15, 500, true) returning id into ad;
  insert into staff (salon_id, name, role_title, app_role) values (sa, 'Stylist', 'Stylist', 'stylist') returning id into st;
  insert into service_staff select x, st from unnest(array[a, b]) x;
  insert into staff_shifts (staff_id, weekday, start_time, end_time) select st, g, time '09:00', time '17:00' from generate_series(0, 6) g;
  insert into service_addons (service_id, addon_id) values (a, ad);
  insert into clients (salon_id, name) values (sa, 'Client') returning id into cl;

  select starts_at into t0 from available_slots(sa, array[a, ad], st, day, day, 'public', 15) order by starts_at limit 1;
  worked := false;
  begin perform create_booking(sa, cl, st, t0, array[ad], 'online', null, 'public'); worked := true; exception when others then null; end;
  perform pg_temp.ok(not worked, 'an add-on was booked online on its own');
  worked := false;
  begin perform create_booking(sa, cl, st, t0, array[b, ad], 'online', null, 'public'); worked := true; exception when others then null; end;
  perform pg_temp.ok(not worked, 'an add-on was booked online with a service it is not offered with');
  worked := false;
  begin perform create_booking(sa, cl, st, t0, array[a, ad], 'online', null, 'public'); worked := true; exception when others then null; end;
  perform pg_temp.ok(worked, 'a service with its own add-on could not be booked online');

  -- tips: the salon has tips switched off, so no route adds one
  insert into sales (salon_id, client_id, staff_id, subtotal_cents, tip_cents, tax_rate, tax_inclusive, tax_cents, total_cents)
    values (sa, cl, st, 5000, 0, 0, true, 0, 5000) returning id into sale;
  insert into sale_items (sale_id, service_id, label, qty, price_cents) values (sale, a, 'A', 1, 5000);
  perform set_sale_tip(sale, 50);
  select tip_cents into tip from sales where id = sale;
  perform pg_temp.ok(tip = 0, 'a tip was added although tips are switched off');
  update salon_settings set ask_for_tip = true where salon_id = sa;
  perform set_sale_tip(sale, 20);
  select tip_cents into tip from sales where id = sale;
  perform pg_temp.ok(tip = 1000, 'tip was not applied when tips are on');
end $t$;
