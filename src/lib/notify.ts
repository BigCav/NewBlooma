import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { dateLong, time12 } from '@/lib/format';
import { outstandingForBooking } from '@/lib/forms';
import { mailShell, mailP, mailNote, mailButton, mailButtonPair, mailDetails, textDetails } from '@/lib/email-layout';

const base = () => process.env.NEXT_PUBLIC_APP_URL ?? '';

// Email goes through the "send-email" Supabase edge function (which holds the Resend key), or straight to Resend with RESEND_API_KEY only when Supabase is not configured.
const viaSupabase = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
export const emailConfigured = () => !!process.env.RESEND_API_KEY || viaSupabase();
/** EMAIL_FROM overrides the sender; otherwise mail goes out as "<Salon name> <bookings@blooma.co.nz>", an address already verified in Resend. */
const fromFor = (salonName: string) => process.env.EMAIL_FROM || `${salonName.replace(/[<>",]/g, '').trim() || 'Bookings'} <bookings@blooma.co.nz>`;
export const smsConfigured = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

type Row = { id: string; salon_id: string; booking_id: string | null; channel: 'email' | 'sms'; to_address: string; template: string; payload: any; attempts: number };

const footerFor = (salon: { name: string; phone?: string | null }) => `${salon.name}${salon.phone ? ` · ${salon.phone}` : ''}`;

async function compose(r: Row): Promise<{ subject: string; text: string; html: string; from: string } | null> {
  const sb = supabaseAdmin();
  const { data: salon } = await sb.from('salons').select('name,phone,timezone,slug').eq('id', r.salon_id).single();
  if (!salon) return null;
  let service = '', staffName = '', date = '', time = '', bref = '', clientName = '';
  let manage = '';
  if (r.booking_id) {
    const { data: b } = await sb.from('bookings').select('ref_no,starts_at,status,staff(name),clients(name,reminders),booking_services(services(name))').eq('id', r.booking_id).single();
    if (!b) return null;
    const cancelledTpl = r.template === 'booking_cancelled' || r.template === 'owner_booking_cancelled';
    if (!cancelledTpl && ['cancelled', 'no_show'].includes(b.status)) return null; // nothing to tell them
    if (cancelledTpl && b.status !== 'cancelled') return null; // it was reinstated
    if (r.template.startsWith('reminder') && (b as any).clients?.reminders === false) return null; // client turned reminders off
    bref = 'B-' + (b as any).ref_no;
    clientName = String((b as any).clients?.name ?? '');
    date = dateLong(b.starts_at, salon.timezone); time = time12(b.starts_at, salon.timezone);
    service = (b as any).booking_services.map((x: any) => x.services.name).join(', ');
    staffName = (b as any).staff?.name ?? '';
    const { data: t } = await sb.from('booking_tokens').select('token').eq('booking_id', r.booking_id).eq('purpose', 'manage_booking').maybeSingle();
    if (t) manage = `${base()}/manage/${t.token}`;
  }
  const first = clientName.split(' ')[0] || 'there';
  const visit: [string, string][] = [['Service', service], ['With', staffName], ['Date', date], ['Time', time], ['Booking', bref]];
  let subject = '', heading = '', intro = '', details: [string, string | null | undefined][] = visit, outro = '', link = manage, cta = 'View or change your appointment';
  switch (r.template) {
    case 'booking_confirmation': subject = `Booking confirmed at ${salon.name}`; heading = 'You are booked in'; intro = `Hi ${first}, your appointment is confirmed. Here are the details.`; break;
    case 'booking_cancelled': subject = `Your booking at ${salon.name} was cancelled`; heading = 'Appointment cancelled'; intro = `Hi ${first}, your appointment has been cancelled.`; outro = 'If this was a mistake, or you would like another time, you can book again online.'; link = `${base()}/b/${salon.slug}`; cta = 'Book again'; break;
    case 'owner_new_booking': subject = `New booking: ${clientName || 'a client'}`; heading = 'New online booking'; intro = `${clientName || 'A client'} booked online.`; details = [['Client', clientName], ...visit]; link = `${base()}/inbox`; cta = 'Open your inbox'; break;
    case 'owner_booking_cancelled': subject = `Cancellation: ${clientName || 'a client'}`; heading = 'Booking cancelled'; intro = `${clientName || 'A client'} cancelled their appointment.`; details = [['Client', clientName], ...visit]; link = `${base()}/calendar`; cta = 'Open your calendar'; break;
    case 'reminder_24h': subject = `Reminder: tomorrow at ${salon.name}`; heading = 'See you tomorrow'; intro = `Hi ${first}, just a reminder of your appointment.`; break;
    case 'reminder_2h': subject = `Reminder: today at ${salon.name}`; heading = 'See you soon'; intro = `Hi ${first}, your appointment is coming up.`; break;
    case 'waitlist_offer': {
      subject = `A time opened up at ${salon.name}`; heading = 'A time opened up'; intro = 'A time you were waiting for is now available.'; outro = 'It is held for you for a short time.';
      link = `${base()}/offer/${r.payload.token}`; cta = 'Book this time';
      details = [['Date', dateLong(r.payload.starts_at, salon.timezone)], ['Time', time12(r.payload.starts_at, salon.timezone)]]; break; }
    case 'review_request': subject = `How was your visit to ${salon.name}?`; heading = 'How was your visit?'; intro = 'Thanks for visiting. We would love to hear how it went.'; details = []; link = `${base()}/review/${r.payload.token}`; cta = 'Leave a review'; break;
    default: return null;
  }
  // Forms the client still owes for this visit go in the same email, with their own link.
  const forms = r.booking_id && (r.template === 'booking_confirmation' || r.template === 'reminder_24h') ? await outstandingForBooking(r.booking_id).catch(() => null) : null;
  const formLine = forms ? `Before your visit, please complete: ${forms.names.join(', ')}. It takes about two minutes.` : '';
  const text = [heading, '', intro, textDetails(details), outro, formLine, '', link ? `${cta}: ${link}` : '', forms ? `Complete your form: ${forms.url}` : '', '', bref ? `${salon.name} · ${bref}` : footerFor(salon)]
    .filter((x, i, a) => x !== '' || (i > 0 && a[i - 1] !== '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const body = mailP(intro) + mailDetails(details) + (outro ? `<div style="height:8px"></div>${mailP(outro)}` : '') + (formLine ? `<div style="height:8px"></div>${mailP(formLine)}` : '')
    + (link && forms ? mailButtonPair({ label: 'Manage booking', url: link }, { label: 'Complete form', url: forms.url }) : link ? mailButton(cta, link) : '');
  return { subject, text, html: mailShell({ brand: salon.name, heading, body, footer: bref ? `${salon.name} · ${bref}` : footerFor(salon), preheader: intro }), from: fromFor(salon.name) };
}

async function sendEmail(to: string, m: { subject: string; text: string; html: string; from: string }) {
  if (!viaSupabase() && process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: m.from, to, subject: m.subject, text: m.text, html: m.html }) });
    if (!res.ok) { const b = await res.json().catch(() => ({})) as { message?: string }; throw new Error(`email ${res.status}${b.message ? ': ' + b.message : ''}`); }
    return;
  }
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, { method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: m.from, to, subject: m.subject, text: m.text, html: m.html }) });
  const b = await res.json().catch(() => ({})) as { sent?: boolean; error?: string };
  if (!res.ok || !b.sent) throw new Error(`email ${res.status}${b.error ? ': ' + b.error : ''}`);
}
async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM!, Body: body.slice(0, 600) }) });
  if (!res.ok) throw new Error(`sms ${res.status}`);
}

