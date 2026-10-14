import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { clientHome } from '@/lib/session';

export default async function Home() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  redirect(user ? clientHome(user.user_metadata) ?? '/calendar' : '/sign-in');
}
