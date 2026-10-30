'use client';
import { useState } from 'react';
import { S, ServicePicker } from '../calendar/pickers';
import { ClientCard, ClientStep, DetailRows, ICONS, PeopleStep, ROW, StepShell, TICK, Tiles, useSteps } from '../calendar/wizardUi';
import { DAY_PREFS, STATUS, WINDOWS, initialsOf, type WlRow } from './shared';
import type { WaitlistCtl } from './WaitlistView';

const RING = 'flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;padding:0';
const BACK = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6l-6 6 6 6" /></svg>;
const DOTS = <svg width="20" height="20" viewBox="0 0 24 24" fill="#0E1116"><circle cx="12" cy="5.5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="18.5" r="1.6" /></svg>;
const CLOSE = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;
const BLACK = 'flex:1 1 0;height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;cursor:pointer';
const OUTLINE = 'flex:1 1 0;height:52px;box-sizing:border-box;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500;cursor:pointer';

/** Add to waitlist as steps: client, service, team member, days, time of day, then a summary. */
export function AddFlow({ c }: { c: WaitlistCtl }) {
  const a = c.add;
  const kinds = ['client', 'service', 'team', 'days', 'time', 'summary'] as const;
  const last = kinds.length - 1;
  const { step, jump, forward, back } = useSteps(last, () => c.setError(''));
  const kind = kinds[step];
  const titles: Record<string, string> = { client: 'Select client', service: 'Select service', team: 'Select team member', days: 'Which days?', time: 'Time of day', summary: 'Summary' };
  const svc = c.services.find((x) => x.id === a.svc);
  const proName = a.pro === 'any' ? 'Anyone' : c.team.find((t) => t.id === a.pro)?.name ?? 'Anyone';
  const ready = () => (kind === 'client' && !a.name.trim() ? "Add the client's name." : kind === 'service' && !a.svc ? 'Choose a service.' : '');
  const next = () => { const e = ready(); if (e) { c.setError(e); return; } forward(); };
  const close = () => { c.setMode('list'); c.setError(''); };
  return (
    <StepShell step={step} titles={kinds.map((k) => titles[k])} onBack={back} onClose={close} error={c.error}
      actions={kind === 'summary' ? [] : [{ label: 'Continue', onClick: next }]}
      bar={kind === 'summary' ? <button type="button" onClick={c.submitAdd} disabled={c.busy} style={S(BLACK + ';width:100%;flex:0 0 auto')}>Add to waitlist</button> : undefined}>
      {kind === 'client' && <ClientStep name={a.name} clientId={a.clientId} recent={[]} onChange={(name, id) => { c.setAdd({ ...a, name, clientId: id }); c.setError(''); }} />}
      {kind === 'service' && <ServicePicker extras={false} services={c.services} selected={a.svc ? [a.svc] : []} initialCat={svc?.cat} chipHeight={44} onPick={c.pickSvc} />}
      {kind === 'team' && <PeopleStep any team={c.team} selected={a.pro} offers={svc ? (sid) => (c.offers[svc.id] ?? []).includes(sid) : undefined} onPick={(id) => { c.setAdd({ ...a, pro: id || 'any' }); c.setError(''); }} />}
      {kind === 'days' && <Tiles label="Days" options={DAY_PREFS} value={a.dayPref} onPick={(v) => c.setAdd({ ...a, dayPref: v })} />}
      {kind === 'time' && <Tiles label="Time of day" options={WINDOWS} value={a.win} onPick={(v) => c.setAdd({ ...a, win: v })} />}
      {kind === 'summary' && (<>
        <ClientCard name={a.name} existing={!!a.clientId} onChange={() => jump(0)} />
        <DetailRows go={jump} rows={[
          { icon: ICONS.scissors, text: svc?.name ?? 'No service', step: 1 },
          { icon: ICONS.person, text: proName, step: 2 },
          { icon: ICONS.day, text: DAY_PREFS.find((d) => d[0] === a.dayPref)?.[1] ?? 'Any day', step: 3 },
          { icon: ICONS.time, text: WINDOWS.find((w) => w[0] === a.win)?.[1] ?? 'Any time', step: 4 },
        ]} />
        <p style={S('margin:0;font-size:13px;color:#5E6673')}>We will suggest times as they open up.</p>
      </>)}
    </StepShell>
  );
}

