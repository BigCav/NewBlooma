import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Customer accounts are completely separate from staff logins: own tables, own opaque session cookie, never the Supabase auth session. */
const COOKIE = 'aster_client';
const MAX_AGE = 60 * 60 * 24 * 30;

export type ClientAccount = { id: string; name: string; email: string; phone: string };

export async function salonIdFor(slug: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from('salons').select('id').eq('slug', slug).maybeSingle();
  return data?.id ?? null;
}

export async function setClientCookie(token: string) {
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE });
}
export async function clearClientCookie() { (await cookies()).delete(COOKIE); }
export async function clientToken(): Promise<string | null> { return (await cookies()).get(COOKIE)?.value ?? null; }

/** The signed-in customer for this salon, or null. */
export async function currentClient(salonId: string): Promise<ClientAccount | null> {
  const token = await clientToken();
  if (!token) return null;
  const { data } = await supabaseAdmin().rpc('client_session', { p_token: token, p_salon: salonId });
  if (!data || !data.email) return null;
  return { id: String(data.id), name: String(data.name ?? ''), email: String(data.email), phone: String(data.phone ?? '') };
}
