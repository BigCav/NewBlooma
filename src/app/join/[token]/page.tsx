import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { S } from '@/app/(dash)/calendar/pickers';

export const metadata = { title: 'Join your team' };
export const dynamic = 'force-dynamic';

async function accept(token: string) {
  'use server';
  const sb = await supabaseServer();
  const { error } = await sb.rpc('accept_staff_invite', { p_token: token });
  if (error) redirect(`/join/${token}?err=1`);
  redirect('/calendar');
}

const BULLET = <span aria-hidden="true" style={S('width:8px;height:8px;border-radius:999px;background:#8F7CFF;flex:0 0 8px')}></span>;
const DARK = 'height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:15px;font-weight:500;padding:0 24px;display:flex;align-items:center;justify-content:center;text-decoration:none;box-sizing:border-box;width:100%';

/** Team invite, laid out like the prototype's TeamInvite: dark panel on desktop, banner on phones, one primary action and a sign-in line. */
function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="cal-root si-root" style={S("display:flex;width:100%;min-height:100vh;box-sizing:border-box;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <aside className="si-aside" style={S('flex:0 0 44%;max-width:640px;box-sizing:border-box;background:#0E1116;color:#FFFFFF;padding:56px;display:flex;flex-direction:column;justify-content:space-between;gap:40px')}>
        <Link href="/" aria-label="Aster home" style={S('align-self:flex-start;display:flex;align-items:center;min-height:44px;color:#FFFFFF;text-decoration:none;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Aster</Link>
        <div style={S('display:flex;flex-direction:column;gap:28px;max-width:440px')}>
          <h2 style={S('margin:0;font-size:44px;line-height:1.08;font-weight:600;letter-spacing:-0.03em')}>You are invited to join the team.</h2>
          <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:14px;color:#C9CDD5;font-size:16px')}>
            {['See your own appointments and shifts', 'Get notified when clients book you', 'Check out clients in a couple of taps'].map((t) => <li key={t} style={S('display:flex;gap:12px;align-items:center')}>{BULLET}{t}</li>)}
          </ul>
        </div>
        <div aria-hidden="true" style={S('color:#8A93A0;font-size:13px')}>{' '}</div>
      </aside>
      <main className="si-main" style={S('flex:1 1 auto;min-width:0;display:flex;align-items:center;justify-content:center;padding:56px 32px;box-sizing:border-box')}>
        <div style={S('width:100%;max-width:420px;display:flex;flex-direction:column;gap:20px')}>
          <div className="si-mob" style={S('flex-direction:column;gap:20px')}>
            <Link href="/" aria-label="Aster home" style={S('align-self:flex-start;display:flex;align-items:center;min-height:44px;color:#0E1116;text-decoration:none;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Aster</Link>
            <div style={S('padding:20px;border-radius:24px;background:#0E1116;color:#FFFFFF;font-size:22px;font-weight:600;letter-spacing:-0.02em;line-height:1.15')}>You are invited to join the team.</div>
          </div>
          <h1 style={S('margin:0;font-size:30px;line-height:1.15;font-weight:600;letter-spacing:-0.025em;overflow-wrap:anywhere')}>{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}

export default async function Join({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ err?: string }> }) {
  const { token } = await params; const sp = await searchParams;
  const { data: inv } = await supabaseAdmin().from('staff_invites').select('accepted_at,expires_at,salon_id,staff(name,role_title)').eq('token', token).maybeSingle();
  if (!inv || inv.accepted_at || new Date(inv.expires_at) < new Date()) return (
    <Shell title="This invite is no longer valid">
      <p style={S('margin:0;color:#5E6673;font-size:15px')}>Ask the salon owner to send you a new one from the Team page.</p>
      <Link href="/sign-in" style={S(DARK.replace('background:#0E1116;color:#FFFFFF', 'background:#FFFFFF;color:#0E1116;border:1px solid #E1E4E9'))}>Go to sign in</Link>
    </Shell>
  );
  const { data: salon } = await supabaseAdmin().from('salons').select('name').eq('id', inv.salon_id).single();
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const who = (inv as any).staff;
  return (
    <Shell title={`Join ${salon?.name ?? 'the team'}`}>
      <p style={S('margin:-12px 0 0;color:#5E6673;font-size:15px')}>You have been invited to the team{who?.name ? ` as ${who.name}` : ''}{who?.role_title ? `, a ${String(who.role_title).toLowerCase()}` : ''}.</p>
      {sp.err && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>This account could not join. It may already belong to a salon.</p>}
      {user ? (
        <form action={accept.bind(null, token)}><button style={S(DARK)}>Accept invite</button></form>
      ) : (<>
        <Link href="/sign-up" style={S(DARK)}>Create account</Link>
        <p style={S('margin:0;color:#5E6673;font-size:13.5px;text-align:center')}>After signing up, open this invite link again to finish joining.</p>
        <div style={S('display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px;padding-top:20px;border-top:1px solid #E6E8EC;font-size:14.5px;color:#5E6673')}><span>Already have an account?</span><Link href="/sign-in" style={S('padding:6px 0;color:#5B3DF5;font-weight:600;text-decoration:none')}>Sign in</Link></div>
      </>)}
    </Shell>
  );
}
