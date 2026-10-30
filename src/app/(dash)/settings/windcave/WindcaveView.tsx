'use client';
// Card payment setup, styled like the rest of Settings (same cards, switches, fields and mobile sheet-less layout).
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../../calendar/pickers';
import { BACK as BACK_ICON, BAR, CARD, Field as CardField, FIELD_IN, PAGE, RING } from '../forms/FormPage';
import { savePayments } from './actions';

type Props = { taxInclusive: boolean; online: boolean; terminal: boolean; station: string; saved: { online_user: boolean; online_key: boolean; hit_user: boolean; hit_key: boolean } };

const INPUT = 'box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF';
const swStyle = (on: boolean) => 'position:relative;flex:0 0 52px;width:52px;height:32px;padding:0;border:0;border-radius:999px;cursor:pointer;background:' + (on ? '#0E1116' : '#D5D9E0');
const swKnob = (on: boolean) => 'position:absolute;top:3px;left:' + (on ? 23 : 3) + 'px;width:26px;height:26px;border-radius:999px;background:#FFFFFF';
const noMin = { minHeight: 0 } as const;

function SwRow({ id, title, sub, on, toggle }: { id: string; title: string; sub?: string; on: boolean; toggle: () => void }) {
  return (
    <div style={S('display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-top:1px solid #EEF0F3')}>
      <div style={S('min-width:0')}><div id={id} style={S('font-size:14px;font-weight:600')}>{title}</div>{sub && <div style={S('font-size:13px;color:#5E6673')}>{sub}</div>}</div>
      <button role="switch" aria-checked={on} aria-labelledby={id} onClick={toggle} style={S(swStyle(on))}><span style={S(swKnob(on))} /></button>
    </div>
  );
}

function Field({ id, label, value, set, secret, saved, ph }: { id: string; label: string; value: string; set: (v: string) => void; secret?: boolean; saved?: boolean; ph?: string }) {
  return (
    <div style={S('display:flex;flex-direction:column;gap:8px;min-width:0')}>
      <label htmlFor={id} style={S('display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600')}>{label}{saved && <span style={S('padding:2px 10px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12px;font-weight:500')}>Saved</span>}</label>
      <input id={id} type={secret ? 'password' : 'text'} value={value} onChange={(e) => set(e.target.value)} autoComplete={secret ? 'new-password' : 'off'} placeholder={saved ? 'Leave blank to keep what is saved' : ph ?? ''} style={{ ...S(INPUT), ...noMin }} />
    </div>
  );
}

function useForm(p: Props) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const [v, setV] = useState({ inclusive: p.taxInclusive, online: p.online, terminal: p.terminal, station: p.station, online_user: '', online_key: '', hit_user: '', hit_key: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => { setV((o) => ({ ...o, [k]: val })); setError(''); setNotice(''); };
  const save = () => startT(async () => {
    const fd = new FormData();
    fd.set('tax_mode', v.inclusive ? 'inclusive' : 'exclusive');
    if (v.online) fd.set('online_cards_enabled', 'on');
    if (v.terminal) fd.set('terminal_enabled', 'on');
    fd.set('terminal_station_id', v.station);
    for (const k of ['online_user', 'online_key', 'hit_user', 'hit_key'] as const) fd.set(k, v[k]);
    const r: any = await savePayments(null, fd);
    if (r?.error) { setError(r.error); setNotice(''); return; }
    setV((o) => ({ ...o, online_user: '', online_key: '', hit_user: '', hit_key: '' }));
    setError(''); setNotice('Payment settings saved'); router.refresh();
  });
  return { narrow, v, set, save, busy, error, notice, saved: p.saved };
}
type C = ReturnType<typeof useForm>;

function Chip({ on, label, pick, m }: { on: boolean; label: string; pick: () => void; m: boolean }) {
  return <button onClick={pick} aria-pressed={on} style={S((m ? 'height:44px;' : 'height:40px;') + 'flex:0 0 auto;padding:0 16px;font-size:13.5px;border-radius:999px;font-weight:500;cursor:pointer;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116'))}>{label}</button>;
}

