-- Cancelling a booking (or marking it a no-show) used to leave the sale opened for it sitting as "pending": it cluttered the Sales list
-- forever and, if the visit had used a package, kept that package visit locked. The unpaid sale now goes with the booking, the same way
-- "void" removes it, unless a card payment is under way or has been flagged for a look, in which case it is left for staff to deal with.
create or replace function void_open_sale_of_booking() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  delete from sales s
  where s.booking_id = new.id and s.status = 'pending'
    and not exists (select 1 from card_payments cp where cp.sale_id = s.id and (cp.status in ('approved', 'pending') or cp.needs_review));
  return new;
end $$;
revoke execute on function void_open_sale_of_booking() from public, anon, authenticated;

drop trigger if exists bookings_void_open_sale on bookings;
create trigger bookings_void_open_sale after update of status on bookings
  for each row when (new.status in ('cancelled', 'no_show') and old.status is distinct from new.status) execute function void_open_sale_of_booking();
