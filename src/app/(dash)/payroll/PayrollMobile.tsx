'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { deleteTimesheet, loadTimesheets, saveTimesheet, type SheetRow } from './actions';
import { dollars0, type PayRow } from './shared';
import type { PayrollCtl } from './PayrollView';

const RING = 'flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0';
const BACK = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6l-6 6 6 6" /></svg>;
const CHEV = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true"><path d="M9.5 6l6 6-6 6" /></svg>;
const BLACK = 'flex:1 1 0;height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer';
const OUTLINE = 'flex:1 1 0;height:52px;box-sizing:border-box;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer';
const PAGE = "position:absolute;left:0;right:0;top:0;bottom:0;z-index:5;display:flex;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4";
const BAR = 'flex:0 0 auto;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px';
const CARD = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:18px';
const FIELD_IN = { ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), minHeight: 0, borderRadius: 0 } as const;
const CELL = { done: 'background:#EEF0F3;color:#0E1116;font-weight:500', today: 'background:#ECE8FF;color:#3B2BB5;font-weight:600', plan: 'background:#F4F5F7;color:#8A93A0' };
const initials = (n: string) => n.split(' ').filter((w) => /[A-Za-z0-9]/.test(w[0] ?? '')).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'C';
const AV = (px: number, fs: number) => 'flex:0 0 ' + px + 'px;width:' + px + 'px;height:' + px + 'px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:' + fs + 'px;font-weight:600';
const pct = (n: number) => (Math.round(n * 10) / 10) + '%';

