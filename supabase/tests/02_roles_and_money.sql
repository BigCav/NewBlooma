-- Inside one salon: a stylist cannot touch money, stock or deletes. Only the owner can. Nobody signed out can do anything.
do $t$
declare us uuid := pg_temp.f('us'); ua uuid := pg_temp.f('ua'); sa uuid := pg_temp.f('sa'); cla uuid := pg_temp.f('cla'); bka uuid := pg_temp.f('bka'); pid uuid; n text;
begin
  -- gift cards: stylist cannot mint, change or delete; owner can
  perform pg_temp.ok(pg_temp.dml_as(us, format('insert into gift_cards (salon_id,code,balance_cents,original_cents) values (%L,%L,99999,99999)', sa, 'MINTED')) like 'ERR%', 'stylist minted a gift card');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('insert into gift_cards (salon_id,code,balance_cents,original_cents) values (%L,%L,5000,5000)', sa, 'OWNERCARD')) = 'OK 1', 'owner could not create a gift card');
  perform pg_temp.ok(pg_temp.dml_as(us, 'update gift_cards set balance_cents = 999999') = 'OK 0', 'stylist changed a gift card balance');
  perform pg_temp.ok(pg_temp.dml_as(us, 'delete from gift_cards') = 'OK 0', 'stylist deleted gift cards');

  -- products: stylist cannot add, reprice or delete; stock changes only through the guarded function
  insert into products (salon_id, name, price_cents, stock) values (sa, 'Shampoo A', 2000, 5) returning id into pid;
  perform pg_temp.ok(pg_temp.dml_as(us, format('insert into products (salon_id,name,price_cents) values (%L,%L,1)', sa, 'x')) like 'ERR%', 'stylist added a product');
  perform pg_temp.ok(pg_temp.dml_as(us, format('update products set price_cents = 1 where id = %L', pid)) = 'OK 0', 'stylist repriced a product');
  perform pg_temp.ok(pg_temp.dml_as(us, format('delete from products where id = %L', pid)) = 'OK 0', 'stylist deleted a product');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('update products set price_cents = 2200 where id = %L', pid)) = 'OK 1', 'owner could not reprice a product');

  -- stock function: never below zero, huge changes refused, and not for other salons' products
  perform pg_temp.ok((select stock from products where id = pid) = 5, 'start stock');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select adjust_product_stock(%L, -50)', pid)) = 'OK 1', 'owner stock change failed');
  perform pg_temp.ok((select stock from products where id = pid) = 0, 'stock went below zero');
  perform pg_temp.ok(pg_temp.dml_as(ua, format('select adjust_product_stock(%L, 1000000)', pid)) like 'ERR%', 'huge stock change was allowed');
  perform pg_temp.dml_as(ua, format('select adjust_product_stock(%L, 5)', (select id from products where name = 'Shampoo B')));
  perform pg_temp.ok((select stock from products where name = 'Shampoo B') = 10, 'stock of salon B changed');

  -- deleting bookings and clients is owner-only (the app cancels, it never deletes)
  perform pg_temp.ok(pg_temp.dml_as(us, format('delete from bookings where id = %L', bka)) = 'OK 0', 'stylist deleted a booking');
  perform pg_temp.ok(pg_temp.dml_as(us, format('delete from clients where id = %L', cla)) = 'OK 0', 'stylist deleted a client');

  -- a stylist cannot promote themselves or touch the team
  perform pg_temp.ok(pg_temp.dml_as(us, format('update staff set app_role = ''owner'' where user_id = %L', us)) = 'OK 0' or pg_temp.dml_as(us, format('update staff set app_role = ''owner'' where user_id = %L', us)) like 'ERR%', 'stylist promoted themselves');
  perform pg_temp.ok((select app_role from staff where user_id = us) = 'stylist', 'role changed');
end $t$;

-- signed out (anon) has no access to any table
create function pg_temp.anon_read(tbl text) returns text language plpgsql as $$
begin
  set local role anon;
  begin execute format('select count(*) from %I', tbl); reset role; return 'none';
  exception when others then reset role; return sqlstate; end;
end $$;
do $t$
declare r text; res text;
begin
  foreach r in array array['clients','bookings','sales','staff','salons','gift_cards','client_notes','inbox_items','booking_tokens','salon_payment_secrets'] loop
    res := pg_temp.anon_read(r);
    perform pg_temp.ok(res = '42501', 'anon could read ' || r || ' (' || res || ')');
  end loop;
end $t$;
