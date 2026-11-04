import { redirect } from 'next/navigation';
import { AuthView } from '@/components/AuthView';
import { openInvite } from '@/lib/invites';
import { supabaseServer } from '@/lib/supabase/server';
import { clientHome } from '@/lib/session';
export const metadata = { title: 'Create account' };
export const dynamic = 'force-dynamic';
/** Already signed in? Go straight to the calendar instead of showing the form. A team invite (?invite=) goes on to its own page, which also says when the invite no longer works. */
export default async function Page({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  const inv = await openInvite(invite);
  if (invite && !inv) redirect(`/join/${encodeURIComponent(invite)}`);
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (user) redirect(inv ? `/join/${encodeURIComponent(inv.token)}` : clientHome(user.user_metadata) ?? '/calendar');
  return <AuthView mode="up" invite={inv} />;
}
