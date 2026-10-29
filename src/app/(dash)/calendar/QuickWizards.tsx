'use client';
import { useState } from 'react';
import { dayInfo, fmtMin, BLOCK_KINDS } from '@/lib/cal';
import { S, ServicePicker } from './pickers';
import { BLOCK_DURS_M, METHODS } from './calUi';
import { CheckoutFlow } from './CheckoutFlow';
import { useSteps, StepShell, ClientStep, PeopleStep, Tiles, DayTimeStep, ClientCard, DetailRows, ICONS } from './wizardUi';
import type { useCalendar } from './useCalendar';
import type { Props } from './calUi';

type C = ReturnType<typeof useCalendar>;

/** Walk-in as steps: client, service, team member, then a summary with the two ways to add it. */
export function WalkInWizard({ c, props }: { c: C; props: Props }) {
  const { wi, setWi, wiSvc, wiPlanText, wiPlanCss, addWalkin, offered, services, svcMap, lockFor, team, staffName, setError, error, hasError, busy, close } = c;
  const { step, go, jump, forward, back } = useSteps(3, () => setError(''));
  const canNext = step === 0 ? !!wi.name.trim() : step === 1 ? !!wi.svc : step === 2 ? !!wi.pro : true;
  const next = () => { if (!canNext) { setError(step === 0 ? "Add the client's name." : step === 1 ? 'Choose a service.' : 'Choose a team member.'); return; } forward(); };
  return (
    <StepShell step={step} titles={['Select client', 'Select service', 'Select team member', 'Summary']} onBack={back} onClose={close} error={hasError ? error : ''}
      actions={step === 3 ? [{ label: 'Add & check out', onClick: () => addWalkin(true), disabled: busy }, { label: 'Add to calendar', onClick: () => addWalkin(false), disabled: busy, secondary: true }] : [{ label: 'Continue', onClick: next, disabled: !canNext }]}>
      {step === 0 && <ClientStep name={wi.name} clientId={wi.clientId} recent={props.recent ?? []} onChange={(name, id) => { setWi({ ...wi, name, clientId: id }); setError(''); }} />}
      {step === 1 && (
        <ServicePicker extras={false} lock={lockFor([])} services={services} selected={wi.svc ? [wi.svc] : []} initialCat={wiSvc?.cat || wi.cat || undefined} chipHeight={44} onCat={(cat) => setWi({ ...wi, cat })}
          onPick={(id) => { const sv = svcMap.get(id)!; const pro = wi.pro !== 'any' && !offered(id, wi.pro) ? 'any' : wi.pro; setWi(wi.svc === id ? { ...wi, svc: null } : { ...wi, svc: id, cat: sv.cat, pro }); setError(''); }} />
      )}
      {step === 2 && <PeopleStep any team={team} selected={wi.pro} offers={wi.svc ? (sid) => offered(wi.svc!, sid) : undefined} onPick={(id) => { setWi({ ...wi, pro: id || 'any' }); setError(''); }} />}
      {step === 3 && (<>
        <ClientCard name={wi.name} existing={!!wi.clientId} onChange={() => jump(0)} />
        <DetailRows go={jump} rows={[
          { icon: ICONS.scissors, text: wiSvc ? wiSvc.name : '', step: 1 },
          { icon: ICONS.person, text: wi.pro === 'any' ? 'First available' : staffName(wi.pro), step: 2 },
        ]} />
        <div role="status" style={S(wiPlanCss)}>{wiPlanText}</div>
      </>)}
    </StepShell>
  );
}

