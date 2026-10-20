-- Booking references: B-1000, B-1001 ... counted separately for each salon.
alter table bookings add column if not exists ref_no integer;

with n as (select id, 999 + row_number() over (partition by salon_id order by created_at, id) as r from bookings where ref_no is null)
update bookings b set ref_no = n.r from n where b.id = n.id;

create or replace function set_booking_ref() returns trigger language plpgsql as $$
begin
  if new.ref_no is null then
    perform pg_advisory_xact_lock(hashtextextended('booking_ref:' || new.salon_id::text, 0));
    select coalesce(max(ref_no), 999) + 1 into new.ref_no from bookings where salon_id = new.salon_id;
  end if;
  return new;
end $$;

drop trigger if exists bookings_set_ref on bookings;
create trigger bookings_set_ref before insert on bookings for each row execute function set_booking_ref();

alter table bookings alter column ref_no set not null;
create unique index if not exists bookings_salon_ref_uq on bookings (salon_id, ref_no);
