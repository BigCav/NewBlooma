'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function submitReview(token: string, input: { stars: number; text: string; name: string }): Promise<{ error?: string }> {
  if (token === 'preview') return { error: 'This is a preview, so nothing was sent.' };
  if (!(input.stars >= 1 && input.stars <= 5)) return { error: 'Choose a star rating.' };
  if (!input.name.trim()) return { error: 'Add your name.' };
  const { error } = await supabaseAdmin().rpc('submit_review', { p_token: token, p_stars: input.stars, p_body: input.text.slice(0, 2000), p_name: input.name.trim().slice(0, 80) });
  return error ? { error: 'This link is no longer valid.' } : {};
}
