import Link from 'next/link';
import { requireCtx } from '@/lib/session';
import { dateLong, money, time12 } from '@/lib/format';

export const metadata = { title: 'Sales' };

export default async function Sales({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const { sb, salon } = await requireCtx();
  let q = sb.from('sales').select('id,status,method,total_cents,created_at,paid_at,description,clients(name),staff(name)').order('created_at', { ascending: false }).limit(100);
  if (s && ['pending', 'paid', 'refunded'].includes(s)) q = q.eq('status', s);
  const { data: sales } = await q;
  const paid = (sales ?? []).filter((x) => x.status === 'paid').reduce((a, x) => a + x.total_cents, 0);
  return (
    <>
      <div className="page-head"><div><h1>Sales</h1><div className="muted">{money(paid, salon.currency)} paid in this list</div></div>
        <div className="row wrap">{[['', 'All'], ['pending', 'Open'], ['paid', 'Paid'], ['refunded', 'Refunded']].map(([v, l]) => <Link key={v} className={`btn sm ${(s ?? '') === v ? 'dark' : ''}`} href={v ? `/sales?s=${v}` : '/sales'}>{l}</Link>)}
          <Link className="btn primary" href="/sales/new">New retail sale</Link></div></div>
      <div className="card">
        {!sales?.length ? <div className="empty">No sales yet. Check out an appointment from the calendar to create one.</div> : (
          <table className="stack-m"><thead><tr><th>When</th><th>Client</th><th>Staff</th><th>Method</th><th>Status</th><th className="right">Total</th></tr></thead><tbody>
            {(sales as any[]).map((x) => <tr key={x.id}>
              <td><Link href={`/sales/${x.id}`}><b>{dateLong(x.paid_at ?? x.created_at, salon.timezone)}</b> <span className="muted">{time12(x.paid_at ?? x.created_at, salon.timezone)}</span></Link></td>
              <td>{x.clients?.name ?? <span className="muted">Walk-in</span>}</td><td className="muted">{x.staff?.name}</td><td className="muted">{x.method ?? ''}</td>
              <td><span className={`pill ${x.status === 'paid' ? 'ok' : x.status === 'refunded' ? 'bad' : 'warn'}`}>{x.status === 'pending' ? 'Open' : x.status}</span></td>
              <td className="right"><b>{money(x.total_cents, salon.currency)}</b></td></tr>)}
          </tbody></table>)}
      </div>
    </>
  );
}
