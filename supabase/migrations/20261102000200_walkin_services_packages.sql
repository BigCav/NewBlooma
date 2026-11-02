-- Walk-in sales (no booking) can change their services and use a client's package visits at checkout, like a sale from a booking.
-- Services only change the sale's lines, so the booking is not needed; packages need a client to take the visit from.
do $$
declare d text; n text;
begin
  select pg_get_functiondef(oid) into d from pg_proc where pronamespace = 'public'::regnamespace and proname = 'set_sale_services';
  n := replace(d, 'if s.booking_id is null then raise exception ''no_booking''; end if;', '');
  if n = d then raise exception 'set_sale_services patch did not apply'; end if;
  execute n;

  select pg_get_functiondef(oid) into d from pg_proc where pronamespace = 'public'::regnamespace and proname = 'apply_packages_to_sale';
  n := replace(d, 'if s.booking_id is null or s.client_id is null then raise exception ''no_booking''; end if;', 'if s.client_id is null then raise exception ''no_client''; end if;');
  if n = d then raise exception 'apply_packages_to_sale patch did not apply'; end if;
  execute n;
end $$;
