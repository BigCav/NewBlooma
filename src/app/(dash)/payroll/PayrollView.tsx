'use client';
// 1:1 conversion of the prototype's Payroll.dc.html and MobilePayroll.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { S } from '../calendar/pickers';
import { clockToggle, markPaid, setRate } from './actions';
import { hrs, type PayRow } from './shared';
import { PayrollMobile } from './PayrollMobile';
import { PayrollDesk } from './PayrollDesk';

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
  const hoursTotal = props.rows.reduce((a, r) => a + r.hours, 0);
  const hoursText = hrs(hoursTotal);
  const pay = rows.reduce((a, r) => a + r.commission + r.tips, 0);
  return { ...props, editing, setEditing, busy, narrow, tab, setTab: (t: 'time' | 'comm') => { setTab(t); setNotice(''); setError(''); }, notice, error, rows, go, bump, hoursTotal, hoursText, pay,
    clock: (r: PayRow) => run(() => clockToggle(r.id)), pay1: (r: PayRow) => run(() => markPaid(r.id, props.from, props.to)) };
}
type C = ReturnType<typeof usePayroll>;
export type PayrollCtl = C;

function Desktop({ c }: { c: C }) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 32px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PayrollDesk c={c} onOpen={setSel} />
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
