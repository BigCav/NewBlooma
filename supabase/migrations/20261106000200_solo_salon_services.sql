-- Alone in a salon, every service is that one person's, so nobody has to link them (a booking refuses a service nobody is linked to,
-- and a solo owner has no one to choose between). When a second person joins, links are made on the Services screen as before.
create or replace function public.link_solo_service() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_only uuid;
begin
  if new.is_addon then return new; end if;
  select (array_agg(id))[1] into v_only from staff where salon_id = new.salon_id and active having count(*) = 1;
  if v_only is not null then insert into service_staff (service_id, staff_id) values (new.id, v_only) on conflict do nothing; end if;
  return new;
end $$;
drop trigger if exists link_solo_service on public.services;
create trigger link_solo_service after insert on public.services for each row execute function public.link_solo_service();

create or replace function public.link_solo_staff() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_only uuid;
begin
  select (array_agg(id))[1] into v_only from staff where salon_id = new.salon_id and active having count(*) = 1;
  if v_only is not null then
    insert into service_staff (service_id, staff_id) select s.id, v_only from services s where s.salon_id = new.salon_id and not s.is_addon on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists link_solo_staff on public.staff;
create trigger link_solo_staff after insert or update of active on public.staff for each row execute function public.link_solo_staff();

-- Salons that are already on their own.
insert into service_staff (service_id, staff_id)
select s.id, o.id from services s
join (select salon_id, (array_agg(id))[1] id from staff where active group by salon_id having count(*) = 1) o on o.salon_id = s.salon_id
where not s.is_addon
on conflict do nothing;
