-- Birthdays and marketing messages.
--  * A client's birthday is a day and a month. It is stored as a date in the year 2000 (a leap year, so 29 February is allowed) and only day and month are ever used.
--  * Marketing goes only to clients whose "Marketing messages" switch is on (clients.marketing, off until they or the salon turn it on). Every message carries an
--    unsubscribe link that turns that switch off, and it works without signing in, through the client's own unsub_token.
--  * Two automatic messages ("we miss you" and "happy birthday") are off until the owner switches them on; marketing_log remembers who was sent what, so nobody is
--    messaged twice in a row. A message to a chosen group is the same outbox, started by the owner.

alter table public.clients
  add column if not exists birthday date check (birthday is null or extract(year from birthday) = 2000),
  add column if not exists unsub_token uuid not null default gen_random_uuid();
create unique index if not exists clients_unsub_token_idx on public.clients (unsub_token);

create table if not exists public.marketing_settings (
  salon_id      uuid primary key references public.salons(id) on delete cascade,
  winback_on    boolean not null default false,
  winback_weeks smallint not null default 8 check (winback_weeks between 4 and 52),
  winback_text  text not null default 'Hi {first}, it has been a while since your last visit and we would love to see you again. You can book online any time.' check (length(btrim(winback_text)) between 1 and 500),
  birthday_on   boolean not null default false,
  birthday_text text not null default 'Happy birthday {first}! We hope you have a lovely day. Treat yourself to something special this month, we would love to see you.' check (length(btrim(birthday_text)) between 1 and 500),
  updated_at    timestamptz not null default now()
);
alter table public.marketing_settings enable row level security;
grant select, insert, update on public.marketing_settings to authenticated;
drop policy if exists owner_all on public.marketing_settings;
create policy owner_all on public.marketing_settings for all to authenticated
  using (salon_id = current_salon_id() and is_owner()) with check (salon_id = current_salon_id() and is_owner());

