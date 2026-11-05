'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx, friendly } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { allow } from '@/lib/rate-limit';
import { emailConfigured, flushOutbox, sendRendered, smsConfigured } from '@/lib/notify';
import { renderMarketing } from '@/lib/marketing';
import { AUDIENCES, BROADCAST_MAX, SUBJECT_MAX, TEXT_MAX, type AudienceKind } from '@/lib/marketing-shared';
import { firstName } from '@/lib/people';
import { plural } from '@/lib/display';
import { ymd } from '@/lib/format';

type Res = { error?: string; notice?: string };
export type AudienceInput = { kind: AudienceKind; n: number; service: string | null };
export type AudiencePreview = { total: number; agreed: number; reach: number; names: string[]; error?: string };

/** Everything here is the owner's. The check is repeated in every action because a server action can be called without its screen. */
async function owner() {
  const c = await requireCtx();
  if (c.staff.app_role !== 'owner') return null;
  return c;
}
const NO = { error: 'Only the owner can send marketing messages.' };

const WEEK_CHOICES = new Set([4, 6, 8, 12, 16, 26]);

export async function saveAutomation(i: { winbackOn: boolean; winbackWeeks: number; winbackText: string; birthdayOn: boolean; birthdayText: string }): Promise<Res> {
  const c = await owner(); if (!c) return NO;
  const winback = i.winbackText.trim(), birthday = i.birthdayText.trim();
  if (!winback || !birthday) return { error: 'Write a message for each one, even if one is switched off.' };
  if (winback.length > TEXT_MAX || birthday.length > TEXT_MAX) return { error: `Keep each message under ${TEXT_MAX} characters.` };
  if (!WEEK_CHOICES.has(i.winbackWeeks)) return { error: 'Choose how long since their last visit.' };
  const { error } = await c.sb.from('marketing_settings').upsert({
    salon_id: c.salon.id, winback_on: i.winbackOn, winback_weeks: i.winbackWeeks, winback_text: winback, birthday_on: i.birthdayOn, birthday_text: birthday, updated_at: new Date().toISOString(),
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/marketing');
  return { notice: 'Saved' };
}

/** The clients a group message would reach, worked out here from the database, never from a list sent by the screen. */
async function reachable(c: Awaited<ReturnType<typeof requireCtx>>, a: AudienceInput) {
  const def = AUDIENCES.find((x) => x.id === a.kind);
  if (!def) return { error: 'Choose who to message.' } as const;
  if (def.n && !def.n.options.some(([v]) => v === a.n)) return { error: 'Choose a valid time.' } as const;
  if (a.kind === 'service' && !/^[0-9a-f-]{36}$/i.test(a.service ?? '')) return { error: 'Choose a service.' } as const;
  const n = a.kind === 'birthday' ? Number(ymd(new Date(), c.salon.timezone).slice(5, 7)) : def.n ? a.n : 0;
  const { data, error } = await c.sb.rpc('marketing_audience', { p_kind: a.kind, p_n: n, p_service: a.kind === 'service' ? a.service : null });
  if (error) return { error: friendly(error.message) } as const;
  const rows = (data ?? []) as { id: string; name: string; email: string | null; phone: string | null; agreed: boolean }[];
  const sms = smsConfigured();
  const reach = rows.filter((r) => r.agreed && (r.email || (sms && r.phone)));
  return { rows, reach } as const;
}

export async function previewAudience(a: AudienceInput): Promise<AudiencePreview> {
  const c = await owner(); if (!c) return { total: 0, agreed: 0, reach: 0, names: [], error: NO.error };
  const r = await reachable(c, a);
  if ('error' in r) return { total: 0, agreed: 0, reach: 0, names: [], error: r.error };
  return { total: r.rows.length, agreed: r.rows.filter((x) => x.agreed).length, reach: r.reach.length, names: r.reach.slice(0, 8).map((x) => x.name) };
}

const check = (subject: string, text: string): string | null => {
  if (!subject.trim()) return 'Add a subject.';
  if (!text.trim()) return 'Write the message.';
  if (subject.trim().length > SUBJECT_MAX) return `Keep the subject under ${SUBJECT_MAX} characters.`;
  if (text.trim().length > TEXT_MAX) return `Keep the message under ${TEXT_MAX} characters.`;
  return null;
};

/** Queues one email (or text) per client who agreed, then sends what it can straight away; the rest goes out with the next scheduled run. */
export async function sendBroadcast(a: AudienceInput, subject: string, text: string): Promise<Res> {
  const c = await owner(); if (!c) return NO;
  const bad = check(subject, text); if (bad) return { error: bad };
  if (!emailConfigured() && !smsConfigured()) return { error: 'Messaging is not set up yet. Add the Resend or Twilio keys to send.' };
  if (!(await allow('broadcast:' + c.salon.id, 6, 3600))) return { error: 'You have sent several messages in the last hour. Try again a little later.' };
  const r = await reachable(c, a);
  if ('error' in r) return { error: r.error };
  const admin = supabaseAdmin();
  // Anyone who was sent a group message in the last few minutes is left out, so a double tap cannot send twice.
  const since = new Date(Date.now() - 5 * 60e3).toISOString();
  const { data: recent } = await admin.from('marketing_log').select('client_id').eq('salon_id', c.salon.id).eq('kind', 'broadcast').gte('created_at', since);
  const skip = new Set((recent ?? []).map((x) => x.client_id as string));
  const rows = r.reach.filter((x) => !skip.has(x.id)).slice(0, BROADCAST_MAX);
  if (!rows.length) return { error: r.reach.length ? 'These clients were just sent a message.' : 'Nobody in this group has agreed to marketing messages yet.' };
  const sms = smsConfigured();
  const out = rows.map((x) => ({ salon_id: c.salon.id, channel: x.email ? 'email' : 'sms', to_address: (x.email ?? x.phone)!, template: 'broadcast', payload: { client_id: x.id, subject: subject.trim(), text: text.trim() } }))
    .filter((x) => x.channel === 'email' ? emailConfigured() : sms);
  if (!out.length) return { error: 'None of these clients can be reached with the messaging that is set up.' };
  const ins = await admin.from('notifications_outbox').insert(out);
  if (ins.error) return { error: 'The messages could not be queued. Please try again.' };
  await admin.from('marketing_log').insert(rows.map((x) => ({ salon_id: c.salon.id, client_id: x.id, kind: 'broadcast' })));
  await flushOutbox();
  revalidatePath('/marketing');
  return { notice: `Sending to ${plural(out.length, 'client')}` };
}

/** One copy to the owner's own sign-in email, so they see exactly what a client will see. */
export async function sendTest(kind: 'broadcast' | 'winback' | 'birthday', subject: string, text: string): Promise<Res> {
  const c = await owner(); if (!c) return NO;
  const bad = check(subject, text); if (bad) return { error: bad };
  if (!emailConfigured()) return { error: 'Email is not set up yet. Add the Resend key to send.' };
  if (!(await allow('mk-test:' + c.staff.id, 10, 3600))) return { error: 'That is a lot of tests. Try again a little later.' };
  const { data: u } = await c.sb.auth.getUser();
  const to = u.user?.email;
  if (!to) return { error: 'Your account has no email address to send the test to.' };
  const { data: salon } = await c.sb.from('salons').select('name,phone,slug').eq('id', c.salon.id).single();
  if (!salon) return { error: 'Salon not found.' };
  const heading = kind === 'winback' ? 'We miss you' : kind === 'birthday' ? 'Happy birthday' : subject.trim();
  const m = renderMarketing({ salon, subject: `[Test] ${subject.trim()}`, heading, body: text.trim(), first: firstName(c.staff.name), unsubUrl: null, test: true });
  const r = await sendRendered(c.salon.id, to, m);
  return r.ok ? { notice: `Test sent to ${to}` } : { error: r.error };
}
