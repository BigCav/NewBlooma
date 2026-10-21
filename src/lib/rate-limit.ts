import 'server-only';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** The caller's address as Vercel reports it. */
export async function clientIp() {
  const h = await headers();
  return (h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0] ?? 'unknown').trim();
}

/** True while the caller is under `max` hits in the last `windowSec` seconds for this bucket. Fails open if the limiter itself is down. */
export async function allow(bucket: string, max: number, windowSec: number) {
  const { data, error } = await supabaseAdmin().rpc('rate_hit', { p_bucket: bucket, p_max: max, p_window_sec: windowSec });
  if (error) { console.error('rate_hit failed', error.message); return true; }
  return data !== false;
}
