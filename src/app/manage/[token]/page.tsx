import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { dateLong, money, time12, STATUS_LABEL } from '@/lib/format';
import ManageActions from './ManageActions';

export const metadata = { title: 'Your appointment' };

export default async function Manage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string }> }) {
  const { token } = await params; const sp = await searchParams;
  const sb = supabaseAdmin();
  const { data: t } = await sb.from('booking_tokens').select('booking_id,expires_at').eq('token', token).eq('purpose', 'manage_booking').maybeSingle();
  if (!t || new Date(t.expires_at) < new Date()) return <div className="auth"><div className="card"><h1>Link expired</h1><p className="muted">Please contact the salon to manage your appointment.</p></div></div>;
  const { data: b } = await sb.from('bookings').select('starts_at,ends_at,status,salon_id,staff(name),booking_services(price_cents,services(name))').eq('id', t.booking_id!).single();
  if (!b) notFound();
  const { data: salon } = await sb.from('salons').select('name,phone,address,timezone,currency').eq('id', b.salon_id).single();
  const { data: st } = await sb.from('salon_settings').select('free_cancel_before').eq('salon_id', b.salon_id).single();
  const total = (b.booking_services as any[]).reduce((a, x) => a + x.price_cents, 0);
  const canAct = ['pending', 'confirmed'].includes(b.status) && new Date(b.starts_at) > new Date();
  const policy = { '2h': '2 hours', '24h': '24 hours', '48h': '48 hours' }[st!.free_cancel_before as '2h'];
  return (
    <div className="auth" style={{ maxWidth: 520 }}>
      <div className="brand" style={{ paddingLeft: 0 }}>{salon!.name}</div>
      {sp.new && <div className="notice ok">{b.status === 'pending' ? 'Request sent. We will email you once it is confirmed.' : 'You are booked in. We have emailed your confirmation.'}</div>}
      <div className="card">
        <div className="row between"><h1>{dateLong(b.starts_at, salon!.timezone)}</h1><span className={`pill ${b.status === 'confirmed' ? 'ok' : b.status === 'pending' ? 'warn' : b.status === 'cancelled' ? 'bad' : ''}`}>{STATUS_LABEL[b.status]}</span></div>
        <div className="muted" style={{ marginBottom: 14 }}>{time12(b.starts_at, salon!.timezone)}–{time12(b.ends_at, salon!.timezone)} with {(b as any).staff?.name}</div>
        {(b.booking_services as any[]).map((x, i) => <div className="row between" key={i} style={{ padding: '4px 0' }}><span>{x.services.name}</span><b>{money(x.price_cents, salon!.currency)}</b></div>)}
        <div className="row between" style={{ borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 8 }}><span className="muted">Total</span><b>{money(total, salon!.currency)}</b></div>
        <p className="muted small">{[salon!.address, salon!.phone].filter(Boolean).join(' · ')}</p>
        {canAct && <ManageActions token={token} policy={policy ?? ''} />}
      </div>
    </div>
  );
}
