import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

const base = () => process.env.NEXT_PUBLIC_APP_URL ?? '';
export const replyUrl = (token: string) => `${base()}/reply/${token}`;

/** The conversation with a client about one booking (or, with no booking, the client in general). Created on first use. */
export async function ensureThread(salonId: string, clientId: string, bookingId: string | null): Promise<{ id: string; token: string; created: boolean }> {
  const sb = supabaseAdmin();
  let q = sb.from('inbox_items').select('id,reply_token').eq('salon_id', salonId).eq('type', 'message').eq('client_id', clientId);
  q = bookingId ? q.eq('booking_id', bookingId) : q.is('booking_id', null);
  const { data: ex } = await q.order('created_at').limit(1).maybeSingle();
  if (ex) return { id: ex.id, token: ex.reply_token, created: false };
  const { data, error } = await sb.from('inbox_items').insert({ salon_id: salonId, type: 'message', client_id: clientId, booking_id: bookingId, body: null, unread: false, status: 'handled' }).select('id,reply_token').single();
  if (error) throw error;
  return { id: data.id, token: data.reply_token, created: true };
}

/** Saves a message the salon sent so it shows in the Inbox conversation. */
export async function logStaffMessage(salonId: string, threadId: string, text: string) {
  const sb = supabaseAdmin();
  await sb.from('inbox_messages').insert({ salon_id: salonId, item_id: threadId, mine: true, body: text });
  await sb.from('inbox_items').update({ unread: false, status: 'handled' }).eq('id', threadId);
}

export async function dropEmptyThread(threadId: string) {
  await supabaseAdmin().from('inbox_items').delete().eq('id', threadId);
}
