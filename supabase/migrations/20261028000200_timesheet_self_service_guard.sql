-- A team member could write any hours they liked into their own timesheet by calling the database directly
-- (the screens only let the owner edit times, but the table allowed everyone to).
-- Now a non-owner can only clock in (a new open entry starting right now) and clock out (close their own open entry at right now).
-- The owner, and the server's own maintenance calls, are not restricted here; the app checks paid weeks for them.

create or replace function public.timesheet_guard() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or is_owner() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.clock_out is not null or abs(extract(epoch from (new.clock_in - now()))) > 120 then
      raise exception 'timesheet_locked' using errcode = '42501';
    end if;
  else
    if old.clock_out is not null or new.clock_in <> old.clock_in or new.staff_id <> old.staff_id or new.salon_id <> old.salon_id
       or new.clock_out is null or abs(extract(epoch from (new.clock_out - now()))) > 120 then
      raise exception 'timesheet_locked' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists timesheet_guard on public.timesheets;
create trigger timesheet_guard before insert or update on public.timesheets
  for each row execute function public.timesheet_guard();
