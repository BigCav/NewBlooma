-- A signed-in person at salon A must never see or change anything that belongs to salon B, and secrets must stay locked.
do $t$
declare r text; us uuid := pg_temp.f('us'); ua uuid := pg_temp.f('ua'); sb uuid := pg_temp.f('sb'); clb uuid := pg_temp.f('clb'); bkb uuid := pg_temp.f('bkb'); cla uuid := pg_temp.f('cla');
begin
  -- reads: a stylist of A sees zero rows of B in every table
  foreach r in array array['clients','bookings','sales','gift_cards','client_notes','inbox_items','staff','services','salon_settings','audit_log','payouts','card_payments','reviews','waitlist_entries','products','form_submissions','opening_hours','staff_blocks'] loop
    perform pg_temp.ok(pg_temp.cnt_as(us, format('select 1 from %I where salon_id = %L', r, sb)) = '0', 'stylist of A can read ' || r || ' of salon B');
  end loop;
  perform pg_temp.ok(pg_temp.cnt_as(us, format('select 1 from salons where id = %L', sb)) = '0', 'stylist of A can read salon B');
  perform pg_temp.ok(pg_temp.cnt_as(us, format('select 1 from sale_items where sale_id = %L', pg_temp.f('saleb'))) = '0', 'stylist of A can read B sale items');

  -- sanity: they do see their own salon
  perform pg_temp.ok(pg_temp.cnt_as(us, 'select 1 from clients')::int >= 1, 'stylist cannot see own clients');
  perform pg_temp.ok(pg_temp.cnt_as(ua, 'select 1 from staff')::int = 2, 'owner of A should see exactly the 2 staff of A');

  -- owner-only data is hidden from a stylist
  perform pg_temp.ok(pg_temp.cnt_as(us, 'select 1 from payouts') = '0', 'stylist can read payouts');
  perform pg_temp.ok(pg_temp.cnt_as(us, 'select 1 from audit_log') = '0', 'stylist can read the audit log');

  -- secrets: nobody signed in can read them
  foreach r in array array['salon_payment_secrets','booking_tokens','client_accounts','client_sessions','notifications_outbox'] loop
    perform pg_temp.ok(pg_temp.cnt_as(ua, format('select 1 from %I', r)) like 'ERR%' or pg_temp.cnt_as(ua, format('select 1 from %I', r)) = '0', 'signed-in owner can read ' || r);
  end loop;

  -- writes across salons are refused or change nothing
  perform pg_temp.ok(pg_temp.dml_as(us, format('insert into clients (salon_id,name) values (%L,%L)', sb, 'evil')) like 'ERR%', 'insert a client into salon B');
  perform pg_temp.ok(pg_temp.dml_as(us, format('update clients set salon_id = %L where id = %L', sb, cla)) like 'ERR%', 'move own client into salon B');
  perform pg_temp.ok(pg_temp.dml_as(us, format('update clients set name = %L where id = %L', 'pwned', clb)) in ('OK 0'), 'update a client of B');
  perform pg_temp.ok(pg_temp.dml_as(us, format('delete from clients where id = %L', clb)) in ('OK 0') or pg_temp.dml_as(us, format('delete from clients where id = %L', clb)) like 'ERR%', 'delete a client of B');
  perform pg_temp.ok(pg_temp.dml_as(us, format('update bookings set status = ''cancelled'' where id = %L', bkb)) = 'OK 0', 'cancel a booking of B');
  perform pg_temp.ok(pg_temp.dml_as(us, format('update salons set name = ''hacked'' where id = %L', sb)) = 'OK 0', 'rename salon B');
  perform pg_temp.ok((select name from salons where id = sb) = 'Test Salon B', 'salon B changed');
  perform pg_temp.ok((select name from clients where id = clb) = 'Client B', 'client B changed');

  -- a booking at A may not point at B's staff or client (this used to let one salon block another's calendar)
  perform pg_temp.ok(pg_temp.dml_as(pg_temp.f('ua'), format('insert into bookings (salon_id,client_id,staff_id,starts_at,ends_at) values (%L,%L,%L,now()+interval ''40 days'',now()+interval ''40 days 30 minutes'')', pg_temp.f('sa'), cla, pg_temp.f('stfb'))) like 'ERR%', 'booking at A using B staff');
  perform pg_temp.ok(pg_temp.dml_as(pg_temp.f('ua'), format('insert into bookings (salon_id,client_id,staff_id,starts_at,ends_at) values (%L,%L,%L,now()+interval ''40 days'',now()+interval ''40 days 30 minutes'')', pg_temp.f('sa'), clb, pg_temp.f('stfa'))) like 'ERR%', 'booking at A using B client');
  perform pg_temp.ok(pg_temp.dml_as(pg_temp.f('ua'), format('insert into staff_blocks (salon_id,staff_id,starts_at,ends_at) values (%L,%L,now()+interval ''40 days'',now()+interval ''41 days'')', pg_temp.f('sa'), pg_temp.f('stfb'))) like 'ERR%', 'block time on B staff from A');
end $t$;
