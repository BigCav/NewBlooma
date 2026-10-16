'use server';
import { revalidatePath } from 'next/cache';
import { currentClient, salonIdFor, setClientCookie } from '@/lib/client-auth';
import { checkPhone } from '@/lib/phone';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Res = { error?: string; notice?: string };

export async function saveDetails(slug: string, i: { name: string; email: string; phone: string }): Promise<Res> {
  const salonId = await salonIdFor(slug); if (!salonId) return { error: 'This page is not available.' };
  const me = await currentClient(salonId); if (!me) return { error: 'Please sign in again.' };
  const name = i.name.trim(), email = i.email.trim().toLowerCase();
  if (!name) return { error: 'Add your name.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Enter a valid email address.' };
  const ph = checkPhone(i.phone, true); if (ph.error) return { error: ph.error };
  const { error } = await supabaseAdmin().rpc('client_update_details', { p_account: me.id, p_name: name, p_email: email, p_phone: ph.value });
  if (error) return { error: /email_taken/.test(error.message) ? 'That email is already used by another account.' : 'Could not save your details. Please try again.' };
  revalidatePath(`/b/${slug}/account`);
  return { notice: 'Details saved' };
}

export async function changePassword(slug: string, password: string): Promise<Res> {
  const salonId = await salonIdFor(slug); if (!salonId) return { error: 'This page is not available.' };
  const me = await currentClient(salonId); if (!me) return { error: 'Please sign in again.' };
  if (password.length < 8) return { error: 'Use at least 8 characters.' };
  const { data, error } = await supabaseAdmin().rpc('client_set_password', { p_account: me.id, p_password: password });
  if (error || !data) return { error: 'Could not update your password. Please try again.' };
  await setClientCookie(String(data));
  return { notice: 'Password updated' };
}
