'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { phoneInput } from '@/lib/phone';
import { decimalInput } from '@/lib/numeric';
import { useNightMode } from '@/components/Theme';
import { S } from '../calendar/pickers';
import { addClosedPeriod, removeClosedPeriod } from './actions';
import { BACK, BAR, CARD, Field, FIELD_IN, PAGE, PickSheet, RING, SettingRow } from './forms/FormPage';
import { DAY_FULL, GROUPS, SECTIONS, type Values } from './shared';
import type { SettingsCtl } from './SettingsView';

const swStyle = (on: boolean) => 'position:relative;flex:0 0 52px;width:52px;height:32px;padding:0;border:0;border-radius:999px;cursor:pointer;background:' + (on ? '#0E1116' : '#D5D9E0');
const swKnob = (on: boolean) => 'position:absolute;top:3px;left:' + (on ? 23 : 3) + 'px;width:26px;height:26px;border-radius:999px;background:#FFFFFF';
const TIME = { ...S('box-sizing:border-box;flex:1 1 0;min-width:0;width:100%;height:44px;padding:0 10px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF'), minHeight: 0 } as const;
const dayText = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const PILL_DARK = 'height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer';
const H3 = 'margin:6px 0 0;font-size:17px;font-weight:600;letter-spacing:-0.01em';
const NOTE = 'margin:0;font-size:13px;color:#5E6673;overflow-wrap:anywhere';

/** A switch line inside a card. */
function SwLine({ id, title, sub, on, toggle, last }: { id: string; title: string; sub?: string; on: boolean; toggle: () => void; last?: boolean }) {
  return (
    <div style={S('display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:' + (last ? '0' : '1px solid #EEF0F3'))}>
      <div style={S('min-width:0')}><div id={id} style={S('font-size:15px;font-weight:500')}>{title}</div>{sub && <div style={S('margin-top:2px;font-size:13px;color:#5E6673')}>{sub}</div>}</div>
      <button role="switch" aria-checked={on} aria-labelledby={id} onClick={toggle} style={S(swStyle(on))}><span style={S(swKnob(on))} /></button>
    </div>
  );
}

