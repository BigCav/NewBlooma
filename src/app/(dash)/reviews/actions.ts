'use server';
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

export async function requestReviews(): Promise<Res> {
  const { sb } = await requireCtx();
  const { data, error } = await sb.rpc('request_reviews');
  if (error) return { error: friendly(error.message) };
  revalidatePath('/reviews');
  return { notice: data === 0 ? 'No one new to ask right now' : `Review requests sent to ${data} client${data === 1 ? '' : 's'} from the last two weeks` };
}
