import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Lead, LightButton, LightLink, Note, PrimaryButton, PrimaryLink, Problem, Shell, SignInLine } from './Shell';

export const metadata = { title: 'Join your team' };
export const dynamic = 'force-dynamic';

async function accept(token: string) {
  'use server';
  const sb = await supabaseServer();
  const { error } = await sb.rpc('accept_staff_invite', { p_token: token });
  if (error) redirect(`/join/${token}?err=1`);
  redirect('/calendar');
}

/** Signs out of the account that is open in this browser, then comes back to the invite so the right account can be used. */
async function switchAccount(token: string) {
  'use server';
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect(`/join/${token}`);
}

export default async function Join({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ err?: string }> }) {
  const { token } = await params; const sp = await searchParams;
  const { data: inv } = await supabaseAdmin().from('staff_invites').select('accepted_at,expires_at,salon_id,staff(name,role_title)').eq('token', token).maybeSingle();
  if (!inv || inv.accepted_at || new Date(inv.expires_at) < new Date()) return (
    <Shell title="This invite is no longer valid">
      <Lead>Ask the salon owner to send you a new one from the Team page.</Lead>
      <LightLink href="/sign-in">Go to sign in</LightLink>
    </Shell>
  );
  const { data: salon } = await supabaseAdmin().from('salons').select('name').eq('id', inv.salon_id).single();
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const who = (inv as any).staff;
  // An account that already works at a salon cannot also join this one, so say so instead of failing after a click.
  const mine = user ? (await supabaseAdmin().from('staff').select('salon_id,salons(name)').eq('user_id', user.id).maybeSingle()).data as { salons?: { name?: string } | null } | null : null;
  return (
    <Shell title={`Join ${salon?.name ?? 'the team'}`}>
      <Lead>You have been invited to the team{who?.name ? ` as ${who.name}` : ''}{who?.role_title ? `, a ${String(who.role_title).toLowerCase()}` : ''}.</Lead>
      {user ? (mine ? (<>
        <Problem>{`You are signed in as ${user.email}, which already belongs to ${mine.salons?.name ?? 'a salon'}. To join as ${who?.name ?? 'this team member'}, sign out and open this link again with the email you want to use.`}</Problem>
        <form action={switchAccount.bind(null, token)}><LightButton>Sign out and use a different account</LightButton></form>
      </>) : (<>
        {sp.err && <Problem>This invite could not be accepted. Ask the salon owner for a new one.</Problem>}
        <Note>{`Signed in as ${user.email}.`}</Note>
        <form action={accept.bind(null, token)}><PrimaryButton>Accept invite</PrimaryButton></form>
        <form action={switchAccount.bind(null, token)}><LightButton>Not you? Sign out</LightButton></form>
      </>)) : (<>
        {sp.err && <Problem>This invite could not be accepted. Ask the salon owner for a new one.</Problem>}
        <PrimaryLink href={`/sign-up?invite=${encodeURIComponent(token)}`}>Create account</PrimaryLink>
        <Note>Just an email and a password. You join the team straight after.</Note>
        <SignInLine href={`/sign-in?invite=${encodeURIComponent(token)}`} />
      </>)}
    </Shell>
  );
}
