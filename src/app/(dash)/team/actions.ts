'use server';
import { revalidatePath } from 'next/cache';
import { requireOwner, friendly } from '@/lib/session';

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function saveMember(_: unknown, fd: FormData) {
  const { sb, salon } = await requireOwner();
  const id = s(fd, 'id');
  const pct = Number(fd.get('commission_pct') || 0);
  if (!(pct >= 0 && pct <= 100)) return { error: 'Commission must be between 0 and 100.' };
  const row = { salon_id: salon.id, name: s(fd, 'name'), role_title: s(fd, 'role_title') || 'Stylist', app_role: s(fd, 'app_role') || 'stylist',
    online_bookable: fd.get('online_bookable') === 'on', commission_pct: pct };
  if (!row.name) return { error: 'Enter a name.' };
  let sid = id;
  if (id) { const { error } = await sb.from('staff').update(row).eq('id', id); if (error) return { error: friendly(error.message) }; }
  else {
    const { data, error } = await sb.from('staff').insert(row).select('id').single(); if (error) return { error: friendly(error.message) };
    sid = data.id;
  }
  // Weekly shifts
  for (let d = 0; d < 7; d++) {
    const on = fd.get(`work_${d}`) === 'on', from = s(fd, `from_${d}`), to = s(fd, `to_${d}`);
    if (!on) { await sb.from('staff_shifts').delete().eq('staff_id', sid).eq('weekday', d); continue; }
    if (!from || !to || to <= from) return { error: 'Shift end must be after its start.' };
    const { error } = await sb.from('staff_shifts').upsert({ staff_id: sid, weekday: d, start_time: from, end_time: to });
    if (error) return { error: friendly(error.message) };
  }
  revalidatePath('/team'); return { ok: id ? 'Saved.' : 'Team member added.' };
}

export async function setActive(fd: FormData) {
  const { sb } = await requireOwner();
  await sb.from('staff').update({ active: fd.get('active') === 'true' }).eq('id', String(fd.get('id')));
  revalidatePath('/team');
}

export async function inviteMember(_: unknown, fd: FormData) {
  const { sb } = await requireOwner();
  const { data, error } = await sb.rpc('create_staff_invite', { p_staff: s(fd, 'id') });
  if (error) return { error: friendly(error.message) };
  return { ok: `Invite link: ${process.env.NEXT_PUBLIC_APP_URL}/join/${data}` };
}
