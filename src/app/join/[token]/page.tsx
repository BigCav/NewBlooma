import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Lead, LightLink, Note, PrimaryButton, PrimaryLink, Problem, Shell, SignInLine } from './Shell';

export const metadata = { title: 'Join your team' };
export const dynamic = 'force-dynamic';

async function accept(token: string) {
  'use server';
  const sb = await supabaseServer();
  const { error } = await sb.rpc('accept_staff_invite', { p_token: token });
  if (error) redirect(`/join/${token}?err=1`);
  redirect('/calendar');
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
  return (
    <Shell title={`Join ${salon?.name ?? 'the team'}`}>
      <Lead>You have been invited to the team{who?.name ? ` as ${who.name}` : ''}{who?.role_title ? `, a ${String(who.role_title).toLowerCase()}` : ''}.</Lead>
      {sp.err && <Problem>This account could not join. It may already belong to a salon.</Problem>}
      {user ? (
        <form action={accept.bind(null, token)}><PrimaryButton>Accept invite</PrimaryButton></form>
      ) : (<>
        <PrimaryLink href="/sign-up">Create account</PrimaryLink>
        <Note>After signing up, open this invite link again to finish joining.</Note>
        <SignInLine />
      </>)}
    </Shell>
  );
}
