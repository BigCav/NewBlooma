'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendWelcomeEmail } from '@/lib/notify';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { supabaseServer } from '@/lib/supabase/server';

type R = { error?: string; status?: 'created' | 'confirm' | 'sent' };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const origin = async () => { const h = await headers(); return h.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? `https://${h.get('x-forwarded-host') ?? h.get('host')}`; };

export async function signIn(input: { email: string; password: string }): Promise<R> {
  if (!EMAIL.test(input.email.trim()) || !input.password) return { error: 'Email or password is incorrect.' };
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email: input.email.trim(), password: input.password });
  if (error) return { error: 'Email or password is incorrect.' };
  redirect('/calendar');
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<R> {
  const name = input.name.trim(), email = input.email.trim();
  if (!name) return { error: 'Add your name.' };
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address.' };
  if (input.password.length < 8) return { error: 'Use at least 8 characters for your password.' };
  // No confirmation email: the account is created already verified and signed in, and a welcome email follows.
  const { error } = await supabaseAdmin().auth.admin.createUser({ email, password: input.password, email_confirm: true, user_metadata: { full_name: name } });
  if (error) return { error: /already|registered|exists/i.test(error.message) ? 'An account with that email already exists. Try signing in.' : /password/i.test(error.message) ? 'Choose a stronger password.' : 'Could not create your account. Please try again.' };
  const sb = await supabaseServer();
  const { error: inErr } = await sb.auth.signInWithPassword({ email, password: input.password });
  if (inErr) return { error: 'Your account was created. Please sign in.' };
  await sendWelcomeEmail(email, name);
  return { status: 'created' };
}

export async function requestReset(input: { email: string }): Promise<R> {
  const email = input.email.trim();
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address.' };
  const sb = await supabaseServer();
  await sb.auth.resetPasswordForEmail(email, { redirectTo: `${await origin()}/auth/callback?next=/reset-password` });
  return { status: 'sent' }; // same answer whether or not the email has an account
}

export async function setNewPassword(input: { password: string }): Promise<R> {
  if (input.password.length < 8) return { error: 'Use at least 8 characters for your password.' };
  const sb = await supabaseServer();
  const { error } = await sb.auth.updateUser({ password: input.password });
  if (error) return { error: 'Could not save your password. Open the reset link from your email again.' };
  redirect('/calendar');
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect('/sign-in');
}
