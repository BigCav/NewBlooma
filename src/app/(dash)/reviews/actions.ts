'use server';
import { emailConfigured, flushOutbox } from '@/lib/notify';
import { revalidatePath } from 'next/cache';
import { requireCtx, friendly } from '@/lib/session';

type Res = { error?: string; notice?: string };

export async function saveReply(id: string, text: string): Promise<Res> {
  const { sb } = await requireCtx();
  const reply = text.trim();
  if (!reply) return { error: 'Write a reply first.' };
  const { error } = await sb.from('reviews').update({ reply, replied_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/reviews'); return { notice: 'Reply posted' };
}

export async function deleteReply(id: string): Promise<Res> {
  const { sb } = await requireCtx();
  const { error } = await sb.from('reviews').update({ reply: null, replied_at: null }).eq('id', id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/reviews'); return { notice: 'Reply deleted' };
}

export async function requestReviews(): Promise<Res> {
  const { sb } = await requireCtx();
  const { data, error } = await sb.rpc('request_reviews');
  if (error) return { error: friendly(error.message) };
  await flushOutbox();
  revalidatePath('/reviews');
  const n = `${data} client${data === 1 ? '' : 's'}`;
  return { notice: data === 0 ? 'No one new to ask right now' : emailConfigured() ? `Review requests sent to ${n} from the last two weeks` : `Review requests are ready for ${n}, but email is not set up yet so nothing was sent` };
}
