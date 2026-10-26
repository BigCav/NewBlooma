import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ymd } from '@/lib/format';
import { checkForm, formRows, needsAttention, type FillForm, type FormInput, type FormRow, type Question, type Sub, type Tpl } from '@/lib/forms-shared';

type Sb = any;
export const formBase = () => process.env.NEXT_PUBLIC_APP_URL ?? '';
export const formUrl = (token: string) => `${formBase()}/form/${token}`;

export function toFill(t: Tpl): FillForm { return { id: t.id, name: t.name, consentText: t.consentText, askPhotos: t.askPhotos, questions: t.questions }; }

/** The salon's active forms with the service categories they apply to and their questions in order. */
export async function loadTemplates(sb: Sb, salonId: string): Promise<Tpl[]> {
  const { data } = await sb.from('form_templates')
    .select('id,name,valid_months,how,miss,consent_text,ask_photos,is_patch_test,sort,form_template_categories(category_id),form_questions(id,label,qtype,required,options,detail_prompt,sort)')
    .eq('salon_id', salonId).eq('active', true).order('sort').order('created_at');
  return (data ?? []).map((t: any) => ({
    id: t.id, name: t.name, validMonths: t.valid_months, how: t.how, miss: t.miss, consentText: t.consent_text, askPhotos: t.ask_photos, isPatch: t.is_patch_test, sort: t.sort,
    catIds: (t.form_template_categories ?? []).map((c: any) => c.category_id),
    questions: ((t.form_questions ?? []) as any[]).sort((a, b) => a.sort - b.sort).map((q): Question => ({ id: q.id, label: q.label, type: q.qtype, required: q.required, options: q.options ?? [], detailPrompt: q.detail_prompt })),
  }));
}

export async function loadSubs(sb: Sb, clientIds: string[]): Promise<Sub[]> {
  if (!clientIds.length) return [];
  const { data } = await sb.from('form_submissions').select('id,template_id,client_id,booking_id,answers,signed_name,flagged,performed_on,completed_at,recorded_by,bookings(starts_at,ref_no)').in('client_id', clientIds).order('completed_at', { ascending: false }).limit(2000);
  return ((data ?? []) as any[]).map(({ bookings, ...s }) => ({ ...s, booking_at: bookings?.starts_at ?? null, booking_ref: bookings?.ref_no ?? null })) as Sub[];
}

export type BookingInfo = { id: string; salonId: string; clientId: string; startsAt: string; status: string; dayYmd: string; catIds: string[]; services: string; staff: string; clientName: string; clientEmail: string | null };
export async function loadBooking(sb: Sb, bookingId: string, tz: string): Promise<BookingInfo | null> {
  const { data: b } = await sb.from('bookings').select('id,salon_id,client_id,starts_at,status,staff(name),clients(name,email),booking_services(services(name,category_id))').eq('id', bookingId).maybeSingle();
  if (!b) return null;
  const lines = ((b as any).booking_services ?? []) as any[];
  return { id: b.id, salonId: b.salon_id, clientId: b.client_id, startsAt: b.starts_at, status: b.status, dayYmd: ymd(b.starts_at, tz), catIds: [...new Set(lines.map((l) => l.services?.category_id).filter(Boolean))] as string[],
    services: lines.map((l) => l.services?.name).filter(Boolean).join(' + '), staff: (b as any).staff?.name ?? '', clientName: (b as any).clients?.name ?? 'Client', clientEmail: (b as any).clients?.email ?? null };
}

export async function rowsForBooking(sb: Sb, b: BookingInfo, tz: string, tpls?: Tpl[]): Promise<FormRow[]> {
  const [t, subs] = await Promise.all([tpls ? Promise.resolve(tpls) : loadTemplates(sb, b.salonId), loadSubs(sb, [b.clientId])]);
  return formRows(t, subs, { id: b.id, dayYmd: b.dayYmd, catIds: b.catIds }, tz, (iso, z) => ymd(iso, z));
}

