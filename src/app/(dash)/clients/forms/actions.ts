'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx, friendly } from '@/lib/session';
import { sendCustomMessage } from '@/lib/notify';
import { mailP, mailButton } from '@/lib/email-layout';
import { ymd } from '@/lib/format';
import { ensureFormToken, formUrl, loadBooking, loadTemplates, rowsForBooking, saveForms } from '@/lib/forms';
import { niceDate, type FormInput } from '@/lib/forms-shared';

type Res = { error?: string; notice?: string; errors?: Record<string, Record<string, string>> };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const touch = () => { revalidatePath('/clients/forms'); revalidatePath('/calendar'); };

/** Emails the client their link to the forms that are still outstanding for this booking. */
export async function sendFormLinks(bookingId: string): Promise<Res> {
  const { sb, salon } = await requireCtx();
  const b = await loadBooking(sb, bookingId, salon.timezone);
  if (!b) return { error: 'That appointment no longer exists.' };
  if (['cancelled', 'no_show', 'completed'].includes(b.status)) return { error: 'That appointment is not coming up.' };
  const pend = (await rowsForBooking(sb, b, salon.timezone)).filter((r) => r.needed && r.tpl.how === 'client' && (r.state === 'missing' || r.state === 'expired'));
  if (!pend.length) return { error: 'Nothing is waiting for this client to fill in.' };
  if (!b.clientEmail) return { error: 'This client has no email address. Use Fill in at the salon, or add their email on their profile.' };
  const url = formUrl(await ensureFormToken(b.id, b.salonId, b.startsAt));
  const first = b.clientName.split(' ')[0];
  const names = pend.map((r) => r.tpl.name);
  const text = `Hi ${first}, before your visit please complete ${names.join(' and ')}. It takes about two minutes: ${url}`;
  const html = mailP(`Hi ${first},`) + mailP(`Before your visit, please complete: ${names.join(', ')}. It takes about two minutes.`) + mailButton('Complete your form', url);
  const r = await sendCustomMessage(salon.id, { email: b.clientEmail }, text, { subject: `Please complete your form before your visit to ${salon.name}`, heading: 'Please complete your form', html }, { label: 'Complete your form', url });
  if (!r.ok) return { error: r.error };
  return { notice: 'Link sent to ' + b.clientEmail };
}

/** Records a patch test: the day it was applied, what happened after 48 hours, and any notes. A reaction puts a warning on the appointment. */
export async function recordPatchTest(clientId: string, templateId: string, on: string, reaction: boolean, note: string): Promise<Res> {
  const { sb, salon, staff } = await requireCtx();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on) || isNaN(new Date(on + 'T00:00:00Z').getTime())) return { error: 'Pick the date the test was applied.' };
  const today = ymd(new Date(), salon.timezone);
  if (on > today) return { error: 'The date cannot be in the future.' };
  if (note.length > 300) return { error: 'Keep the notes under 300 characters.' };
  const tpl = (await loadTemplates(sb, salon.id)).find((t) => t.id === templateId && t.isPatch);
  if (!tpl) return { error: 'That patch test form no longer exists.' };
  const { data: cl } = await sb.from('clients').select('id').eq('id', clientId).maybeSingle();
  if (!cl) return { error: 'That client no longer exists.' };
  const answers = [{ q: 'Date applied', a: niceDate(on) }, { q: 'Result after 48 hours', a: reaction ? 'Reaction' : 'No reaction' }, { q: 'Notes', a: note.trim() || 'None' }, { q: 'Recorded by', a: staff.name }];
  const { error } = await sb.from('form_submissions').insert({ salon_id: salon.id, template_id: tpl.id, client_id: clientId, booking_id: null, answers, flagged: reaction, performed_on: on, recorded_by: staff.id });
  if (error) return { error: friendly(error.message) };
  await sb.from('clients').update({ patch_test_on: on }).eq('id', clientId);
  touch(); revalidatePath(`/clients/${clientId}`);
  return { notice: reaction ? 'Reaction recorded. A warning now shows on the appointment.' : 'Patch test saved.' };
}

/** A team member fills a form in with the client at the salon. */
export async function submitStaffForms(bookingId: string, inputs: { templateId: string; input: FormInput }[]): Promise<Res> {
  const { sb, salon, staff } = await requireCtx();
  if (!Array.isArray(inputs) || inputs.length > 10) return { error: 'Something went wrong. Please refresh and try again.' };
  const b = await loadBooking(sb, bookingId, salon.timezone);
  if (!b) return { error: 'That appointment no longer exists.' };
  const rows = await rowsForBooking(sb, b, salon.timezone);
  const allowed = rows.filter((r) => r.needed && !r.tpl.isPatch && (r.state === 'missing' || r.state === 'expired')).map((r) => r.tpl);
  return saveForms(sb, { salonId: salon.id, clientId: b.clientId, bookingId: b.id, recordedBy: staff.id, allowed, inputs });
}
