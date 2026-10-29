'use client';
import { dayInfo, fmtMin } from '@/lib/cal';
import { S, ServicePicker } from './pickers';
import { first, usd } from './calUi';
import { useSteps, StepShell, ClientStep, PeopleStep, DayTimeStep, ClientCard, DetailRows, ICONS } from './wizardUi';
import type { useCalendar } from './useCalendar';
import type { Props } from './calUi';

const TITLES = ['Select client', 'Select services', 'Select team member', 'Select time', 'Summary'];

/** Phone version of "New appointment": client, services (and extras), team member, time, then a summary like the booking view. */
export function NewApptWizard({ c, props, onCancel }: { c: ReturnType<typeof useCalendar>; props: Props; onCancel?: () => void }) {
  const { nf, setNf, setError, error, hasError, busy, close, createNew, nLock, nFirstSvc, nPickSvc, nOffers, nSlots, nWhy, days14, offered, offers, staffName, services, team, nPlan } = c;
  const typed = nf.client.trim();
  const plan = nPlan();
  const { step, go, jump, forward, back } = useSteps(4, () => setError(''));
  const canNext = step === 0 ? !!typed : step === 1 ? plan.sel.length > 0 : step === 2 ? !!nf.staff : step === 3 ? nf.time !== null && !nWhy(nf.time) : true;
  const next = () => { if (!canNext) { setError(step === 0 ? "Add the client's name." : step === 1 ? 'Choose a service.' : step === 2 ? 'Choose a team member.' : 'Choose a time.'); return; } forward(); };
  const shut = onCancel ?? close;

  return (
    <StepShell step={step} titles={TITLES} onBack={back} onClose={shut} error={hasError ? error : ''}
      summary={step >= 1 && plan.sel.length > 0 ? <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px')}><span style={S('color:#5E6673;font-size:14px')}>{plan.sel.length + (plan.sel.length === 1 ? ' service' : ' services') + ', ' + plan.mins + ' min'}</span><span style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{usd(plan.priceC)}</span></div> : null}
      actions={[step === 4 ? { label: 'Create appointment', onClick: createNew, disabled: busy } : { label: 'Continue', onClick: next, disabled: !canNext }]}>
      {step === 0 && <ClientStep name={nf.client} clientId={nf.clientId} recent={props.recent ?? []} onChange={(name, id) => { setNf({ ...nf, client: name, clientId: id }); setError(''); }} />}

      {step === 1 && (
        <ServicePicker lock={nLock} services={services} selected={nf.services} initialCat={nFirstSvc?.cat} chipHeight={44} onPick={nPickSvc} note={(x) => (nf.staff && !offered(x.id, nf.staff) ? ((offers[x.id] ?? [])[0] ? 'separate booking with ' + first(staffName(offers[x.id][0])) : 'no one offers this') : '')} />
      )}

      {step === 2 && <PeopleStep team={team} selected={nf.staff} offers={nOffers} onPick={(id) => { setNf({ ...nf, staff: id, time: null }); setError(''); }} />}

      {step === 3 && <DayTimeStep days={days14} day={nf.day} onDay={(d) => { setNf({ ...nf, day: d, time: null }); setError(''); }} slots={nSlots} why={nWhy} time={nf.time} onTime={(t) => { setNf({ ...nf, time: t }); setError(''); }} />}

      {step === 4 && (<>
        <ClientCard name={nf.client} existing={!!nf.clientId} onChange={() => jump(0)} />
        <DetailRows go={jump} rows={[
          { icon: ICONS.day, text: dayInfo(nf.day).full, step: 3 },
          { icon: ICONS.time, text: nf.time !== null ? fmtMin(nf.time) + ' – ' + fmtMin(nf.time + plan.dur) : '', step: 3 },
          { icon: ICONS.person, text: staffName(nf.staff), step: 2 },
        ]} />
        <div style={S('display:flex;flex-direction:column;gap:10px')}>
          <div style={S('display:flex;align-items:center;justify-content:space-between')}><h3 style={S('margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Services</h3><button onClick={() => jump(1)} style={S('border:0;background:transparent;font:inherit;font-size:14px;font-weight:500;text-decoration:underline;cursor:pointer;color:#0E1116')}>Edit</button></div>
          {plan.sel.map((v) => (
            <div key={v.id} style={S('display:flex;align-items:center;gap:12px')}>
              <span style={S('flex:0 0 4px;align-self:stretch;border-radius:999px;background:#B9AEFB')} />
              <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{v.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{v.dur + ' min' + (nf.staff && !offered(v.id, nf.staff) ? ', with ' + first(staffName((offers[v.id] ?? [])[0] ?? '')) : '')}</span></span>
              <span style={S('flex:0 0 auto;font-size:14.5px;font-weight:500')}>{usd(v.priceCents)}</span>
            </div>
          ))}
        </div>
      </>)}
    </StepShell>
  );
}
