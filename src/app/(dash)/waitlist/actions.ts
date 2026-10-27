'use server';
import { clock12 } from '@/lib/display';
import { revalidatePath } from 'next/cache';
import { requireCtx, friendly } from '@/lib/session';
import { minutesOfDay, ymd, zonedToUtc } from '@/lib/format';
import { dayInfo } from '@/lib/cal';
import { processOutbox } from '@/lib/notify';
import type { WlSlot } from './shared';

type R = { error?: string; ok?: boolean; notice?: string };
const first = (n?: string | null) => String(n ?? 'Client').split(' ')[0];
const clock = clock12;

export async function findTimes(entryId: string): Promise<{ error?: string; slots?: WlSlot[] }> {
  const { sb, salon } = await requireCtx();
  const [{ data, error }, { data: team }] = await Promise.all([sb.rpc('waitlist_matches', { p_entry: entryId }), sb.from('staff').select('id,name')]);
  if (error) return { error: friendly(error.message) };
  const slots = ((data ?? []) as any[]).slice(0, 6).map((m) => ({
    staffId: m.staff_id as string, startsAt: m.starts_at as string,
    label: `${dayInfo(ymd(m.starts_at, salon.timezone)).short}, ${clock(minutesOfDay(m.starts_at, salon.timezone))} with ${first((team ?? []).find((t) => t.id === m.staff_id)?.name)}`,
  }));
  return { slots };
}

export async function addToWaitlist(name: string, clientId: string | null, serviceId: string | null, staffId: string | null, dayPref: string, win: string): Promise<R & { id?: string }> {
  const { sb, salon, staff } = await requireCtx();
  name = name.trim();
  if (!name) return { error: "Add the client's name." };
  if (!serviceId) return { error: 'Choose a service.' };
  const weekdays = dayPref === 'weekdays' ? [0, 1, 2, 3, 4] : dayPref === 'sat' ? [5] : [0, 1, 2, 3, 4, 5, 6];
  let cid = clientId;
  if (!cid) { const { data, error } = await sb.from('clients').insert({ salon_id: salon.id, name }).select('id').single(); if (error) return { error: friendly(error.message) }; cid = data.id; }
  const { data, error } = await sb.from('waitlist_entries').insert({
    salon_id: salon.id, client_id: cid, service_id: serviceId, staff_id: staffId || null, weekdays,
    earliest_time: win === 'pm' ? '12:00' : null, latest_time: win === 'am' ? '12:00' : null, added_by: staff.id,
  }).select('id').single();
  if (error) return { error: error.code === '23505' ? 'They are already on the waitlist for that service.' : friendly(error.message) };
  revalidatePath('/waitlist');
  return { ok: true, id: data.id, notice: `${first(name)} added to the waitlist` };
}

export async function offerTime(entryId: string, staffId: string, startsAt: string): Promise<R> {
  const { sb } = await requireCtx();
  const { data: e } = await sb.from('waitlist_entries').select('clients(name,email,phone)').eq('id', entryId).maybeSingle();
  const { error } = await sb.rpc('offer_waitlist_slot', { p_entry: entryId, p_staff: staffId, p_start: startsAt });
  if (error) return { error: error.message.includes('client_unreachable') ? 'This client has no email or phone, so there is nowhere to send the offer.' : error.message.includes('slot_unavailable') ? 'That time has just been taken. Find another.' : friendly(error.message) };
  try { await processOutbox(20); } catch {}
  revalidatePath('/waitlist');
  return { ok: true, notice: `Offer sent to ${first((e as any)?.clients?.name)}` };
}

export async function bookEntry(entryId: string, slot?: { staffId: string; startsAt: string }): Promise<R> {
  const { sb, salon } = await requireCtx();
  const { data: e } = await sb.from('waitlist_entries').select('status,client_id,service_id,offered_staff_id,offered_start,clients(name)').eq('id', entryId).maybeSingle();
  if (!e || !['waiting', 'offered'].includes(e.status)) return { error: 'This entry is no longer waiting.' };
  const staffId = slot?.staffId ?? e.offered_staff_id, at = slot?.startsAt ?? e.offered_start;
  if (!staffId || !at) return { error: 'Choose a time first.' };
  const { data: bid, error } = await sb.rpc('create_booking', { p_salon: salon.id, p_client: e.client_id, p_staff: staffId, p_starts_at: at, p_service_ids: [e.service_id], p_source: 'waitlist', p_notes: null, p_mode: 'offer' });
  if (error) return { error: friendly(error.message) };
  await sb.from('waitlist_entries').update({ status: 'booked', booking_id: bid as string, offered_staff_id: null, offered_start: null, offer_expires_at: null }).eq('id', entryId);
  await sb.from('booking_tokens').update({ used_at: new Date().toISOString() }).eq('waitlist_id', entryId).eq('purpose', 'accept_offer').is('used_at', null);
  revalidatePath('/waitlist'); revalidatePath('/calendar');
  return { ok: true, notice: `${first((e as any).clients?.name)} booked` };
}

export async function removeEntry(entryId: string): Promise<R> {
  const { sb } = await requireCtx();
  const { data: e } = await sb.from('waitlist_entries').select('clients(name)').eq('id', entryId).maybeSingle();
  const { error } = await sb.from('waitlist_entries').update({ status: 'removed', offered_staff_id: null, offered_start: null, offer_expires_at: null }).eq('id', entryId);
  if (error) return { error: friendly(error.message) };
  await sb.from('booking_tokens').update({ used_at: new Date().toISOString() }).eq('waitlist_id', entryId).eq('purpose', 'accept_offer').is('used_at', null);
  revalidatePath('/waitlist');
  return { ok: true, notice: `${first((e as any)?.clients?.name)} removed from the waitlist` };
}
