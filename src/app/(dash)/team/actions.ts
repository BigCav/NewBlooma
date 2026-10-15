'use server';
import { revalidatePath } from 'next/cache';
import { requireOwner, friendly } from '@/lib/session';
import { SHIFTS } from './shared';

type Input = { id: string | null; name: string; role: string; cats: string[]; days: number[]; shift: string | null; online: boolean };
type Res = { error?: string; id?: string; notice?: string };

export async function saveMember(i: Input): Promise<Res> {
  const { sb, salon } = await requireOwner();
  const name = i.name.trim();
  if (!name) return { error: "Add the team member's name." };
  if (!i.cats.length) return { error: 'Choose at least one service category.' };
  const preset = SHIFTS.find((s) => s.id === i.shift) ?? null;
  const row = { name, role_title: i.role.trim() || 'Team member', online_bookable: !!i.online };
  let sid = i.id;
  if (sid) { const { error } = await sb.from('staff').update(row).eq('id', sid); if (error) return { error: friendly(error.message) }; }
  else {
    const { data, error } = await sb.from('staff').insert({ ...row, salon_id: salon.id, app_role: 'stylist', commission_pct: 0 }).select('id').single();
    if (error) return { error: friendly(error.message) }; sid = data.id;
  }
  // Working days: preset shift applies to every chosen day; with no preset an existing day keeps its own times.
  const { data: cur } = await sb.from('staff_shifts').select('weekday,start_time,end_time').eq('staff_id', sid);
  const days = new Set(i.days);
  for (let d = 0; d < 7; d++) {
    if (!days.has(d)) { await sb.from('staff_shifts').delete().eq('staff_id', sid).eq('weekday', d); continue; }
    const ex = (cur ?? []).find((x) => x.weekday === d);
    const from = preset?.from ?? ex?.start_time?.slice(0, 5) ?? '09:00', to = preset?.to ?? ex?.end_time?.slice(0, 5) ?? '17:00';
    const { error } = await sb.from('staff_shifts').upsert({ staff_id: sid, weekday: d, start_time: from, end_time: to });
    if (error) return { error: friendly(error.message) };
  }
  // Services they offer: a category turned on links every service in it; turned off unlinks them. Untouched categories keep partial setups.
  const [{ data: cats }, { data: svcs }, { data: links }] = await Promise.all([
    sb.from('service_categories').select('id,name'),
    sb.from('services').select('id,category_id').eq('is_addon', false),
    sb.from('service_staff').select('service_id').eq('staff_id', sid),
  ]);
  const have = new Set((links ?? []).map((l) => l.service_id));
  for (const c of cats ?? []) {
    const ids = (svcs ?? []).filter((s) => s.category_id === c.id).map((s) => s.id);
    if (!ids.length) continue;
    const was = ids.some((x) => have.has(x)), want = i.cats.includes(c.name);
    if (want && !was) { const { error } = await sb.from('service_staff').insert(ids.map((service_id) => ({ service_id, staff_id: sid! }))); if (error) return { error: friendly(error.message) }; }
    if (!want && was) { const { error } = await sb.from('service_staff').delete().eq('staff_id', sid).in('service_id', ids); if (error) return { error: friendly(error.message) }; }
  }
  revalidatePath('/team'); revalidatePath('/calendar');
  return { id: sid!, notice: i.id ? 'Changes saved' : 'Team member added' };
}

export async function removeMember(id: string): Promise<Res> {
  const { sb } = await requireOwner();
  const { count } = await sb.from('bookings').select('id', { count: 'exact', head: true }).eq('staff_id', id).gte('starts_at', new Date().toISOString()).not('status', 'in', '(cancelled,no_show,completed)');
  if (count) return { error: `They have ${count} upcoming ${count === 1 ? 'appointment' : 'appointments'}. Move or cancel those first.` };
  const { error } = await sb.from('staff').update({ active: false, online_bookable: false }).eq('id', id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/team'); revalidatePath('/calendar');
  return { notice: 'Team member removed' };
}
