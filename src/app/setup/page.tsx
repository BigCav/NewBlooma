import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { clientHome } from '@/lib/session';
import { SetupView } from './SetupView';

export const metadata = { title: 'Set up your salon' };
export default async function Page() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/sign-in');
  const { data: staff } = await sb.from('staff').select('id').eq('user_id', user.id).maybeSingle();
  if (staff) redirect('/calendar');
  const home = clientHome(user.user_metadata); if (home) redirect(home);
  return <SetupView />;
}
