import { LandingView } from '@/components/Marketing';
import { supabaseServer } from '@/lib/supabase/server';
import { clientHome } from '@/lib/session';

export const metadata = { title: { absolute: 'Aster · Less admin, more time for clients' }, description: 'Calendar, online booking, reminders and checkout in one simple app for independent salons and barbers.' };
export const dynamic = 'force-dynamic';

export default async function Home() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  // Signed-in owners can still see the landing page; the header offers a way back to the dashboard.
  return <LandingView dash={user ? clientHome(user.user_metadata) ?? '/calendar' : null} />;
}
