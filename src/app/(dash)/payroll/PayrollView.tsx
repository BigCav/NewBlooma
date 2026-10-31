'use client';
// 1:1 conversion of the prototype's Payroll.dc.html and MobilePayroll.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { clockToggle, markPaid, setRate } from './actions';
import { dollars0, type PayRow } from './shared';
import { PayrollMobile, PayRows } from './PayrollMobile';

type Props = { rows: PayRow[]; w: number; from: string; to: string; over: boolean; days: number; owner: boolean; title: string; range: string };

function usePayroll(props: Props) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const [tab, setTab] = useState<'time' | 'comm'>('time');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [rates, setRates] = useState<Record<string, number>>({});
  useEffect(() => { setRates({}); }, [props.rows]);
  const go = (n: number) => { setNotice(''); setError(''); startT(() => { router.push(n === 0 ? '/payroll' : `/payroll?w=${n}`); }); };
  const run = (fn: () => Promise<{ error?: string; notice?: string }>) => startT(async () => { const r = await fn(); if (r.error) { setError(r.error); setNotice(''); return; } setError(''); setNotice(r.notice ?? ''); router.refresh(); });
  const rows = props.rows.map((r) => {
    const rate = rates[r.id] ?? r.rate;
    const commission = rates[r.id] != null ? Math.round(r.svc * rate / 100) + Math.round(r.prod * r.prodPct / 100) : r.commission;
    return { ...r, rate, commission };
  });
  const bump = (r: (typeof rows)[number], d: number) => {
    const next = Math.max(0, Math.min(100, r.rate + d));
    if (next === r.rate) return;
    setRates((x) => ({ ...x, [r.id]: next })); setNotice(''); setError('');
    startT(async () => { const res = await setRate(r.id, next, props.from, props.to); if (res.error) { setError(res.error); setRates((x) => { const y = { ...x }; delete y[r.id]; return y; }); } else router.refresh(); });
  };
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => { setEditing(null); }, [props.w]);
  const hoursTotal = props.rows.reduce((a, r) => a + parseFloat(r.total), 0);
  const pay = rows.reduce((a, r) => a + r.commission + r.tips, 0);
  return { ...props, editing, setEditing, busy, narrow, tab, setTab: (t: 'time' | 'comm') => { setTab(t); setNotice(''); setError(''); }, notice, error, rows, go, bump, hoursTotal, pay,
    clock: (r: PayRow) => run(() => clockToggle(r.id)), pay1: (r: PayRow) => run(() => markPaid(r.id, props.from, props.to)) };
}
type C = ReturnType<typeof usePayroll>;
export type PayrollCtl = C;


function Controls({ c, m }: { c: C; m: boolean }) {
  const tabs: [('time' | 'comm'), string][] = c.owner ? [['time', 'Timesheets'], ['comm', 'Commission']] : [['time', 'Timesheets']];
  const pad = m ? 18 : 24;
  const hoursText = (Math.round(c.hoursTotal * 10) / 10) + 'h';
  return (<>
    <div role="tablist" aria-label="Payroll view" style={S('display:flex;gap:4px;padding:4px;border-radius:999px;background:#E9ECF0;flex:0 0 auto')}>
      {tabs.map(([id, label]) => <button key={id} role="tab" onClick={() => c.setTab(id)} aria-selected={c.tab === id} style={S('flex:1 1 0;height:44px;border:0;border-radius:999px;font-size:14px;font-weight:500;background:' + (c.tab === id ? '#0E1116' : 'transparent') + ';color:' + (c.tab === id ? '#FFFFFF' : '#0E1116'))}>{label}</button>)}
    </div>
    <div role="group" aria-label="Pay period" style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:8px;display:flex;flex-wrap:nowrap;align-items:center;gap:8px;border-radius:999px')}>
      <button onClick={() => c.go(c.w + 1)} disabled={c.w >= 104} aria-label="Previous week" style={S('flex:0 0 44px;width:44px;height:44px;border-radius:999px;border:0;background:#F4F5F7;font-size:20px;color:' + (c.w >= 104 ? '#B5BBC5' : '#0E1116'))}>‹</button>
      <div style={S('flex:1 1 auto;min-width:0;text-align:center;white-space:nowrap')}><div style={S('font-size:15px;font-weight:600')}>{c.title}</div><div style={S('font-size:12.5px;color:#5E6673')}>{c.range}</div></div>
      <button onClick={() => c.go(c.w - 1)} disabled={c.w === 0} aria-label="Next week" style={S('flex:0 0 44px;width:44px;height:44px;border-radius:999px;border:0;background:#F4F5F7;font-size:20px;color:' + (c.w === 0 ? '#B5BBC5' : '#0E1116'))}>›</button>
    </div>
    {!!c.notice && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{c.notice}</span>}
    {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
    <div style={S(`box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:${pad}px;display:flex;flex-wrap:wrap;gap:${m ? 16 : 40}px`)}>
      <div><div style={S('color:#5E6673;font-size:13px')}>Hours worked</div><div style={S('font-size:26px;font-weight:500;letter-spacing:-0.03em')}>{hoursText}</div></div>
      {c.owner && <div><div style={S('color:#5E6673;font-size:13px')}>Team payout</div><div style={S('font-size:26px;font-weight:500;letter-spacing:-0.03em')}>{dollars0(c.pay)}</div></div>}
    </div>
  </>);
}

function Desktop({ c }: { c: C }) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Payroll" subtitle="Timesheets and commission" showSearch={false} showAction={false} />
      <div style={S('display:flex;flex-direction:column;gap:16px;max-width:760px')}><Controls c={c} m={false} /></div>
      <section aria-label="Team" style={S('display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:16px;align-items:start')}><PayRows c={c} onOpen={setSel} /></section>
      {sel && <PayrollMobile key={sel + c.tab} c={c} drawer startId={sel} onClose={() => setSel(null)} />}
    </div>
  );
}
export function PayrollView(props: Props) {
  const c = usePayroll(props);
  return (<>
    {c.narrow !== false && <PayrollMobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
