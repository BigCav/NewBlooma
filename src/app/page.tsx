import { redirect } from 'next/navigation';
import { LandingView } from '@/components/Marketing';
import { supabaseServer } from '@/lib/supabase/server';
import { clientHome } from '@/lib/session';

export const metadata = { title: 'Aster · Less admin, more time for clients', description: 'Calendar, online booking, reminders and checkout in one simple app for independent salons and barbers.' };
export const dynamic = 'force-dynamic';

export default async function Home() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (user) redirect(clientHome(user.user_metadata) ?? '/calendar');
  return <LandingView />;
}
