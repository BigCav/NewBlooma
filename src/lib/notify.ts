import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { dateLong, time12 } from '@/lib/format';

const base = () => process.env.NEXT_PUBLIC_APP_URL ?? '';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
export const smsConfigured = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

type Row = { id: string; salon_id: string; booking_id: string | null; channel: 'email' | 'sms'; to_address: string; template: string; payload: any; attempts: number };

async function compose(r: Row): Promise<{ subject: string; text: string; html: string } | null> {
  const sb = supabaseAdmin();
  const { data: salon } = await sb.from('salons').select('name,phone,timezone').eq('id', r.salon_id).single();
  if (!salon) return null;
  let when = '', who = '', manage = '';
  if (r.booking_id) {
    const { data: b } = await sb.from('bookings').select('starts_at,status,staff(name),clients(name,reminders),booking_services(services(name))').eq('id', r.booking_id).single();
    if (!b || ['cancelled', 'no_show'].includes(b.status)) return null; // nothing to tell them
    if (r.template.startsWith('reminder') && (b as any).clients?.reminders === false) return null; // client turned reminders off
    when = `${dateLong(b.starts_at, salon.timezone)} at ${time12(b.starts_at, salon.timezone)}`;
    who = `${(b as any).booking_services.map((x: any) => x.services.name).join(', ')} with ${(b as any).staff?.name}`;
    const { data: t } = await sb.from('booking_tokens').select('token').eq('booking_id', r.booking_id).eq('purpose', 'manage_booking').maybeSingle();
    if (t) manage = `${base()}/manage/${t.token}`;
  }
  let subject = '', lines: string[] = [], link = manage, cta = 'View or change your appointment';
  switch (r.template) {
    case 'booking_confirmation': subject = `Booking confirmed at ${salon.name}`; lines = [`You are booked in for ${who}.`, when]; break;
    case 'reminder_24h': subject = `Reminder: tomorrow at ${salon.name}`; lines = [`Just a reminder of your appointment: ${who}.`, when]; break;
    case 'reminder_2h': subject = `Reminder: today at ${salon.name}`; lines = [`See you soon: ${who}.`, when]; break;
    case 'waitlist_offer': {
      subject = `A time opened up at ${salon.name}`; link = `${base()}/offer/${r.payload.token}`; cta = 'Book this time';
      lines = [`A time you were waiting for is available: ${dateLong(r.payload.starts_at, salon.timezone)} at ${time12(r.payload.starts_at, salon.timezone)}.`, 'It is held for you for a short time.']; break; }
    case 'review_request': subject = `How was your visit to ${salon.name}?`; link = `${base()}/review/${r.payload.token}`; cta = 'Leave a review'; lines = ['Thanks for visiting. We would love to hear how it went.']; break;
    default: return null;
  }
  const text = `${lines.join('\n')}\n\n${cta}: ${link}\n\n${salon.name}${salon.phone ? ` · ${salon.phone}` : ''}`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto"><h2>${esc(salon.name)}</h2>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}<p><a href="${link}" style="background:#5B3DF5;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;display:inline-block">${esc(cta)}</a></p></div>`;
  return { subject, text, html };
}

async function sendEmail(to: string, m: { subject: string; text: string; html: string }) {
  const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject: m.subject, text: m.text, html: m.html }) });
  if (!res.ok) throw new Error(`email ${res.status}`);
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
  const { data: rows } = await sb.from('notifications_outbox').select('*').eq('status', 'queued').lte('send_after', new Date().toISOString()).lt('attempts', 5).order('created_at').limit(limit);
  const stats = { sent: 0, failed: 0, skipped: 0, waiting: 0 };
  for (const r of (rows ?? []) as Row[]) {
    if ((r.channel === 'email' && !emailConfigured()) || (r.channel === 'sms' && !smsConfigured())) { stats.waiting++; continue; }
    const stale = Date.now() - new Date((r as any).created_at ?? Date.now()).getTime() > 48 * 3600e3;
    if (stale) { await sb.from('notifications_outbox').update({ status: 'skipped', error: 'stale' }).eq('id', r.id); stats.skipped++; continue; }
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

/** Sends a one-off message typed by staff, right away, and keeps a record of it in the outbox. */
export async function sendCustomMessage(salonId: string, to: { phone?: string | null; email?: string | null }, text: string): Promise<{ ok: true; via: 'sms' | 'email' } | { ok: false; error: string }> {
  const sb = supabaseAdmin();
  const { data: salon } = await sb.from('salons').select('name,phone').eq('id', salonId).single();
  if (!salon) return { ok: false, error: 'Salon not found.' };
  const channel: 'sms' | 'email' | null = smsConfigured() && to.phone ? 'sms' : emailConfigured() && to.email ? 'email' : null;
  if (!channel) return { ok: false, error: smsConfigured() || emailConfigured() ? 'This client has no phone or email that can receive messages.' : 'Messaging is not set up yet. Add the Twilio or Resend keys to send.' };
  const address = (channel === 'sms' ? to.phone : to.email)!;
  const row = { salon_id: salonId, channel, to_address: address, template: 'custom_message', payload: { text } };
  try {
    if (channel === 'sms') await sendSms(address, `${salon.name}: ${text}`);
    else await sendEmail(address, { subject: `Message from ${salon.name}`, text: `${text}\n\n${salon.name}${salon.phone ? ` · ${salon.phone}` : ''}`, html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto"><h2>${esc(salon.name)}</h2>${text.split(/\n+/).map((l) => `<p>${esc(l)}</p>`).join('')}</div>` });
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
