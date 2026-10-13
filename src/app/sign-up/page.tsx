import { redirect } from 'next/navigation';
import { AuthView } from '@/components/AuthView';
import { supabaseServer } from '@/lib/supabase/server';
export const metadata = { title: 'Create account' };
export const dynamic = 'force-dynamic';
/** Already signed in? Go straight to the calendar instead of showing the form. */
export default async function Page() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (user) redirect('/calendar');
  return <AuthView mode="up" />;
}
