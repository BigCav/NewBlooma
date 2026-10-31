'use client';
import { PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { photoCss } from '../team/shared';
import { dollars0, type PayRow } from './shared';
import type { PayrollCtl } from './PayrollView';

const CELL = { done: 'background:#EEF0F3;color:#0E1116;font-weight:500', today: 'background:#ECE8FF;color:#3B2BB5;font-weight:600', plan: 'background:#F4F5F7;color:#8A93A0' };
const initials = (n: string) => n.split(' ').filter((w) => /[A-Za-z0-9]/.test(w[0] ?? '')).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'C';
const AV = 'flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600';
const CHEV = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true"><path d="M9.5 6l6 6-6 6" /></svg>;
const ARROW = (d: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const ROW = 'display:flex;align-items:center;gap:16px;width:100%;box-sizing:border-box;padding:12px 24px;border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;font-size:14px;color:#0E1116;background:transparent';
const HEAD = 'display:flex;align-items:center;gap:16px;padding:12px 24px;border-bottom:1px solid #EEF0F3;color:#5E6673;font-size:12.5px;font-weight:500';
const chip = (on: boolean) => 'height:40px;padding:0 16px;border-radius:999px;font:inherit;font-size:13.5px;font-weight:500;cursor:pointer;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
const big = (l: string, v: string) => <div key={l}><div style={S('color:#5E6673;font-size:13.5px')}>{l}</div><div style={S('margin-top:4px;font-size:38px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div></div>;

function payTone(c: PayrollCtl, p: PayRow) {
  return !c.over ? { t: 'Pending', bg: '#FFEBD0', fg: '#7A4204' } : p.paid ? { t: 'Paid', bg: '#DDF3EA', fg: '#14624A' } : { t: 'Ready to pay', bg: '#ECE8FF', fg: '#3B2BB5' };
}

/** Desktop payroll: totals, then one table of the team for the chosen week. A row opens in the drawer. */
export function PayrollDesk({ c, onOpen }: { c: PayrollCtl; onOpen: (id: string) => void }) {
  const hoursText = (Math.round(c.hoursTotal * 10) / 10) + 'h';
  const tabs: [('time' | 'comm'), string][] = c.owner ? [['time', 'Timesheets'], ['comm', 'Commission']] : [['time', 'Timesheets']];
  const who = (p: PayRow) => (
    <span style={S('flex:2.2 1 0;min-width:0;display:flex;align-items:center;gap:12px')}>
      <span style={S(AV + photoCss(p.photo))}>{p.photo ? '' : initials(p.name)}</span>
      <span style={S('min-width:0')}><span style={S('display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.name}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.role}</span></span>
    </span>
  );
  return (<>
    <PageHeader title="Payroll" subtitle="Timesheets and commission" showSearch={false} showAction={false} />
    <section aria-label="Pay period at a glance" style={S('display:flex;flex-wrap:wrap;align-items:flex-end;gap:20px 64px')}>
      {big('Hours worked', hoursText)}
      {c.owner && big('Team payout', dollars0(c.pay))}
      {big('Team members', String(c.rows.length))}
    </section>
    {!!c.notice && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{c.notice}</span>}
    {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
    <section aria-label="Team" style={S('background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
      <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 24px;border-bottom:1px solid #E6E8EC')}>
        <div role="tablist" aria-label="Payroll view" style={S('display:flex;gap:8px')}>
          {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={c.tab === id} onClick={() => c.setTab(id)} style={S(chip(c.tab === id))}>{label}</button>)}
        </div>
        <div role="group" aria-label="Pay period" style={S('display:flex;align-items:center;gap:12px')}>
          <button className="ghost" onClick={() => c.go(c.w + 1)} disabled={c.w >= 104} aria-label="Previous week" style={S('width:40px;height:40px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center')}>{ARROW('M14.5 6l-6 6 6 6')}</button>
          <div style={S('min-width:190px;text-align:center;white-space:nowrap')}><div style={S('font-size:14.5px;font-weight:600')}>{c.title}</div><div style={S('font-size:12.5px;color:#5E6673')}>{c.range}</div></div>
          <button className="ghost" onClick={() => c.go(c.w - 1)} disabled={c.w === 0} aria-label="Next week" style={S('width:40px;height:40px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center')}>{ARROW('M9.5 6l6 6-6 6')}</button>
        </div>
      </div>
      {c.rows.length === 0 && <p style={S('margin:0;padding:24px;color:#5E6673;font-size:14px')}>No team members yet.</p>}
      {c.tab === 'time' && c.rows.length > 0 && (<>
        <div style={S(HEAD)}>
          <span style={S('flex:2.2 1 0;min-width:0')}>Team member</span>
          <span style={S(`flex:5 1 0;min-width:0;display:grid;grid-template-columns:repeat(${c.days},1fr);gap:6px;text-align:center`)}>{c.rows[0].cells.map((x) => <span key={x.day}>{x.day}</span>)}</span>
          <span style={S('flex:1 1 0;min-width:0;text-align:right')}>Hours</span>
          <span style={S('flex:1.4 1 0;min-width:0')}>Clock</span>
          <span style={S('flex:0 0 18px')} />
        </div>
        {c.rows.map((p) => (
          <button key={p.id} className="s-row" onClick={() => onOpen(p.id)} aria-label={`${p.name}, ${p.total} ${p.planned}`} style={S(ROW)}>
            {who(p)}
            <span style={S(`flex:5 1 0;min-width:0;display:grid;grid-template-columns:repeat(${c.days},1fr);gap:6px`)}>
              {p.cells.map((x) => <span key={x.day} style={S('padding:9px 0;border-radius:12px;text-align:center;font-size:13px;' + CELL[x.kind])}>{x.txt}</span>)}
            </span>
            <span style={S('flex:1 1 0;min-width:0;text-align:right')}><span style={S('display:block;font-size:16px;font-weight:600;letter-spacing:-0.01em')}>{p.total}</span><span style={S('display:block;font-size:12px;color:#5E6673')}>{p.planned}</span></span>
            <span style={S('flex:1.4 1 0;min-width:0;display:flex;align-items:center;gap:8px;font-size:13px;color:#5E6673')}>
              {c.w === 0 && p.canClock ? (<><span style={S('width:8px;height:8px;border-radius:999px;background:' + (p.inSince ? '#14A06A' : '#C3C8D0'))} />{p.inSince ? 'In since ' + p.inSince : 'Not clocked in'}</>) : 'Not tracked'}
            </span>
            {CHEV}
          </button>
        ))}
      </>)}
      {c.tab === 'comm' && c.owner && c.rows.length > 0 && (<>
        <div style={S(HEAD)}>
          <span style={S('flex:2.2 1 0;min-width:0')}>Team member</span>
          <span style={S('flex:1 1 0;min-width:0')}>Services</span><span style={S('flex:1 1 0;min-width:0')}>Products</span><span style={S('flex:1 1 0;min-width:0')}>Tips</span><span style={S('flex:0.8 1 0;min-width:0')}>Rate</span>
          <span style={S('flex:1.3 1 0;min-width:0;text-align:right')}>Commission + tips</span><span style={S('flex:1.2 1 0;min-width:0')}>Status</span>
          <span style={S('flex:0 0 18px')} />
        </div>
        {c.rows.map((p) => {
          const t = payTone(c, p);
          return (
            <button key={p.id} className="s-row" onClick={() => onOpen(p.id)} aria-label={`${p.name}, ${dollars0(p.commission + p.tips)}, ${t.t}`} style={S(ROW)}>
              {who(p)}
              <span style={S('flex:1 1 0;min-width:0')}>{dollars0(p.svc)}</span><span style={S('flex:1 1 0;min-width:0')}>{dollars0(p.prod)}</span><span style={S('flex:1 1 0;min-width:0')}>{dollars0(p.tips)}</span><span style={S('flex:0.8 1 0;min-width:0')}>{(Math.round(p.rate * 10) / 10) + '%'}</span>
              <span style={S('flex:1.3 1 0;min-width:0;text-align:right;font-size:16px;font-weight:600;letter-spacing:-0.01em')}>{dollars0(p.commission + p.tips)}</span>
              <span style={S('flex:1.2 1 0;min-width:0')}><span style={S('display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap;background:' + t.bg + ';color:' + t.fg)}>{t.t}</span></span>
              {CHEV}
            </button>
          );
        })}
      </>)}
    </section>
  </>);
}