create table if not exists public.marketing_log (
  id         uuid primary key default gen_random_uuid(),
  salon_id   uuid not null references public.salons(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  kind       text not null check (kind in ('winback', 'birthday', 'broadcast')),
  created_at timestamptz not null default now()
);
create index if not exists marketing_log_client_idx on public.marketing_log (client_id, kind, created_at desc);
create index if not exists marketing_log_salon_idx on public.marketing_log (salon_id, created_at desc);
alter table public.marketing_log enable row level security;
grant select on public.marketing_log to authenticated;
drop policy if exists owner_read on public.marketing_log;
create policy owner_read on public.marketing_log for select to authenticated using (salon_id = current_salon_id() and is_owner());

-- Queues today's automatic messages (the daily maintenance run calls this; the notification run sends them). At most 25 "we miss you" messages per salon per run,
-- so switching it on does not message every lapsed client at once, and nobody gets more than one marketing message a week.
create or replace function public.enqueue_marketing(p_sms boolean default false) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; s record; r record; v_today date; v_md text; v_leap boolean;
begin
  if not is_service() then raise exception 'forbidden' using errcode = '42501'; end if;
  for s in select m.*, sa.timezone from marketing_settings m join salons sa on sa.id = m.salon_id where m.winback_on or m.birthday_on loop
    v_today := (now() at time zone s.timezone)::date;
    v_md := to_char(v_today, 'MM-DD');
    v_leap := extract(day from (make_date(extract(year from v_today)::int, 3, 1) - 1)) = 29;
    if s.birthday_on then
      for r in
        select cl.id, case when cl.email is not null then 'email' else 'sms' end ch, coalesce(cl.email, cl.phone) addr
        from clients cl
        where cl.salon_id = s.salon_id and cl.marketing and cl.birthday is not null
          and (cl.email is not null or (p_sms and cl.phone is not null))
          and (to_char(cl.birthday, 'MM-DD') = v_md or (to_char(cl.birthday, 'MM-DD') = '02-29' and v_md = '02-28' and not v_leap))
          and not exists (select 1 from marketing_log l where l.client_id = cl.id and l.kind = 'birthday' and l.created_at > now() - interval '300 days')
          and not exists (select 1 from marketing_log l where l.client_id = cl.id and l.created_at > now() - interval '2 days')
      loop
        insert into notifications_outbox (salon_id, channel, to_address, template, payload) values (s.salon_id, r.ch, r.addr, 'birthday', jsonb_build_object('client_id', r.id));
        insert into marketing_log (salon_id, client_id, kind) values (s.salon_id, r.id, 'birthday');
        n := n + 1;
      end loop;
    end if;
    if s.winback_on then
      for r in
        select cl.id, case when cl.email is not null then 'email' else 'sms' end ch, coalesce(cl.email, cl.phone) addr
        from clients cl
        join lateral (select max(b.starts_at) last_at from bookings b where b.client_id = cl.id and b.status = 'completed') lv on true
        where cl.salon_id = s.salon_id and cl.marketing and lv.last_at is not null
          and (cl.email is not null or (p_sms and cl.phone is not null))
          and lv.last_at < now() - make_interval(weeks => s.winback_weeks)
          and lv.last_at > now() - interval '12 months'
          and not exists (select 1 from bookings b where b.client_id = cl.id and b.status in ('pending', 'confirmed', 'checked_in', 'in_progress') and b.ends_at > now())
          and not exists (select 1 from marketing_log l where l.client_id = cl.id and l.kind = 'winback' and l.created_at > now() - interval '120 days')
          and not exists (select 1 from marketing_log l where l.client_id = cl.id and l.created_at > now() - interval '7 days')
        order by lv.last_at desc
        limit 25
      loop
        insert into notifications_outbox (salon_id, channel, to_address, template, payload) values (s.salon_id, r.ch, r.addr, 'winback', jsonb_build_object('client_id', r.id));
        insert into marketing_log (salon_id, client_id, kind) values (s.salon_id, r.id, 'winback');
        n := n + 1;
      end loop;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.enqueue_marketing(boolean) from public, anon, authenticated;
grant execute on function public.enqueue_marketing(boolean) to service_role;

-- Who a message to a chosen group would reach (the owner's screen shows the count and the names before anything is sent).
-- p_kind: 'all' | 'lapsed' (last visit more than p_n weeks ago) | 'regulars' (p_n or more visits) | 'new' (one visit so far) | 'birthday' (birthday in month p_n) | 'service' (has had service p_service).
-- Every match comes back with whether they agreed to marketing; the sender only ever uses the ones who did.
create or replace function public.marketing_audience(p_kind text, p_n integer default 0, p_service uuid default null)
returns table(id uuid, name text, email text, phone text, agreed boolean)
language plpgsql stable set search_path to 'public' as $$
begin
  if not is_owner() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  with done as (
    select b.client_id, count(*)::int n, max(b.starts_at) last_at from bookings b where b.status = 'completed' group by b.client_id
  )
  select c.id, c.name, c.email, c.phone, c.marketing
  from clients c left join done d on d.client_id = c.id
  where c.salon_id = current_salon_id()
    and case p_kind
      when 'all' then true
      when 'lapsed' then d.last_at is not null and d.last_at < now() - make_interval(weeks => greatest(p_n, 1))
      when 'regulars' then coalesce(d.n, 0) >= greatest(p_n, 1)
      when 'new' then coalesce(d.n, 0) = 1
      when 'birthday' then c.birthday is not null and extract(month from c.birthday) = p_n
      when 'service' then exists (select 1 from bookings b join booking_services bs on bs.booking_id = b.id where b.client_id = c.id and b.status = 'completed' and bs.service_id = p_service)
      else false end
  order by c.name;
end $$;
revoke all on function public.marketing_audience(text, integer, uuid) from public, anon;
grant execute on function public.marketing_audience(text, integer, uuid) to authenticated;
