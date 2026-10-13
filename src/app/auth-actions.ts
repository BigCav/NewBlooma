'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { supabaseServer } from '@/lib/supabase/server';

export async function signIn(_: unknown, fd: FormData) {
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email: String(fd.get('email') ?? '').trim(), password: String(fd.get('password') ?? '') });
  if (error) return { error: 'Email or password is incorrect.' };
  redirect('/calendar');
}

export async function signUp(_: unknown, fd: FormData) {
  const email = String(fd.get('email') ?? '').trim();
  const password = String(fd.get('password') ?? '');
  if (password.length < 10) return { error: 'Use at least 10 characters for your password.' };
  const sb = await supabaseServer();
  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_APP_URL;
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/callback` } });
  if (error) return { error: error.message };
  if (!data.session) return { notice: 'Check your email to confirm your address, then sign in.' };
  redirect('/setup');
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect('/sign-in');
}
