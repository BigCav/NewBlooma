'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function submitReview(token: string, input: { stars: number; text: string }): Promise<{ error?: string }> {
  if (!(input.stars >= 1 && input.stars <= 5)) return { error: 'Choose a star rating.' };
  // The reviewer is whoever the link was sent to; their name comes from the booking, never from the browser.
  const sb = supabaseAdmin();
  const { data: t } = await sb.from('booking_tokens').select('booking_id').eq('token', token).eq('purpose', 'review').maybeSingle();
  const { data: b } = t?.booking_id ? await sb.from('bookings').select('clients(name)').eq('id', t.booking_id).single() : { data: null };
  const name = String((b as any)?.clients?.name ?? '').trim() || 'Client';
  const { error } = await sb.rpc('submit_review', { p_token: token, p_stars: input.stars, p_body: input.text.slice(0, 2000), p_name: name.slice(0, 80) });
  return error ? { error: 'This link is no longer valid.' } : {};
}
