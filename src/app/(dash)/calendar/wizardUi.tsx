'use client';
import { useEffect, useState } from 'react';
import { fmtMin, initials } from '@/lib/cal';
import { findClients, type ClientHit } from './actions';
import { S } from './pickers';
import { slotCss, dayCss, PRIMARY, CLOSE_BTN, ERR, CloseX } from './calUi';

/* Pieces shared by the phone step-by-step flows (new appointment, walk-in, running late, block time, checkout). */

/** Step state. Opening a step from the summary (`jump`) sends Continue and Back straight back to the summary. */
export function useSteps(last: number, onNav: () => void, start = 0) {
  const [step, setStep] = useState(start);
  const [ret, setRet] = useState(false);
  const go = (n: number) => { onNav(); setStep(n); };
  const jump = (n: number) => { setRet(true); go(n); };
  const forward = () => { if (ret) { setRet(false); go(last); } else go(step + 1); };
  const back = () => { if (ret) { setRet(false); go(last); } else go(step - 1); };
  return { step, go, jump, forward, back };
}

export const AV = 'flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600';
export const ROW = (on: boolean) => 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:64px;padding:8px 14px;margin-bottom:8px;border-radius:16px;font:inherit;text-align:left;color:#0E1116;cursor:pointer;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#F4F5F7' : '#FFFFFF') + (on ? ';box-shadow:inset 0 0 0 1px #0E1116' : '');
export const TICK = <span aria-hidden="true" style={S('flex:0 0 22px;width:22px;height:22px;border-radius:999px;background:#0E1116;display:flex;align-items:center;justify-content:center')}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19 7.5" /></svg></span>;
export const ico = (children: React.ReactNode) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true">{children}</svg>;
export const ICONS = {
  day: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  time: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  person: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.6-3.4 3.3-5 7-5s6.4 1.6 7 5" /></>,
  tag: <><path d="M4 4h7l9 9-7 7-9-9z" /><circle cx="8.5" cy="8.5" r="1.2" /></>,
  scissors: <><circle cx="6" cy="7" r="2.5" /><circle cx="6" cy="17" r="2.5" /><path d="M8 8.5 20 18M8 15.5 20 6" /></>,
};

export type StepAction = { label: string; onClick: () => void; secondary?: boolean; disabled?: boolean };

