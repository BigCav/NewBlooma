'use server';
import { revalidatePath } from 'next/cache';
import { requireOwner, friendly } from '@/lib/session';
import { toCents } from '@/lib/format';

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function addCategory(_: unknown, fd: FormData) {
  const { sb, salon } = await requireOwner();
  const name = s(fd, 'name'); if (!name) return { error: 'Enter a category name.' };
  const { error } = await sb.from('service_categories').insert({ salon_id: salon.id, name });
  if (error) return { error: error.code === '23505' ? 'That category already exists.' : friendly(error.message) };
  revalidatePath('/services'); return { ok: 'Category added.' };
}

export async function saveService(_: unknown, fd: FormData) {
  const { sb, salon } = await requireOwner();
  const id = s(fd, 'id');
  const row = {
    salon_id: salon.id, category_id: s(fd, 'category_id'), name: s(fd, 'name'), description: s(fd, 'description') || null,
    duration_min: Number(fd.get('duration_min')), price_cents: toCents(fd.get('price')), online_bookable: fd.get('online_bookable') === 'on',
  };
  if (!row.name || !row.category_id) return { error: 'Name and category are required.' };
  if (!(row.duration_min > 0)) return { error: 'Duration must be more than 0 minutes.' };
  const staffIds = fd.getAll('staff').map(String);
  let sid = id;
  if (id) {
    const { error } = await sb.from('services').update(row).eq('id', id); if (error) return { error: friendly(error.message) };
  } else {
    const { data, error } = await sb.from('services').insert(row).select('id').single(); if (error) return { error: friendly(error.message) };
    sid = data.id;
  }
  await sb.from('service_staff').delete().eq('service_id', sid);
  if (staffIds.length) {
    const { error } = await sb.from('service_staff').insert(staffIds.map((staff_id) => ({ service_id: sid, staff_id })));
    if (error) return { error: friendly(error.message) };
  }
  revalidatePath('/services'); return { ok: id ? 'Service updated.' : 'Service added.' };
}

export async function archiveService(fd: FormData) {
  const { sb } = await requireOwner();
  await sb.from('services').update({ active: fd.get('active') === 'true' }).eq('id', String(fd.get('id')));
  revalidatePath('/services');
}
