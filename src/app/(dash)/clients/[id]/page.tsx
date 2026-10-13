import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/session';
import ActionForm from '@/components/ActionForm';
import { dateLong, money, time12, STATUS_LABEL } from '@/lib/format';
import { updateClient } from '../actions';

export const metadata = { title: 'Client' };

export default async function Client({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, salon } = await requireCtx();
  const { data: c } = await sb.from('clients').select('*').eq('id', id).maybeSingle();
  if (!c) notFound();
  const [{ data: bookings }, { data: sales }] = await Promise.all([
    sb.from('bookings').select('id,starts_at,status,staff(name),booking_services(services(name))').eq('client_id', id).order('starts_at', { ascending: false }).limit(50),
    sb.from('sales').select('total_cents,status').eq('client_id', id),
  ]);
  const spent = (sales ?? []).filter((x) => x.status === 'paid').reduce((a, x) => a + x.total_cents, 0);
  const visits = (bookings ?? []).filter((b) => b.status === 'completed').length;
  return (
    <>
      <div className="page-head"><div><Link href="/clients" className="muted small">‹ Clients</Link><h1>{c.name}</h1></div>
        <Link className="btn primary" href={`/calendar/new?client=${c.id}`}>Book appointment</Link></div>
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card"><div className="muted small">Visits</div><div className="big">{visits}</div></div>
        <div className="card"><div className="muted small">Total spent</div><div className="big">{money(spent, salon.currency)}</div></div>
        <div className="card"><div className="muted small">Client since</div><div className="big" style={{ fontSize: 22 }}>{dateLong(c.created_at, salon.timezone)}</div></div>
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Details</h2>
          <ActionForm action={updateClient}>
            <input type="hidden" name="id" value={c.id} />
            <div className="field"><label>Name</label><input name="name" defaultValue={c.name} required /></div>
            <div className="grid g2"><div className="field"><label>Email</label><input name="email" type="email" defaultValue={c.email ?? ''} /></div><div className="field"><label>Phone</label><input name="phone" defaultValue={c.phone ?? ''} /></div></div>
            <div className="field"><label>Notes</label><textarea name="notes" rows={4} defaultValue={c.notes ?? ''} /></div>
          </ActionForm>
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 8 }}>History</h2>
          {!bookings?.length ? <div className="empty">No appointments yet.</div> : (bookings as any[]).map((b) => (
            <Link key={b.id} href={`/calendar/${b.id}`} className="row between" style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
              <span><b>{dateLong(b.starts_at, salon.timezone)}</b> <span className="muted">{time12(b.starts_at, salon.timezone)}</span><div className="muted small">{b.booking_services.map((x: any) => x.services.name).join(', ')} · {b.staff?.name}</div></span>
              <span className="pill">{STATUS_LABEL[b.status]}</span></Link>
          ))}
        </div>
      </div>
    </>
  );
}
