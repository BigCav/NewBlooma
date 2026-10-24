'use server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { allow, clientIp } from '@/lib/rate-limit';
import { clientPending, loadBooking, rowsForBooking, saveForms } from '@/lib/forms';
import type { FormInput } from '@/lib/forms-shared';

/** A client completes the forms on their link. Only forms still outstanding for that booking can be saved. */
export async function submitPublicForms(token: string, inputs: { templateId: string; input: FormInput }[]): Promise<{ error?: string; errors?: Record<string, Record<string, string>> }> {
  if (!Array.isArray(inputs) || inputs.length > 10) return { error: 'Something went wrong. Please refresh and try again.' };
  if (!(await allow('form:' + (await clientIp()), 20, 3600))) return { error: 'Too many attempts from here for now. Please try again later.' };
  const sb = supabaseAdmin();
  const { data: t } = await sb.from('booking_tokens').select('booking_id,salon_id,expires_at').eq('token', token).eq('purpose', 'fill_form').maybeSingle();
  if (!t || !t.booking_id || new Date(t.expires_at) < new Date()) return { error: 'This link has expired.' };
  const { data: salon } = await sb.from('salons').select('timezone').eq('id', t.salon_id).single();
  const tz = salon?.timezone ?? 'UTC';
  const b = await loadBooking(sb, t.booking_id, tz);
  if (!b || ['cancelled', 'no_show'].includes(b.status)) return { error: 'This appointment is no longer booked.' };
  const pend = clientPending(await rowsForBooking(sb, b, tz));
  if (!pend.length) return { error: 'Your forms are already complete.' };
  if (inputs.length !== pend.length || pend.some((r) => !inputs.some((i) => i.templateId === r.tpl.id))) return { error: 'The forms have changed. Please refresh the page.' };
  const r = await saveForms(sb, { salonId: b.salonId, clientId: b.clientId, bookingId: b.id, recordedBy: null, allowed: pend.map((x) => x.tpl), inputs });
  if (!r.error) { revalidatePath('/calendar'); revalidatePath('/clients/forms'); }
  return r;
}
