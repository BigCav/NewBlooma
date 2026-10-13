import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const metadata = { title: 'Join your team' };

async function accept(token: string) {
  'use server';
  const sb = await supabaseServer();
  const { error } = await sb.rpc('accept_staff_invite', { p_token: token });
  if (error) redirect(`/join/${token}?err=1`);
  redirect('/calendar');
}

export default async function Join({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ err?: string }> }) {
  const { token } = await params; const sp = await searchParams;
  const { data: inv } = await supabaseAdmin().from('staff_invites').select('accepted_at,expires_at,salon_id,staff(name)').eq('token', token).maybeSingle();
  if (!inv || inv.accepted_at || new Date(inv.expires_at) < new Date()) return <div className="auth"><div className="card"><h1>Invite not valid</h1><p className="muted">Ask the salon owner for a new invite link.</p></div></div>;
  const { data: salon } = await supabaseAdmin().from('salons').select('name').eq('id', inv.salon_id).single();
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return (
    <div className="auth"><div className="card">
      <h1>Join {salon?.name}</h1>
      <p className="muted">You have been invited as {(inv as any).staff?.name}.</p>
      {sp.err && <div className="notice err">This account could not join. It may already belong to a salon.</div>}
      {user ? <form action={accept.bind(null, token)}><button className="btn primary">Accept invite</button></form>
        : <div className="row"><Link className="btn primary" href="/sign-up">Create account</Link><Link className="btn" href="/sign-in">Sign in</Link></div>}
      {!user && <p className="muted small">After signing in, open this link again to finish.</p>}
    </div></div>
  );
}
