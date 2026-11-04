-- Cash or a gift card cannot be taken while a card payment for the same sale is pending or approved. Every other change to a sale already
-- refused in that state; taking another kind of payment did not, so a customer could be charged on the card and also pay cash if the two
-- arrived at the same moment. The app checks first (payFlow); this makes the database hold the line too.

create or replace function public.complete_sale(p_sale uuid, p_method pay_method, p_gift_code text default null) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare s sales; v_set salon_settings; g gift_cards;
begin
  select * into s from sales where id = p_sale for update;
  if s.id is null then raise exception 'sale_not_found'; end if;
  perform assert_salon_access(s.salon_id);
  if s.status <> 'pending' then raise exception 'sale_not_pending'; end if;
  if exists (select 1 from card_payments where sale_id = s.id and status in ('approved', 'pending')) then raise exception 'card_payment_in_progress'; end if;
  select * into v_set from salon_settings where salon_id = s.salon_id;
  if p_method = 'package' and s.total_cents > 0 then raise exception 'package_needs_zero_total'; end if;
  if p_method = 'card' then raise exception 'card_must_use_provider'; end if;
  if p_method = 'cash' and not v_set.accept_cash then raise exception 'method_disabled'; end if;
  if p_method = 'gift_card' then
    if not v_set.accept_gift_cards then raise exception 'method_disabled'; end if;
    select * into g from gift_cards where salon_id = s.salon_id and code = trim(p_gift_code) for update;
    if g.id is null then raise exception 'gift_card_not_found'; end if;
    if g.balance_cents < s.total_cents then raise exception 'gift_card_insufficient'; end if;
    update gift_cards set balance_cents = balance_cents - s.total_cents where id = g.id;
    update sales set gift_card_id = g.id where id = s.id;
  end if;
  perform finalize_sale(s.id, p_method);
end $function$;
