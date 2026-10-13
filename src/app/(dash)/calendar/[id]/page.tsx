import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/session';
import { dateLong, money, time12, STATUS_LABEL } from '@/lib/format';
import { setStatus, startCheckout } from '../actions';

export const metadata = { title: 'Appointment' };

export default async function Appt({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const { sb, salon } = await requireCtx();
  const { data: b } = await sb.from('bookings').select('*,clients(id,name,email,phone),staff(name),booking_services(price_cents,duration_min,services(name))').eq('id', id).maybeSingle();
  if (!b) notFound();
  const { data: sale } = await sb.from('sales').select('id,status').eq('booking_id', id).neq('status', 'refunded').maybeSingle();
  const total = (b.booking_services as any[]).reduce((a, x) => a + x.price_cents, 0);
  const live = ['pending', 'confirmed', 'checked_in', 'in_progress'].includes(b.status);
  const Btn = ({ status, label, cls = '', approve = false }: { status: string; label: string; cls?: string; approve?: boolean }) => (
    <form action={setStatus}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value={status} />{approve && <input type="hidden" name="approve" value="1" />}<button className={`btn ${cls}`}>{label}</button></form>
  );
  return (
    <>
      <div className="page-head"><div><Link href="/calendar" className="muted small">‹ Calendar</Link><h1>{(b as any).clients?.name}</h1>
        <div className="muted">{dateLong(b.starts_at, salon.timezone)} · {time12(b.starts_at, salon.timezone)}–{time12(b.ends_at, salon.timezone)} · with {(b as any).staff?.name}</div></div>
        <span className={`pill ${b.status === 'completed' ? 'ok' : b.status === 'pending' ? 'warn' : b.status === 'cancelled' || b.status === 'no_show' ? 'bad' : ''}`}>{STATUS_LABEL[b.status]}</span></div>
      {sp.err && <div className="notice err">{sp.err}</div>}
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2 style={{ marginBottom: 10 }}>Services</h2>
          {(b.booking_services as any[]).map((x, i) => <div className="row between" key={i} style={{ padding: '6px 0' }}><span>{x.services.name} <span className="muted small">{x.duration_min} min</span></span><b>{money(x.price_cents, salon.currency)}</b></div>)}
          <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 6 }}><span className="muted">Subtotal</span><b>{money(total, salon.currency)}</b></div>
          {b.notes && <p className="muted" style={{ marginBottom: 0 }}>{b.notes}</p>}
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 10 }}>Client</h2>
          <Link href={`/clients/${(b as any).clients.id}`}><b>{(b as any).clients.name}</b></Link>
          <div className="muted">{(b as any).clients.email}</div><div className="muted">{(b as any).clients.phone}</div>
          <div className="row wrap" style={{ marginTop: 18 }}>
            {b.status === 'pending' && <Btn status="confirmed" label="Approve" cls="primary" approve />}
            {b.status === 'confirmed' && <Btn status="checked_in" label="Check in" />}
            {b.status === 'checked_in' && <Btn status="in_progress" label="Start" />}
            {live && b.status !== 'pending' && !sale && <form action={startCheckout}><input type="hidden" name="id" value={b.id} /><button className="btn primary">Checkout</button></form>}
            {sale && <Link className="btn primary" href={`/sales?sale=${sale.id}&pay=1`}>{sale.status === 'paid' ? 'View sale' : 'Continue checkout'}</Link>}
            {live && <Btn status="no_show" label="No-show" />}
            {live && <Btn status="cancelled" label="Cancel" cls="danger" />}
          </div>
        </div>
      </div>
    </>
  );
}
