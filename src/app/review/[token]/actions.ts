'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function submitReview(token: string, _: unknown, fd: FormData) {
  if (token === 'preview') return { error: 'This is a preview, so nothing was sent.' };
  const stars = Number(fd.get('stars')), body = String(fd.get('body') ?? '').trim();
  if (!(stars >= 1 && stars <= 5) || !body) return { error: 'Choose a rating and write a few words.' };
  const { error } = await supabaseAdmin().rpc('submit_review', { p_token: token, p_stars: stars, p_body: body });
  return error ? { error: 'This link is no longer valid.' } : { ok: true };
}
