-- One person can wait for a service once. Before this, the public form let anyone add the same person again and again, and staff would then send the same offer several times.
update waitlist_entries w set status = 'removed'
 where status in ('waiting', 'offered') and exists (
   select 1 from waitlist_entries o where o.client_id = w.client_id and o.service_id = w.service_id and o.status in ('waiting', 'offered') and (o.created_at, o.id) < (w.created_at, w.id));
create unique index if not exists waitlist_one_per_client_service on waitlist_entries (client_id, service_id) where status in ('waiting', 'offered');

-- A trigger function is not meant to be called; stop it showing up as a public API.
revoke execute on function timesheet_guard() from public, anon, authenticated;
