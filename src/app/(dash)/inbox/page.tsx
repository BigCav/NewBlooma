import Link from 'next/link';
import { requireCtx } from '@/lib/session';
import { dateLong, time12 } from '@/lib/format';
import { handleItem, markRead } from './actions';

export const metadata = { title: 'Inbox' };
const LABEL: Record<string, string> = { request: 'Booking request', reschedule: 'Reschedule request', message: 'Message', cancellation: 'Cancellation', booking: 'New booking' };

export default async function Inbox({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const { sb, salon } = await requireCtx();
  let q = sb.from('inbox_items').select('id,type,body,unread,status,created_at,booking_id,clients(name),bookings(starts_at,status,staff(name),booking_services(services(name)))').order('created_at', { ascending: false }).limit(100);
  if (f === 'new') q = q.eq('status', 'new');
  const { data: items } = await q;
  return (
    <>
      <div className="page-head"><div><h1>Inbox</h1><div className="muted">{(items ?? []).filter((i) => i.unread).length} unread</div></div>
        <div className="row"><Link className={`btn sm ${f !== 'new' ? 'dark' : ''}`} href="/inbox">All</Link><Link className={`btn sm ${f === 'new' ? 'dark' : ''}`} href="/inbox?f=new">Needs action</Link></div></div>
      {!items?.length ? <div className="card empty">Nothing here yet. Online bookings, cancellations and reschedule requests land here.</div> : (items as any[]).map((i) => {
        const b = i.bookings;
        return (
          <div className="card" key={i.id} style={i.unread ? { borderColor: 'var(--accent)' } : undefined}>
            <div className="row between wrap"><div><span className="pill">{LABEL[i.type]}</span> {i.status !== 'new' && <span className="pill ok">{i.status}</span>}
              <h3 style={{ marginTop: 8 }}>{i.clients?.name ?? 'Client'}</h3>
              {b && <div className="muted">{dateLong(b.starts_at, salon.timezone)} · {time12(b.starts_at, salon.timezone)} · {b.booking_services.map((x: any) => x.services.name).join(', ')} · {b.staff?.name}</div>}
              {i.body && <p style={{ margin: '8px 0 0' }}>{i.body}</p>}</div>
              <span className="muted small">{dateLong(i.created_at, salon.timezone)} {time12(i.created_at, salon.timezone)}</span></div>
            <div className="row wrap" style={{ marginTop: 12 }}>
              {i.type === 'request' && i.status === 'new' && b?.status === 'pending' && (<>
                <form action={handleItem}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="booking" value={i.booking_id} /><input type="hidden" name="act" value="approve" /><button className="btn primary sm">Approve</button></form>
                <form action={handleItem}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="booking" value={i.booking_id} /><input type="hidden" name="act" value="decline" /><button className="btn danger sm">Decline</button></form></>)}
              {i.booking_id && <Link className="btn sm" href={`/calendar/${i.booking_id}`}>Open appointment</Link>}
              {i.status === 'new' && i.type !== 'request' && <form action={handleItem}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="act" value="done" /><button className="btn sm">Mark handled</button></form>}
              {i.unread && <form action={markRead}><input type="hidden" name="id" value={i.id} /><button className="btn sm">Mark read</button></form>}
            </div>
          </div>);
      })}
    </>
  );
}
