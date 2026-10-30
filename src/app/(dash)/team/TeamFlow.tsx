'use client';
import { useState } from 'react';
import { S } from '../calendar/pickers';
import { CLOSE_BTN as RING_BTN, CloseX } from '../calendar/calUi';
import { ROW, TICK, ICONS, StepShell, useSteps, Tiles, DetailRows } from '../calendar/wizardUi';
import { Crown } from './Crown';
import { DAYS, DAY_FULL, SHIFTS, clock24, initialsOf, photoCss } from './shared';
import type { TeamCtl } from './TeamView';

const FIELD_IN = { ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), minHeight: 0 } as const;
const TIME_IN = { ...S('box-sizing:border-box;flex:1 1 0;min-width:0;max-width:150px;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF'), minHeight: 0 } as const;

function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} style={S('display:block;box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{label}</span>{children}</label>;
}

const AVATAR = 'flex:0 0 72px;width:72px;height:72px;border-radius:999px;background:#EEF0F3;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:600';
const PILL = 'display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 18px;border-radius:999px;border:1px solid #E1E4E9;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500;cursor:pointer';

/**
 * The phone's team member editor as steps: details, services, days, hours, online booking, then a summary.
 * A new member goes through them in order. An existing one opens on the summary, and a row there jumps to that step.
 */
export function TeamFlow({ c }: { c: TeamCtl }) {
  const { draft: d, mode, confirm, setConfirm, error, busy } = c;
  const isNew = mode === 'new';
  const cur = c.items.find((x) => x.id === c.selectedId) ?? null;
  const kinds = ['details', 'services', 'days', 'hours', 'online', 'summary'] as const;
  const last = kinds.length - 1;
  const { step, jump, forward, back } = useSteps(last, () => c.setError(''), isNew ? 0 : last);
  const [menu, setMenu] = useState(false);
  const kind = kinds[Math.min(step, last)];
  const at = (k: string) => (kinds as readonly string[]).indexOf(k);
  const titles: Record<string, string> = { details: 'Details', services: 'Services they offer', days: 'Working days', hours: 'Hours', online: 'Online booking', summary: isNew ? 'Summary' : 'Edit team member' };

  const ready = () => {
    if (kind === 'details') return d.name.trim() ? '' : "Add the team member's name.";
    if (kind === 'services') return d.cats.length ? '' : 'Choose at least one service category.';
    return '';
  };
  const next = () => { const e = ready(); if (e) { c.setError(e); return; } forward(); };

  const days = d.days.slice().sort((a, b) => a - b);
  const same = days.length > 0 && days.every((x) => d.times[x][0] === d.times[days[0]][0] && d.times[x][1] === d.times[days[0]][1]);
  const hoursText = !days.length ? 'No working days' : same ? clock24(d.times[days[0]][0]) + ' to ' + clock24(d.times[days[0]][1]) : 'Hours vary by day';
  const daysText = !days.length ? 'No working days' : days.length === 7 ? 'Every day' : days.map((x) => DAYS[x]).join(', ');
  const first = (cur?.name ?? d.name).split(' ')[0] || 'them';
  const canRemove = !isNew && !!cur && !cur.isOwner;

  const summaryBar = (
    <div style={S('display:flex;gap:10px')}>
      {canRemove && <button type="button" onClick={() => setMenu(true)} aria-label="More actions" aria-haspopup="dialog" style={S(RING_BTN + ';flex:0 0 52px;width:52px;height:52px')}><svg width="20" height="20" viewBox="0 0 24 24" fill="#0E1116"><circle cx="12" cy="5.5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="18.5" r="1.6" /></svg></button>}
      <button type="button" onClick={c.save} disabled={busy} style={S('flex:1 1 0;height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;cursor:pointer')}>{isNew ? 'Add team member' : 'Save changes'}</button>
    </div>
  );

  return (<>
    <StepShell step={step} titles={kinds.map((k) => titles[k])} onBack={back} onClose={c.close} error={error}
      actions={kind === 'summary' ? [] : [{ label: 'Continue', onClick: next }]}
      bar={kind === 'summary' ? summaryBar : undefined}>
      <div style={S('display:flex;flex-direction:column;gap:14px')}>
        {kind === 'details' && (<>
          <div style={S('display:flex;align-items:center;gap:16px')}>
            <span aria-hidden="true" style={S(AVATAR + photoCss(cur?.photo ?? null))}>{cur?.photo ? '' : initialsOf(d.name || '?')}</span>
            {isNew ? <span style={S('font-size:13px;color:#5E6673')}>Save the team member first, then add a photo.</span> : (
              <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>
                <label style={S(PILL)}>
                  {c.photoBusy ? 'Uploading…' : cur?.photo ? 'Change photo' : 'Add photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={c.photoBusy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; c.pickPhoto(f); }} style={S('position:absolute;width:1px;height:1px;opacity:0;pointer-events:none')} />
                </label>
                {!!cur?.photo && <button type="button" className="ghost" onClick={c.dropPhoto} disabled={c.photoBusy} style={S(PILL)}>Remove</button>}
              </div>
            )}
          </div>
          <Field label="Name" htmlFor="tm-name"><input id="tm-name" type="text" value={d.name} onChange={(e) => c.setDraft('name', e.target.value)} placeholder="Full name" style={FIELD_IN} /></Field>
          <Field label="Role (optional)" htmlFor="tm-role"><input id="tm-role" type="text" value={d.role} onChange={(e) => c.setDraft('role', e.target.value)} placeholder="For example, Senior stylist" style={FIELD_IN} /></Field>
        </>)}

        {kind === 'services' && (<>
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>Clients can book {isNew ? 'them' : first} for services in these categories.</p>
          <div role="group" aria-label="Services they offer" style={S('display:flex;flex-direction:column')}>
            {c.cats.map((x) => { const on = d.cats.includes(x); return (
              <button key={x} type="button" onClick={() => c.flip('cats', x)} aria-pressed={on} style={S(ROW(on))}>
                <span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{x}</span>{on && TICK}
              </button>
            ); })}
            {!c.cats.length && <span style={S('color:#5E6673;font-size:13px')}>Add a service category first.</span>}
          </div>
        </>)}

        {kind === 'days' && (
          <div role="group" aria-label="Working days" style={S('display:flex;flex-direction:column')}>
            {DAYS.map((n, i) => { const on = d.days.includes(i); return (
              <button key={n} type="button" onClick={() => c.flip('days', i)} aria-pressed={on} aria-label={DAY_FULL[i]} style={S(ROW(on))}>
                <span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600')}>{DAY_FULL[i]}</span>{on && TICK}
              </button>
            ); })}
          </div>
        )}

        {kind === 'hours' && (<>
          {days.length === 0 && <p style={S('margin:0;font-size:13px;color:#5E6673')}>No working days chosen, so there are no hours to set.</p>}
          {days.length > 0 && (<>
            <Tiles label="Quick shift for every day" options={SHIFTS.map((s) => [s.id, s.label] as const)} value={d.shift} onPick={(v) => c.pickShift(v)} />
            <div style={S('display:flex;flex-direction:column;gap:10px;margin-top:6px')}>
              <span style={S('font-size:14px;font-weight:600')}>Hours each day</span>
              {days.map((day) => (
                <div key={day} style={S('display:flex;align-items:center;gap:8px')}>
                  <span style={S('flex:0 0 44px;font-size:13.5px;color:#4A525E')}>{DAYS[day]}</span>
                  <input type="time" aria-label={DAY_FULL[day] + ' starts'} value={d.times[day][0]} onChange={(e) => c.setTime(day, 0, e.target.value)} style={TIME_IN} />
                  <span style={S('color:#5E6673')}>to</span>
                  <input type="time" aria-label={DAY_FULL[day] + ' finishes'} value={d.times[day][1]} onChange={(e) => c.setTime(day, 1, e.target.value)} style={TIME_IN} />
                </div>
              ))}
            </div>
          </>)}
        </>)}

        {kind === 'online' && (<>
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>Clients can choose them when booking. Hidden team members can still be booked by you.</p>
          <Tiles label="Online booking" options={[['yes', 'Bookable online'], ['no', 'Hidden']] as const} value={d.online ? 'yes' : 'no'} onPick={(v) => c.setDraft('online', v === 'yes')} />
        </>)}

        {kind === 'summary' && (<>
          <div style={S('display:flex;align-items:center;gap:14px;box-sizing:border-box;padding:14px 16px;border:1px solid #E6E8EC;border-radius:20px;background:#FAFAFB')}>
            <span aria-hidden="true" style={S(AVATAR.replace(/72px/g, '56px') + photoCss(cur?.photo ?? null))}>{cur?.photo ? '' : initialsOf(d.name || '?')}</span>
            <div style={S('flex:1 1 auto;min-width:0')}>
              <div style={S('font-size:16px;font-weight:600;overflow-wrap:anywhere')}>{d.name.trim() || 'Name'}{cur?.isOwner && <Crown />}</div>
              <div style={S('font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{d.role.trim() || 'No role'}</div>
            </div>
          </div>
          <DetailRows go={jump} rows={[
            { icon: ICONS.person, text: (d.name.trim() || 'No name') + (d.role.trim() ? ', ' + d.role.trim() : ''), step: at('details') },
            { icon: ICONS.scissors, text: d.cats.length ? d.cats.join(', ') : 'No services chosen', step: at('services') },
            { icon: ICONS.day, text: daysText, step: at('days') },
            { icon: ICONS.time, text: hoursText, step: at('hours') },
            { icon: ICONS.tag, text: d.online ? 'Bookable online' : 'Hidden online', step: at('online') },
          ]} />
          {!isNew && !!cur && (
            <div style={S('display:flex;flex-direction:column;gap:8px;margin-top:6px')}>
              <span style={S('font-size:14px;font-weight:600')}>Sign-in</span>
              {cur.linked
                ? <span style={S('font-size:13.5px;color:#14624A')}>They have their own login.</span>
                : c.invite
                  ? (<>
                      <input readOnly aria-label="Invite link" value={c.invite} onFocus={(e) => e.currentTarget.select()} style={{ ...S('box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF'), minHeight: 0 }} />
                      <button type="button" className="ghost" onClick={() => { navigator.clipboard?.writeText(c.invite).catch(() => {}); }} style={S(PILL + ';height:48px')}>Copy link</button>
                    </>)
                  : (<>
                      <button type="button" className="ghost" onClick={c.makeInvite} disabled={busy} style={S(PILL + ';height:48px')}>Create invite link</button>
                    </>)}
            </div>
          )}
        </>)}
      </div>
    </StepShell>
    {menu && (
      <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:6')}>
        <button onClick={() => { setMenu(false); setConfirm(false); }} aria-label="Close" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
        <div className="sheet" role="dialog" aria-label="More actions" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column')}>
          <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0;margin-bottom:12px')} />
          <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>More actions</h2><button onClick={() => { setMenu(false); setConfirm(false); }} aria-label="Close" style={S(RING_BTN)}><CloseX /></button></div>
          {!confirm ? (
            <div style={S('display:flex;flex-direction:column;padding:4px 0;border-top:1px solid #EEF0F3')}>
              <button type="button" onClick={() => setConfirm(true)} style={S('display:flex;align-items:center;width:100%;min-height:54px;box-sizing:border-box;padding:0;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;color:#B42318;cursor:pointer')}>Remove team member</button>
            </div>
          ) : (
            <div role="alertdialog" aria-label="Confirm removal" style={S('display:flex;flex-direction:column;gap:12px;box-sizing:border-box;padding:16px;border:1px solid #F3C6C3;border-radius:20px;background:#FEF3F2')}>
              <div><div style={S('font-size:14.5px;font-weight:600')}>Remove this team member?</div><div style={S('margin-top:2px;font-size:13px;color:#5E6673')}>They will no longer appear on the calendar or in online booking.</div></div>
              {!!error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{error}</p>}
              <div style={S('display:flex;gap:10px')}>
                <button type="button" className="ghost" onClick={() => { setConfirm(false); setMenu(false); }} style={S('flex:1 1 0;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500')}>Keep</button>
                <button type="button" onClick={c.remove} disabled={busy} style={S('flex:1 1 0;height:48px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font-size:14px;font-weight:500')}>Remove</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  </>);
}
