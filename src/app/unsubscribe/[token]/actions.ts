'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { allow, clientIp } from '@/lib/rate-limit';

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Turns marketing messages off (or back on) for the client who holds this link. Needs no sign-in; the link is the proof. */
export async function setMarketing(token: string, on: boolean): Promise<{ ok: boolean }> {
  if (!TOKEN.test(token)) return { ok: false };
  if (!(await allow('unsub:' + (await clientIp()), 30, 3600))) return { ok: false };
  const { data, error } = await supabaseAdmin().from('clients').update({ marketing: on }).eq('unsub_token', token).select('id');
  return { ok: !error && !!data?.length };
}
