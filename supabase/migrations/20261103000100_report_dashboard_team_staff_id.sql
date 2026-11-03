-- The Reports team rows now carry the staff id, so a photo is matched to the person and not to a name two people could share.
do $$
declare
  def text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.proname = 'report_dashboard';
  if def is null then raise exception 'report_dashboard not found'; end if;
  if position('st.id as staff_id' in def) > 0 then return; end if;
  if position('select st.name,' in def) = 0 then raise exception 'team select not found'; end if;
  def := replace(def, 'select st.name,', 'select st.id as staff_id, st.name,');
  execute def;
end $$;