/** Header with back, close and progress; a scrolling body; and a bottom bar pinned to the foot of the page. */
export function StepShell({ step, titles, onBack, onClose, error, summary, actions, children, plain, bar }: {
  bar?: React.ReactNode; plain?: boolean; step: number; titles: string[]; onBack: () => void; onClose: () => void; error?: string; summary?: React.ReactNode; actions: StepAction[]; children: React.ReactNode;
}) {
  return (
    <div style={S('display:flex;flex-direction:column;flex:1 1 auto;min-height:0;margin:0 -20px -40px')}>
      <div style={S('flex:0 0 auto;padding:0 20px 14px')}>
        <div style={S('display:flex;align-items:center;gap:12px;min-height:44px')}>
          {(step > 0 || plain) && <button onClick={onBack} aria-label="Back" style={S(CLOSE_BTN)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6l-6 6 6 6" /></svg></button>}
          <div style={S('flex:1 1 auto;min-width:0;font-size:13px;color:#5E6673')}>{plain ? '' : 'Step ' + (step + 1) + ' of ' + titles.length}</div>
          <button onClick={onClose} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button>
        </div>
        {!plain && <div aria-hidden="true" style={S('display:flex;gap:6px;margin-top:12px')}>{titles.map((t, i) => <span key={t} style={S('flex:1 1 0;height:4px;border-radius:999px;background:' + (i <= step ? '#0E1116' : '#E6E8EC'))} />)}</div>}
        <h2 style={S('margin:16px 0 0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>{titles[step]}</h2>
      </div>
      <div style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:4px 20px 16px;display:flex;flex-direction:column;gap:14px')}>
        {children}
        {error ? <p role="alert" style={S(ERR)}>{error}</p> : null}
      </div>
      <div style={S('flex:0 0 auto;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px')}>
        {summary}
        {bar}
        {!bar && actions.map((a) => <button key={a.label} onClick={a.onClick} disabled={a.disabled} style={S((a.secondary ? 'flex:0 0 auto;width:100%;height:52px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500;cursor:pointer' : PRIMARY + ';flex:0 0 auto;width:100%;height:52px') + ';opacity:' + (a.disabled ? 0.45 : 1))}>{a.label}</button>)}
      </div>
    </div>
  );
}

/** Existing clients matching the search, in the same avatar rows as the recent list. */
function Matches({ query, pickedId, onPick }: { query: string; pickedId: string | null; onPick: (h: ClientHit) => void }) {
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [doneFor, setDoneFor] = useState('');
  const q = query.trim();
  useEffect(() => {
    if (!q || pickedId) { setHits([]); return; }
    let live = true;
    const t = setTimeout(() => { findClients(q).then((r) => { if (live) { setHits(r); setDoneFor(q); } }).catch(() => { if (live) { setHits([]); setDoneFor(q); } }); }, 150);
    return () => { live = false; clearTimeout(t); };
  }, [q, pickedId]);
  if (!q || pickedId) return null;
  if (!hits.length) return doneFor !== q ? null : <div style={S('font-size:13px;color:#5E6673')}>No existing client with that name. Tap Continue to add {q} as a new client.</div>;
  return (
    <div role="listbox" aria-label="Matching clients" style={S('display:flex;flex-direction:column')}>
      {hits.map((h) => (
        <button key={h.id} role="option" aria-selected="false" onClick={() => onPick(h)} style={S(ROW(false))}>
          <span style={S(AV)}>{initials(h.name)}</span>
          <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{h.name}</span>{!!h.sub && <span style={S('display:block;font-size:13px;color:#5E6673;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{h.sub}</span>}</span>
        </button>
      ))}
    </div>
  );
}

/** Search box, matches and recent clients. Picking selects; it never moves on by itself and never opens the keyboard. */
export function ClientStep({ name, clientId, recent, onChange }: { name: string; clientId: string | null; recent: { id: string; name: string }[]; onChange: (name: string, id: string | null) => void }) {
  const typed = name.trim();
  return (<>
    <div style={S('position:relative')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('position:absolute;left:16px;top:15px')} aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>
      <input type="text" aria-label="Client" value={name} onChange={(e) => onChange(e.target.value, null)} placeholder="Search or type a client name" style={{ ...S('box-sizing:border-box;width:100%;height:48px;padding:0 14px 0 42px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF'), minHeight: 0 }} />
    </div>
    <Matches query={name} pickedId={clientId} onPick={(h) => onChange(h.name, h.id)} />
    {clientId && !recent.some((r) => r.id === clientId) && (
      <button onClick={() => onChange('', null)} aria-pressed="true" style={S(ROW(true))}>
        <span style={S(AV)}>{initials(name)}</span><span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{name}</span>{TICK}
      </button>
    )}
    {(!typed || !!clientId) && recent.length > 0 && (<>
      <h3 style={S('margin:6px 0 0;font-size:15px;font-weight:600')}>Recent clients</h3>
      <div style={S('display:flex;flex-direction:column')}>
        {recent.slice(0, 8).map((r) => { const on = clientId === r.id; return (
          <button key={r.id} onClick={() => (on ? onChange('', null) : onChange(r.name, r.id))} aria-pressed={on} style={S(ROW(on))}>
            <span style={S(AV)}>{initials(r.name)}</span>
            <span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{r.name}</span>{on && TICK}
          </button>
        ); })}
      </div>
    </>)}
  </>);
}

/** Team members as separate cards. `any` adds a "First available" card. */
export function PeopleStep({ team, selected, onPick, offers, any }: { team: { id: string; name: string; role?: string }[]; selected: string; onPick: (id: string) => void; offers?: (id: string) => boolean; any?: boolean }) {
  const list = [...(any ? [{ id: 'any', name: 'First available', role: 'Whoever is free first' }] : []), ...team];
  return (
    <div role="group" aria-label="Team member" style={S('display:flex;flex-direction:column')}>
      {list.map((m) => {
        const off = m.id !== 'any' && !!offers && !offers(m.id), on = selected === m.id && !off;
        return (
          <button key={m.id} disabled={off} aria-pressed={on} onClick={() => onPick(on && m.id !== 'any' ? '' : m.id)} style={S(ROW(on) + (off ? ';opacity:0.55;cursor:default;background:#FAFBFC' : ''))}>
            <span style={S(AV)}>{m.id === 'any' ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3A2BB5" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18.5 14.8c1.6.8 2.6 2.4 3 5.2" /></svg> : initials(m.name)}</span>
            <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{m.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{off ? 'Does not offer this service' : m.role || 'Team member'}</span></span>
            {on && TICK}
          </button>
        );
      })}
    </div>
  );
}

/** Choices as big squares, two across and going down. */
export function Tiles<T extends string | number>({ options, value, onPick, label }: { options: readonly (readonly [T, string])[]; value: T | null; onPick: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} style={S('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px')}>
      {options.map(([v, l]) => {
        const on = value === v;
        return (
          <button key={String(v)} onClick={() => onPick(v)} aria-pressed={on} style={S('position:relative;aspect-ratio:1.15;box-sizing:border-box;padding:14px;border-radius:20px;display:flex;align-items:flex-end;text-align:left;font:inherit;font-size:19px;font-weight:600;letter-spacing:-0.02em;color:#0E1116;cursor:pointer;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#F4F5F7' : '#FFFFFF') + (on ? ';box-shadow:inset 0 0 0 1px #0E1116' : ''))}>
            <span style={S('overflow-wrap:anywhere')}>{l}</span>
            {on && <span style={S('position:absolute;top:12px;right:12px;display:flex')}>{TICK}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A day strip and the times under it. */
export function DayTimeStep({ days, day, onDay, slots, why, time, onTime }: {
  days: { ymd: string; abbr: string; num: string | number; full: string; closed: boolean }[]; day: string; onDay: (ymd: string) => void; slots: number[]; why: (t: number) => string; time: number | null; onTime: (t: number) => void;
}) {
  return (<>
    <div role="group" className="hscroll" aria-label="Day" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
      {days.map((d) => <button key={d.ymd} onClick={() => { if (!d.closed) onDay(d.ymd); }} disabled={d.closed} aria-pressed={day === d.ymd} aria-label={d.full + (d.closed ? ', closed' : '')} style={S(dayCss(day === d.ymd, d.closed))}><span style={S('font-size:12.5px')}>{d.abbr}</span><span style={S('font-size:17px;font-weight:600')}>{d.num}</span></button>)}
    </div>
    <div role="group" aria-label="Time" style={S('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px')}>
      {slots.map((t) => { const w = why(t); const on = time === t && !w; return <button key={t} onClick={() => { if (!w) onTime(t); }} disabled={!!w} aria-pressed={on} aria-label={fmtMin(t) + (w ? ', unavailable' : '')} style={S(slotCss(on, !!w))}>{fmtMin(t)}</button>; })}
    </div>
    {!slots.length && <div style={S('font-size:14px;color:#5E6673')}>No times to show for this day.</div>}
  </>);
}

/** A client card with a Change button, as at the top of each summary. */
export function ClientCard({ name, existing, onChange }: { name: string; existing: boolean; onChange: () => void }) {
  return (
    <div style={S('display:flex;align-items:center;gap:14px;padding:16px;border:1px solid #E6E8EC;border-radius:22px')}>
      <div style={S('flex:0 0 52px;width:52px;height:52px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600')}>{initials(name.trim() || '?')}</div>
      <div style={S('flex:1 1 auto;min-width:0')}>
        <div style={S('font-size:19px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{name.trim()}</div>
        <div style={S('margin-top:2px;font-size:13.5px;color:#5E6673')}>{existing ? 'Existing client' : 'New client'}</div>
      </div>
      <button onClick={onChange} style={S('flex:0 0 auto;height:36px;padding:0 14px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;font:inherit;font-size:13.5px;font-weight:500;cursor:pointer')}>Change</button>
    </div>
  );
}

/** Rows of detail; a row with `step` is tappable and jumps back to that step. */
export function DetailRows({ rows, go }: { rows: { icon: React.ReactNode; text: string; step?: number }[]; go: (n: number) => void }) {
  const row = 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:14px 0;border:0;background:transparent;font:inherit;font-size:15px;text-align:left;color:#0E1116';
  return (
    <div className="sum-rows" style={S('padding:2px 16px;border:1px solid #E6E8EC;border-radius:22px;background:#FFFFFF')}>
      {rows.map((r) => {
        const inner = <>{ico(r.icon)}<span style={S('min-width:0;overflow-wrap:anywhere')}>{r.text}</span>{r.step !== undefined && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto;margin-left:auto')}><path d="M9.5 6l6 6-6 6" /></svg>}</>;
        return r.step !== undefined ? <button key={r.text + r.step} onClick={() => go(r.step!)} style={S(row + ';cursor:pointer')}>{inner}</button> : <div key={r.text} style={S(row)}>{inner}</div>;
      })}
    </div>
  );
}