function Body({ c, m }: { c: C; m: boolean }) {
  const { v, set, saved } = c;
  const sub = 'margin:0;font-size:13px;color:#5E6673';
  return (<>
    <div style={S('display:flex;flex-direction:column;gap:8px')}>
      <span id="wc-tax" style={S('font-size:14px;font-weight:600')}>Prices are</span>
      <div role="group" aria-labelledby="wc-tax" style={S('display:flex;gap:8px;flex-wrap:wrap')}>
        <Chip m={m} on={v.inclusive} label="Tax inclusive" pick={() => set('inclusive', true)} />
        <Chip m={m} on={!v.inclusive} label="Tax added at checkout" pick={() => set('inclusive', false)} />
      </div>
    </div>

    <div style={S('display:flex;flex-direction:column;gap:16px')}>
      <SwRow id="wc-online" title="Take card payments on screen" sub="Opens Windcave's secure payment page for the client to enter their card." on={v.online} toggle={() => set('online', !v.online)} />
      <div style={S('display:grid;gap:16px;grid-template-columns:' + (m ? '1fr' : '1fr 1fr'))}>
        <Field id="wc-ou" label="Windcave REST user" value={v.online_user} set={(x) => set('online_user', x)} saved={saved.online_user} />
        <Field id="wc-ok" label="Windcave REST key" value={v.online_key} set={(x) => set('online_key', x)} saved={saved.online_key} secret />
      </div>
    </div>

    <div style={S('display:flex;flex-direction:column;gap:16px')}>
      <SwRow id="wc-term" title="Use a card terminal" sub="Windcave HIT. Sends the amount to your terminal." on={v.terminal} toggle={() => set('terminal', !v.terminal)} />
      <div style={S('display:grid;gap:16px;grid-template-columns:' + (m ? '1fr' : '1fr 1fr 1fr'))}>
        <Field id="wc-st" label="Terminal station ID" value={v.station} set={(x) => set('station', x)} />
        <Field id="wc-hu" label="HIT user" value={v.hit_user} set={(x) => set('hit_user', x)} saved={saved.hit_user} />
        <Field id="wc-hk" label="HIT key" value={v.hit_key} set={(x) => set('hit_key', x)} saved={saved.hit_key} secret />
      </div>
    </div>

    <p style={S(sub)}>Credentials are encrypted and only ever used on the server. Leave a field blank to keep what is saved.</p>
    {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
    {!!c.notice && <p role="status" style={S('margin:0;color:#14624A;font-size:13.5px;font-weight:500')}>{c.notice}</p>}
    <button onClick={c.save} disabled={c.busy} style={S('height:' + (m ? 48 : 44) + 'px;border:0;border-radius:999px;font-size:14px;font-weight:500;font-family:inherit;background:#0E1116;color:#FFFFFF;cursor:pointer;opacity:' + (c.busy ? 0.6 : 1))}>{c.busy ? 'Saving' : 'Save payment settings'}</button>
  </>);
}

const BACK = <Link href="/settings?section=payments" style={S('display:inline-flex;align-items:center;height:40px;padding:0 16px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:13.5px;font-weight:500;text-decoration:none')}>Back to settings</Link>;

const SECTIONS = [
  ['business', 'Business details', 'Name, contact and address'], ['hours', 'Opening hours', 'When the salon is open'], ['booking', 'Online booking', 'Booking rules for clients'],
  ['payments', 'Payments', 'Methods, tips and tax'], ['notifications', 'Notifications', 'Emails and reminders'],
] as const;
const Chevron = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')}><path d="M9.5 6l6 6-6 6" /></svg>;

function Desktop({ c }: { c: C }) {
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Settings" subtitle="Business details and booking rules" showSearch={false} showAction={false} />
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <nav aria-label="Settings sections" style={S('box-sizing:content-box;flex:1 1 300px;max-width:360px;min-width:0;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
          <ul style={S('margin:0;padding:0;list-style:none')}>
            {SECTIONS.map(([id, label, desc], i) => (
              <li key={id}>
                <Link href={'/settings?section=' + id} aria-label={label + ', ' + desc} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 20px;border-bottom:' + (i === SECTIONS.length - 1 ? '0' : '1px solid #EEF0F3') + ';text-align:left;color:#0E1116;text-decoration:none;background:' + (id === 'payments' ? '#F4F5F7' : 'transparent'))}>
                  <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600')}>{label}</span><span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673')}>{desc}</span></span><Chevron />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <section aria-label="Card payments" style={S('flex:999 1 520px;min-width:0;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:22px')}>
          <div><Link href="/settings?section=payments" style={S('font-size:13.5px;color:#5B3DF5;font-weight:500;text-decoration:none')}>Back to payments</Link>
            <h2 style={S('margin:8px 0 0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Card payments</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>Windcave setup and tax mode</p></div>
          <Body c={c} m={false} />
        </section>
      </div>
    </div>
  );
}

function SwLine({ id, title, sub, on, toggle, last }: { id: string; title: string; sub?: string; on: boolean; toggle: () => void; last?: boolean }) {
  return (
    <div style={S('display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:' + (last ? '0' : '1px solid #EEF0F3'))}>
      <div style={S('min-width:0')}><div id={id} style={S('font-size:15px;font-weight:500')}>{title}</div>{sub && <div style={S('margin-top:2px;font-size:13px;color:#5E6673')}>{sub}</div>}</div>
      <button role="switch" aria-checked={on} aria-labelledby={id} onClick={toggle} style={S(swStyle(on))}><span style={S(swKnob(on))} /></button>
    </div>
  );
}

function Key({ id, label, value, set, secret, saved, ph }: { id: string; label: string; value: string; set: (v: string) => void; secret?: boolean; saved?: boolean; ph?: string }) {
  return (
    <CardField label={label + (saved ? ' (saved)' : '')} htmlFor={id}>
      <input id={id} type={secret ? 'password' : 'text'} value={value} onChange={(e) => set(e.target.value)} autoComplete={secret ? 'new-password' : 'off'} placeholder={saved ? 'Leave blank to keep what is saved' : ph ?? ''} style={FIELD_IN} />
    </CardField>
  );
}

/** Phone: a page with its own back arrow, a card per area, and a Save bar. */
function Mobile({ c }: { c: C }) {
  const { v, set, saved } = c;
  const H3 = 'margin:6px 0 0;font-size:17px;font-weight:600;letter-spacing:-0.01em';
  const NOTE = 'margin:2px 0 0;font-size:13px;color:#5E6673';
  const tile = (on: boolean) => 'flex:1 1 0;min-height:56px;padding:10px 12px;border-radius:16px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;text-align:center;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
  return (
    <div className="only-m m-cal cal-root" style={S(PAGE.replace('position:absolute;left:0;right:0;top:0;bottom:0;z-index:5;display:flex;', 'position:relative;width:100%;height:100dvh;box-sizing:border-box;'))}>
      <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px;border-bottom:1px solid #E6E8EC')}>
        <Link href="/settings?section=payments" aria-label="Back to payments" style={S(RING + ';text-decoration:none')}>{BACK_ICON}</Link>
        <div style={S('flex:1 1 auto;min-width:0')}>
          <div style={S('font-size:18px;font-weight:600;letter-spacing:-0.02em')}>Card payments</div>
          <div style={S('font-size:13px;color:#5E6673')}>Windcave setup and tax mode</div>
        </div>
      </header>
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 24px;display:flex;flex-direction:column;gap:14px')}>
        <div><h3 style={S(H3)}>Prices are</h3></div>
        <div role="group" aria-label="Prices are" style={S('display:flex;gap:10px')}>
          <button onClick={() => set('inclusive', true)} aria-pressed={v.inclusive} style={S(tile(v.inclusive))}>Tax inclusive</button>
          <button onClick={() => set('inclusive', false)} aria-pressed={!v.inclusive} style={S(tile(!v.inclusive))}>Tax added at checkout</button>
        </div>

        <div><h3 style={S(H3)}>Card payments on screen</h3><p style={S(NOTE)}>Opens Windcave's secure payment page for the client to enter their card.</p></div>
        <section style={S(CARD)}><SwLine id="wc-online" title="Take card payments on screen" on={v.online} toggle={() => set('online', !v.online)} last /></section>
        <Key id="wc-ou" label="Windcave REST user" value={v.online_user} set={(x) => set('online_user', x)} saved={saved.online_user} />
        <Key id="wc-ok" label="Windcave REST key" value={v.online_key} set={(x) => set('online_key', x)} saved={saved.online_key} secret />

        <div><h3 style={S(H3)}>Card terminal</h3><p style={S(NOTE)}>Windcave HIT. Sends the amount to your terminal.</p></div>
        <section style={S(CARD)}><SwLine id="wc-term" title="Use a card terminal" on={v.terminal} toggle={() => set('terminal', !v.terminal)} last /></section>
        <Key id="wc-st" label="Terminal station ID" value={v.station} set={(x) => set('station', x)} />
        <Key id="wc-hu" label="HIT user" value={v.hit_user} set={(x) => set('hit_user', x)} saved={saved.hit_user} />
        <Key id="wc-hk" label="HIT key" value={v.hit_key} set={(x) => set('hit_key', x)} saved={saved.hit_key} secret />
        <p style={S('margin:0;font-size:13px;color:#5E6673')}>Credentials are encrypted and only ever used on the server. Leave a field blank to keep what is saved.</p>
      </main>
      <div style={S(BAR)}>
        {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
        {!!c.notice && <p role="status" style={S('margin:0;color:#14624A;font-size:13.5px;font-weight:500')}>{c.notice}</p>}
        <button onClick={c.save} disabled={c.busy} style={S('height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer;opacity:' + (c.busy ? 0.6 : 1))}>{c.busy ? 'Saving' : 'Save payment settings'}</button>
      </div>
    </div>
  );
}

export function WindcaveView(p: Props) {
  const c = useForm(p);
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
