'use server';
import { revalidatePath } from 'next/cache';
import { requireOwner, friendly } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { headers } from 'next/headers';
import { DAY_FULL } from './shared';

type Input = { id: string | null; name: string; role: string; cats: string[]; days: number[]; times: [string, string][]; online: boolean };
type Res = { error?: string; id?: string; notice?: string };

const BUCKET = 'staff-photos';
const keyOf = (url: string | null) => (url && url.includes(`/${BUCKET}/`) ? url.split(`/${BUCKET}/`)[1].split('?')[0] : null);

/** Owner uploads a (client-resized) JPEG for a team member. The old file is removed once the new one is saved. */
export async function uploadPhoto(staffId: string, fd: FormData): Promise<Res & { url?: string }> {
  const { sb, salon } = await requireOwner();
  const file = fd.get('photo');
  if (!(file instanceof File) || !file.size) return { error: 'Choose a photo.' };
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return { error: 'Use a JPG, PNG or WebP photo.' };
  if (file.size > 900_000) return { error: 'That photo is too large. Try a smaller one.' };
  const { data: m } = await sb.from('staff').select('id,photo_url').eq('id', staffId).eq('salon_id', salon.id).maybeSingle();
  if (!m) return { error: 'Team member not found.' };
  const admin = supabaseAdmin();
  const path = `${salon.id}/${staffId}-${Date.now()}.jpg`;
  const up = await admin.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (up.error) return { error: 'Could not upload the photo. Please try again.' };
  const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await sb.from('staff').update({ photo_url: url }).eq('id', staffId);
  if (error) { await admin.storage.from(BUCKET).remove([path]); return { error: friendly(error.message) }; }
  const old = keyOf(m.photo_url); if (old) await admin.storage.from(BUCKET).remove([old]);
  revalidatePath('/team'); revalidatePath(`/b/${salon.slug}`);
  return { url, notice: 'Photo saved' };
}

export async function removePhoto(staffId: string): Promise<Res> {
  const { sb, salon } = await requireOwner();
  const { data: m } = await sb.from('staff').select('id,photo_url').eq('id', staffId).eq('salon_id', salon.id).maybeSingle();
  if (!m) return { error: 'Team member not found.' };
  const { error } = await sb.from('staff').update({ photo_url: null }).eq('id', staffId);
  if (error) return { error: friendly(error.message) };
  const old = keyOf(m.photo_url); if (old) await supabaseAdmin().storage.from(BUCKET).remove([old]);
  revalidatePath('/team'); revalidatePath(`/b/${salon.slug}`);
  return { notice: 'Photo removed' };
}

export async function saveMember(i: Input): Promise<Res> {
  const { sb, salon } = await requireOwner();
  const name = i.name.trim();
  if (!name) return { error: "Add the team member's name." };
  if (!i.cats.length) return { error: 'Choose at least one service category.' };
  for (const d of i.days) {
    const t = i.times?.[d];
    if (!t || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t[0]) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t[1])) return { error: 'Choose a start and finish time for each working day.' };
    if (t[1] <= t[0]) return { error: `${DAY_FULL[d]}: finish time must be after start time.` };
  }
  const row = { name, role_title: i.role.trim() || 'Team member', online_bookable: !!i.online };
  let sid = i.id;
  if (sid) { const { error } = await sb.from('staff').update(row).eq('id', sid); if (error) return { error: friendly(error.message) }; }
  else {
    const { data, error } = await sb.from('staff').insert({ ...row, salon_id: salon.id, app_role: 'stylist', commission_pct: 0 }).select('id').single();
    if (error) return { error: friendly(error.message) }; sid = data.id;
  }
  // Each chosen day gets its own start and finish time.
  const days = new Set(i.days);
  for (let d = 0; d < 7; d++) {
    if (!days.has(d)) { await sb.from('staff_shifts').delete().eq('staff_id', sid).eq('weekday', d); continue; }
    const [from, to] = i.times[d];
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

/** A one-time link that lets this team member create their own login and join the salon. */
export async function inviteMember(staffId: string): Promise<Res & { link?: string }> {
  const { sb, salon } = await requireOwner();
  const { data: m } = await sb.from('staff').select('id,user_id,active').eq('id', staffId).eq('salon_id', salon.id).maybeSingle();
  if (!m || !m.active) return { error: 'Team member not found.' };
  if (m.user_id) return { error: 'They already have a login.' };
  const { data, error } = await sb.rpc('create_staff_invite', { p_staff: staffId });
  if (error || !data) return { error: friendly(error?.message) };
  const h = await headers();
  const base = process.env.NEXT_PUBLIC_APP_URL || `https://${h.get('x-forwarded-host') ?? h.get('host')}`;
  return { link: `${base}/join/${data}` };
}

export async function removeMember(id: string): Promise<Res> {
  const { sb, staff } = await requireOwner();
  // Removing the owner would lock everyone out of the salon.
  if (id === staff.id) return { error: 'You cannot remove yourself.' };
  const { data: target } = await sb.from('staff').select('app_role').eq('id', id).maybeSingle();
  if (target?.app_role === 'owner') return { error: 'The owner cannot be removed.' };
  const { count } = await sb.from('bookings').select('id', { count: 'exact', head: true }).eq('staff_id', id).gte('starts_at', new Date().toISOString()).not('status', 'in', '(cancelled,no_show,completed)');
  if (count) return { error: `They have ${count} upcoming ${count === 1 ? 'appointment' : 'appointments'}. Move or cancel those first.` };
  const { error } = await sb.from('staff').update({ active: false, online_bookable: false }).eq('id', id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/team'); revalidatePath('/calendar');
  return { notice: 'Team member removed' };
}
