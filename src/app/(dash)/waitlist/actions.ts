'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx, friendly } from '@/lib/session';

export async function addEntry(_: unknown, fd: FormData) {
  const { sb, salon } = await requireCtx();
  const client = String(fd.get('client_id') ?? ''), service = String(fd.get('service_id') ?? '');
  if (!client || !service) return { error: 'Choose a client and a service.' };
  const days = fd.getAll('day').map(Number); if (!days.length) return { error: 'Choose at least one day.' };
  const from = String(fd.get('earliest') ?? '') || null, to = String(fd.get('latest') ?? '') || null;
  if (from && to && to <= from) return { error: 'Latest time must be after earliest.' };
  const { error } = await sb.from('waitlist_entries').insert({ salon_id: salon.id, client_id: client, service_id: service, staff_id: String(fd.get('staff_id') ?? '') || null, weekdays: days, earliest_time: from, latest_time: to });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/waitlist'); return { ok: 'Added to the waitlist.' };
}
export async function offerSlot(fd: FormData) {
  const { sb } = await requireCtx();
  const [staff, start] = String(fd.get('slot')).split('|');
  const { error } = await sb.rpc('offer_waitlist_slot', { p_entry: String(fd.get('id')), p_staff: staff, p_start: start });
  revalidatePath('/waitlist');
  if (error) return;
}
export async function removeEntry(fd: FormData) {
  const { sb } = await requireCtx();
  await sb.from('waitlist_entries').update({ status: 'removed', offered_staff_id: null, offered_start: null, offer_expires_at: null }).eq('id', String(fd.get('id')));
  revalidatePath('/waitlist');
}
