'use server';
import { revalidatePath } from 'next/cache';
import { requireOwner, friendly } from '@/lib/session';

export type SvcInput = { id?: string; name: string; categoryId: string; dur: number; price: string; desc: string; online: boolean; staffIds: string[]; addon: boolean; parentIds: string[] };

export async function addCategory(name: string): Promise<{ error?: string; id?: string; name?: string }> {
  const { sb, salon } = await requireOwner();
  const n = name.trim(); if (!n) return { error: 'Enter a category name.' };
  const { data: last } = await sb.from('service_categories').select('sort').order('sort', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await sb.from('service_categories').insert({ salon_id: salon.id, name: n, sort: (last?.sort ?? 0) + 1 }).select('id,name').single();
  if (error) return { error: error.code === '23505' ? 'That category already exists.' : friendly(error.message) };
  revalidatePath('/services'); return { id: data.id, name: data.name };
}

export async function saveService(i: SvcInput): Promise<{ error?: string; id?: string; created?: boolean }> {
  const { sb, salon } = await requireOwner();
  const name = i.name.trim();
  const price = parseFloat(i.price);
  if (!name) return { error: 'Give the service a name.' };
  if (isNaN(price) || price < 0) return { error: 'Enter a price, like 45 or 45.50.' };
  // An add-on has no category of its own: it sits with the first service it is offered with.
  let categoryId = i.categoryId;
  if (i.addon) {
    const { data: par } = await sb.from('services').select('category_id').eq('id', i.parentIds[0] ?? '').maybeSingle();
    if (par?.category_id) categoryId = par.category_id;
  }
  if (!categoryId) return { error: 'Choose a category.' };
  if (!(i.dur > 0)) return { error: 'Choose how long it takes.' };
  if (i.addon && !i.parentIds.length) return { error: 'Choose at least one service this add-on goes with.' };
  const row = { salon_id: salon.id, category_id: categoryId, name, description: i.desc.trim() || null, duration_min: i.dur, price_cents: Math.round(price * 100), online_bookable: i.online, is_addon: i.addon };
  let id = i.id;
  if (id) {
    const { error } = await sb.from('services').update(row).eq('id', id); if (error) return { error: friendly(error.message) };
  } else {
    const { data, error } = await sb.from('services').insert(row).select('id').single(); if (error) return { error: friendly(error.message) };
    id = data.id;
  }
  const { error: de } = await sb.from('service_staff').delete().eq('service_id', id!);
  if (de) return { error: friendly(de.message) };
  const { error: ae } = await sb.from('service_addons').delete().eq('addon_id', id!);
  if (ae) return { error: friendly(ae.message) };
  if (i.addon) {
    const parents = i.parentIds.filter((p) => p !== id);
    if (!parents.length) return { error: 'Choose at least one service this add-on goes with.' };
    const { error } = await sb.from('service_addons').insert(parents.map((service_id) => ({ addon_id: id!, service_id })));
    if (error) return { error: friendly(error.message) };
  } else if (i.staffIds.length) {
    const { error } = await sb.from('service_staff').insert(i.staffIds.map((staff_id) => ({ service_id: id!, staff_id })));
    if (error) return { error: friendly(error.message) };
  }
  revalidatePath('/services'); revalidatePath('/calendar');
  return { id, created: !i.id };
}

/** Removes a service. If past bookings or sales still use it, it is archived instead so history stays intact. */
export async function deleteService(id: string): Promise<{ error?: string; archived?: boolean }> {
  const { sb } = await requireOwner();
  const { error } = await sb.from('services').delete().eq('id', id);
  if (error) {
    const { error: e2 } = await sb.from('services').update({ active: false, online_bookable: false }).eq('id', id);
    if (e2) return { error: friendly(e2.message) };
    revalidatePath('/services'); revalidatePath('/calendar'); return { archived: true };
  }
  revalidatePath('/services'); revalidatePath('/calendar'); return {};
}
