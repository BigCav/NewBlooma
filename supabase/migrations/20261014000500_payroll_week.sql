-- Product commission rate (shown on the Payroll screen) and the full payout breakdown.
alter table salon_settings add column if not exists product_commission_pct numeric(4,1) not null default 10 check (product_commission_pct between 0 and 100);
alter table payouts
  add column if not exists service_cents int not null default 0,
  add column if not exists product_cents int not null default 0,
  add column if not exists product_pct numeric(4,1) not null default 0,
  add column if not exists product_commission_cents int not null default 0,
  add column if not exists tips_cents int not null default 0;

-- One row per team member for a pay period: sales split into services, products and tips, with commission.
-- A paid period returns the figures frozen at payout time.
create or replace function payroll_week(p_from date, p_to date)
returns table (staff_id uuid, staff_name text, role_title text, service_cents bigint, product_cents bigint, tips_cents bigint,
               commission_pct numeric, product_pct numeric, service_commission_cents bigint, product_commission_cents bigint, paid_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_salon uuid := current_salon_id(); v_tz text; v_start timestamptz; v_end timestamptz; v_ppct numeric;
begin
  if v_salon is null or not is_owner() then raise exception 'owner_only' using errcode = '42501'; end if;
  select timezone into v_tz from salons where id = v_salon;
  select coalesce(max(product_commission_pct), 10) into v_ppct from salon_settings where salon_id = v_salon;
  v_start := p_from::timestamp at time zone v_tz;
  v_end := (p_to + 1)::timestamp at time zone v_tz;
  return query
  select st.id, st.name, st.role_title,
    coalesce(po.service_cents::bigint, b.svc), coalesce(po.product_cents::bigint, b.prod), coalesce(po.tips_cents::bigint, b.tips),
    coalesce(po.commission_pct, st.commission_pct)::numeric,
    coalesce(po.product_pct, v_ppct)::numeric,
    coalesce(po.commission_cents::bigint, round(b.svc * st.commission_pct / 100.0)::bigint),
    coalesce(po.product_commission_cents::bigint, round(b.prod * v_ppct / 100.0)::bigint),
    po.paid_at
  from staff st
  left join payouts po on po.staff_id = st.id and po.period_start = p_from and po.period_end = p_to
  cross join lateral (
    select
      coalesce((select sum(si.price_cents::bigint * si.qty) from sale_items si join sales s on s.id = si.sale_id
                where s.staff_id = st.id and s.status = 'paid' and s.paid_at >= v_start and s.paid_at < v_end and si.service_id is not null), 0)::bigint as svc,
      coalesce((select sum(si.price_cents::bigint * si.qty) from sale_items si join sales s on s.id = si.sale_id
                where s.staff_id = st.id and s.status = 'paid' and s.paid_at >= v_start and s.paid_at < v_end and si.product_id is not null), 0)::bigint as prod,
      coalesce((select sum(s.tip_cents) from sales s
                where s.staff_id = st.id and s.status = 'paid' and s.paid_at >= v_start and s.paid_at < v_end), 0)::bigint as tips
  ) b
  where st.salon_id = v_salon and (st.active or po.id is not null)
  order by st.name;
end $$;

create or replace function mark_payout_paid(p_staff uuid, p_from date, p_to date) returns void
language plpgsql security definer set search_path = public as $$
declare r record; h numeric; v_salon uuid := current_salon_id(); v_tz text;
begin
  if v_salon is null or not is_owner() then raise exception 'owner_only' using errcode = '42501'; end if;
  select timezone into v_tz from salons where id = v_salon;
  if p_to >= (now() at time zone v_tz)::date then raise exception 'period_open'; end if;
  select * into r from payroll_week(p_from, p_to) w where w.staff_id = p_staff;
  if r.staff_id is null then raise exception 'staff_not_found'; end if;
  if r.paid_at is not null then raise exception 'already_paid'; end if;
  select s.hours into h from payroll_summary(p_from, p_to) s where s.staff_id = p_staff;
  insert into payouts (salon_id, staff_id, period_start, period_end, hours, commission_pct, commission_cents,
                       service_cents, product_cents, product_pct, product_commission_cents, tips_cents)
  values (v_salon, p_staff, p_from, p_to, coalesce(h, 0), r.commission_pct, r.service_commission_cents,
          r.service_cents, r.product_cents, r.product_pct, r.product_commission_cents, r.tips_cents);
  perform audit(v_salon, 'payout', 'staff', p_staff, jsonb_build_object('from', p_from, 'to', p_to,
    'commission_cents', r.service_commission_cents + r.product_commission_cents, 'tips_cents', r.tips_cents));
end $$;

revoke all on function payroll_week(date, date) from public, anon;
grant execute on function payroll_week(date, date) to authenticated;
