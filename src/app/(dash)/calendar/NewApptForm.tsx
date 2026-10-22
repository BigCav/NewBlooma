'use client';
import { fmtMin } from '@/lib/cal';
import { ClientMatches } from './ClientMatches';
import { S, ServicePicker, TeamPicker } from './pickers';
import { first, chip, slotCss, dayCss, PRIMARY, SECOND, CLOSE_BTN, H2S, ERR, CloseX } from './calUi';
import type { useCalendar } from './useCalendar';
import type { Props } from './calUi';

/** The "New appointment" form shared by the calendar's sheet and the global sheet opened from the + button on any page. */
export function NewApptForm({ c, props, onCancel }: { c: ReturnType<typeof useCalendar>; props: Props; onCancel?: () => void }) {
  const { nf, setNf, setError, error, hasError, busy, close, backToView, createNew, nLock, nFirstSvc, nPickSvc, nOffers, nSlots, nWhy, days14, offered, offers, staffName, services, team } = c;
  return (<>
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><div style={S('min-width:0')}><h2 style={S(H2S)}>New appointment</h2></div><button onClick={onCancel ?? close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}>
                <label htmlFor="ap-client" style={S('font-size:14px;font-weight:600')}>Client</label>
                <input id="ap-client" type="text" value={nf.client} onChange={(e) => { setNf({ ...nf, client: e.target.value, clientId: null }); setError(''); }} placeholder="Search or type a client name" style={{ ...S('box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF'), minHeight: 0 }} />
                <ClientMatches mobile query={nf.client} pickedId={nf.clientId} onPick={(h) => { setNf({ ...nf, client: h.name, clientId: h.id }); setError(''); }} />
                {!nf.client.trim() && props.recent.length > 0 && <div role="group" className="hscroll" aria-label="Recent clients" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
                  {props.recent.map((r) => <button key={r.id} onClick={() => { setNf({ ...nf, client: r.name, clientId: r.id }); setError(''); }} aria-pressed={nf.client.trim() === r.name} style={S(chip(nf.client.trim() === r.name))}>{r.name}</button>)}</div>}
              </div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="ap-service-label" style={S('font-size:14px;font-weight:600')}>Service</span>
                <ServicePicker lock={nLock} services={services} selected={nf.services} initialCat={nFirstSvc?.cat} chipHeight={44} onPick={nPickSvc} note={(x) => (nf.staff && !offered(x.id, nf.staff) ? ((offers[x.id] ?? [])[0] ? 'separate booking with ' + first(staffName(offers[x.id][0])) : 'no one offers this') : '')} /></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="ap-staff-label" style={S('font-size:14px;font-weight:600')}>Team member</span>
                <TeamPicker team={team} selected={nf.staff} offers={nOffers} onPick={(id) => { setNf({ ...nf, staff: id, time: null }); setError(''); }} /></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="ap-day-label" style={S('font-size:14px;font-weight:600')}>Day</span>
                <div role="group" className="hscroll" aria-labelledby="ap-day-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
                  {days14.map((d) => <button key={d.ymd} onClick={() => { if (!d.closed) { setNf({ ...nf, day: d.ymd, time: null }); setError(''); } }} disabled={d.closed} aria-pressed={nf.day === d.ymd} aria-label={d.full + (d.closed ? ', closed' : '')} style={S(dayCss(nf.day === d.ymd, d.closed))}><span style={S('font-size:12.5px')}>{d.abbr}</span><span style={S('font-size:17px;font-weight:600')}>{d.num}</span></button>)}</div></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="ap-time-label" style={S('font-size:14px;font-weight:600')}>Time</span>
                <div role="group" aria-labelledby="ap-time-label" style={S('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px')}>
                  {nSlots.map((t) => { const why = nWhy(t); const on = nf.time === t && !why; return <button key={t} onClick={() => { if (!why) { setNf({ ...nf, time: t }); setError(''); } }} disabled={!!why} aria-pressed={on} aria-label={fmtMin(t) + (why ? ', unavailable' : '')} style={S(slotCss(on, !!why))}>{fmtMin(t)}</button>; })}</div></div>
              {hasError ? <p role="alert" style={S(ERR)}>{error}</p> : null}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={createNew} disabled={busy} style={S(PRIMARY)}>Create appointment</button>
                <button onClick={onCancel ?? backToView} style={S(SECOND)}>Cancel</button>
              </div>
              </>);
}
