-- A person waits for a service once; after they are booked or removed they can wait again.
do $t$
declare sa uuid := pg_temp.f('sa'); cla uuid := pg_temp.f('cla'); svca uuid := pg_temp.f('svca'); w uuid;
begin
  insert into waitlist_entries (salon_id, client_id, service_id) values (sa, cla, svca) returning id into w;
  perform pg_temp.ok(pg_temp.err_of(format('insert into waitlist_entries (salon_id, client_id, service_id) values (%L,%L,%L)', sa, cla, svca)) = '23505', 'the same person was added to the waitlist twice');
  update waitlist_entries set status = 'removed' where id = w;
  perform pg_temp.ok(pg_temp.err_of(format('insert into waitlist_entries (salon_id, client_id, service_id) values (%L,%L,%L)', sa, cla, svca)) = 'none', 'a removed person could not rejoin');
end $t$;

-- the clock-in guard still works now that nobody can call it directly
do $t$
declare us uuid := pg_temp.f('us'); anon_can boolean;
begin
  select has_function_privilege('anon', 'public.timesheet_guard()', 'execute') or has_function_privilege('authenticated', 'public.timesheet_guard()', 'execute') into anon_can;
  perform pg_temp.ok(not anon_can, 'the clock-in guard can be called from outside');
end $t$;