/** One waitlist entry as its own page: what they want, times that fit, and the actions. */
export function EntryPage({ c, r }: { c: WaitlistCtl; r: WlRow }) {
  const [qa, setQa] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const tone = STATUS[r.status];
  const sl = c.slots[r.id];
  const pick = c.picked[r.id] ?? null;
  const close = () => c.toggle(r);
  const err = c.error ? <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p> : null;
  const rowCss = 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:58px;padding:0 4px;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;color:#B42318;cursor:pointer';
  const prefs = r.prefs.split(', ');
  return (
    <div role="dialog" aria-label="Waitlist entry" style={S("position:absolute;left:0;right:0;top:0;bottom:0;z-index:5;display:flex;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px;border-bottom:1px solid #E6E8EC')}>
        <button onClick={close} aria-label="Back" style={S(RING)}>{BACK}</button>
        <div style={S('flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600')}>{r.initials || initialsOf(r.name)}</div>
        <div style={S('flex:1 1 auto;min-width:0;font-size:18px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.name}</div>
        <button onClick={() => { setConfirm(false); setQa(true); }} aria-label="More actions" aria-haspopup="dialog" style={S(RING)}>{DOTS}</button>
      </header>
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 20px;display:flex;flex-direction:column;gap:16px')}>
        <div>
          <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;overflow-wrap:anywhere')}>{r.service.split(',')[0]}</h2>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px')}>
            <span style={S('display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + tone[0] + ';color:' + tone[1])}>{r.status}</span>
            <span style={S('font-size:13px;color:#5E6673')}>{r.meta}</span>
            {!!c.notice && <span role="status" style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.notice}</span>}
          </div>
        </div>
        <DetailRows go={() => {}} rows={[
          { icon: ICONS.scissors, text: r.service },
          { icon: ICONS.person, text: prefs[0] ?? '' },
          { icon: ICONS.day, text: prefs.slice(1).join(', ') || 'Any day, Any time' },
        ]} />
        {!!r.offer && r.status === 'Offered' && <div style={S('border-radius:16px;background:#ECE8FF;color:#3B2BB5;padding:12px 16px;font-size:14px;font-weight:500;overflow-wrap:anywhere')}>{r.offer}. Waiting for a reply.</div>}
        {r.status !== 'Booked' && (
          <section aria-label="Times that fit">
            <h3 style={S('margin:0 0 10px;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Times that fit</h3>
            {sl === 'loading' && <p style={S('margin:0;color:#5E6673;font-size:14px')}>Looking for times…</p>}
            {Array.isArray(sl) && sl.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>Nothing fits in the next two weeks. Loosen the preferences or try another team member.</p>}
            {Array.isArray(sl) && sl.map((s) => {
              const on = pick?.startsAt === s.startsAt && pick?.staffId === s.staffId;
              return <button key={s.staffId + s.startsAt} onClick={() => c.setPicked({ ...c.picked, [r.id]: on ? null : s })} aria-pressed={on} style={S(ROW(on))}><span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:500;overflow-wrap:anywhere')}>{s.label}</span>{on && TICK}</button>;
            })}
          </section>
        )}
      </main>
      {r.status !== 'Booked' && (
        <div style={S('flex:0 0 auto;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px')}>
          {err}
          <div style={S('display:flex;gap:10px')}>
            {(r.status === 'Offered' || !!pick) && <button className="ghost" onClick={() => c.bookNow(r)} disabled={c.busy} style={S(OUTLINE)}>Mark as booked</button>}
            {r.status === 'Waiting' && <button onClick={() => c.offerNow(r)} disabled={c.busy || !pick} style={S(BLACK + ';opacity:' + (pick ? 1 : 0.45))}>Offer this time</button>}
            {r.status === 'Offered' && !!pick && <button onClick={() => c.offerNow(r)} disabled={c.busy} style={S(BLACK)}>Offer this time</button>}
          </div>
        </div>
      )}
      {qa && (
        <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:7')}>
          <button onClick={() => setQa(false)} aria-label="Close" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
          <div className="sheet" role="dialog" aria-label="More actions" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column')}>
            <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0;margin-bottom:12px')} />
            <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}>
              <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>More actions</h2>
              <button onClick={() => setQa(false)} aria-label="Close" style={S(RING)}>{CLOSE}</button>
            </div>
            {!confirm ? <button onClick={() => setConfirm(true)} style={S(rowCss)}>Remove from waitlist</button> : (
              <div style={S('display:flex;flex-direction:column;gap:12px;padding:16px;border:1px solid #F3C6C3;border-radius:20px;background:#FEF3F2')}>
                <span style={S('font-size:14.5px;font-weight:600')}>Remove {r.name} from the waitlist?</span>
                {err}
                <div style={S('display:flex;gap:10px')}>
                  <button onClick={() => c.remove(r)} disabled={c.busy} style={S('flex:1 1 0;height:48px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font-size:14px;font-weight:500')}>Remove</button>
                  <button className="ghost" onClick={() => { setConfirm(false); setQa(false); }} style={S('flex:1 1 0;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500')}>Keep</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
