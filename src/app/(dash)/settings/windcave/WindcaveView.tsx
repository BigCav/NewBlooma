'use client';
// Card payment setup, styled like the rest of Settings (same cards, switches, fields and mobile sheet-less layout).
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/Chrome';
import { S } from '../../calendar/pickers';
import { BACK as BACK_ICON, BAR, BLACK, CARD, FIELD_IN, Field as CardField, FieldError, Notice, OUTLINE, PAGE, ScreenHeader, RING, SwitchRow, dim } from '@/components/ui';
import { checkTerminal, savePayments } from './actions';

type Props = { taxInclusive: boolean; online: boolean; terminal: boolean; station: string; saved: { online_user: boolean; online_key: boolean; hit_user: boolean; hit_key: boolean } };


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
  const test = () => startT(async () => {
    const r = await checkTerminal();
    if (r.error) { setError(r.error); setNotice(''); return; }
    setError(''); setNotice(r.ok ?? '');
  });
  return { narrow, v, set, save, test, busy, error, notice, saved: p.saved };
}
type C = ReturnType<typeof useForm>;


function Desktop({ c }: { c: C }) {
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 32px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Card payments" subtitle="Windcave setup and tax mode" showSearch={false} showAction={false} />
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <div style={S('flex:999 1 520px;min-width:0;max-width:760px')}><Mobile c={c} inline /></div>
      </div>
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
function Mobile({ c, inline }: { c: C; inline?: boolean }) {
  const { v, set, saved } = c;
  const H3 = 'margin:6px 0 0;font-size:17px;font-weight:600;letter-spacing:-0.01em';
  const NOTE = 'margin:2px 0 0;font-size:13px;color:#5E6673';
  const tile = (on: boolean) => 'flex:1 1 0;min-height:56px;padding:10px 12px;border-radius:16px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;text-align:center;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
  return (
    <div className={inline ? 'm-cal cal-root' : 'only-m m-cal cal-root'} style={S(PAGE.replace('position:absolute;left:0;right:0;top:0;bottom:0;z-index:5;display:flex;', inline ? 'position:relative;width:100%;height:calc(100dvh - 170px);min-height:520px;box-sizing:border-box;border:1px solid #E6E8EC;border-radius:24px;display:flex;' : 'position:relative;width:100%;height:100dvh;box-sizing:border-box;'))}>
      <ScreenHeader title={inline ? 'Payments' : 'Card payments'} sub={inline ? 'Back to payments settings' : 'Windcave setup and tax mode'} backHref="/settings?section=payments" backLabel="Back to payments" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 24px;display:flex;flex-direction:column;gap:14px')}>
        <div><h3 style={S(H3)}>Prices are</h3></div>
        <div role="group" aria-label="Prices are" style={S('display:flex;gap:10px')}>
          <button onClick={() => set('inclusive', true)} aria-pressed={v.inclusive} style={S(tile(v.inclusive))}>Tax inclusive</button>
          <button onClick={() => set('inclusive', false)} aria-pressed={!v.inclusive} style={S(tile(!v.inclusive))}>Tax exclusive</button>
        </div>

        <div><h3 style={S(H3)}>Card payments on screen</h3><p style={S(NOTE)}>Opens Windcave's secure payment page for the client to enter their card.</p></div>
        <section style={S(CARD)}><SwitchRow id="wc-online" title="Take card payments on screen" on={v.online} toggle={() => set('online', !v.online)} last /></section>
        <Key id="wc-ou" label="Windcave REST user" value={v.online_user} set={(x) => set('online_user', x)} saved={saved.online_user} />
        <Key id="wc-ok" label="Windcave REST key" value={v.online_key} set={(x) => set('online_key', x)} saved={saved.online_key} secret />

        <div><h3 style={S(H3)}>Card terminal</h3><p style={S(NOTE)}>Windcave HIT. Sends the amount to your terminal.</p></div>
        <section style={S(CARD)}><SwitchRow id="wc-term" title="Use a card terminal" on={v.terminal} toggle={() => set('terminal', !v.terminal)} last /></section>
        <Key id="wc-st" label="Terminal station ID" value={v.station} set={(x) => set('station', x)} />
        <Key id="wc-hu" label="HIT user" value={v.hit_user} set={(x) => set('hit_user', x)} saved={saved.hit_user} />
        <Key id="wc-hk" label="HIT key" value={v.hit_key} set={(x) => set('hit_key', x)} saved={saved.hit_key} secret />
        <p style={S(NOTE)}>Save first, then test. Testing asks Windcave about a made-up payment, so nothing is charged.</p>
        <button onClick={c.test} disabled={c.busy} className="ghost" style={S(OUTLINE + ';flex:0 0 auto' + dim(c.busy))}>Test terminal connection</button>
      </main>
      <div style={S(BAR)}>
        {!!c.error && <FieldError>{c.error}</FieldError>}
        {!!c.notice && <Notice>{c.notice}</Notice>}
        <button onClick={c.save} disabled={c.busy} style={S(BLACK + ';flex:0 0 auto' + dim(c.busy))}>{c.busy ? 'Saving…' : 'Save payment settings'}</button>
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
