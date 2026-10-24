// Client forms: types and rules shared by the browser (so mistakes show as people type) and the server (which never trusts the browser).

export type QType = 'short' | 'yesno' | 'one' | 'many' | 'long';
export const QTYPES: [QType, string][] = [['short', 'Short answer'], ['yesno', 'Yes or no'], ['one', 'Choose one'], ['many', 'Tick all that apply'], ['long', 'Long answer']];
export const VALID_OPTS: [number, string][] = [[3, '3 months'], [6, '6 months'], [12, '12 months'], [0, 'Every visit']];
export const HOW_OPTS: [How, string][] = [['client', 'Client fills it in'], ['salon', 'Filled in at the salon'], ['staff', 'Staff record it']];
export type How = 'client' | 'salon' | 'staff';
export type Miss = 'warn' | 'ask';

export type Question = { id: string; label: string; type: QType; required: boolean; options: string[]; detailPrompt: string | null };
/** One form as a client or staff member fills it in. */
export type FillForm = { id: string; name: string; consentText: string | null; askPhotos: boolean; questions: Question[] };
export type FormInput = { answers: Record<string, string | string[]>; details: Record<string, string>; agree: boolean; photos: boolean; sign: string };
export type Answer = { q: string; a: string };

export const SHORT_MAX = 200, LONG_MAX = 2000;
const noneLike = (s: string) => /^none\b/i.test(s.trim());
/** "None of these" clears every other tick, and ticking anything else clears "None of these". */
export function tickMany(cur: string[], opt: string): string[] {
  if (cur.includes(opt)) return cur.filter((x) => x !== opt);
  return noneLike(opt) ? [opt] : cur.filter((x) => !noneLike(x)).concat(opt);
}