/** Sends due messages. Channels with no provider configured stay queued rather than being faked or dropped. */
export async function processOutbox(limit = 50) {
  const sb = supabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data: rows } = await sb.from('notifications_outbox').select('*').eq('status', 'queued').lte('send_after', nowIso).lt('attempts', 5).order('created_at').limit(limit);
  const stats = { sent: 0, failed: 0, skipped: 0, waiting: 0 };
  for (const r of (rows ?? []) as Row[]) {
    if ((r.channel === 'email' && !emailConfigured()) || (r.channel === 'sms' && !smsConfigured())) { stats.waiting++; continue; }
    const stale = Date.now() - new Date((r as any).created_at ?? Date.now()).getTime() > 48 * 3600e3;
    if (stale) { await sb.from('notifications_outbox').update({ status: 'skipped', error: 'stale' }).eq('id', r.id); stats.skipped++; continue; }
    // Claim the message for ten minutes so a booking's own send and the scheduled run never both send it. A crash just means it is retried after that.
    const { data: claimed } = await sb.from('notifications_outbox').update({ send_after: new Date(Date.now() + 10 * 60e3).toISOString() }).eq('id', r.id).eq('status', 'queued').lte('send_after', nowIso).select('id');
    if (!claimed?.length) continue;
    const msg = await compose(r);
    if (!msg) { await sb.from('notifications_outbox').update({ status: 'skipped', error: 'nothing to send' }).eq('id', r.id); stats.skipped++; continue; }
    try {
      if (r.channel === 'email') await sendEmail(r.to_address, msg); else await sendSms(r.to_address, `${msg.subject}. ${msg.text}`);
      await sb.from('notifications_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), attempts: r.attempts + 1 }).eq('id', r.id); stats.sent++;
    } catch (e: any) {
      const attempts = r.attempts + 1;
      await sb.from('notifications_outbox').update({ attempts, error: String(e.message).slice(0, 200), status: attempts >= 5 ? 'failed' : 'queued', send_after: new Date(Date.now() + attempts * 5 * 60e3).toISOString() }).eq('id', r.id); stats.failed++;
    }
  }
  return stats;
}

