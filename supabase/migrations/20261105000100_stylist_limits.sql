-- Four things a stylist could still reach straight through the database, whatever the screens showed:
--   the salon-wide revenue report, emailing every recent client to ask for a review, changing stock counts, and the list of gift card codes.
-- Each now needs the owner or front desk (any signed-in team member that is not a stylist), the same rule the till and daily summary already use.

create or replace function public.report_summary(p_from date, p_to date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare v_salon uuid := current_salon_id(); v_tz text; v_start timestamptz; v_end timestamptz; res jsonb;
begin
  if v_salon is null or not is_owner() then raise exception 'forbidden' using errcode = '42501'; end if;
  select timezone into v_tz from salons where id = v_salon;
  v_start := p_from::timestamp at time zone v_tz;
  v_end := (p_to + 1)::timestamp at time zone v_tz;
  select jsonb_build_object(
    'revenue_cents', coalesce((select sum(total_cents) from sales where salon_id = v_salon and status = 'paid' and paid_at >= v_start and paid_at < v_end), 0),
    'net_cents', coalesce((select sum(subtotal_cents - case when tax_inclusive then tax_cents else 0 end) from sales where salon_id = v_salon and status = 'paid' and paid_at >= v_start and paid_at < v_end), 0),
    'tips_cents', coalesce((select sum(tip_cents) from sales where salon_id = v_salon and status = 'paid' and paid_at >= v_start and paid_at < v_end), 0),
    'sales_count', (select count(*) from sales where salon_id = v_salon and status = 'paid' and paid_at >= v_start and paid_at < v_end),
    'bookings_total', (select count(*) from bookings where salon_id = v_salon and starts_at >= v_start and starts_at < v_end),
    'bookings_completed', (select count(*) from bookings where salon_id = v_salon and status = 'completed' and starts_at >= v_start and starts_at < v_end),
    'bookings_cancelled', (select count(*) from bookings where salon_id = v_salon and status = 'cancelled' and starts_at >= v_start and starts_at < v_end),
    'bookings_no_show', (select count(*) from bookings where salon_id = v_salon and status = 'no_show' and starts_at >= v_start and starts_at < v_end),
    'new_clients', (select count(*) from clients where salon_id = v_salon and created_at >= v_start and created_at < v_end),
    'by_staff', coalesce((select jsonb_agg(x order by x.revenue_cents desc) from (
        select st.id as staff_id, st.name, coalesce(sum(s.total_cents), 0)::bigint as revenue_cents
        from staff st left join sales s on s.staff_id = st.id and s.status = 'paid' and s.paid_at >= v_start and s.paid_at < v_end
        where st.salon_id = v_salon group by st.id, st.name) x), '[]'::jsonb),
    'top_services', coalesce((select jsonb_agg(x order by x.revenue_cents desc) from (
        select si.label as name, sum(si.qty)::int as count, sum(si.price_cents::bigint * si.qty) as revenue_cents
        from sale_items si join sales s on s.id = si.sale_id
        where s.salon_id = v_salon and s.status = 'paid' and s.paid_at >= v_start and s.paid_at < v_end and si.service_id is not null
        group by si.label order by sum(si.price_cents::bigint * si.qty) desc limit 8) x), '[]'::jsonb),
    'by_hour', coalesce((select jsonb_agg(x order by x.hour) from (
        select extract(hour from (starts_at at time zone v_tz))::int as hour, count(*)::int as count
        from bookings where salon_id = v_salon and status not in ('cancelled', 'no_show') and starts_at >= v_start and starts_at < v_end
        group by 1) x), '[]'::jsonb)
  ) into res;
  return res;
end $function$;

create or replace function public.request_reviews()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_salon uuid := current_salon_id(); b record; n int := 0; v_tok text;
begin
  if v_salon is null or not exists (select 1 from staff where user_id = auth.uid() and active and app_role <> 'stylist') then raise exception 'forbidden' using errcode = '42501'; end if;
  for b in
    select bk.id, c.email from bookings bk join clients c on c.id = bk.client_id
    where bk.salon_id = v_salon and bk.status = 'completed' and bk.ends_at > now() - interval '14 days' and c.email is not null
      and not exists (select 1 from reviews r where r.booking_id = bk.id)
      and not exists (select 1 from booking_tokens t where t.booking_id = bk.id and t.purpose = 'review')
  loop
    insert into booking_tokens (salon_id, purpose, booking_id, expires_at) values (v_salon, 'review', b.id, now() + interval '30 days') returning token into v_tok;
    insert into notifications_outbox (salon_id, booking_id, channel, to_address, template, payload)
    values (v_salon, b.id, 'email', b.email, 'review_request', jsonb_build_object('token', v_tok)) on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end $function$;

create or replace function public.adjust_product_stock(p_product uuid, p_delta integer)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare r int;
begin
  if current_salon_id() is null or not exists (select 1 from staff where user_id = auth.uid() and active and app_role <> 'stylist') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_delta is null or abs(p_delta) > 100000 then raise exception 'invalid_delta'; end if;
  update products set stock = greatest(0, stock + p_delta) where id = p_product and salon_id = current_salon_id() returning stock into r;
  return r;
end $function$;

-- A gift card code is as good as cash, so a stylist cannot list them (a stylist still takes one as payment by typing the code the client gives).
-- The owner reads them through the owner_write policy.
drop policy if exists staff_read on public.gift_cards;
create policy front_desk_read on public.gift_cards for select to authenticated
  using (salon_id = current_salon_id() and exists (select 1 from staff s where s.user_id = (select auth.uid()) and s.active and s.app_role <> 'stylist'));