/** Checks one filled-in form. Returns an error per question id (plus 'agree' and 'sign') and the answers as the client saw them. */
export function checkForm(f: FillForm, inp: FormInput): { errors: Record<string, string>; answers: Answer[] } {
  const errors: Record<string, string> = {}; const out: Answer[] = [];
  for (const q of f.questions) {
    const v = inp.answers[q.id];
    let a = '';
    if (q.type === 'short' || q.type === 'long') {
      a = typeof v === 'string' ? v.trim() : '';
      if (a.length > (q.type === 'short' ? SHORT_MAX : LONG_MAX)) errors[q.id] = 'That answer is too long.';
      else if (q.required && !a) errors[q.id] = 'Answer this question.';
    } else if (q.type === 'yesno') {
      if (v !== 'yes' && v !== 'no') { if (q.required) errors[q.id] = 'Choose yes or no.'; }
      else if (v === 'no') a = 'No';
      else {
        const d = (inp.details[q.id] ?? '').trim();
        if (q.detailPrompt && !d) errors[q.id] = 'Tell us a little more.';
        else if (d.length > SHORT_MAX) errors[q.id] = 'That answer is too long.';
        else a = d ? 'Yes: ' + d : 'Yes';
      }
    } else if (q.type === 'one') {
      if (typeof v === 'string' && v && q.options.includes(v)) a = v;
      else if (q.required) errors[q.id] = 'Choose one.';
    } else {
      const arr = Array.isArray(v) ? v.filter((x) => q.options.includes(x)) : [];
      a = arr.join(', ');
      if (q.required && !arr.length) errors[q.id] = 'Choose at least one.';
    }
    out.push({ q: q.label, a });
  }
  if (f.consentText) {
    if (!inp.agree) errors.agree = 'Tick the box to confirm.';
    const s = inp.sign.trim();
    if (s.length < 2) errors.sign = 'Type your full name to sign.';
    else if (s.length > 80) errors.sign = 'That name is too long.';
    out.push({ q: 'Consent', a: inp.agree ? 'Agreed' : 'Not agreed' });
  }
  if (f.askPhotos) out.push({ q: 'Photos allowed', a: inp.photos ? 'Yes' : 'No' });
  if (f.consentText) out.push({ q: 'Signed', a: inp.sign.trim() });
  return { errors, answers: out };
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Add whole months to a YYYY-MM-DD date; 31 Aug plus 6 months lands on the last day of February, never in March. */
export function addMonthsYmd(d: string, n: number): string {
  const [y, m, day] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(Math.min(day, last))}`;
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const niceDate = (d: string) => { const [y, m, day] = d.split('-').map(Number); return `${day} ${MON[m - 1]} ${y}`; };

export type FormState = 'valid' | 'expired' | 'missing' | 'reaction' | 'na';
export type Sub = { id: string; template_id: string; client_id: string; booking_id: string | null; answers: Answer[]; signed_name: string | null; flagged: boolean; performed_on: string | null; completed_at: string; recorded_by: string | null };
export type Tpl = {
  id: string; name: string; validMonths: number; how: How; miss: Miss; consentText: string | null; askPhotos: boolean; isPatch: boolean; sort: number;
  catIds: string[]; questions: Question[];
};
export type FormRow = { tpl: Tpl; needed: boolean; state: FormState; doneOn: string | null; until: string | null; sub: Sub | null };

/**
 * Where one client stands on every form for one appointment.
 * A form is valid on the appointment day if it was done within its validity window; "every visit" forms only count when done for this booking.
 */
export function formRows(tpls: Tpl[], subs: Sub[], booking: { id: string; dayYmd: string; catIds: string[] }, tz: string, dayOf: (iso: string, tz: string) => string): FormRow[] {
  return tpls.map((tpl) => {
    const needed = tpl.catIds.some((c) => booking.catIds.includes(c));
    const latest = subs.filter((s) => s.template_id === tpl.id).sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0] ?? null;
    if (!latest) return { tpl, needed, state: needed ? 'missing' : 'na', doneOn: null, until: null, sub: null } as FormRow;
    const doneOn = latest.performed_on ?? dayOf(latest.completed_at, tz);
    const until = tpl.validMonths === 0 ? null : addMonthsYmd(doneOn, tpl.validMonths);
    const valid = tpl.validMonths === 0 ? latest.booking_id === booking.id : booking.dayYmd <= until!;
    const state: FormState = valid ? (latest.flagged ? 'reaction' : 'valid') : needed ? 'expired' : 'na';
    return { tpl, needed, state, doneOn, until, sub: latest };
  });
}
export const needsAttention = (r: FormRow) => r.needed && (r.state === 'missing' || r.state === 'expired' || r.state === 'reaction');

/** Ready-made forms an owner can add with one tap, then edit. */
export type Starter = { key: string; name: string; validMonths: number; how: How; miss: Miss; consentText: string | null; askPhotos: boolean; isPatch: boolean; qs: { label: string; type: QType; required: boolean; options: string[]; detailPrompt: string | null }[] };
export const STARTERS: Starter[] = [
  { key: 'consult', name: 'New client consultation', validMonths: 12, how: 'client', miss: 'warn', askPhotos: true, isPatch: false,
    consentText: 'I confirm the answers above are correct. I understand that hair colouring and other treatments carry a small risk of a reaction, and I will tell my stylist about any changes before my next visit.',
    qs: [
      { label: 'Do you have any allergies?', type: 'yesno', required: true, options: [], detailPrompt: 'What are you allergic to?' },
      { label: 'Any skin or scalp conditions?', type: 'many', required: false, options: ['Eczema', 'Psoriasis', 'Sensitive scalp', 'Dandruff or dry scalp', 'Hair loss or thinning', 'None of these'], detailPrompt: null },
      { label: 'Any chemical treatments in the last 6 months?', type: 'yesno', required: true, options: [], detailPrompt: null },
      { label: 'Anything else we should know?', type: 'long', required: false, options: [], detailPrompt: null },
    ] },
  { key: 'patch', name: 'Colour patch test', validMonths: 6, how: 'staff', miss: 'warn', consentText: null, askPhotos: false, isPatch: true,
    qs: [
      { label: 'Date applied', type: 'short', required: true, options: [], detailPrompt: null },
      { label: 'Result after 48 hours', type: 'one', required: true, options: ['No reaction', 'Reaction'], detailPrompt: null },
      { label: 'Notes', type: 'long', required: false, options: [], detailPrompt: null },
    ] },
  { key: 'consent', name: 'Treatment consent', validMonths: 12, how: 'client', miss: 'ask', askPhotos: false, isPatch: false,
    consentText: 'I understand that colouring, bleaching and other chemical treatments carry a small risk of a reaction. I will tell my stylist about any change to my health or products I use before each treatment.',
    qs: [] },
  { key: 'nails', name: 'Nail health check', validMonths: 12, how: 'client', miss: 'warn', consentText: null, askPhotos: false, isPatch: false,
    qs: [
      { label: 'Any nail or skin infections?', type: 'yesno', required: true, options: [], detailPrompt: 'Please describe' },
      { label: 'Do you have any allergies to nail products?', type: 'yesno', required: true, options: [], detailPrompt: 'What are you allergic to?' },
    ] },
];
