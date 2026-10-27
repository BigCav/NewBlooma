'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { allow, clientIp } from '@/lib/rate-limit';
import { sendCustomMessage } from '@/lib/notify';
import { mailP } from '@/lib/email-layout';

/** A client answers a message from the salon using the link in their email or text. The reply lands in the salon's Inbox. */
export async function sendClientReply(token: string, text: string): Promise<{ error?: string; ok?: boolean }> {
  text = String(text ?? '').trim();
  if (!text) return { error: 'Write your reply first.' };
  if (text.length > 600) return { error: 'Please keep it under 600 characters.' };
  if (!(await allow('reply:' + (await clientIp()), 15, 3600))) return { error: 'Too many messages from here for now. Please try again later.' };
  const sb = supabaseAdmin();
  const { data: it } = await sb.from('inbox_items').select('id,salon_id,clients(name)').eq('reply_token', token).eq('type', 'message').maybeSingle();
  if (!it) return { error: 'This link is not available any more.' };
  const { error } = await sb.from('inbox_messages').insert({ salon_id: it.salon_id, item_id: it.id, mine: false, body: text });
  if (error) return { error: 'Your reply could not be sent. Please try again.' };
  await sb.from('inbox_items').update({ unread: true, status: 'new' }).eq('id', it.id);
  // Let the owner know by email too. Best effort: the reply is already in the Inbox.
  try {
    const { data: s } = await sb.from('salons').select('email').eq('id', it.salon_id).single();
    const name = (it as any).clients?.name ?? 'A client';
    const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
    if (s?.email) await sendCustomMessage(it.salon_id, { email: s.email }, text, { subject: `${name} replied`, heading: `${name} replied`, html: mailP(text) }, { label: 'Open your inbox', url: `${base}/inbox` });
  } catch { /* the Inbox badge still shows it */ }
  return { ok: true };
}
