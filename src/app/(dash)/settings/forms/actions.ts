'use server';
import { revalidatePath } from 'next/cache';
import { requireOwner, friendly } from '@/lib/session';
import { STARTERS, QTYPES, VALID_OPTS, type How, type Miss, type QType } from '@/lib/forms-shared';

type Res = { error?: string; notice?: string; id?: string };
export type FormQIn = { id: string; label: string; type: QType; required: boolean; options: string[]; detailPrompt: string };
export type FormIn = { id: string | null; name: string; catIds: string[]; validMonths: number; how: How; miss: Miss; consentText: string; askPhotos: boolean; isPatch: boolean; questions: FormQIn[] };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Create or update one form: its settings, the service categories it is needed for, and its questions in order. */
export async function saveForm(i: FormIn): Promise<Res> {
  const { sb, salon } = await requireOwner();
  const name = String(i.name ?? '').trim();
  if (!name) return { error: 'Give this form a name.' };
  if (name.length > 80) return { error: 'Keep the form name under 80 characters.' };
  if (!Array.isArray(i.catIds) || !i.catIds.length) return { error: 'Pick at least one kind of service this form is for.' };
  if (!VALID_OPTS.some((v) => v[0] === i.validMonths)) return { error: 'Choose how long the form stays valid.' };
  if (!['client', 'salon', 'staff'].includes(i.how) || !['warn', 'ask'].includes(i.miss)) return { error: 'Something is not right with this form. Please refresh and try again.' };
  const staff = i.how === 'staff';
  const consent = staff ? '' : String(i.consentText ?? '').trim();
  if (consent.length > 1000) return { error: 'Keep the consent statement under 1000 characters.' };
  const qs = Array.isArray(i.questions) ? i.questions : [];
  if (qs.length > 40) return { error: 'A form can have up to 40 questions.' };
  if (!qs.length && !consent) return { error: 'Add at least one question.' };
  const clean: { id: string | null; label: string; type: QType; required: boolean; options: string[]; detail: string | null }[] = [];
  for (let n = 0; n < qs.length; n++) {
    const q = qs[n]; const label = String(q.label ?? '').trim();
    if (!label) return { error: `Question ${n + 1} needs some text.` };
    if (label.length > 200) return { error: `Question ${n + 1} is too long.` };
    if (!QTYPES.some((t) => t[0] === q.type)) return { error: `Question ${n + 1} has an unknown answer type.` };
    let options: string[] = [];
    if (q.type === 'one' || q.type === 'many') {
      options = [...new Set((q.options ?? []).map((o) => String(o).trim()).filter(Boolean))];
      if (options.length < 2) return { error: `"${label}" needs at least two options, separated by commas.` };
      if (options.length > 20 || options.some((o) => o.length > 80)) return { error: `"${label}" has too many or too long options.` };
    }
    const detail = q.type === 'yesno' ? String(q.detailPrompt ?? '').trim().slice(0, 120) || null : null;
    clean.push({ id: UUID.test(q.id) ? q.id : null, label, type: q.type, required: !!q.required, options, detail });
  }
  const { data: cats } = await sb.from('service_categories').select('id').eq('salon_id', salon.id).in('id', i.catIds);
  if ((cats ?? []).length !== new Set(i.catIds).size) return { error: 'One of the service categories no longer exists. Please refresh.' };
  const row = { name, valid_months: i.validMonths, how: i.how, miss: staff && i.miss === 'ask' ? 'warn' : i.miss, consent_text: consent || null, ask_photos: staff ? false : !!i.askPhotos, is_patch_test: staff && !!i.isPatch };
  let id = i.id;
  if (id) {
    const { data: ex } = await sb.from('form_templates').select('id').eq('id', id).eq('salon_id', salon.id).maybeSingle();
    if (!ex) return { error: 'That form no longer exists.' };
    const { error } = await sb.from('form_templates').update(row).eq('id', id);
    if (error) return { error: friendly(error.message) };
  } else {
    const { data: last } = await sb.from('form_templates').select('sort').eq('salon_id', salon.id).order('sort', { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await sb.from('form_templates').insert({ ...row, salon_id: salon.id, sort: (last?.sort ?? 0) + 1 }).select('id').single();
    if (error) return { error: friendly(error.message) };
    id = data.id;
  }
  await sb.from('form_template_categories').delete().eq('template_id', id!);
  const c = await sb.from('form_template_categories').insert([...new Set(i.catIds)].map((category_id) => ({ template_id: id!, category_id })));
  if (c.error) return { error: friendly(c.error.message) };
  const { data: cur } = await sb.from('form_questions').select('id').eq('template_id', id!);
  const have = new Set((cur ?? []).map((x: any) => x.id as string)), keep = new Set(clean.filter((q) => q.id && have.has(q.id)).map((q) => q.id!));
  const drop = [...have].filter((x) => !keep.has(x));
  if (drop.length) await sb.from('form_questions').delete().eq('template_id', id!).in('id', drop);
  for (let n = 0; n < clean.length; n++) {
    const q = clean[n]; const body = { template_id: id!, label: q.label, qtype: q.type, required: q.required, options: q.options, detail_prompt: q.detail, sort: n };
    const r = q.id && have.has(q.id) ? await sb.from('form_questions').update(body).eq('id', q.id) : await sb.from('form_questions').insert(body);
    if (r.error) return { error: friendly(r.error.message) };
  }
  revalidatePath('/settings/forms'); revalidatePath('/calendar'); revalidatePath('/clients/forms');
  return { id: id!, notice: 'Saved. It applies to new and existing bookings from now on.' };
}

/** Removes a form from use. Answers clients already gave stay on file. */
export async function deleteForm(id: string): Promise<Res> {
  const { sb, salon } = await requireOwner();
  const { data, error } = await sb.from('form_templates').update({ active: false }).eq('id', id).eq('salon_id', salon.id).select('id');
  if (error) return { error: friendly(error.message) };
  if (!data?.length) return { error: 'That form no longer exists.' };
  revalidatePath('/settings/forms'); revalidatePath('/calendar'); revalidatePath('/clients/forms');
  return { notice: 'Form deleted' };
}

/** Adds one of the ready-made forms, needed for every service category to start with. */
export async function addStarter(key: string): Promise<Res> {
  const { sb, salon } = await requireOwner();
  const s = STARTERS.find((x) => x.key === key);
  if (!s) return { error: 'Unknown form.' };
  const { data: cats } = await sb.from('service_categories').select('id').eq('salon_id', salon.id);
  if (!cats?.length) return { error: 'Add a service category first, under Services.' };
  return saveForm({ id: null, name: s.name, catIds: cats.map((c: any) => c.id), validMonths: s.validMonths, how: s.how, miss: s.miss, consentText: s.consentText ?? '', askPhotos: s.askPhotos, isPatch: s.isPatch,
    questions: s.qs.map((q) => ({ id: '', label: q.label, type: q.type, required: q.required, options: q.options, detailPrompt: q.detailPrompt ?? '' })) });
}
