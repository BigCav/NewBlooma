import Link from 'next/link';
import { requireCtx } from '@/lib/session';
import { addDays, money, time12, ymd } from '@/lib/format';
import { clock, markPaid } from './actions';

export const metadata = { title: 'Payroll' };

export default async function Payroll({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const { sb, salon, staff } = await requireCtx();
  const owner = staff.app_role === 'owner';
  const today = ymd(new Date(), salon.timezone);
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? '') ? sp.from! : addDays(today, -dow);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? '') ? sp.to! : addDays(from, 6);
  const { data: open } = await sb.from('timesheets').select('clock_in').eq('staff_id', staff.id).is('clock_out', null).maybeSingle();
  const { data: rows } = owner ? await sb.rpc('payroll_summary', { p_from: from, p_to: to }) : { data: null };
  const total = (rows ?? []).reduce((a: number, r: any) => a + Number(r.commission_cents), 0);
  return (
    <>
      <div className="page-head"><div><h1>Payroll</h1><div className="muted">Time clock{owner ? ' and commission' : ''}</div></div></div>
      <div className="card">
        <h2 style={{ marginBottom: 8 }}>Your shift</h2>
        {open ? <p className="muted">Clocked in at {time12(open.clock_in, salon.timezone)}.</p> : <p className="muted">You are clocked out.</p>}
        <form action={clock}><input type="hidden" name="act" value={open ? 'out' : 'in'} /><button className="btn primary">{open ? 'Clock out' : 'Clock in'}</button></form>
      </div>
      {owner && (
        <div className="card">
          <div className="row between wrap" style={{ marginBottom: 12 }}><h2>Commission</h2>
            <form className="row wrap"><input type="date" name="from" defaultValue={from} aria-label="From" style={{ width: 160 }} /><span className="muted">to</span><input type="date" name="to" defaultValue={to} aria-label="To" style={{ width: 160 }} /><button className="btn sm">Update</button></form></div>
          {!rows?.length ? <div className="empty">No team members yet.</div> : (
            <table className="stack-m"><thead><tr><th>Team member</th><th className="right">Hours</th><th className="right">Service sales</th><th className="right">Rate</th><th className="right">Commission</th><th /></tr></thead><tbody>
              {(rows as any[]).map((r) => <tr key={r.staff_id}><td><b>{r.staff_name}</b></td><td className="right">{Number(r.hours).toFixed(2)}</td><td className="right">{money(Number(r.service_subtotal_cents), salon.currency)}</td><td className="right">{Number(r.commission_pct)}%</td><td className="right"><b>{money(Number(r.commission_cents), salon.currency)}</b></td>
                <td className="right">{r.paid_at ? <span className="pill ok">Paid</span> : Number(r.commission_cents) > 0 || Number(r.hours) > 0 ? <form action={markPaid}><input type="hidden" name="staff" value={r.staff_id} /><input type="hidden" name="from" value={from} /><input type="hidden" name="to" value={to} /><button className="btn sm">Mark paid</button></form> : null}</td></tr>)}
            </tbody></table>)}
          <div className="row between" style={{ borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 12 }}><span className="muted">Total commission</span><b>{money(total, salon.currency)}</b></div>
          <p className="muted small" style={{ marginBottom: 0 }}>Commission is the team member's rate applied to paid service sales (before tip) in the period. Once marked paid, a period is locked.</p>
        </div>)}
    </>
  );
}
