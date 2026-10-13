'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx, friendly } from '@/lib/session';

export async function replyReview(_: unknown, fd: FormData) {
  const { sb } = await requireCtx();
  const reply = String(fd.get('reply') ?? '').trim(); if (!reply) return { error: 'Write a reply first.' };
  const { error } = await sb.from('reviews').update({ reply, replied_at: new Date().toISOString() }).eq('id', String(fd.get('id')));
  if (error) return { error: friendly(error.message) };
  revalidatePath('/reviews'); return { ok: 'Reply saved.' };
}
export async function requestReviews() {
  const { sb } = await requireCtx();
  const { data, error } = await sb.rpc('request_reviews');
  revalidatePath('/reviews');
  return error ? { error: friendly(error.message) } : { ok: data === 0 ? 'No one new to ask right now.' : `Review requests queued for ${data} client${data === 1 ? '' : 's'}.` };
}
