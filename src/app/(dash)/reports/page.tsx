import Link from 'next/link';
import { requireCtx } from '@/lib/session';
import { addDays, money, ymd } from '@/lib/format';

export const metadata = { title: 'Reports' };
const RANGES: [string, string, number][] = [['7', 'Last 7 days', 6], ['30', 'Last 30 days', 29], ['90', 'Last 90 days', 89]];

export default async function Reports({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  const { sb, salon } = await requireCtx();
  const range = RANGES.find((x) => x[0] === r) ?? RANGES[1];
  const to = ymd(new Date(), salon.timezone), from = addDays(to, -range[2]);
  const { data, error } = await sb.rpc('report_summary', { p_from: from, p_to: to });
  const d = (data ?? {}) as any;
  const cur = salon.currency;
  const maxHour = Math.max(1, ...((d.by_hour ?? []) as any[]).map((h) => h.count));
  const maxStaff = Math.max(1, ...((d.by_staff ?? []) as any[]).map((h) => Number(h.revenue_cents)));
  const h12 = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
  return (
    <>
      <div className="page-head"><div><h1>Reports</h1><div className="muted">{from} to {to}</div></div>
        <div className="row wrap">{RANGES.map(([v, l]) => <Link key={v} href={`/reports?r=${v}`} className={`btn sm ${range[0] === v ? 'dark' : ''}`}>{l}</Link>)}</div></div>
      {error ? <div className="notice err">Could not load the report.</div> : (<>
        <div className="grid g4" style={{ marginBottom: 16 }}>
          <div className="card" style={{ margin: 0 }}><div className="muted small">Revenue</div><div className="big">{money(Number(d.revenue_cents ?? 0), cur)}</div><div className="muted small">{d.sales_count ?? 0} sales</div></div>
          <div className="card" style={{ margin: 0 }}><div className="muted small">Net of tax</div><div className="big">{money(Number(d.net_cents ?? 0), cur)}</div></div>
          <div className="card" style={{ margin: 0 }}><div className="muted small">Tips</div><div className="big">{money(Number(d.tips_cents ?? 0), cur)}</div></div>
          <div className="card" style={{ margin: 0 }}><div className="muted small">New clients</div><div className="big">{d.new_clients ?? 0}</div></div>
        </div>
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <div className="card" style={{ margin: 0 }}><h2 style={{ marginBottom: 10 }}>Appointments</h2>
            {[['Total', d.bookings_total], ['Completed', d.bookings_completed], ['Cancelled', d.bookings_cancelled], ['No-shows', d.bookings_no_show]].map(([l, v]) => <div className="row between" key={l as string} style={{ padding: '6px 0' }}><span className="muted">{l}</span><b>{v ?? 0}</b></div>)}</div>
          <div className="card" style={{ margin: 0 }}><h2 style={{ marginBottom: 10 }}>Revenue by team member</h2>
            {!(d.by_staff ?? []).length ? <div className="muted">No team members.</div> : (d.by_staff as any[]).map((s) => <div key={s.staff_id} style={{ padding: '6px 0' }}><div className="row between small"><span>{s.name}</span><b>{money(Number(s.revenue_cents), cur)}</b></div><div style={{ height: 8, borderRadius: 8, background: 'var(--bg)' }}><div style={{ height: 8, borderRadius: 8, background: 'var(--accent)', width: `${(Number(s.revenue_cents) / maxStaff) * 100}%` }} /></div></div>)}</div>
          <div className="card" style={{ margin: 0 }}><h2 style={{ marginBottom: 10 }}>Top services</h2>
            {!(d.top_services ?? []).length ? <div className="muted">No paid services in this period.</div> : (d.top_services as any[]).map((s) => <div className="row between" key={s.name} style={{ padding: '6px 0' }}><span>{s.name} <span className="muted small">× {s.count}</span></span><b>{money(Number(s.revenue_cents), cur)}</b></div>)}</div>
          <div className="card" style={{ margin: 0 }}><h2 style={{ marginBottom: 10 }}>Busiest hours</h2>
            {!(d.by_hour ?? []).length ? <div className="muted">No appointments in this period.</div> : <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>{(d.by_hour as any[]).map((h) => <div key={h.hour} style={{ flex: 1, textAlign: 'center' }} title={`${h.count} at ${h12(h.hour)}`}><div style={{ background: 'var(--accent)', borderRadius: 6, height: `${(h.count / maxHour) * 90}px`, minHeight: 4 }} /><div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{h12(h.hour)}</div></div>)}</div>}</div>
        </div></>)}
    </>
  );
}
