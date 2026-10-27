'use server';
import { flushOutbox } from '@/lib/notify';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { allow, clientIp } from '@/lib/rate-limit';
import { minutesOfDay } from '@/lib/format';
import { CANCEL_HOURS, policyInfo } from './shared';

async function load(token: string) {
  const sb = supabaseAdmin();
  const { data: t } = await sb.from('booking_tokens').select('booking_id,expires_at').eq('token', token).eq('purpose', 'manage_booking').maybeSingle();
  if (!t || new Date(t.expires_at) < new Date()) return null;
  const { data: b } = await sb.from('bookings').select('id,salon_id,staff_id,status,starts_at,booking_services(service_id)').eq('id', t.booking_id!).single();
  return b ? { sb, b } : null;
}

/** Open start times on one day for moving this appointment (the appointment's own slot counts as free). */
export async function manageSlots(token: string, date: string): Promise<{ slots: { iso: string; min: number }[]; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { slots: [] };
  if (!(await allow('mslots:' + (await clientIp()), 240, 600))) return { slots: [], error: 'Too many requests from here for now. Please try again in a few minutes.' };
  const l = await load(token); if (!l) return { slots: [], error: 'This link has expired.' };
  const { sb, b } = l;
  const { data: salon } = await sb.from('salons').select('timezone').eq('id', b.salon_id).single();
  const { data, error } = await sb.rpc('available_slots_excluding', { p_salon: b.salon_id, p_service_ids: (b.booking_services as any[]).map((x) => x.service_id), p_staff: b.staff_id, p_from: date, p_to: date, p_mode: 'public', p_step: 15, p_exclude: b.id });
  if (error) return { slots: [], error: 'Could not load times. Please try again.' };
  return { slots: (data ?? []).map((r: any) => ({ iso: r.starts_at as string, min: minutesOfDay(r.starts_at, salon!.timezone) })) };
}

export async function moveBooking(token: string, startsAtIso: string): Promise<{ error?: string; free?: boolean; deadline?: string }> {
  if (!(await allow('move:' + (await clientIp()), 30, 3600))) return { error: 'Too many changes from here for now. Please try again later.' };
  const l = await load(token); if (!l) return { error: 'This link has expired.' };
  const { sb, b } = l;
  const { error } = await sb.rpc('client_reschedule', { p_token: token, p_starts_at: startsAtIso });
  if (error) return { error: error.message.includes('slot_unavailable') ? 'That time is no longer free. Pick another.' : error.message.includes('not_reschedulable') ? 'This appointment can no longer be changed.' : 'Could not move your appointment. Please try again.' };
  const [{ data: salon }, { data: st }] = await Promise.all([sb.from('salons').select('timezone').eq('id', b.salon_id).single(), sb.from('salon_settings').select('free_cancel_before').eq('salon_id', b.salon_id).single()]);
  revalidatePath(`/manage/${token}`);
  return policyInfo(startsAtIso, salon!.timezone, CANCEL_HOURS[st!.free_cancel_before] ?? 24);
}

export async function cancelBooking(token: string, reason: string): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin().rpc('client_cancel', { p_token: token, p_reason: reason.slice(0, 200) });
  if (error) return { error: error.message.includes('not_cancellable') ? 'This appointment can no longer be cancelled.' : 'This link has expired.' };
  await flushOutbox();
  revalidatePath(`/manage/${token}`);
  return {};
}