function Text({ id, label, c, k, type, mode, ph }: { id: string; label: string; c: SettingsCtl; k: 'bizName' | 'bizPhone' | 'bizEmail' | 'bizAddress' | 'slug' | 'tax'; type: string; mode?: string; ph: string }) {
  return (
    <Field label={label} htmlFor={id}>
      <input id={id} type={type} inputMode={mode as never} value={c.v[k]} placeholder={ph} style={FIELD_IN}
        onChange={(e) => c.set(k, k === 'bizPhone' ? phoneInput(e.target.value) : k === 'slug' ? e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') : k === 'tax' ? decimalInput(e.target.value) : e.target.value)} />
    </Field>
  );
}

/** Holidays and other days the salon is shut. These save straight away, separately from the Save button. */
function Closed({ c }: { c: SettingsCtl }) {
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [why, setWhy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, startT] = useTransition();
  const add = () => startT(async () => {
    const r = await addClosedPeriod(from, to, why);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    c.setClosed([...c.closed, { id: r.id!, from, to: to || from, reason: why.trim().slice(0, 80) }].sort((a, b) => a.from.localeCompare(b.from)));
    setFrom(''); setTo(''); setWhy('');
    setMsg({ ok: true, text: r.affected ? `Added. ${r.affected} appointment${r.affected === 1 ? ' is' : 's are'} already booked on those days and stay on your calendar. Move or cancel ${r.affected === 1 ? 'it' : 'them'}.` : 'Added. Clients can no longer book those days.' });
  });
  const remove = (id: string) => startT(async () => {
    const r = await removeClosedPeriod(id);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    c.setClosed(c.closed.filter((x) => x.id !== id)); setMsg({ ok: true, text: 'Removed. Those days follow your weekly hours again.' });
  });
  return (<>
    <div><h3 style={S(H3)}>Closed dates</h3><p style={S('margin:2px 0 0;' + NOTE)}>Holidays and other days you are shut, even though the weekly hours say open. Nothing is offered online on these days.</p></div>
    {c.closed.map((x) => (
      <div key={x.id} style={S('display:flex;align-items:center;gap:12px;box-sizing:border-box;padding:14px 16px;border:1px solid #E6E8EC;border-radius:22px;background:#FFFFFF')}>
        <div style={S('flex:1 1 auto;min-width:0')}>
          <div style={S('font-size:15px;font-weight:600')}>{x.from === x.to ? dayText(x.from) : dayText(x.from) + ' to ' + dayText(x.to)}</div>
          {x.reason && <div style={S('font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{x.reason}</div>}
        </div>
        <button onClick={() => remove(x.id)} disabled={busy} aria-label={'Remove closed dates ' + dayText(x.from)} style={S('flex:0 0 auto;height:40px;padding:0 16px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#B42318;font:inherit;font-size:13.5px;font-weight:500;cursor:pointer')}>Remove</button>
      </div>
    ))}
    {c.closed.length === 0 && <p style={S(NOTE)}>No closed dates coming up.</p>}
    <section aria-label="Add closed dates" style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:22px;padding:14px;display:flex;flex-direction:column;gap:10px')}>
      <Field label="First day" htmlFor="cd-from"><input id="cd-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setMsg(null); }} style={FIELD_IN} /></Field>
      <Field label="Last day (optional)" htmlFor="cd-to"><input id="cd-to" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setMsg(null); }} style={FIELD_IN} /></Field>
      <Field label="Reason (optional)" htmlFor="cd-why"><input id="cd-why" type="text" maxLength={80} value={why} onChange={(e) => { setWhy(e.target.value); setMsg(null); }} placeholder="For example, Christmas" style={FIELD_IN} /></Field>
      {msg && <p role={msg.ok ? 'status' : 'alert'} style={S('margin:0;font-size:13.5px;font-weight:500;color:' + (msg.ok ? '#14624A' : '#B42318'))}>{msg.text}</p>}
      <button onClick={add} disabled={busy || !from} className="ghost" style={S('height:52px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer;opacity:' + (busy || !from ? 0.5 : 1))}>Add closed dates</button>
    </section>
  </>);
}

type Pick = null | 'window' | 'notice' | 'confirm' | 'cancel' | 'tipDefault';
const PICK_TITLE: Record<string, string> = { window: 'Clients can book up to', notice: 'Minimum notice', confirm: 'Confirm bookings', cancel: 'Free cancellation until', tipDefault: 'Suggested tip' };
const nameOf = (k: string, v: string) => GROUPS[k].find((o) => o[0] === v)?.[1] ?? '';

/** One settings section on the phone as its own page: cards of fields, rows and switches, and a Save bar. */
export function SectionPage({ c, inline }: { c: SettingsCtl; inline?: boolean }) {
  const cur = SECTIONS.find((x) => x.id === c.section)!;
  const v: Values = c.v, s = c.section;
  const [night, setNight] = useNightMode();
  const [pick, setPick] = useState<Pick>(null);
  const key = pick as keyof Values;
  const showBar = s !== 'appearance';
  return (
    <div role={inline ? 'region' : 'dialog'} aria-label={cur.label} style={S(inline ? PAGE.replace('position:absolute;left:0;right:0;top:0;bottom:0;z-index:5;', 'position:relative;height:calc(100dvh - 170px);min-height:520px;border:1px solid #E6E8EC;border-radius:24px;') : PAGE)}>
      <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px;border-bottom:1px solid #E6E8EC')}>
        {!inline && <button onClick={c.close} aria-label="Back" style={S(RING)}>{BACK}</button>}
        <div style={S('flex:1 1 auto;min-width:0')}>
          <div style={S('font-size:18px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{cur.label}</div>
          <div style={S('font-size:13px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{cur.desc}</div>
        </div>
      </header>
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 24px;display:flex;flex-direction:column;gap:14px')}>
        {s === 'business' && (<>
          <Text id="st-name" label="Business name" c={c} k="bizName" type="text" ph="Your business name" />
          <Text id="st-phone" label="Phone" c={c} k="bizPhone" type="tel" mode="tel" ph="+64 21 000 0000" />
          <Text id="st-email" label="Email" c={c} k="bizEmail" type="email" ph="hello@example.com" />
          <Text id="st-address" label="Address" c={c} k="bizAddress" type="text" ph="Street, city" />
          <Text id="st-slug" label="Booking page address" c={c} k="slug" type="text" ph="your-salon" />
          <p style={S(NOTE)}>Clients book at /b/{v.slug || 'your-salon'}. If you change it, links you already shared stop working.</p>
        </>)}

        {s === 'hours' && (<>
          <section style={S(CARD)} aria-label="Weekly hours">
            {v.hours.map((r, i) => (
              <div key={i} style={S('display:flex;flex-direction:column;gap:10px;padding:14px 0;border-bottom:' + (i === 6 ? '0' : '1px solid #EEF0F3'))}>
                <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
                  <div><div style={S('font-size:15px;font-weight:600')}>{DAY_FULL[i]}</div>{!r.open && <div style={S('font-size:13px;color:#5E6673')}>Closed</div>}</div>
                  <button role="switch" aria-checked={r.open} aria-label={DAY_FULL[i] + ' open'} onClick={() => c.setHour(i, 'open', !r.open)} style={S(swStyle(r.open))}><span style={S(swKnob(r.open))} /></button>
                </div>
                {r.open && (
                  <div style={S('display:flex;align-items:center;gap:8px')}>
                    <input type="time" aria-label={DAY_FULL[i] + ' opens'} value={r.from} onChange={(e) => c.setHour(i, 'from', e.target.value)} style={TIME} />
                    <span style={S('flex:0 0 auto;color:#5E6673;font-size:13.5px')}>to</span>
                    <input type="time" aria-label={DAY_FULL[i] + ' closes'} value={r.to} onChange={(e) => c.setHour(i, 'to', e.target.value)} style={TIME} />
                  </div>
                )}
              </div>
            ))}
          </section>
          <Closed c={c} />
        </>)}

        {s === 'booking' && (<>
          <section style={S(CARD)}><SwLine id="st-online" title="Accept online bookings" sub="Clients can book services you have set to bookable online." on={v.online} toggle={() => c.set('online', !v.online)} last /></section>
          <section style={S(CARD)} aria-label="Booking rules">
            <SettingRow label="Book up to" value={nameOf('window', v.window)} onClick={() => setPick('window')} />
            <SettingRow label="Minimum notice" value={nameOf('notice', v.notice)} onClick={() => setPick('notice')} />
            <SettingRow label="Confirm bookings" value={nameOf('confirm', v.confirm)} onClick={() => setPick('confirm')} />
            <SettingRow label="Free cancellation" value={nameOf('cancel', v.cancel)} onClick={() => setPick('cancel')} last />
          </section>
        </>)}

        {s === 'payments' && (<>
          <section style={S(CARD)} aria-label="Payment methods">
            <SwLine id="st-card" title="Card payments" on={v.card} toggle={() => c.set('card', !v.card)} />
            <SwLine id="st-cash" title="Cash" on={v.cash} toggle={() => c.set('cash', !v.cash)} />
            <SwLine id="st-gift" title="Gift cards" on={v.gift} toggle={() => c.set('gift', !v.gift)} last />
          </section>
          <section style={S(CARD)} aria-label="Tips">
            <SwLine id="st-tips" title="Ask for a tip at checkout" sub="Show tip options when you take payment." on={v.tips} toggle={() => c.set('tips', !v.tips)} />
            <SettingRow label="Suggested tip" value={nameOf('tipDefault', v.tipDefault)} onClick={() => setPick('tipDefault')} last />
          </section>
          <Text id="st-tax" label="Sales tax rate (%)" c={c} k="tax" type="text" mode="decimal" ph="0" />
          <Link href="/settings/windcave" aria-label="Windcave card setup and tax mode" style={S('display:flex;align-items:center;gap:12px;box-sizing:border-box;min-height:64px;padding:12px 18px;border:1px solid #E6E8EC;border-radius:22px;background:#FFFFFF;text-decoration:none;color:#0E1116')}>
            <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600')}>Windcave card setup</span><span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673')}>Card keys, terminal and tax mode</span></span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.5 6l6 6-6 6" /></svg>
          </Link>
        </>)}

        {s === 'notifications' && (
          <section style={S(CARD)} aria-label="Notifications">
            <SwLine id="st-confirmEmail" title="Booking confirmation emails" sub="Sent to clients as soon as they book." on={v.confirmEmail} toggle={() => c.set('confirmEmail', !v.confirmEmail)} />
            <SwLine id="st-remind24" title="Reminder 24 hours before" sub="Email reminder for the day before." on={v.remind24} toggle={() => c.set('remind24', !v.remind24)} />
            <SwLine id="st-remind2" title="Reminder 2 hours before" sub="A short text reminder on the day." on={v.remind2} toggle={() => c.set('remind2', !v.remind2)} />
            <SwLine id="st-newBooking" title="Tell me about new online bookings" on={v.newBooking} toggle={() => c.set('newBooking', !v.newBooking)} />
            <SwLine id="st-cancelled" title="Tell me about cancellations" on={v.cancelled} toggle={() => c.set('cancelled', !v.cancelled)} last />
          </section>
        )}

        {s === 'appearance' && (
          <section style={S(CARD)}><SwLine id="st-night" title="Night mode" sub="Darker colours for the dashboard. Saved on this device." on={night} toggle={() => setNight(!night)} last /></section>
        )}
      </main>
      {showBar && (
        <div style={S(BAR)}>
          {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
          <div style={S('display:flex;gap:10px')}>
            {c.dirty && <button type="button" className="ghost" onClick={c.discard} style={S('flex:1 1 0;height:52px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer')}>Discard</button>}
            <button type="button" onClick={c.save} disabled={!c.dirty || c.busy} style={S('flex:2 1 0;' + PILL_DARK + ';background:' + (c.dirty ? '#0E1116' : '#E9ECF0') + ';color:' + (c.dirty ? '#FFFFFF' : '#5E6673') + ';cursor:' + (c.dirty ? 'pointer' : 'default'))}>{c.busy ? 'Saving' : c.dirty ? 'Save changes' : 'Saved'}</button>
          </div>
        </div>
      )}
      {pick && <PickSheet title={PICK_TITLE[pick]} options={GROUPS[pick].map(([id, label]) => ({ id, label }))} values={[String(v[key])]} onPick={(id) => c.set(key, id as never)} onClose={() => setPick(null)} />}
    </div>
  );
}