/** A button under a custom message. A bare string is a "Reply" link. */
type Action = string | { label: string; url: string };

/** Sends a one-off message typed by staff, right away, and keeps a record of it in the outbox. `email` customises the subject, heading and body of the email version. */
export async function sendCustomMessage(salonId: string, to: { phone?: string | null; email?: string | null }, text: string, email?: { subject: string; html?: string; heading?: string; footer?: string }, action?: Action): Promise<{ ok: true; via: 'sms' | 'email' } | { ok: false; error: string }> {
  const sb = supabaseAdmin();
  const { data: salon } = await sb.from('salons').select('name,phone').eq('id', salonId).single();
  if (!salon) return { ok: false, error: 'Salon not found.' };
  const channel: 'sms' | 'email' | null = smsConfigured() && to.phone ? 'sms' : emailConfigured() && to.email ? 'email' : null;
  if (!channel) return { ok: false, error: smsConfigured() || emailConfigured() ? 'This client has no phone or email that can receive messages.' : 'Messaging is not set up yet. Add the Twilio or Resend keys to send.' };
  const address = (channel === 'sms' ? to.phone : to.email)!;
  const row = { salon_id: salonId, channel, to_address: address, template: 'custom_message', payload: { text } };
  const act = typeof action === 'string' ? { label: 'Reply', url: action } : action;
  try {
    if (channel === 'sms') await sendSms(address, `${salon.name}: ${text}${act ? ` ${act.label}: ${act.url}` : ''}`);
    else {
      const foot = email?.footer ?? footerFor(salon);
      const body = (email?.html ?? text.split(/\n+/).map(mailP).join('')) + (act ? mailButton(act.label, act.url, 'dark') : '');
      await sendEmail(address, { from: fromFor(salon.name), subject: email?.subject ?? `Message from ${salon.name}`, text: `${text}${act ? `\n\n${act.label}: ${act.url}` : ''}\n\n${foot}`,
        html: mailShell({ brand: salon.name, heading: email?.heading ?? 'You have a message', body, footer: foot, preheader: text.slice(0, 90) }) });
    }
  } catch (e: any) {
    await sb.from('notifications_outbox').insert({ ...row, status: 'failed', attempts: 1, error: String(e.message).slice(0, 200) });
    return { ok: false, error: 'The message could not be sent. Try again in a moment.' };
  }
  await sb.from('notifications_outbox').insert({ ...row, status: 'sent', attempts: 1, sent_at: new Date().toISOString() });
  return { ok: true, via: channel };
}

/** Sends whatever is queued right now so a confirmation does not wait for the next scheduled run. Never throws. */
export async function flushOutbox() {
  if (!emailConfigured() && !smsConfigured()) return;
  try { await processOutbox(20); } catch { /* the scheduled run will retry */ }
}

/** Welcome email for a new owner account. Best effort: a failure here must never block signing up. */
export async function sendWelcomeEmail(to: string, name: string) {
  if (!emailConfigured()) return;
  try {
    const first = name.trim().split(/\s+/)[0] || 'there';
    const link = `${base()}/setup`;
    const intro = `Hi ${first}, your account is ready. Set up your salon in a few minutes and start taking bookings.`;
    const text = `Welcome to Aster\n\n${intro}\n\nSet up your salon: ${link}\n\nAster`;
    const html = mailShell({ brand: 'Aster', heading: 'Welcome to Aster', body: mailP(intro) + mailButton('Set up your salon', link), footer: 'Aster', preheader: intro });
    await sendEmail(to, { subject: 'Welcome to Aster', text, html, from: fromFor('Aster') });
  } catch { /* welcome emails are a courtesy */ }
}

/** Password reset email through Resend. Returns false when it could not be sent so the caller can fall back. */
export async function sendPasswordResetEmail(to: string, link: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  try {
    const intro = 'We got a request to reset your Aster password.';
    const note = 'If you did not ask for this, you can ignore this email. The link works once and expires soon.';
    const text = `Reset your password\n\n${intro}\n\nChoose a new password: ${link}\n\n${note}\n\nAster`;
    const html = mailShell({ brand: 'Aster', heading: 'Reset your password', body: mailP(intro) + mailButton('Choose a new password', link) + mailNote(note), footer: 'Aster', preheader: intro });
    await sendEmail(to, { subject: 'Reset your Aster password', text, html, from: fromFor('Aster') });
    return true;
  } catch { return false; }
}
