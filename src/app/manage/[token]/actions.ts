'use server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function cancelBooking(token: string) {
  const { error } = await supabaseAdmin().rpc('client_cancel', { p_token: token });
  revalidatePath(`/manage/${token}`);
  return error ? { error: error.message.includes('not_cancellable') ? 'This appointment can no longer be cancelled.' : 'This link has expired.' } : { ok: true };
}
export async function requestReschedule(token: string, _: unknown, fd: FormData) {
  const body = String(fd.get('body') ?? '').trim(); if (!body) return { error: 'Tell us what time would suit you.' };
  const { error } = await supabaseAdmin().rpc('client_request_reschedule', { p_token: token, p_body: body });
  return error ? { error: 'Could not send your request.' } : { ok: 'Request sent. The salon will be in touch.' };
}