const LATE_OPTS = [[15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1.5 hours'], [120, '2 hours']] as const;

/** Running late as steps: who, how late, then what moves and whether to tell the clients. */
export function LateWizard({ c }: { c: C }) {
  const { lf, setLf, lateList, saveLate, team, staffName, day, setError, error, hasError, busy, close } = c;
  const { step, go, jump, forward, back } = useSteps(2, () => setError(''));
  const canNext = step === 0 ? !!lf.s : true;
  return (
    <StepShell step={step} titles={['Select team member', 'How late?', 'Summary']} onBack={back} onClose={close} error={hasError ? error : ''}
      actions={[step === 2 ? { label: 'Move ' + (lateList.length || ''), onClick: saveLate, disabled: busy || !lateList.length } : { label: 'Continue', onClick: () => { if (!canNext) { setError('Choose a team member.'); return; } forward(); }, disabled: !canNext }]}>
      {step === 0 && (<>
        <p style={S('margin:0;color:#5E6673;font-size:14px')}>Moves everything not started for one person on {dayInfo(day).short}.</p>
        <PeopleStep team={team} selected={lf.s} onPick={(id) => { setLf({ ...lf, s: id }); setError(''); }} />
      </>)}
      {step === 1 && <Tiles label="Running late by" options={LATE_OPTS} value={lf.mins} onPick={(m) => { setLf({ ...lf, mins: m }); setError(''); }} />}
      {step === 2 && (<>
        <DetailRows go={jump} rows={[
          { icon: ICONS.person, text: staffName(lf.s), step: 0 },
          { icon: ICONS.time, text: 'Running late by ' + (LATE_OPTS.find((o) => o[0] === lf.mins)?.[1] ?? lf.mins + ' min'), step: 1 },
        ]} />
        <h3 style={S('margin:6px 0 0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>{lateList.length ? lateList.length + (lateList.length === 1 ? ' appointment moves' : ' appointments move') : 'Nothing left to move'}</h3>
        {lateList.map((b) => <div key={b.id} style={S('display:flex;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:14px;background:#F4F5F7;font-size:14px')}><span style={S('min-width:0;overflow-wrap:anywhere')}>{b.client}</span><span style={S('flex:0 0 auto;color:#5E6673')}>{fmtMin(b.start)} to {fmtMin(b.start + lf.mins)}</span></div>)}
        <h3 style={S('margin:6px 0 0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Tell the clients</h3>
        <Tiles label="Tell the clients" options={[['yes', 'Message them'], ['no', 'Do not message']] as const} value={lf.tell ? 'yes' : 'no'} onPick={(v) => setLf({ ...lf, tell: v === 'yes' })} />
      </>)}
    </StepShell>
  );
}

/** Block time as steps: who, reason, length, when, then a summary. */
export function BlockWizard({ c }: { c: C }) {
  const { bf, setBf, bfDur, slotsFor, reason, saveBlock, team, staffName, days14, setError, error, hasError, busy, close } = c;
  const { step, go, jump, forward, back } = useSteps(4, () => setError(''));
  const kindLabel = BLOCK_KINDS.find((k) => k[0] === bf.kind)?.[1] ?? '';
  const durLabel = BLOCK_DURS_M.find((d) => d[0] === bf.dur)?.[1] ?? '';
  const canNext = step === 0 ? !!bf.s : step === 3 ? bf.start !== null && !reason(bf.day, bf.start, bfDur) : true;
  const next = () => { if (!canNext) { setError(step === 0 ? 'Choose a team member.' : 'Choose a start time.'); return; } forward(); };
  return (
    <StepShell step={step} titles={['Select team member', 'Select reason', 'Select length', 'Select time', 'Summary']} onBack={back} onClose={close} error={hasError ? error : ''}
      actions={[step === 4 ? { label: 'Block time', onClick: saveBlock, disabled: busy } : { label: 'Continue', onClick: next, disabled: !canNext }]}>
      {step === 0 && (<>
        <p style={S('margin:0;color:#5E6673;font-size:14px')}>Clients cannot book blocked time.</p>
        <PeopleStep team={team} selected={bf.s} onPick={(id) => { setBf({ ...bf, s: id, start: null }); setError(''); }} />
      </>)}
      {step === 1 && <Tiles label="Reason" options={BLOCK_KINDS} value={bf.kind} onPick={(k) => setBf({ ...bf, kind: k })} />}
      {step === 2 && <Tiles label="Length" options={BLOCK_DURS_M} value={bf.dur} onPick={(m) => { setBf({ ...bf, dur: m, start: null }); setError(''); }} />}
      {step === 3 && <DayTimeStep days={days14} day={bf.day} onDay={(d) => { setBf({ ...bf, day: d, start: null }); setError(''); }} slots={slotsFor} why={(t) => reason(bf.day, t, bfDur)} time={bf.start} onTime={(t) => { setBf({ ...bf, start: t }); setError(''); }} />}
      {step === 4 && (
        <DetailRows go={jump} rows={[
          { icon: ICONS.person, text: staffName(bf.s), step: 0 },
          { icon: ICONS.tag, text: kindLabel, step: 1 },
          { icon: ICONS.time, text: durLabel + (bf.start !== null ? ', ' + fmtMin(bf.start) + (bfDur > 0 ? ' – ' + fmtMin(bf.start + bfDur) : '') : ''), step: 2 },
          { icon: ICONS.day, text: dayInfo(bf.day).full, step: 3 },
        ]} />
      )}
    </StepShell>
  );
}

/** The calendar's checkout: the shared steps, charging the booking being looked at. */
export function CheckoutWizard({ c }: { c: C }) {
  const { sel, co, setCo, cfg, charge, setError, error, hasError, busy, close, svcMap, lockFor, services } = c;
  if (!sel) return null;
  // The services on the sale. Changing them here only changes what is charged, never the booking.
  const ids = co.svc ?? sel.b.serviceIds;
  const found = ids.map((id) => svcMap.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof svcMap.get>>[];
  const gross = co.svc ? found.reduce((a, v) => a + v.priceCents, 0) : sel.b.priceCents;
  const lines = found.length ? found.map((v) => ({ key: v.id, name: v.name, sub: v.dur + ' min', cents: v.priceCents })) : [{ key: 'sale', name: sel.b.services, cents: gross }];
  const pickSvc = (id: string) => {
    let next = ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id];
    next = next.filter((i) => { const sv = svcMap.get(i); return !sv?.addon || (sv.parents ?? []).some((pid) => next.includes(pid)); });
    if (!next.length) { setError('Keep at least one service on the sale.'); return; }
    setError(''); setCo({ ...co, svc: next });
  };
  const methods = METHODS.filter(([m]) => (m === 'card' ? cfg.acceptCard : m === 'cash' ? cfg.acceptCash : cfg.acceptGift));
  return (
    <CheckoutFlow who={sel.b.client + ', ' + sel.b.services} methods={methods} co={co} setCo={(x) => setCo({ ...co, ...x })}
      cfg={{ canDiscount: cfg.canDiscount, askTip: cfg.askTip, taxInclusive: cfg.taxInclusive, taxRate: cfg.taxRate }}
      lines={lines} gross={gross} onCharge={charge} busy={busy} error={hasError ? error : ''} setError={setError} onClose={close}
      edit={{ services, selected: ids, lock: lockFor(ids), initialCat: found[0]?.cat, onPick: pickSvc }} />
  );
}
