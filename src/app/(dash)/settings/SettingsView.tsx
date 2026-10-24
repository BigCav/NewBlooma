'use client';
// 1:1 conversion of the prototype's Settings.dc.html and MobileSettings.dc.html. Markup and style strings are kept as written;
// the {{ }} holes are real salon settings and Save writes them through a server action.
import { phoneInput } from '@/lib/phone';
import { decimalInput } from '@/lib/numeric';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { saveSettings } from './actions';
import { DAY_FULL, validate, type Values } from './shared';

const SECTIONS = [
  { id: 'business', label: 'Business details', desc: 'Name, contact and address' },
  { id: 'hours', label: 'Opening hours', desc: 'When the salon is open' },
  { id: 'booking', label: 'Online booking', desc: 'Booking rules for clients' },
  { id: 'payments', label: 'Payments', desc: 'Methods, tips and tax' },
  { id: 'notifications', label: 'Notifications', desc: 'Emails and reminders' },
];
const GROUPS: Record<string, [string, string][]> = {
  window: [['1w', '1 week'], ['2w', '2 weeks'], ['4w', '4 weeks'], ['8w', '8 weeks']],
  notice: [['none', 'None'], ['1h', '1 hour'], ['2h', '2 hours'], ['24h', '24 hours']],
  confirm: [['auto', 'Instant'], ['manual', 'Manual approval']],
  cancel: [['2h', '2 hours before'], ['24h', '24 hours before'], ['48h', '48 hours before']],
  tipDefault: [['0', 'No default'], ['10', '10%'], ['15', '15%'], ['20', '20%']],
};
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const INPUT = 'box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF';
const swStyle = (on: boolean) => 'position:relative;flex:0 0 52px;width:52px;height:32px;padding:0;border:0;border-radius:999px;background:' + (on ? '#0E1116' : '#D5D9E0');
const swKnob = (on: boolean) => 'position:absolute;top:3px;left:' + (on ? 23 : 3) + 'px;width:26px;height:26px;border-radius:999px;background:#FFFFFF';
const noMin = { minHeight: 0 } as const;

function useSettings(initial: Values, start?: string) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const [v, setV] = useState<Values>(initial);
  const [saved, setSaved] = useState<Values>(initial);
  const [section, setSection] = useState(start ?? 'business');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => { setV((p) => ({ ...p, [k]: val })); setError(''); setNotice(''); };
  const setHour = (i: number, key: 'open' | 'from' | 'to', val: any) => set('hours', v.hours.map((h, idx) => (idx === i ? { ...h, [key]: val } : h)));
  const save = () => {
    const bad = validate(v);
    if (bad) { setSection(bad.section); setError(bad.error); return; }
    startT(async () => {
      const r = await saveSettings(v);
      if (r.error) { if (r.section) setSection(r.section); setError(r.error); return; }
      setSaved(clone(v)); setNotice('Settings saved'); setError(''); setOpen(false); router.refresh();
    });
  };
  return { narrow, v, set, setHour, section, pick: (id: string) => { setSection(id); setOpen(true); setError(''); setNotice(''); }, open, close: () => { setOpen(false); setError(''); },
    error, notice, dirty, busy, save, discard: () => { setV(clone(saved)); setError(''); setNotice(''); } };
}
type C = ReturnType<typeof useSettings>;

