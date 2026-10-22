-- The "Moved by the client from ... to ..." note read 24-hour times; everything else in the app uses 12-hour.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'client_reschedule';
  if position('HH24:MI' in d) > 0 then
    execute replace(d, 'HH24:MI', 'FMHH12:MIam');
  end if;
end $$;
