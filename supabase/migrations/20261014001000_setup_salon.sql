-- First-run setup wizard: create the salon, then the chosen categories with starter services and the team, in one transaction.
create or replace function setup_salon(
  p_name text, p_slug text, p_phone text, p_email text, p_address text, p_timezone text, p_currency text,
  p_hours jsonb, p_owner_name text, p_categories jsonb, p_team jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_salon uuid; c jsonb; s jsonb; m jsonb; v_cat uuid; v_svc uuid; v_staff uuid; v_sort int := 0;
begin
  v_salon := create_salon(p_name, p_slug, p_phone, p_email, p_address, p_timezone, p_currency, p_hours, p_owner_name, 'Owner');

  for m in select * from jsonb_array_elements(coalesce(p_team, '[]'::jsonb)) loop
    insert into staff (salon_id, name, role_title, app_role)
    values (v_salon, trim(m ->> 'name'), coalesce(nullif(trim(m ->> 'role'), ''), 'Stylist'), 'stylist') returning id into v_staff;
    insert into staff_shifts (staff_id, weekday, start_time, end_time)
    select v_staff, weekday, open_time, close_time from opening_hours where salon_id = v_salon and is_open;
  end loop;

  for c in select * from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb)) loop
    v_sort := v_sort + 1;
    insert into service_categories (salon_id, name, sort) values (v_salon, trim(c ->> 'name'), v_sort) returning id into v_cat;
    for s in select * from jsonb_array_elements(coalesce(c -> 'services', '[]'::jsonb)) loop
      insert into services (salon_id, category_id, name, duration_min, price_cents)
      values (v_salon, v_cat, trim(s ->> 'name'), (s ->> 'duration')::int, (s ->> 'price_cents')::int) returning id into v_svc;
      insert into service_staff (service_id, staff_id)
      select v_svc, st.id from staff st
      where st.salon_id = v_salon and (
        st.app_role = 'owner' or st.role_title = 'Other'
        or (st.role_title, c ->> 'name') in (('Stylist', 'Hair'), ('Stylist', 'Colour'), ('Colourist', 'Colour'), ('Colourist', 'Hair'), ('Barber', 'Barber'), ('Nail tech', 'Nails')));
    end loop;
  end loop;
  return v_salon;
end $$;

revoke execute on function setup_salon(text, text, text, text, text, text, text, jsonb, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function setup_salon(text, text, text, text, text, text, text, jsonb, text, jsonb, jsonb) to authenticated;