function Switch({ id, on, toggle, label }: { id: string; on: boolean; toggle: () => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-labelledby={id} onClick={toggle} style={S(swStyle(on))}><span style={S(swKnob(on))} /></button>;
  void label;
}
function SwRow({ id, title, sub, on, toggle }: { id: string; title: string; sub?: string; on: boolean; toggle: () => void }) {
  return (
    <div style={S('display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-top:1px solid #EEF0F3')}>
      <div style={S('min-width:0')}><div id={id} style={S('font-size:14px;font-weight:600')}>{title}</div>{sub && <div style={S('font-size:13px;color:#5E6673')}>{sub}</div>}</div>
      <Switch id={id} on={on} toggle={toggle} label={title} />
    </div>
  );
}

function Group({ c, m, id, title, k }: { c: C; m: boolean; id: string; title: string; k: keyof Values }) {
  const chip = (on: boolean) => (m ? 'flex:0 0 auto;height:44px;padding:0 16px;font-size:14px;' : 'flex:0 0 auto;height:40px;padding:0 16px;font-size:13.5px;') + 'border-radius:999px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
  return (
    <div style={S('display:flex;flex-direction:column;gap:8px')}><span id={id} style={S('font-size:14px;font-weight:600')}>{title}</span>
      <div role="group" className="hscroll" aria-labelledby={id} style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
        {GROUPS[k as string].map(([val, label]) => <button key={val} onClick={() => c.set(k, val as any)} aria-pressed={c.v[k] === val} style={S(chip(c.v[k] === val))}>{label}</button>)}
      </div></div>
  );
}
function Field({ id, label, k, c, type, mode, ph }: { id: string; label: string; k: 'bizName' | 'bizPhone' | 'bizEmail' | 'bizAddress' | 'slug' | 'tax'; c: C; type: string; mode?: string; ph: string }) {
  return (
    <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor={id} style={S('font-size:14px;font-weight:600')}>{label}</label>
      <input id={id} type={type} inputMode={mode as any} value={c.v[k]} onChange={(e) => c.set(k, k === 'bizPhone' ? phoneInput(e.target.value) : k === 'slug' ? e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') : k === 'tax' ? decimalInput(e.target.value) : e.target.value)} placeholder={ph} style={{ ...S(INPUT), ...noMin }} /></div>
  );
}

function Content({ c, m }: { c: C; m: boolean }) {
  const v = c.v, s = c.section;
  return (<>
    {s === 'business' && (
      <div style={S('display:flex;flex-direction:column;gap:18px')}>
        <Field id="st-name" label="Business name" k="bizName" c={c} type="text" ph="Your business name" />
        <Field id="st-phone" label="Phone" k="bizPhone" c={c} type="tel" mode="tel" ph="+64 21 000 0000" />
        <Field id="st-email" label="Email" k="bizEmail" c={c} type="email" ph="hello@example.com" />
        <Field id="st-address" label="Address" k="bizAddress" c={c} type="text" ph="Street, city" />
        <div style={S('display:flex;flex-direction:column;gap:6px')}>
          <Field id="st-slug" label="Booking page address" k="slug" c={c} type="text" ph="your-salon" />
          <span style={S('font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>Clients book at /b/{v.slug || 'your-salon'}. If you change it, links you already shared stop working.</span>
        </div>
      </div>
    )}
    {s === 'hours' && (
      <div style={S('display:flex;flex-direction:column')}>
        {v.hours.map((r, i) => (
          <div key={i} style={S('display:flex;flex-direction:column;gap:8px;padding:12px 0;border-top:1px solid #EEF0F3')}>
            <span style={S('font-size:14.5px;font-weight:600')}>{DAY_FULL[i]}</span>
            <div style={S('display:flex;align-items:center;gap:16px;min-height:44px')}>
              <div style={S('flex:1 1 auto;min-width:0;display:flex;align-items:center')}>
                {r.open && (
                  <span style={S('flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:8px')}>
                    <input type="time" aria-label={DAY_FULL[i] + ' opens'} value={r.from} onChange={(e) => c.setHour(i, 'from', e.target.value)} style={{ ...S('flex:1 1 0;min-width:0;max-width:150px;width:100%;box-sizing:border-box;height:44px;padding:0 10px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:14px;color:#0E1116;background:#FFFFFF'), ...noMin }} />
                    <span style={S('flex:0 0 auto;color:#5E6673;font-size:13.5px')}>to</span>
                    <input type="time" aria-label={DAY_FULL[i] + ' closes'} value={r.to} onChange={(e) => c.setHour(i, 'to', e.target.value)} style={{ ...S('flex:1 1 0;min-width:0;max-width:150px;width:100%;box-sizing:border-box;height:44px;padding:0 10px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:14px;color:#0E1116;background:#FFFFFF'), ...noMin }} />
                  </span>
                )}
                {!r.open && <span style={S('color:#5E6673;font-size:14px')}>Closed</span>}
              </div>
              <button role="switch" aria-checked={r.open} aria-label={DAY_FULL[i] + ' open'} onClick={() => c.setHour(i, 'open', !r.open)} style={S(swStyle(r.open))}><span style={S(swKnob(r.open))} /></button>
            </div>
          </div>
        ))}
      </div>
    )}
    {s === 'booking' && (
      <div style={S('display:flex;flex-direction:column;gap:18px')}>
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-top:1px solid #EEF0F3')}><div style={S('min-width:0')}><div id="st-online" style={S('font-size:14px;font-weight:600')}>Accept online bookings</div><div style={S('font-size:13px;color:#5E6673')}>Clients can book services you have set to bookable online.</div></div><Switch id="st-online" on={v.online} toggle={() => c.set('online', !v.online)} label="" /></div>
        <Group c={c} m={m} id="st-window" title="Clients can book up to" k="window" />
        <Group c={c} m={m} id="st-notice" title="Minimum notice before an appointment" k="notice" />
        <Group c={c} m={m} id="st-confirm" title="Confirm bookings" k="confirm" />
        <Group c={c} m={m} id="st-cancel" title="Free cancellation until" k="cancel" />
      </div>
    )}
    {s === 'payments' && (
      <div style={S('display:flex;flex-direction:column;gap:18px')}>
        <div style={S('display:flex;flex-direction:column')}>
          <SwRow id="st-card" title="Card payments" on={v.card} toggle={() => c.set('card', !v.card)} />
          <SwRow id="st-cash" title="Cash" on={v.cash} toggle={() => c.set('cash', !v.cash)} />
          <SwRow id="st-gift" title="Gift cards" on={v.gift} toggle={() => c.set('gift', !v.gift)} />
          <SwRow id="st-tips" title="Ask for a tip at checkout" sub="Show tip options when you take payment." on={v.tips} toggle={() => c.set('tips', !v.tips)} />
        </div>
        <Group c={c} m={m} id="st-tip" title="Suggested tip" k="tipDefault" />
        <Field id="st-tax" label="Sales tax rate (%)" k="tax" c={c} type="text" mode="decimal" ph="0" />
        <Link href="/settings/windcave" style={S('font-size:13.5px;color:#5B3DF5;font-weight:500;text-decoration:none')}>Windcave card setup and tax mode</Link>
      </div>
    )}
    {s === 'notifications' && (
      <div style={S('display:flex;flex-direction:column')}>
        <SwRow id="st-confirmEmail" title="Booking confirmation emails" sub="Sent to clients as soon as they book." on={v.confirmEmail} toggle={() => c.set('confirmEmail', !v.confirmEmail)} />
        <SwRow id="st-remind24" title="Reminder 24 hours before" sub="Email reminder for the day before." on={v.remind24} toggle={() => c.set('remind24', !v.remind24)} />
        <SwRow id="st-remind2" title="Reminder 2 hours before" sub="A short text reminder on the day." on={v.remind2} toggle={() => c.set('remind2', !v.remind2)} />
        <SwRow id="st-newBooking" title="Tell me about new online bookings" on={v.newBooking} toggle={() => c.set('newBooking', !v.newBooking)} />
        <SwRow id="st-cancelled" title="Tell me about cancellations" on={v.cancelled} toggle={() => c.set('cancelled', !v.cancelled)} />
      </div>
    )}
    {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
    <div style={S('display:flex;gap:10px')}>
      <button onClick={c.save} disabled={!c.dirty || c.busy} style={S('flex:1 1 0;height:' + (m ? 48 : 44) + 'px;border:0;border-radius:999px;font-size:14px;font-weight:500;font-family:inherit;background:' + (c.dirty ? '#0E1116' : '#D5D9E0') + ';color:' + (c.dirty ? '#FFFFFF' : '#5E6673') + ';cursor:' + (c.dirty ? 'pointer' : 'default'))}>Save changes</button>
      <button className="ghost" onClick={c.discard} disabled={!c.dirty} style={S('flex:1 1 0;height:' + (m ? 48 : 44) + 'px;border:1px solid #E1E4E9;border-radius:999px;font-size:14px;font-weight:500;font-family:inherit;background:#FFFFFF;color:' + (c.dirty ? '#0E1116' : '#8A93A0') + ';cursor:' + (c.dirty ? 'pointer' : 'default'))}>Discard</button>
    </div>
  </>);
}

const Chevron = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')}><path d="M9.5 6l6 6-6 6" /></svg>;

function Desktop({ c }: { c: C }) {
  const cur = SECTIONS.find((x) => x.id === c.section)!;
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Settings" subtitle="Business details and booking rules" showSearch={false} showAction={false} />
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <nav aria-label="Settings sections" style={S('box-sizing:content-box;flex:1 1 300px;max-width:360px;min-width:0;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
          <ul style={S('margin:0;padding:0;list-style:none')}>
            {SECTIONS.map((x, i) => (
              <li key={x.id}>
                <button onClick={() => c.pick(x.id)} aria-label={x.label + ', ' + x.desc} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 20px;border:0;border-bottom:' + (i === SECTIONS.length - 1 ? '0' : '1px solid #EEF0F3') + ';text-align:left;font:inherit;color:#0E1116;background:' + (c.section === x.id ? '#F4F5F7' : 'transparent'))}>
                  <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600')}>{x.label}</span><span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673')}>{x.desc}</span></span><Chevron />
                </button>
              </li>
            ))}
          </ul>
          <Link href="/settings/forms" aria-label="Forms and consultations, what clients fill in before a visit" style={S('display:flex;align-items:center;gap:12px;box-sizing:border-box;min-height:68px;padding:10px 20px;border-top:1px solid #EEF0F3;text-decoration:none;color:#0E1116')}><span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600')}>Forms and consultations</span><span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673')}>What clients fill in before a visit</span></span><Chevron /></Link>
        </nav>
        <section aria-label="Settings" style={S('flex:999 1 520px;min-width:0;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:22px')}>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px')}>
            <div><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{cur.label}</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>{cur.desc}</p></div>
            {!!c.notice && <span role="status" style={S('flex:0 0 auto;padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.notice}</span>}
          </div>
          <Content c={c} m={false} />
        </section>
      </div>
    </div>
  );
}

function Mobile({ c }: { c: C }) {
  const cur = SECTIONS.find((x) => x.id === c.section)!;
  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Settings" subtitle="Business details and booking rules" showSearch={false} />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <section aria-label="Your business" style={S('display:flex;align-items:center;gap:14px;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px')}>
          <div style={S('flex:0 0 48px;width:48px;height:48px;border-radius:16px;background:#0E1116;display:flex;align-items:center;justify-content:center')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="7.5" /><path d="M8.5 13.5c1 1.6 2.2 2.3 3.5 2.3s2.5-.7 3.5-2.3" /></svg></div>
          <div style={S('min-width:0')}><div style={S('font-size:17px;font-weight:600;letter-spacing:-0.01em;overflow-wrap:anywhere')}>{c.v.bizName.trim() || 'Your business'}</div><div style={S('font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{c.v.bizAddress.trim() || 'No address yet'}</div></div>
        </section>
        <ul style={S('margin:0;padding:4px 0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px')}>
          {SECTIONS.map((x, i) => (
            <li key={x.id}>
              <button onClick={() => c.pick(x.id)} aria-label={x.label + ', ' + x.desc} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 16px;border:0;border-bottom:' + (i === SECTIONS.length - 1 ? '0' : '1px solid #EEF0F3') + ';background:transparent;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
                <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600')}>{x.label}</span><span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673')}>{x.desc}</span></span><Chevron />
              </button>
            </li>
          ))}
        </ul>
        <div style={S('background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}><Link href="/settings/forms" aria-label="Forms and consultations, what clients fill in before a visit" style={S('display:flex;align-items:center;gap:12px;box-sizing:border-box;min-height:68px;padding:10px 16px;text-decoration:none;color:#0E1116')}><span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600')}>Forms and consultations</span><span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673')}>What clients fill in before a visit</span></span><Chevron /></Link></div>
      </main>
      <MobileTabs active="more" />
      {c.open && (
        <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:5')}>
          <button onClick={c.close} aria-label="Close settings" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
          <div className="sheet" role="dialog" aria-label="Settings" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:18px')}>
            <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0')} />
            <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
              <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{cur.label}</h2>
              <button onClick={c.close} aria-label="Close" style={S('flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
            </div>
            <Content c={c} m={true} />
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsView({ initial, section }: { initial: Values; section?: string }) {
  const c = useSettings(initial, SECTIONS.some((x) => x.id === section) ? section : undefined);
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
