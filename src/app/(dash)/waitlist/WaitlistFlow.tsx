'use client';
import { Avatar, BACK, BLACK, CLOSE, Chip, DOTS, Note, FieldError, MENU_ROW, Notice, OUTLINE, PAGE, RING, ScreenHeader, dim } from '@/components/ui';
import { TONE } from '@/lib/tones';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmBox } from '@/components/ConfirmBox';
import { useState } from 'react';
import { S, ServicePicker } from '../calendar/pickers';
import { ClientCard, ClientStep, DetailRows, ICONS, PeopleStep, ROW, StepShell, TICK, Tiles, useSteps } from '../calendar/wizardUi';
import { DAY_PREFS, STATUS, WINDOWS, type WlRow } from './shared';
import type { WaitlistCtl } from './WaitlistView';


/** Add to waitlist as steps: client, service, team member, days, time of day, then a summary. */
export function AddFlow({ c }: { c: WaitlistCtl }) {
  const a = c.add;
  const kinds = ['client', 'service', 'team', 'days', 'time', 'summary'] as const;
  const last = kinds.length - 1;
  const { step, jump, forward, back } = useSteps(last, () => c.setError(''));
  const kind = kinds[step];
  const titles: Record<string, string> = { client: 'Select client', service: 'Select service', team: 'Select team member', days: 'Which days?', time: 'Time of day', summary: 'Summary' };
  const svc = c.services.find((x) => x.id === a.svc);
  const proName = a.pro === 'any' ? 'First available team member' : c.team.find((t) => t.id === a.pro)?.name ?? 'First available team member';
  const ready = () => (kind === 'client' && !a.name.trim() ? "Add the client's name." : kind === 'service' && !a.svc ? 'Choose a service.' : '');
  const next = () => { const e = ready(); if (e) { c.setError(e); return; } forward(); };
  const close = () => { c.setMode('list'); c.setError(''); };
  return (
    <StepShell step={step} titles={kinds.map((k) => titles[k])} onBack={back} onClose={close} error={c.error}
      actions={kind === 'summary' ? [] : [{ label: 'Continue', onClick: next }]}
      bar={kind === 'summary' ? <button type="button" onClick={c.submitAdd} disabled={c.busy} style={S(BLACK + ';width:100%;flex:0 0 auto' + dim(c.busy))}>{c.busy ? 'Adding…' : 'Add to waitlist'}</button> : undefined}>
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
  const sl = c.slots[r.id];
  const pick = c.picked[r.id] ?? null;
  const close = () => c.toggle(r);
  const err = c.error ? <FieldError>{c.error}</FieldError> : null;
  const rowCss = MENU_ROW + ';color:#B42318';
  const prefs = r.prefs.split(', ');
  return (
    <div role="dialog" aria-label="Waitlist entry" style={S(PAGE)}>
      <ScreenHeader title={r.name} avatar={r.name} onBack={close}>
        <button onClick={() => { setConfirm(false); setQa(true); }} aria-label="More actions" aria-haspopup="dialog" style={S(RING)}>{DOTS}</button>
      </ScreenHeader>
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 20px;display:flex;flex-direction:column;gap:16px')}>
        <div>
          <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;overflow-wrap:anywhere')}>{r.service.split(',')[0]}</h2>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px')}>
            <Chip tone={STATUS[r.status]}>{r.status}</Chip>
            <span style={S('font-size:13px;color:#5E6673')}>{r.meta}</span>
            {!!c.notice && <Notice>{c.notice}</Notice>}
          </div>
        </div>
        <DetailRows go={() => {}} rows={[
          { icon: ICONS.scissors, text: r.service },
          { icon: ICONS.person, text: prefs[0] ?? '' },
          { icon: ICONS.day, text: prefs.slice(1).join(', ') || 'Any day, Any time' },
        ]} />
        {!!r.offer && r.status === 'Offered' && <div style={S('border-radius:16px;background:' + TONE.purple.bg + ';color:' + TONE.purple.fg + ';padding:12px 16px;font-size:14px;font-weight:500;overflow-wrap:anywhere')}>{r.offer}. Waiting for a reply.</div>}
        {r.status !== 'Booked' && (
          <section aria-label="Times that fit">
            <h3 style={S('margin:0 0 10px;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Times that fit</h3>
            {sl === 'loading' && <Note>Looking for times…</Note>}
            {Array.isArray(sl) && sl.length === 0 && <Note>Nothing fits in the next two weeks. Loosen the preferences or try another team member.</Note>}
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
            {(r.status === 'Offered' || !!pick) && <button className="ghost" onClick={() => c.bookNow(r)} disabled={c.busy} style={S(OUTLINE + dim(c.busy))}>Mark as booked</button>}
            {r.status === 'Waiting' && <button onClick={() => c.offerNow(r)} disabled={c.busy || !pick} style={S(BLACK + dim(c.busy || !pick))}>Offer this time</button>}
            {r.status === 'Offered' && !!pick && <button onClick={() => c.offerNow(r)} disabled={c.busy} style={S(BLACK + dim(c.busy))}>Offer this time</button>}
          </div>
        </div>
      )}
      {qa && (
        <BottomSheet label="More actions" onClose={() => setQa(false)} z={7} gap={0} handleGap={12}>
            <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}>
              <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>More actions</h2>
              <button onClick={() => setQa(false)} aria-label="Close" style={S(RING)}>{CLOSE}</button>
            </div>
            {!confirm ? <button onClick={() => setConfirm(true)} style={S(rowCss)}>Remove from waitlist</button> : (
              <ConfirmBox label="Confirm removal" title={'Remove ' + r.name + ' from the waitlist?'} error={c.error} action="Remove from waitlist" keep="Keep on waitlist" onAction={() => c.remove(r)} busy={c.busy} onKeep={() => { setConfirm(false); setQa(false); }} />
            )}
          </BottomSheet>
      )}
    </div>
  );
}
