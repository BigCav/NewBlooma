'use client';
import { useState } from 'react';
import { dayInfo, fmtMin, BLOCK_KINDS } from '@/lib/cal';
import { S, ServicePicker } from './pickers';
import { BLOCK_DURS_M, METHODS, TIP_OPTS, m2 } from './calUi';
import { DISC_PCTS, NO_DISC } from '../sales/shared';
import { decimalInput } from '@/lib/numeric';
import { StepShell, ClientStep, PeopleStep, Tiles, DayTimeStep, ClientCard, DetailRows, ICONS } from './wizardUi';
import type { useCalendar } from './useCalendar';
import type { Props } from './calUi';

type C = ReturnType<typeof useCalendar>;

/** Walk-in as steps: client, service, team member, then a summary with the two ways to add it. */
export function WalkInWizard({ c, props }: { c: C; props: Props }) {
  const { wi, setWi, wiSvc, wiPlanText, wiPlanCss, addWalkin, offered, services, svcMap, lockFor, team, staffName, setError, error, hasError, busy, close } = c;
  const [step, setStep] = useState(0);
  const go = (n: number) => { setError(''); setStep(n); };
  const canNext = step === 0 ? !!wi.name.trim() : step === 1 ? !!wi.svc : step === 2 ? !!wi.pro : true;
  const next = () => { if (!canNext) { setError(step === 0 ? "Add the client's name." : step === 1 ? 'Choose a service.' : 'Choose a team member.'); return; } go(step + 1); };
  return (
    <StepShell step={step} titles={['Select client', 'Select service', 'Select team member', 'Summary']} onBack={() => go(step - 1)} onClose={close} error={hasError ? error : ''}
      actions={step === 3 ? [{ label: 'Add & check out', onClick: () => addWalkin(true), disabled: busy }, { label: 'Add to calendar', onClick: () => addWalkin(false), disabled: busy, secondary: true }] : [{ label: 'Continue', onClick: next, disabled: !canNext }]}>
      {step === 0 && <ClientStep name={wi.name} clientId={wi.clientId} recent={props.recent ?? []} onChange={(name, id) => { setWi({ ...wi, name, clientId: id }); setError(''); }} />}
      {step === 1 && (
        <ServicePicker extras={false} lock={lockFor([])} services={services} selected={wi.svc ? [wi.svc] : []} initialCat={wiSvc?.cat || wi.cat || undefined} chipHeight={44} onCat={(cat) => setWi({ ...wi, cat })}
          onPick={(id) => { const sv = svcMap.get(id)!; const pro = wi.pro !== 'any' && !offered(id, wi.pro) ? 'any' : wi.pro; setWi(wi.svc === id ? { ...wi, svc: null } : { ...wi, svc: id, cat: sv.cat, pro }); setError(''); }} />
      )}
      {step === 2 && <PeopleStep any team={team} selected={wi.pro} offers={wi.svc ? (sid) => offered(wi.svc!, sid) : undefined} onPick={(id) => { setWi({ ...wi, pro: id || 'any' }); setError(''); }} />}
      {step === 3 && (<>
        <ClientCard name={wi.name} existing={!!wi.clientId} onChange={() => go(0)} />
        <DetailRows go={go} rows={[
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
  const [step, setStep] = useState(0);
  const go = (n: number) => { setError(''); setStep(n); };
  const canNext = step === 0 ? !!lf.s : true;
  return (
    <StepShell step={step} titles={['Select team member', 'How late?', 'Summary']} onBack={() => go(step - 1)} onClose={close} error={hasError ? error : ''}
      actions={[step === 2 ? { label: 'Move ' + (lateList.length || ''), onClick: saveLate, disabled: busy || !lateList.length } : { label: 'Continue', onClick: () => { if (!canNext) { setError('Choose a team member.'); return; } go(step + 1); }, disabled: !canNext }]}>
      {step === 0 && (<>
        <p style={S('margin:0;color:#5E6673;font-size:14px')}>Moves everything not started for one person on {dayInfo(day).short}.</p>
        <PeopleStep team={team} selected={lf.s} onPick={(id) => { setLf({ ...lf, s: id }); setError(''); }} />
      </>)}
      {step === 1 && <Tiles label="Running late by" options={LATE_OPTS} value={lf.mins} onPick={(m) => { setLf({ ...lf, mins: m }); setError(''); }} />}
      {step === 2 && (<>
        <DetailRows go={go} rows={[
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
  const [step, setStep] = useState(0);
  const go = (n: number) => { setError(''); setStep(n); };
  const kindLabel = BLOCK_KINDS.find((k) => k[0] === bf.kind)?.[1] ?? '';
  const durLabel = BLOCK_DURS_M.find((d) => d[0] === bf.dur)?.[1] ?? '';
  const canNext = step === 0 ? !!bf.s : step === 3 ? bf.start !== null && !reason(bf.day, bf.start, bfDur) : true;
  const next = () => { if (!canNext) { setError(step === 0 ? 'Choose a team member.' : 'Choose a start time.'); return; } go(step + 1); };
  return (
    <StepShell step={step} titles={['Select team member', 'Select reason', 'Select length', 'Select time', 'Summary']} onBack={() => go(step - 1)} onClose={close} error={hasError ? error : ''}
      actions={[step === 4 ? { label: 'Block time', onClick: saveBlock, disabled: busy } : { label: 'Continue', onClick: next, disabled: !canNext }]}>
      {step === 0 && (<>
        <p style={S('margin:0;color:#5E6673;font-size:14px')}>Clients cannot book blocked time.</p>
        <PeopleStep team={team} selected={bf.s} onPick={(id) => { setBf({ ...bf, s: id, start: null }); setError(''); }} />
      </>)}
      {step === 1 && <Tiles label="Reason" options={BLOCK_KINDS} value={bf.kind} onPick={(k) => setBf({ ...bf, kind: k })} />}
      {step === 2 && <Tiles label="Length" options={BLOCK_DURS_M} value={bf.dur} onPick={(m) => { setBf({ ...bf, dur: m, start: null }); setError(''); }} />}
      {step === 3 && <DayTimeStep days={days14} day={bf.day} onDay={(d) => { setBf({ ...bf, day: d, start: null }); setError(''); }} slots={slotsFor} why={(t) => reason(bf.day, t, bfDur)} time={bf.start} onTime={(t) => { setBf({ ...bf, start: t }); setError(''); }} />}
      {step === 4 && (
        <DetailRows go={go} rows={[
          { icon: ICONS.person, text: staffName(bf.s), step: 0 },
          { icon: ICONS.tag, text: kindLabel, step: 1 },
          { icon: ICONS.time, text: durLabel + (bf.start !== null ? ', ' + fmtMin(bf.start) + (bfDur > 0 ? ' – ' + fmtMin(bf.start + bfDur) : '') : ''), step: 2 },
          { icon: ICONS.day, text: dayInfo(bf.day).full, step: 3 },
        ]} />
      )}
    </StepShell>
  );
}

const FIELD = 'box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF';

/** Checkout as steps: payment method, discount and tip when they are switched on, then the total to charge. */
export function CheckoutWizard({ c }: { c: C }) {
  const { sel, co, setCo, coMath, cfg, charge, setError, error, hasError, busy, close } = c;
  const kinds = ['method', ...(cfg.canDiscount ? ['discount'] : []), ...(cfg.askTip ? ['tip'] : []), 'summary'] as const;
  const [step, setStep] = useState(0);
  if (!sel) return null;
  const kind = kinds[step];
  const go = (n: number) => { setError(''); setStep(n); };
  const cm = coMath(sel.b.priceCents);
  const methods = METHODS.filter(([m]) => (m === 'card' ? cfg.acceptCard : m === 'cash' ? cfg.acceptCash : cfg.acceptGift));
  const methodLabel = METHODS.find((m) => m[0] === co.method)?.[1] ?? '';
  const discKey = co.disc.kind === 'none' ? 'none' : co.disc.kind === 'amount' ? 'amt' : 'p' + co.disc.value;
  const discLabel = co.disc.kind === 'none' ? 'No discount' : co.disc.kind === 'amount' ? (co.disc.value ? '$' + co.disc.value + ' off' : '$ off') : co.disc.value + '% off';
  const titles: Record<string, string> = { method: 'Payment method', discount: 'Discount', tip: 'Tip', summary: 'Checkout' };
  const stepOf = (k: string) => (kinds as readonly string[]).indexOf(k);
  const canNext = kind === 'method' ? (co.method !== 'gift_card' || !!co.code.trim()) : true;
  return (
    <StepShell step={step} titles={kinds.map((k) => titles[k])} onBack={() => go(step - 1)} onClose={close} error={hasError ? error : ''}
      actions={[kind === 'summary' ? { label: 'Charge ' + m2(cm.total), onClick: charge, disabled: busy } : { label: 'Continue', onClick: () => { if (!canNext) { setError('Enter the gift card code.'); return; } go(step + 1); }, disabled: !canNext }]}>
      <p style={S('margin:0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{sel.b.client + ', ' + sel.b.services}</p>
      {kind === 'method' && (<>
        <Tiles label="Payment method" options={methods} value={co.method} onPick={(m) => setCo({ ...co, method: m })} />
        {co.method === 'gift_card' && <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="co-code" style={S('font-size:14px;font-weight:600')}>Gift card code</label><input id="co-code" type="text" value={co.code} onChange={(e) => setCo({ ...co, code: e.target.value })} placeholder="Code" style={{ ...S(FIELD), minHeight: 0 }} /></div>}
      </>)}
      {kind === 'discount' && (<>
        <Tiles label="Discount" value={discKey} options={[['none', 'None'], ...DISC_PCTS.map((v) => ['p' + v, v + '%'] as const), ['amt', '$ off']] as const}
          onPick={(k) => setCo({ ...co, disc: k === 'none' ? NO_DISC : k === 'amt' ? { ...co.disc, kind: 'amount', value: co.disc.kind === 'amount' ? co.disc.value : '' } : { ...co.disc, kind: 'percent', value: k.slice(1) } })} />
        {co.disc.kind === 'amount' && <input aria-label="Discount amount in dollars" inputMode="decimal" value={co.disc.value} onChange={(e) => setCo({ ...co, disc: { ...co.disc, value: decimalInput(e.target.value) } })} placeholder="Amount off, like 10 or 7.50" style={{ ...S(FIELD), minHeight: 0 }} />}
        {co.disc.kind !== 'none' && <input aria-label="Discount reason" maxLength={60} value={co.disc.note} onChange={(e) => setCo({ ...co, disc: { ...co.disc, note: e.target.value } })} placeholder="Reason (optional), e.g. Staff discount" style={{ ...S(FIELD), minHeight: 0 }} />}
      </>)}
      {kind === 'tip' && <Tiles label="Tip" options={TIP_OPTS} value={co.tip} onPick={(p) => setCo({ ...co, tip: p })} />}
      {kind === 'summary' && (<>
        <DetailRows go={go} rows={[
          { icon: ICONS.tag, text: methodLabel + (co.method === 'gift_card' && co.code ? ', ' + co.code : ''), step: 0 },
          ...(cfg.canDiscount ? [{ icon: ICONS.tag, text: discLabel, step: stepOf('discount') }] : []),
          ...(cfg.askTip ? [{ icon: ICONS.tag, text: cm.tip ? 'Tip ' + m2(cm.tip) : 'No tip', step: stepOf('tip') }] : []),
        ]} />
        <div className="sum-rows" style={S('padding:2px 16px;border:1px solid #E6E8EC;border-radius:22px')}>
          {([['Service', m2(sel.b.priceCents)], ...(cm.disc > 0 ? [['Discount', '-' + m2(cm.disc)]] : []), ['Tip', cm.tip ? m2(cm.tip) : 'None'], [cm.taxLabel, m2(cm.taxAmt)]] as [string, string][]).map(([l, v]) => (
            <div key={l} style={S('display:flex;justify-content:space-between;gap:12px;padding:13px 0;font-size:15px')}><span style={S('color:#5E6673')}>{l}</span><span style={S('font-weight:500;white-space:nowrap')}>{v}</span></div>
          ))}
          <div style={S('display:flex;justify-content:space-between;gap:12px;padding:15px 0;font-size:18px;font-weight:600')}><span>Total</span><span>{m2(cm.total)}</span></div>
        </div>
      </>)}
    </StepShell>
  );
}