/** Forms the client themselves still has to complete for this booking. */
export const clientPending = (rows: FormRow[]) => rows.filter((r) => r.needed && r.tpl.how === 'client' && (r.state === 'missing' || r.state === 'expired'));

/** The one link a client uses to complete everything outstanding for a booking. Created on first use, valid until the day after the appointment. */
export async function ensureFormToken(bookingId: string, salonId: string, startsAtIso: string): Promise<string> {
  const admin = supabaseAdmin();
  const { data: ex } = await admin.from('booking_tokens').select('token,expires_at').eq('booking_id', bookingId).eq('purpose', 'fill_form').maybeSingle();
  if (ex) return ex.token;
  const expires = new Date(new Date(startsAtIso).getTime() + 36 * 3600e3).toISOString();
  const { data, error } = await admin.from('booking_tokens').insert({ salon_id: salonId, purpose: 'fill_form', booking_id: bookingId, expires_at: expires }).select('token').single();
  if (error) { const { data: again } = await admin.from('booking_tokens').select('token').eq('booking_id', bookingId).eq('purpose', 'fill_form').maybeSingle(); if (again) return again.token; throw error; }
  return data.token;
}

/** What a booking still needs from the client, for emails and the booking confirmation. Null when nothing is outstanding. */
export async function outstandingForBooking(bookingId: string): Promise<{ names: string[]; askNames: string[]; url: string } | null> {
  const admin = supabaseAdmin();
  const { data: s } = await admin.from('bookings').select('salon_id,salons(timezone)').eq('id', bookingId).maybeSingle();
  if (!s) return null;
  const tz = (s as any).salons?.timezone ?? 'UTC';
  const b = await loadBooking(admin, bookingId, tz);
  if (!b || ['cancelled', 'no_show', 'completed'].includes(b.status)) return null;
  const pend = clientPending(await rowsForBooking(admin, b, tz));
  if (!pend.length) return null;
  const token = await ensureFormToken(b.id, b.salonId, b.startsAt);
  return { names: pend.map((r) => r.tpl.name), askNames: pend.filter((r) => r.tpl.miss === 'ask').map((r) => r.tpl.name), url: formUrl(token) };
}

/** Validate and store filled-in forms. Only forms in `allowed` can be saved, and the questions come from the database, never from the browser. */
export async function saveForms(sb: Sb, p: { salonId: string; clientId: string; bookingId: string | null; recordedBy: string | null; allowed: Tpl[]; inputs: { templateId: string; input: FormInput }[] }): Promise<{ error?: string; errors?: Record<string, Record<string, string>> }> {
  if (!p.inputs.length) return { error: 'There is nothing to save.' };
  const rows: any[] = []; const errors: Record<string, Record<string, string>> = {};
  for (const i of p.inputs) {
    const tpl = p.allowed.find((t) => t.id === i.templateId);
    if (!tpl) return { error: 'One of these forms is no longer needed.' };
    const input: FormInput = { answers: i.input?.answers ?? {}, details: i.input?.details ?? {}, agree: !!i.input?.agree, photos: !!i.input?.photos, sign: String(i.input?.sign ?? '') };
    const r = checkForm(toFill(tpl), input);
    if (Object.keys(r.errors).length) { errors[tpl.id] = r.errors; continue; }
    rows.push({ salon_id: p.salonId, template_id: tpl.id, client_id: p.clientId, booking_id: p.bookingId, answers: r.answers, signed_name: tpl.consentText ? input.sign.trim() : null, photos_ok: tpl.askPhotos ? input.photos : null, recorded_by: p.recordedBy });
  }
  if (Object.keys(errors).length) return { error: 'Check the highlighted answers.', errors };
  const { error } = await sb.from('form_submissions').insert(rows);
  if (error) return { error: 'Could not save your form. Please try again.' };
  return {};
}

export { needsAttention };
