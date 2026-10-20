'use client';
// 1:1 conversion of the prototype's Payroll.dc.html and MobilePayroll.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { clockToggle, markPaid, setRate } from './actions';
import { dollars0, type PayRow } from './shared';

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
  const hoursTotal = props.rows.reduce((a, r) => a + parseFloat(r.total), 0);
  const pay = rows.reduce((a, r) => a + r.commission + r.tips, 0);
  return { ...props, busy, narrow, tab, setTab: (t: 'time' | 'comm') => { setTab(t); setNotice(''); setError(''); }, notice, error, rows, go, bump, hoursTotal, pay,
    clock: (r: PayRow) => run(() => clockToggle(r.id)), pay1: (r: PayRow) => run(() => markPaid(r.id, props.from, props.to)) };
}
type C = ReturnType<typeof usePayroll>;

const pct = (n: number) => (Math.round(n * 10) / 10) + '%';
const CELL = { done: 'background:#EEF0F3;color:#0E1116;font-weight:500', today: 'background:#ECE8FF;color:#3B2BB5;font-weight:600', plan: 'background:#F4F5F7;color:#8A93A0' };

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

function Cards({ c, m }: { c: C; m: boolean }) {
  const pad = m ? 18 : 24;
  return (<>
    {c.rows.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>No team members yet.</p>}
    {c.tab === 'time' && c.rows.map((p) => (
      <article key={p.id} style={S(`box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:${pad}px;display:flex;flex-direction:column;gap:14px`)}>
        <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px')}><div style={S('flex:1 1 160px;min-width:0')}><div style={S('font-size:16px;font-weight:600')}>{p.name}</div><div style={S('font-size:13px;color:#5E6673')}>{p.role}</div></div><div style={S('text-align:right')}><div style={S('font-size:22px;font-weight:600;letter-spacing:-0.02em')}>{p.total}</div><div style={S('font-size:12.5px;color:#5E6673')}>{p.planned}</div></div></div>
        <div style={S(`display:grid;grid-template-columns:repeat(${c.days},1fr);gap:${m ? 5 : 8}px`)}>{p.cells.map((x) => <div key={x.day} style={S('min-width:0;text-align:center')}><div style={S('font-size:11.5px;color:#8A93A0;margin-bottom:4px')}>{x.day}</div><div style={S(`padding:10px 0;border-radius:12px;font-size:${m ? 12.5 : 14}px;` + CELL[x.kind])}>{x.txt}</div></div>)}</div>
        {c.w === 0 && p.canClock && (
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px')}>
            <span style={S('flex:1 1 150px;display:flex;align-items:center;gap:8px;font-size:13.5px;color:#5E6673')}><span style={S('width:8px;height:8px;border-radius:999px;background:' + (p.inSince ? '#14A06A' : '#C3C8D0'))} />{p.inSince ? 'In since ' + p.inSince : 'Not clocked in'}</span>
            <button className="ghost" onClick={() => c.clock(p)} disabled={c.busy} style={S('height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500;padding:0 20px')}>{p.inSince ? 'Clock out' : 'Clock in'}</button>
          </div>
        )}
      </article>
    ))}
    {c.tab === 'comm' && c.owner && c.rows.map((p) => {
      const pending = !c.over, tone = pending ? ['#FFEBD0', '#7A4204'] : p.paid ? ['#DDF3EA', '#14624A'] : ['#ECE8FF', '#3B2BB5'];
      return (
        <article key={p.id} style={S(`box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:${pad}px;display:flex;flex-direction:column;gap:14px`)}>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px')}><div style={S('flex:1 1 150px;min-width:0')}><div style={S('font-size:16px;font-weight:600')}>{p.name}</div><div style={S('font-size:13px;color:#5E6673')}>{p.role}</div></div><span style={S('display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + tone[0] + ';color:' + tone[1])}>{pending ? 'Pending until Sunday' : p.paid ? 'Paid' : 'Ready to pay'}</span></div>
          <div style={S('display:grid;grid-template-columns:repeat(3,1fr);gap:10px')}>
            {([['Services', p.svc], ['Products', p.prod], ['Tips', p.tips]] as [string, number][]).map(([l, v]) => <div key={l}><div style={S('font-size:12.5px;color:#5E6673')}>{l}</div><div style={S('font-size:16px;font-weight:600')}>{dollars0(v)}</div></div>)}
          </div>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:12px 14px;border-radius:16px;background:#F4F5F7')}><span style={S('flex:1 1 120px;font-size:14px;font-weight:500')}>Service commission</span><div style={S('display:flex;align-items:center;gap:8px')}><button onClick={() => c.bump(p, -5)} aria-label="Lower commission rate" style={S('width:40px;height:40px;border-radius:999px;border:1px solid #E1E4E9;background:#FFFFFF;font-size:18px;color:#0E1116')}>−</button><span style={S('min-width:48px;text-align:center;font-weight:600')}>{pct(p.rate)}</span><button onClick={() => c.bump(p, 5)} aria-label="Raise commission rate" style={S('width:40px;height:40px;border-radius:999px;border:1px solid #E1E4E9;background:#FFFFFF;font-size:18px;color:#0E1116')}>+</button></div></div>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px')}><div style={S('flex:1 1 150px')}><div style={S('font-size:12.5px;color:#5E6673')}>Commission + tips</div><div style={S('font-size:22px;font-weight:600;letter-spacing:-0.03em')}>{dollars0(p.commission + p.tips)}</div></div>{c.over && !p.paid && <button onClick={() => c.pay1(p)} disabled={c.busy} style={S('height:44px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500;padding:0 20px')}>Mark as paid</button>}</div>
          <div style={S('font-size:12.5px;color:#8A93A0')}>Includes {pct(p.prodPct)} on product sales ({dollars0(p.commission)} commission before tips)</div>
        </article>
      );
    })}
  </>);
}

function Desktop({ c }: { c: C }) {
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Payroll" subtitle="Timesheets and commission" showSearch={false} showAction={false} />
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <section aria-label="Team" style={S('flex:999 1 560px;min-width:0;display:flex;flex-direction:column;gap:16px')}><Cards c={c} m={false} /></section>
        <aside className="side-sticky" aria-label="Pay period" style={S('flex:1 1 440px;max-width:520px;min-width:0;display:flex;flex-direction:column;gap:16px')}><Controls c={c} m={false} /></aside>
      </div>
    </div>
  );
}
function Mobile({ c }: { c: C }) {
  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Payroll" subtitle="Timesheets and commission" showSearch={false} />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}><Controls c={c} m={true} /><Cards c={c} m={true} /></main>
      <MobileTabs active="more" />
    </div>
  );
}
export function PayrollView(props: Props) {
  const c = usePayroll(props);
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
