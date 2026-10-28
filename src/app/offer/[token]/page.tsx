import { supabaseAdmin } from '@/lib/supabase/admin';
import { dateLong, time12 } from '@/lib/format';
import { flushOutbox } from '@/lib/notify';

export const metadata = { title: 'Appointment offer' };

async function accept(token: string) {
  'use server';
  const { redirect } = await import('next/navigation');
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc('accept_offer', { p_token: token });
  if (error || !data) redirect(`/offer/${token}?gone=1`);
  await flushOutbox();
  const { data: t } = await sb.from('booking_tokens').select('token').eq('booking_id', data).eq('purpose', 'manage_booking').single();
  redirect(`/manage/${t!.token}?new=1`);
}

export default async function Offer({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ gone?: string }> }) {
  const { token } = await params; const sp = await searchParams;
  const sb = supabaseAdmin();
  const { data: t } = await sb.from('booking_tokens').select('waitlist_id,expires_at,used_at,salon_id').eq('token', token).eq('purpose', 'accept_offer').maybeSingle();
  const { data: e } = t ? await sb.from('waitlist_entries').select('status,offered_start,services(name),staff:offered_staff_id(name)').eq('id', t.waitlist_id!).single() : { data: null };
  const { data: salon } = t ? await sb.from('salons').select('name,timezone').eq('id', t.salon_id).single() : { data: null };
  const live = t && !t.used_at && new Date(t.expires_at) > new Date() && e?.status === 'offered' && !sp.gone;
  if (!live || !e || !salon) return <div className="auth"><div className="card"><h1>This offer is no longer available</h1><p className="muted">Sorry, the time has been taken or the offer expired. You are still on the waitlist for the next opening.</p></div></div>;
  return (
    <div className="auth"><div className="card">
      <div className="brand" style={{ paddingLeft: 0 }}>{salon.name}</div>
      <h1>A time just opened up</h1>
      <p style={{ fontSize: 18 }}><b>{(e as any).services?.name}</b><br />{dateLong(e.offered_start!, salon.timezone)} at {time12(e.offered_start!, salon.timezone)} with {(e as any).staff?.name}</p>
      <p className="muted small">Offer held until {time12(t!.expires_at, salon.timezone)}.</p>
      <form action={accept.bind(null, token)}><button className="btn primary" style={{ width: '100%' }}>Book this time</button></form>
    </div></div>
  );
}
