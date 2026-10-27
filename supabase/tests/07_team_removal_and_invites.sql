-- Team changes: a removed team member's login is freed, their old invite stops working, and invites can be used once only.
do $t$
declare
  sa uuid := pg_temp.f('sa'); ua uuid := pg_temp.f('ua'); us uuid := pg_temp.f('us'); stfs uuid := pg_temp.f('stfs');
  newu uuid := gen_random_uuid(); newu2 uuid := gen_random_uuid(); m uuid; tok text; tok2 text; got uuid; worked boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (newu, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'new1@t.test'),
    (newu2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'new2@t.test');
  insert into staff (salon_id, name, role_title, app_role) values (sa, 'Joiner', 'Stylist', 'stylist') returning id into m;

  -- an invite works once, then not again
  tok := create_staff_invite(m);
  perform set_config('request.jwt.claims', json_build_object('sub', newu, 'role', 'authenticated')::text, true);
  set local role authenticated;
  got := accept_staff_invite(tok);
  reset role;
  perform pg_temp.ok(got = sa, 'invite did not join the right salon');
  perform pg_temp.ok((select user_id from staff where id = m) = newu, 'invite did not link the login');
  perform set_config('request.jwt.claims', json_build_object('sub', newu2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform accept_staff_invite(tok); worked := true;
  exception when others then worked := false; end;
  reset role;
  perform pg_temp.ok(not worked, 'a used invite worked a second time');

  -- removing someone frees their login and they can start their own salon or join another
  perform set_config('request.jwt.claims', '', true);
  update staff set active = false, online_bookable = false where id = m;
  perform pg_temp.ok((select user_id from staff where id = m) is null, 'removed team member kept their login');
  perform pg_temp.ok(not exists (select 1 from staff where user_id = newu), 'login still attached to a team row');

  -- an invite sent before they were removed no longer works
  insert into staff (salon_id, name, role_title, app_role) values (sa, 'Leaver', 'Stylist', 'stylist') returning id into m;
  tok2 := create_staff_invite(m);
  update staff set active = false where id = m;
  perform set_config('request.jwt.claims', json_build_object('sub', newu2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform accept_staff_invite(tok2); worked := true;
  exception when others then worked := false; end;
  reset role;
  perform pg_temp.ok(not worked, 'an invite for a removed member still worked');
  perform pg_temp.ok(not exists (select 1 from staff where user_id = newu2), 'a removed member got a login again');

  -- a team member (not the owner) cannot make invites or change the team
  perform set_config('request.jwt.claims', '', true);
  perform pg_temp.ok(pg_temp.dml_as(us, format('select create_staff_invite(%L)', stfs)) like 'ERR%', 'stylist created an invite');
  perform pg_temp.ok(pg_temp.dml_as(us, format('update staff set app_role = ''owner'' where id = %L', stfs)) = 'OK 0', 'stylist promoted themselves');
  perform pg_temp.ok(pg_temp.dml_as(us, format('update staff set commission_pct = 100 where id = %L', stfs)) = 'OK 0', 'stylist changed their own commission');
  perform pg_temp.ok(pg_temp.cnt_as(us, 'select 1 from staff_invites') = '0', 'stylist can read invites');
end $t$;
