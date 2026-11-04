-- Everyone on a salon's team could read every colleague's commission rate (the owner's too) straight from the database. Pay rates are private, so
-- the commission column is no longer readable by signed-in users at all. The payroll functions run with their own rights and still return it to the
-- owner, which is how the Payroll screen shows it. Postgres cannot hide one column while the whole table is readable, so the read right on the
-- table is replaced by a list of the other columns. A column added to staff later must be added to this list if the app is to read it.
revoke select on public.staff from authenticated;
grant select (id, salon_id, user_id, name, role_title, app_role, online_bookable, active, created_at, photo_url) on public.staff to authenticated;
