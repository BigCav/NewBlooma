'use client';
import { useEffect, useState } from 'react';
import { dayInfo, fmtMin, initials } from '@/lib/cal';
import { findClients, type ClientHit } from './actions';
import { S, ServicePicker, TeamPicker } from './pickers';
import { first, usd, slotCss, dayCss, PRIMARY, CLOSE_BTN, ERR, CloseX } from './calUi';
import type { useCalendar } from './useCalendar';
import type { Props } from './calUi';

const STEPS = ['Client', 'Services', 'Team member', 'Time', 'Summary'] as const;
const TITLES = ['Select client', 'Select services', 'Select team member', 'Select time', 'Summary'];

const AV = 'flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600';
const ROW = (on: boolean) => 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:64px;padding:8px 14px;margin-bottom:8px;border-radius:16px;font:inherit;text-align:left;color:#0E1116;cursor:pointer;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#F4F5F7' : '#FFFFFF') + (on ? ';box-shadow:inset 0 0 0 1px #0E1116' : '');
const TICK = <span aria-hidden="true" style={S('flex:0 0 22px;width:22px;height:22px;border-radius:999px;background:#0E1116;display:flex;align-items:center;justify-content:center')}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19 7.5" /></svg></span>;

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

/** Phone version of "New appointment": client, services (and extras), team member, time, then a summary like the booking view. */
export function NewApptWizard({ c, props, onCancel }: { c: ReturnType<typeof useCalendar>; props: Props; onCancel?: () => void }) {
  const { nf, setNf, setError, error, hasError, busy, close, createNew, nLock, nFirstSvc, nPickSvc, nOffers, nSlots, nWhy, days14, offered, offers, staffName, services, team, nPlan } = c;
  const [step, setStep] = useState(0);
  const typed = nf.client.trim();
  const plan = nPlan();
  const go = (n: number) => { setError(''); setStep(n); };
  const canNext = step === 0 ? !!typed : step === 1 ? plan.sel.length > 0 : step === 2 ? !!nf.staff : step === 3 ? nf.time !== null && !nWhy(nf.time) : true;
  const next = () => { if (!canNext) { setError(step === 0 ? "Add the client's name." : step === 1 ? 'Choose a service.' : step === 2 ? 'Choose a team member.' : 'Choose a time.'); return; } go(step + 1); };
  const back = () => (step === 0 ? (onCancel ?? close)() : go(step - 1));
  const recent = props.recent ?? [];
  const di = dayInfo(nf.day);
  const row = 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:14px 0;border:0;background:transparent;font:inherit;font-size:15px;text-align:left;color:#0E1116;cursor:pointer';
  const edit = (n: number, child: React.ReactNode) => <button onClick={() => go(n)} style={S(row)}>{child}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto;margin-left:auto')}><path d="M9.5 6l6 6-6 6" /></svg></button>;
  const ico = (children: React.ReactNode) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true">{children}</svg>;

  return (
    <div style={S('display:flex;flex-direction:column;flex:1 1 auto;min-height:0;margin:-20px -20px -40px')}>
      <div style={S('flex:0 0 auto;padding:0 20px 14px')}>
        <div style={S('display:flex;align-items:center;gap:12px;min-height:44px')}>
          {step > 0 && <button onClick={back} aria-label="Back" style={S(CLOSE_BTN)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6l-6 6 6 6" /></svg></button>}
          <div style={S('flex:1 1 auto;min-width:0;font-size:13px;color:#5E6673')}>{'Step ' + (step + 1) + ' of ' + STEPS.length}</div>
          <button onClick={onCancel ?? close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button>
        </div>
        <div aria-hidden="true" style={S('display:flex;gap:6px;margin-top:12px')}>{STEPS.map((s, i) => <span key={s} style={S('flex:1 1 0;height:4px;border-radius:999px;background:' + (i <= step ? '#0E1116' : '#E6E8EC'))} />)}</div>
        <h2 style={S('margin:16px 0 0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>{TITLES[step]}</h2>
      </div>

      <div style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:4px 20px 16px;display:flex;flex-direction:column;gap:14px')}>
        {step === 0 && (<>
          <div style={S('position:relative')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('position:absolute;left:16px;top:15px')} aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>
            <input id="ap-client" type="text" aria-label="Client" autoFocus value={nf.client} onChange={(e) => { setNf({ ...nf, client: e.target.value, clientId: null }); setError(''); }} placeholder="Search or type a client name" style={{ ...S('box-sizing:border-box;width:100%;height:48px;padding:0 14px 0 42px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF'), minHeight: 0 }} />
          </div>
          <Matches query={nf.client} pickedId={nf.clientId} onPick={(h) => { setNf({ ...nf, client: h.name, clientId: h.id }); setError(''); }} />
          {nf.clientId && !recent.some((r) => r.id === nf.clientId) && (
            <button onClick={() => setNf({ ...nf, client: '', clientId: null })} aria-pressed="true" style={S(ROW(true))}>
              <span style={S(AV)}>{initials(nf.client)}</span><span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{nf.client}</span>{TICK}
            </button>
          )}
          {(!typed || !!nf.clientId) && recent.length > 0 && (<>
            <h3 style={S('margin:6px 0 0;font-size:15px;font-weight:600')}>Recent clients</h3>
            <div style={S('display:flex;flex-direction:column')}>
              {recent.slice(0, 8).map((r) => { const on = nf.clientId === r.id; return (
                <button key={r.id} onClick={() => { setNf(on ? { ...nf, client: '', clientId: null } : { ...nf, client: r.name, clientId: r.id }); setError(''); }} aria-pressed={on} style={S(ROW(on))}>
                  <span style={S(AV)}>{initials(r.name)}</span>
                  <span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{r.name}</span>{on && TICK}
                </button>
              ); })}
            </div>
          </>)}
        </>)}

        {step === 1 && (
          <ServicePicker lock={nLock} services={services} selected={nf.services} initialCat={nFirstSvc?.cat} chipHeight={44} onPick={nPickSvc} note={(x) => (nf.staff && !offered(x.id, nf.staff) ? ((offers[x.id] ?? [])[0] ? 'separate booking with ' + first(staffName(offers[x.id][0])) : 'no one offers this') : '')} />
        )}

        {step === 2 && (
          <TeamPicker team={team} selected={nf.staff} offers={nOffers} onPick={(id) => { setNf({ ...nf, staff: id, time: null }); setError(''); }} />
        )}

        {step === 3 && (<>
          <div role="group" className="hscroll" aria-label="Day" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
            {days14.map((d) => <button key={d.ymd} onClick={() => { if (!d.closed) { setNf({ ...nf, day: d.ymd, time: null }); setError(''); } }} disabled={d.closed} aria-pressed={nf.day === d.ymd} aria-label={d.full + (d.closed ? ', closed' : '')} style={S(dayCss(nf.day === d.ymd, d.closed))}><span style={S('font-size:12.5px')}>{d.abbr}</span><span style={S('font-size:17px;font-weight:600')}>{d.num}</span></button>)}
          </div>
          <div role="group" aria-label="Time" style={S('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px')}>
            {nSlots.map((t) => { const why = nWhy(t); const on = nf.time === t && !why; return <button key={t} onClick={() => { if (!why) { setNf({ ...nf, time: t }); setError(''); } }} disabled={!!why} aria-pressed={on} aria-label={fmtMin(t) + (why ? ', unavailable' : '')} style={S(slotCss(on, !!why))}>{fmtMin(t)}</button>; })}
          </div>
          {!nSlots.length && <div style={S('font-size:14px;color:#5E6673')}>No times to show for this day.</div>}
        </>)}

        {step === 4 && (<>
          <div style={S('display:flex;align-items:center;gap:14px;padding:16px;border:1px solid #E6E8EC;border-radius:22px')}>
            <div style={S('flex:0 0 52px;width:52px;height:52px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600')}>{initials(typed || '?')}</div>
            <div style={S('flex:1 1 auto;min-width:0')}>
              <div style={S('font-size:19px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{typed}</div>
              <div style={S('margin-top:2px;font-size:13.5px;color:#5E6673')}>{nf.clientId ? 'Existing client' : 'New client'}</div>
            </div>
            <button onClick={() => go(0)} style={S('flex:0 0 auto;height:36px;padding:0 14px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;font:inherit;font-size:13.5px;font-weight:500;cursor:pointer')}>Change</button>
          </div>
          <div className="sum-rows" style={S('padding:2px 16px;border:1px solid #E6E8EC;border-radius:22px')}>
            {edit(3, <>{ico(<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>)}<span>{di.full}</span></>)}
            {edit(3, <>{ico(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>)}<span>{nf.time !== null ? fmtMin(nf.time) + ' – ' + fmtMin(nf.time + plan.dur) : ''}</span></>)}
            {edit(2, <>{ico(<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.6-3.4 3.3-5 7-5s6.4 1.6 7 5" /></>)}<span>{staffName(nf.staff)}</span></>)}
          </div>
          <div style={S('display:flex;flex-direction:column;gap:10px')}>
            <div style={S('display:flex;align-items:center;justify-content:space-between')}><h3 style={S('margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Services</h3><button onClick={() => go(1)} style={S('border:0;background:transparent;font:inherit;font-size:14px;font-weight:500;text-decoration:underline;cursor:pointer;color:#0E1116')}>Edit</button></div>
            {plan.sel.map((v) => (
              <div key={v.id} style={S('display:flex;align-items:center;gap:12px')}>
                <span style={S('flex:0 0 4px;align-self:stretch;border-radius:999px;background:#B9AEFB')} />
                <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{v.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{v.dur + ' min' + (nf.staff && !offered(v.id, nf.staff) ? ', with ' + first(staffName((offers[v.id] ?? [])[0] ?? '')) : '')}</span></span>
                <span style={S('flex:0 0 auto;font-size:14.5px;font-weight:500')}>{usd(v.priceCents)}</span>
              </div>
            ))}
          </div>
        </>)}
        {hasError ? <p role="alert" style={S(ERR)}>{error}</p> : null}
      </div>

      <div style={S('flex:0 0 auto;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px')}>
        {step >= 1 && plan.sel.length > 0 && <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px')}><span style={S('color:#5E6673;font-size:14px')}>{plan.sel.length + (plan.sel.length === 1 ? ' service' : ' services') + ', ' + plan.mins + ' min'}</span><span style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{usd(plan.priceC)}</span></div>}
        <button onClick={step === 4 ? createNew : next} disabled={busy} style={S(PRIMARY + ';flex:0 0 auto;width:100%;height:52px;opacity:' + (step < 4 && !canNext ? 0.45 : 1))}>{step === 4 ? 'Create appointment' : 'Continue'}</button>
      </div>
    </div>
  );
}