function Header({ title, onBack, avatar }: { title: string; onBack: () => void; avatar?: string }) {
  return (
    <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px;border-bottom:1px solid #E6E8EC')}>
      <button onClick={onBack} aria-label="Back" style={S(RING)}>{BACK}</button>
      {avatar && <div style={S(AV(36, 13))}>{avatar}</div>}
      <div style={S('flex:1 1 auto;min-width:0;font-size:18px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{title}</div>
    </header>
  );
}

function payTone(c: PayrollCtl, p: PayRow) {
  const pending = !c.over;
  return pending ? { t: 'Pending until Sunday', bg: '#FFEBD0', fg: '#7A4204' } : p.paid ? { t: 'Paid', bg: '#DDF3EA', fg: '#14624A' } : { t: 'Ready to pay', bg: '#ECE8FF', fg: '#3B2BB5' };
}

function Week({ p, days, big }: { p: PayRow; days: number; big?: boolean }) {
  return (
    <div style={S(`display:grid;grid-template-columns:repeat(${days},1fr);gap:${big ? 6 : 4}px`)}>
      {p.cells.map((x) => (
        <div key={x.day} style={S('min-width:0;text-align:center')}>
          <div style={S('font-size:11.5px;color:#8A93A0;margin-bottom:4px')}>{x.day}</div>
          <div style={S(`padding:${big ? 12 : 8}px 0;border-radius:12px;font-size:${big ? 13.5 : 12}px;` + CELL[x.kind])}>{x.txt}</div>
        </div>
      ))}
    </div>
  );
}

export function PayrollMobile({ c }: { c: PayrollCtl }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const tabs: [('time' | 'comm'), string][] = c.owner ? [['time', 'Timesheets'], ['comm', 'Commission']] : [['time', 'Timesheets']];
  const hoursText = (Math.round(c.hoursTotal * 10) / 10) + 'h';
  const open = openId ? c.rows.find((r) => r.id === openId) ?? null : null;
  const edit = editId ? c.rows.find((r) => r.id === editId) ?? null : null;
  const stat = (l: string, v: string) => <div key={l} style={S('flex:1 1 0;min-width:0;' + CARD + ';padding:16px;border-radius:20px')}><div style={S('color:#5E6673;font-size:13px')}>{l}</div><div style={S('margin-top:2px;font-size:28px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div></div>;

  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Payroll" subtitle="Timesheets and commission" showSearch={false} />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:14px')}>
        {tabs.length > 1 && (
          <div role="tablist" aria-label="Payroll view" style={S('display:flex;gap:4px;padding:4px;border-radius:999px;background:#E9ECF0;flex:0 0 auto')}>
            {tabs.map(([id, label]) => <button key={id} role="tab" onClick={() => c.setTab(id)} aria-selected={c.tab === id} style={S('flex:1 1 0;height:44px;border:0;border-radius:999px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;background:' + (c.tab === id ? '#0E1116' : 'transparent') + ';color:' + (c.tab === id ? '#FFFFFF' : '#0E1116'))}>{label}</button>)}
          </div>
        )}
        <div role="group" aria-label="Pay period" style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;padding:8px;display:flex;align-items:center;gap:8px;border-radius:999px')}>
          <button onClick={() => c.go(c.w + 1)} disabled={c.w >= 104} aria-label="Previous week" style={S('flex:0 0 44px;width:44px;height:44px;border-radius:999px;border:0;background:#F4F5F7;font-size:20px;color:' + (c.w >= 104 ? '#B5BBC5' : '#0E1116'))}>‹</button>
          <div style={S('flex:1 1 auto;min-width:0;text-align:center;white-space:nowrap')}><div style={S('font-size:15px;font-weight:600')}>{c.title}</div><div style={S('font-size:12.5px;color:#5E6673')}>{c.range}</div></div>
          <button onClick={() => c.go(c.w - 1)} disabled={c.w === 0} aria-label="Next week" style={S('flex:0 0 44px;width:44px;height:44px;border-radius:999px;border:0;background:#F4F5F7;font-size:20px;color:' + (c.w === 0 ? '#B5BBC5' : '#0E1116'))}>›</button>
        </div>
        <div style={S('display:flex;gap:12px')}>{stat('Hours worked', hoursText)}{c.owner && stat('Team payout', dollars0(c.pay))}</div>
        {!!c.notice && !open && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{c.notice}</span>}
        {!!c.error && !open && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
        {c.rows.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>No team members yet.</p>}

        {c.tab === 'time' && c.rows.map((p) => (
          <button key={p.id} onClick={() => setOpenId(p.id)} aria-label={`${p.name}, ${p.total} ${p.planned}`} style={S(CARD + ';display:flex;flex-direction:column;gap:14px;width:100%;text-align:left;font:inherit;color:#0E1116;cursor:pointer;border-radius:22px;padding:16px')}>
            <span style={S('display:flex;align-items:center;gap:14px')}>
              <span style={S(AV(48, 15))}>{initials(p.name)}</span>
              <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:16px;font-weight:600;letter-spacing:-0.01em;overflow-wrap:anywhere')}>{p.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{p.role}</span></span>
              <span style={S('flex:0 0 auto;text-align:right')}><span style={S('display:block;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{p.total}</span><span style={S('display:block;font-size:12px;color:#5E6673')}>{p.planned}</span></span>
              {CHEV}
            </span>
            <Week p={p} days={c.days} />
            {c.w === 0 && p.canClock && <span style={S('display:flex;align-items:center;gap:8px;font-size:13px;color:#5E6673')}><span style={S('width:8px;height:8px;border-radius:999px;background:' + (p.inSince ? '#14A06A' : '#C3C8D0'))} />{p.inSince ? 'In since ' + p.inSince : 'Not clocked in'}</span>}
          </button>
        ))}

        {c.tab === 'comm' && c.owner && c.rows.map((p) => {
          const t = payTone(c, p);
          return (
            <button key={p.id} onClick={() => setOpenId(p.id)} aria-label={`${p.name}, ${dollars0(p.commission + p.tips)}, ${t.t}`} style={S(CARD + ';display:flex;align-items:center;gap:14px;width:100%;text-align:left;font:inherit;color:#0E1116;cursor:pointer;border-radius:22px;padding:16px')}>
              <span style={S(AV(48, 15))}>{initials(p.name)}</span>
              <span style={S('flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px')}>
                <span style={S('font-size:16px;font-weight:600;letter-spacing:-0.01em;overflow-wrap:anywhere')}>{p.name}</span>
                <span style={S('font-size:13px;color:#5E6673')}>{p.role}</span>
                <span style={S('align-self:flex-start;margin-top:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:' + t.bg + ';color:' + t.fg)}>{t.t}</span>
              </span>
              <span style={S('flex:0 0 auto;text-align:right')}><span style={S('display:block;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{dollars0(p.commission + p.tips)}</span><span style={S('display:block;font-size:12px;color:#5E6673')}>commission + tips</span></span>
              {CHEV}
            </button>
          );
        })}
      </main>
      <MobileTabs active="more" />
      {open && c.tab === 'time' && <TimePage c={c} p={open} onBack={() => setOpenId(null)} onEdit={() => setEditId(open.id)} />}
      {open && c.tab === 'comm' && <CommPage c={c} p={open} onBack={() => setOpenId(null)} />}
      {edit && <EditPage c={c} p={edit} onBack={() => setEditId(null)} />}
    </div>
  );
}

function TimePage({ c, p, onBack, onEdit }: { c: PayrollCtl; p: PayRow; onBack: () => void; onEdit: () => void }) {
  const clock = c.w === 0 && p.canClock;
  return (
    <div role="dialog" aria-label="Timesheet" style={S(PAGE)}>
      <Header title={p.name} avatar={initials(p.name)} onBack={onBack} />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 24px;display:flex;flex-direction:column;gap:16px')}>
        <div>
          <h2 style={S('margin:0;font-size:40px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{p.total}</h2>
          <p style={S('margin:4px 0 0;font-size:14px;color:#5E6673')}>{p.planned} · {c.title}, {c.range}</p>
        </div>
        <section style={S(CARD)}><Week p={p} days={c.days} big /></section>
        {clock && (
          <div style={S(CARD + ';display:flex;align-items:center;gap:10px;font-size:14.5px')}>
            <span style={S('width:10px;height:10px;border-radius:999px;background:' + (p.inSince ? '#14A06A' : '#C3C8D0'))} />{p.inSince ? 'In since ' + p.inSince : 'Not clocked in'}
          </div>
        )}
        {!!c.notice && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{c.notice}</span>}
        {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
      </main>
      {(clock || c.owner) && (
        <div style={S(BAR)}>
          <div style={S('display:flex;gap:10px')}>
            {c.owner && <button className="ghost" onClick={onEdit} style={S(OUTLINE)}>Edit times</button>}
            {clock && <button onClick={() => c.clock(p)} disabled={c.busy} style={S(BLACK)}>{p.inSince ? 'Clock out' : 'Clock in'}</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function CommPage({ c, p, onBack }: { c: PayrollCtl; p: PayRow; onBack: () => void }) {
  const t = payTone(c, p);
  const stat = (l: string, v: number) => <div key={l} style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:20px;padding:16px')}><div style={S('font-size:13px;color:#5E6673')}>{l}</div><div style={S('margin-top:2px;font-size:22px;font-weight:600;letter-spacing:-0.02em')}>{dollars0(v)}</div></div>;
  return (
    <div role="dialog" aria-label="Commission" style={S(PAGE)}>
      <Header title={p.name} avatar={initials(p.name)} onBack={onBack} />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 24px;display:flex;flex-direction:column;gap:16px')}>
        <div>
          <h2 style={S('margin:0;font-size:40px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{dollars0(p.commission + p.tips)}</h2>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px')}>
            <span style={S('padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:' + t.bg + ';color:' + t.fg)}>{t.t}</span>
            <span style={S('font-size:13px;color:#5E6673')}>commission + tips · {c.title}</span>
          </div>
        </div>
        <div style={S('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px')}>
          {stat('Services', p.svc)}{stat('Products', p.prod)}{stat('Tips', p.tips)}{stat('Commission', p.commission)}
        </div>
        <section style={S(CARD + ';display:flex;flex-direction:column;gap:12px')}>
          <div style={S('font-size:15px;font-weight:600')}>Service commission</div>
          <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
            <button onClick={() => c.bump(p, -5)} aria-label="Lower commission rate" style={S('flex:0 0 52px;width:52px;height:52px;border-radius:999px;border:1px solid #E1E4E9;background:#FFFFFF;font-size:22px;color:#0E1116;cursor:pointer')}>−</button>
            <span style={S('font-size:28px;font-weight:600;letter-spacing:-0.02em')}>{pct(p.rate)}</span>
            <button onClick={() => c.bump(p, 5)} aria-label="Raise commission rate" style={S('flex:0 0 52px;width:52px;height:52px;border-radius:999px;border:1px solid #E1E4E9;background:#FFFFFF;font-size:22px;color:#0E1116;cursor:pointer')}>+</button>
          </div>
          <div style={S('font-size:13px;color:#5E6673')}>Includes {pct(p.prodPct)} on product sales ({dollars0(p.commission)} commission before tips).</div>
        </section>
        {!!c.notice && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{c.notice}</span>}
        {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
      </main>
      {c.over && !p.paid && (
        <div style={S(BAR)}><button onClick={() => c.pay1(p)} disabled={c.busy} style={S(BLACK + ';flex:0 0 auto;width:100%')}>Mark as paid</button></div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={S('display:block;box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{label}</span>{children}</label>;
}

/** Clock-in and clock-out entries for the week, one card each. */
function EditPage({ c, p, onBack }: { c: PayrollCtl; p: PayRow; onBack: () => void }) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [rows, setRows] = useState<(SheetRow & { fresh?: boolean })[] | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const reload = () => loadTimesheets(p.id, c.from, c.to).then((r) => { if (r.error) setError(r.error); else setRows(r.rows ?? []); });
  useEffect(() => { reload(); }, [p.id, c.from, c.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const patch = (id: string, k: 'inAt' | 'outAt', v: string) => { setRows((rs) => (rs ?? []).map((r) => (r.id === id ? { ...r, [k]: v } : r))); setError(''); setNote(''); };
  const save = (r: SheetRow & { fresh?: boolean }) => startT(async () => { const res = await saveTimesheet(r.fresh ? null : r.id, p.id, r.inAt, r.outAt); if (res.error) { setError(res.error); setNote(''); return; } setError(''); setNote(res.notice ?? ''); await reload(); router.refresh(); });
  const del = (r: SheetRow & { fresh?: boolean }) => { if (r.fresh) { setRows((rs) => (rs ?? []).filter((x) => x.id !== r.id)); return; } startT(async () => { const res = await deleteTimesheet(r.id); if (res.error) { setError(res.error); setNote(''); return; } setError(''); setNote(res.notice ?? ''); await reload(); router.refresh(); }); };
  const add = () => setRows((rs) => [...(rs ?? []), { id: 'new-' + Date.now(), inAt: c.from + 'T09:00', outAt: c.from + 'T17:00', fresh: true }]);
  return (
    <div role="dialog" aria-label="Edit times" style={S(PAGE + ';z-index:6')}>
      <Header title="Edit times" onBack={onBack} />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 24px;display:flex;flex-direction:column;gap:14px')}>
        <div>
          <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>{p.name}</h2>
          <p style={S('margin:6px 0 0;font-size:14px;color:#5E6673')}>{c.title}, {c.range}. Clock-in and clock-out times.</p>
        </div>
        {rows === null && !error && <p style={S('margin:0;font-size:14px;color:#5E6673')}>Loading</p>}
        {rows !== null && rows.length === 0 && <p style={S('margin:0;font-size:14px;color:#5E6673')}>No clocked times this week.</p>}
        {(rows ?? []).map((r) => (
          <section key={r.id} style={S(CARD + ';display:flex;flex-direction:column;gap:10px;padding:14px')}>
            <Field label="In"><input type="datetime-local" value={r.inAt} onChange={(e) => patch(r.id, 'inAt', e.target.value)} style={FIELD_IN} /></Field>
            <Field label="Out (blank if still working)"><input type="datetime-local" value={r.outAt} onChange={(e) => patch(r.id, 'outAt', e.target.value)} style={FIELD_IN} /></Field>
            <div style={S('display:flex;gap:10px')}>
              <button className="ghost" onClick={() => del(r)} disabled={busy} style={S(OUTLINE + ';color:#B42318')}>{r.fresh ? 'Discard' : 'Delete'}</button>
              <button onClick={() => save(r)} disabled={busy} style={S(BLACK)}>{r.fresh ? 'Add entry' : 'Save'}</button>
            </div>
          </section>
        ))}
        {!!error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{error}</p>}
        {!!note && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{note}</span>}
      </main>
      <div style={S(BAR)}>
        <div style={S('display:flex;gap:10px')}>
          <button className="ghost" onClick={add} style={S(OUTLINE)}>Add a shift</button>
          <button onClick={onBack} style={S(BLACK)}>Done</button>
        </div>
      </div>
    </div>
  );
}
