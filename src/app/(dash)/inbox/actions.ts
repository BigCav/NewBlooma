'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx, friendly } from '@/lib/session';
import { dateLong, time12 } from '@/lib/format';
import { emailConfigured, flushOutbox, sendCustomMessage } from '@/lib/notify';
import { dropEmptyThread, ensureThread, logStaffMessage, replyUrl } from '@/lib/conversation';

type R = { error?: string; ok?: boolean; notice?: string };
const refresh = () => { revalidatePath('/inbox'); revalidatePath('/', 'layout'); };
const first = (n?: string | null) => String(n ?? 'Client').split(' ')[0];

export async function markRead(id: string): Promise<R> {
  const { sb } = await requireCtx();
  await sb.from('inbox_items').update({ unread: false }).eq('id', id);
  refresh(); return { ok: true };
}

export async function markDone(id: string): Promise<R> {
  const { sb } = await requireCtx();
  const { error } = await sb.from('inbox_items').update({ status: 'handled', unread: false }).eq('id', id);
  if (error) return { error: friendly(error.message) };
  refresh(); return { ok: true };
}

export async function acceptRequest(id: string): Promise<R> {
  const { sb } = await requireCtx();
  const { data: it } = await sb.from('inbox_items').select('booking_id,clients(name,email)').eq('id', id).maybeSingle();
  if (!it?.booking_id) return { error: 'This request has no booking.' };
  const { error } = await sb.rpc('confirm_booking', { p_booking: it.booking_id });
  if (error && !error.message.includes('booking_not_pending')) return { error: friendly(error.message) };
  await sb.from('inbox_items').update({ status: 'handled', unread: false }).eq('id', id);
  await flushOutbox();
  refresh();
  const c = (it as any).clients;
  const notice = !c?.email ? `Accepted. ${first(c?.name)} has no email on file, so no confirmation was sent.` : emailConfigured() ? `Accepted. ${first(c.name)} will get a confirmation email.` : 'Accepted. Email is not set up yet, so no confirmation was sent.';
  return { ok: true, notice };
}

const REASON_TEXT: Record<string, string> = { 'Not available then': 'that time is not available', 'Fully booked': 'we are fully booked then', 'Something else': 'something has come up on our side' };
export async function declineRequest(id: string, reason: string): Promise<R> {
  const { sb, salon } = await requireCtx();
  if (!REASON_TEXT[reason]) return { error: 'Choose a reason.' };
  const { data: it } = await sb.from('inbox_items').select('booking_id,clients(name,email,phone),bookings(starts_at,status,booking_services(services(name)))').eq('id', id).maybeSingle();
  if (!it?.booking_id) return { error: 'This request has no booking.' };
  const b = (it as any).bookings, c = (it as any).clients;
  if (b?.status === 'pending') {
    const { error } = await sb.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', it.booking_id);
    if (error) return { error: friendly(error.message) };
  }
  await sb.from('inbox_items').update({ status: 'declined', unread: false }).eq('id', id);
  refresh();
  const svc = (b?.booking_services ?? []).map((l: any) => l.services?.name).filter(Boolean).join(' + ') || 'your booking';
  const text = `Hi ${first(c?.name)}, sorry, we can't take your booking for ${svc} on ${dateLong(b.starts_at, salon.timezone)} at ${time12(b.starts_at, salon.timezone)}: ${REASON_TEXT[reason]}. Please pick another time on our booking page.`;
  const r = await sendCustomMessage(salon.id, c ?? {}, text, { subject: `About your booking request at ${salon.name}`, heading: 'We could not take your booking' }, { label: 'Book another time', url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/b/${salon.slug}` });
  return { ok: true, notice: r.ok ? `Declined. ${first(c?.name)} has been told.` : `Declined. ${first(c?.name)} was not told: ${r.error}` };
}

export async function replyToItem(id: string, text: string): Promise<R> {
  const { sb, salon } = await requireCtx();
  text = text.trim(); if (!text) return { error: 'Write a reply first.' };
  if (text.length > 600) return { error: 'Keep the message under 600 characters.' };
  const { data: it } = await sb.from('inbox_items').select('type,client_id,booking_id,reply_token,clients(name,email,phone)').eq('id', id).maybeSingle();
  if (!it) return { error: 'Item not found.' };
  const c = (it as any).clients;
  if (!it.client_id) return { error: 'This item has no client to message.' };
  const th = it.type === 'message' ? { id, token: it.reply_token as string, created: false } : await ensureThread(salon.id, it.client_id, it.booking_id);
  const r = await sendCustomMessage(salon.id, c ?? {}, text, undefined, replyUrl(th.token));
  if (!r.ok) { if (th.created) await dropEmptyThread(th.id); return { error: r.error }; }
  await logStaffMessage(salon.id, th.id, text);
  await sb.from('inbox_items').update({ unread: false }).eq('id', id);
  refresh();
  return { ok: true, notice: it.type === 'message' ? 'Reply sent' : `Message sent to ${first(c?.name)}. The conversation is under Messages.` };
}
