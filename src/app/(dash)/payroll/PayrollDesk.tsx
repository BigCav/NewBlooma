'use client';
import { PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { Avatar, Chip, FieldError, FilterChip, Notice, RING_SM, Stat } from '@/components/ui';
import { dollars } from '@/lib/format';
import { CELL, payTone, type PayRow } from './shared';
import type { PayrollCtl } from './PayrollView';

const ARROW = (d: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const CARD = 'display:flex;flex-direction:column;gap:18px;box-sizing:border-box;width:100%;padding:22px;border:1px solid #E6E8EC;border-radius:24px;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer';
const LBL = 'font-size:12px;color:#5E6673';
const big = (l: string, v: string) => <Stat key={l} label={l} value={v} />;

/** Desktop payroll: totals, then one table of the team for the chosen week. A row opens in the drawer. */
export function PayrollDesk({ c, onOpen }: { c: PayrollCtl; onOpen: (id: string) => void }) {
  const tabs: [('time' | 'comm'), string][] = c.owner ? [['time', 'Timesheets'], ['comm', 'Commission']] : [['time', 'Timesheets']];
  const who = (p: PayRow) => (
    <span style={S('flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:12px')}>
      <Avatar name={p.name} photo={p.photo} size="md" />
      <span style={S('min-width:0')}><span style={S('display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.name}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.role}</span></span>
    </span>
  );
  return (<>
    <PageHeader title="Payroll" subtitle="Timesheets and commission" showSearch={false} showAction={false} />
    <section aria-label="Pay period at a glance" style={S('display:flex;flex-wrap:wrap;align-items:flex-end;gap:20px 64px')}>
      {big('Hours worked', c.hoursText)}
      {c.owner && big('Team payout', dollars(c.pay))}
      {big('Team members', String(c.rows.length))}
    </section>
    {!!c.notice && <Notice>{c.notice}</Notice>}
    {!!c.error && <FieldError>{c.error}</FieldError>}
    <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px')}>
      <div role="group" aria-label="Payroll view" style={S('display:flex;gap:8px')}>
        {tabs.map(([id, label]) => <FilterChip key={id} on={c.tab === id} onClick={() => c.setTab(id)}>{label}</FilterChip>)}
      </div>
      <div role="group" aria-label="Pay period" style={S('display:flex;align-items:center;gap:12px')}>
        <button className="ghost" onClick={() => c.go(c.w + 1)} disabled={c.w >= 104} aria-label="Previous week" style={S(RING_SM)}>{ARROW('M14.5 6l-6 6 6 6')}</button>
        <div style={S('min-width:190px;text-align:center;white-space:nowrap')}><div style={S('font-size:14.5px;font-weight:600')}>{c.title}</div><div style={S('font-size:12.5px;color:#5E6673')}>{c.range}</div></div>
        <button className="ghost" onClick={() => c.go(c.w - 1)} disabled={c.w === 0} aria-label="Next week" style={S(RING_SM)}>{ARROW('M9.5 6l6 6-6 6')}</button>
      </div>
    </div>
    {c.rows.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>No team members yet.</p>}
    <section aria-label="Team" style={S('display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));gap:16px')}>
      {c.tab === 'time' && c.rows.map((p) => (
        <button key={p.id} className="s-card" onClick={() => onOpen(p.id)} aria-label={`${p.name}, ${p.total} ${p.planned}`} style={S(CARD)}>
          {who(p)}
          <span style={S('display:flex;align-items:baseline;gap:8px')}><span style={S('font-size:34px;line-height:1;font-weight:500;letter-spacing:-0.03em')}>{p.total}</span><span style={S('font-size:13px;color:#5E6673')}>{p.planned}</span></span>
          <span style={S(`display:grid;grid-template-columns:repeat(${c.days},1fr);gap:6px`)}>
            {p.cells.map((x) => <span key={x.day} style={S('display:flex;flex-direction:column;gap:4px;text-align:center')}><span style={S('font-size:11.5px;color:#8A93A0')}>{x.day}</span><span style={S('padding:9px 2px;line-height:1.25;border-radius:12px;font-size:12.5px;' + CELL[x.kind])}>{x.txt}</span></span>)}
          </span>
          <span style={S('display:flex;align-items:center;gap:8px;font-size:13px;color:#5E6673')}>
            {c.w === 0 && p.canClock ? (<><span style={S('width:8px;height:8px;border-radius:999px;background:' + (p.inSince ? '#14A06A' : '#C3C8D0'))} />{p.inSince ? 'In since ' + p.inSince : 'Not clocked in'}</>) : 'Not tracked'}
          </span>
        </button>
      ))}
      {c.tab === 'comm' && c.owner && c.rows.map((p) => {
        const t = payTone(c.over, p.paid);
        return (
          <button key={p.id} className="s-card" onClick={() => onOpen(p.id)} aria-label={`${p.name}, ${dollars(p.commission + p.tips)}, ${t.label}`} style={S(CARD)}>
            <span style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>{who(p)}<Chip tone={t.tone}>{t.label}</Chip></span>
            <span><span style={S('display:block;' + LBL)}>Commission + tips</span><span style={S('display:block;margin-top:2px;font-size:34px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{dollars(p.commission + p.tips)}</span></span>
            <span style={S('display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding-top:14px;border-top:1px solid #EEF0F3')}>
              {([['Services', dollars(p.svc)], ['Products', dollars(p.prod)], ['Tips', dollars(p.tips)], ['Rate', (Math.round(p.rate * 10) / 10) + '%']] as const).map(([l, v]) => <span key={l}><span style={S('display:block;' + LBL)}>{l}</span><span style={S('display:block;margin-top:2px;font-size:15px;font-weight:600')}>{v}</span></span>)}
            </span>
          </button>
        );
      })}
    </section>
  </>);
}
