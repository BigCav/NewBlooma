import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { dateLong, time12 } from '@/lib/format';

const base = () => process.env.NEXT_PUBLIC_APP_URL ?? '';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Email goes through the "send-email" Supabase edge function (which holds the Resend key), or straight to Resend with RESEND_API_KEY only when Supabase is not configured.
const viaSupabase = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
export const emailConfigured = () => !!process.env.RESEND_API_KEY || viaSupabase();
/** EMAIL_FROM overrides the sender; otherwise mail goes out as "<Salon name> <bookings@blooma.co.nz>", an address already verified in Resend. */
const fromFor = (salonName: string) => process.env.EMAIL_FROM || `${salonName.replace(/[<>",]/g, '').trim() || 'Bookings'} <bookings@blooma.co.nz>`;
export const smsConfigured = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

type Row = { id: string; salon_id: string; booking_id: string | null; channel: 'email' | 'sms'; to_address: string; template: string; payload: any; attempts: number };

async function compose(r: Row): Promise<{ subject: string; text: string; html: string; from: string } | null> {
  const sb = supabaseAdmin();
  const { data: salon } = await sb.from('salons').select('name,phone,timezone,slug').eq('id', r.salon_id).single();
  if (!salon) return null;
  let when = '', who = '', manage = '', bref = '';
  let b0: unknown = null;
  if (r.booking_id) {
    const { data: b } = await sb.from('bookings').select('ref_no,starts_at,status,staff(name),clients(name,reminders),booking_services(services(name))').eq('id', r.booking_id).single();
    if (!b) return null;
    const cancelledTpl = r.template === 'booking_cancelled' || r.template === 'owner_booking_cancelled';
    if (!cancelledTpl && ['cancelled', 'no_show'].includes(b.status)) return null; // nothing to tell them
    if (cancelledTpl && b.status !== 'cancelled') return null; // it was reinstated
    if (r.template.startsWith('reminder') && (b as any).clients?.reminders === false) return null; // client turned reminders off
    b0 = b; bref = 'B-' + (b as any).ref_no;
    when = `${dateLong(b.starts_at, salon.timezone)} at ${time12(b.starts_at, salon.timezone)}`;
    who = `${(b as any).booking_services.map((x: any) => x.services.name).join(', ')} with ${(b as any).staff?.name}`;
    const { data: t } = await sb.from('booking_tokens').select('token').eq('booking_id', r.booking_id).eq('purpose', 'manage_booking').maybeSingle();
    if (t) manage = `${base()}/manage/${t.token}`;
  }
  let subject = '', lines: string[] = [], link = manage, cta = 'View or change your appointment';
  switch (r.template) {
    case 'booking_confirmation': subject = `Booking confirmed at ${salon.name}`; lines = [`You are booked in for ${who}.`, when]; break;
    case 'booking_cancelled': subject = `Your booking at ${salon.name} was cancelled`; lines = [`Your appointment has been cancelled: ${who}.`, `It was booked for ${when}.`, 'If this was a mistake, or you would like another time, you can book again online.']; link = `${base()}/b/${salon.slug}`; cta = 'Book again'; break;
    case 'owner_new_booking': subject = `New booking: ${(b0 as any)?.clients?.name ?? 'a client'}`; lines = [`${(b0 as any)?.clients?.name ?? 'A client'} booked online: ${who}.`, when]; link = `${base()}/inbox`; cta = 'Open your inbox'; break;
    case 'owner_booking_cancelled': subject = `Cancellation: ${(b0 as any)?.clients?.name ?? 'a client'}`; lines = [`${(b0 as any)?.clients?.name ?? 'A client'} cancelled: ${who}.`, `It was booked for ${when}.`]; link = `${base()}/calendar`; cta = 'Open your calendar'; break;
    case 'reminder_24h': subject = `Reminder: tomorrow at ${salon.name}`; lines = [`Just a reminder of your appointment: ${who}.`, when]; break;
    case 'reminder_2h': subject = `Reminder: today at ${salon.name}`; lines = [`See you soon: ${who}.`, when]; break;
    case 'waitlist_offer': {
      subject = `A time opened up at ${salon.name}`; link = `${base()}/offer/${r.payload.token}`; cta = 'Book this time';
      lines = [`A time you were waiting for is available: ${dateLong(r.payload.starts_at, salon.timezone)} at ${time12(r.payload.starts_at, salon.timezone)}.`, 'It is held for you for a short time.']; break; }
    case 'review_request': subject = `How was your visit to ${salon.name}?`; link = `${base()}/review/${r.payload.token}`; cta = 'Leave a review'; lines = ['Thanks for visiting. We would love to hear how it went.']; break;
    default: return null;
  }
  if (bref) lines.push(`Booking reference: ${bref}`);
  const text = `${lines.join('\n')}\n\n${cta}: ${link}\n\n${salon.name}${salon.phone ? ` · ${salon.phone}` : ''}`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto"><h2>${esc(salon.name)}</h2>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}<p><a href="${link}" style="background:#5B3DF5;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;display:inline-block">${esc(cta)}</a></p></div>`;
  return { subject, text, html, from: fromFor(salon.name) };
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
export async function sendCustomMessage(salonId: string, to: { phone?: string | null; email?: string | null }, text: string, email?: { subject: string; html: string; footer?: string }): Promise<{ ok: true; via: 'sms' | 'email' } | { ok: false; error: string }> {
  const sb = supabaseAdmin();
  const { data: salon } = await sb.from('salons').select('name,phone').eq('id', salonId).single();
  if (!salon) return { ok: false, error: 'Salon not found.' };
  const channel: 'sms' | 'email' | null = smsConfigured() && to.phone ? 'sms' : emailConfigured() && to.email ? 'email' : null;
  if (!channel) return { ok: false, error: smsConfigured() || emailConfigured() ? 'This client has no phone or email that can receive messages.' : 'Messaging is not set up yet. Add the Twilio or Resend keys to send.' };
  const address = (channel === 'sms' ? to.phone : to.email)!;
  const row = { salon_id: salonId, channel, to_address: address, template: 'custom_message', payload: { text } };
  try {
    if (channel === 'sms') await sendSms(address, `${salon.name}: ${text}`);
    else {
      const foot = email?.footer ? esc(email.footer) : `${esc(salon.name)}${salon.phone ? ` · ${esc(salon.phone)}` : ''}`;
      const body = email?.html ?? text.split(/\n+/).map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${esc(l)}</p>`).join('');
      await sendEmail(address, { from: fromFor(salon.name), subject: email?.subject ?? `Message from ${salon.name}`, text: `${text}\n\n${email?.footer ?? salon.name + (salon.phone ? ` · ${salon.phone}` : '')}`,
        html: `<div style="background:#F4F5F7;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0E1116"><div style="max-width:480px;margin:auto;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:20px;padding:28px"><div style="font-size:20px;font-weight:600;letter-spacing:-0.01em;margin-bottom:18px">${esc(salon.name)}</div>${body}</div><div style="max-width:480px;margin:12px auto 0;text-align:center;font-size:12.5px;color:#5E6673">${foot}</div></div>` });
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
    const first = esc(name.trim().split(/\s+/)[0] || 'there');
    const link = `${base()}/setup`;
    const text = `Hi ${name.trim().split(/\s+/)[0] || 'there'}, welcome to Aster.

Your account is ready. Set up your salon in a few minutes and start taking bookings.

Set up your salon: ${link}`;
    const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto"><h2>Welcome to Aster, ${first}</h2><p>Your account is ready. Set up your salon in a few minutes and start taking bookings.</p><p><a href="${link}" style="background:#5B3DF5;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;display:inline-block">Set up your salon</a></p></div>`;
    await sendEmail(to, { subject: 'Welcome to Aster', text, html, from: fromFor('Aster') });
  } catch { /* welcome emails are a courtesy */ }
}

/** Password reset email through Resend. Returns false when it could not be sent so the caller can fall back. */
export async function sendPasswordResetEmail(to: string, link: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  try {
    const text = `We got a request to reset your Aster password.

Choose a new password: ${link}

If you did not ask for this, you can ignore this email. The link works once and expires soon.`;
    const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto"><h2>Reset your password</h2><p>We got a request to reset your Aster password.</p><p><a href="${link}" style="background:#5B3DF5;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;display:inline-block">Choose a new password</a></p><p style="color:#5E6673;font-size:13px">If you did not ask for this, you can ignore this email. The link works once and expires soon.</p></div>`;
    await sendEmail(to, { subject: 'Reset your Aster password', text, html, from: fromFor('Aster') });
    return true;
  } catch { return false; }
}
