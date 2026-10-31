'use client';
// 1:1 conversion of the prototype's Settings.dc.html and MobileSettings.dc.html. Markup and style strings are kept as written;
// the {{ }} holes are real salon settings and Save writes them through a server action.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { saveSettings } from './actions';
import { SECTIONS, validate, type Closed, type Values } from './shared';
import { SectionPage } from './SectionPage';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function useSettings(initial: Values, start?: string, closedInit: Closed[] = []) {
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
  const [closed, setClosed] = useState<Closed[]>(closedInit);
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
  return { narrow, v, set, setHour, closed, setClosed, section, pick: (id: string) => { setSection(id); setOpen(true); setError(''); setNotice(''); }, open, close: () => { setOpen(false); setError(''); },
    error, notice, dirty, busy, save, discard: () => { setV(clone(saved)); setError(''); setNotice(''); } };
}
type C = ReturnType<typeof useSettings>;
export type SettingsCtl = C;

const Chevron = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')}><path d="M9.5 6l6 6-6 6" /></svg>;

const ICO = (d: React.ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3A2BB5" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const SEC_ICON: Record<string, React.ReactNode> = {
  business: ICO(<><path d="M4 9.5 5.2 4.5h13.6L20 9.5" /><path d="M5 12.5V20h14v-7.5" /><path d="M10 20v-4.5h4V20" /></>),
  hours: ICO(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  booking: ICO(<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>),
  payments: ICO(<><rect x="3" y="6" width="18" height="12.5" rx="3" /><path d="M3 10.5h18M7 15h3" /></>),
  notifications: ICO(<><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>),
  appearance: ICO(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />),
  forms: ICO(<><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 9h6M9 13h6M9 17h3" /></>),
};
const TILE_D = 'flex:0 0 48px;width:48px;height:48px;border-radius:16px;background:#EEEAFE;display:flex;align-items:center;justify-content:center';
const CARD_D = 'display:flex;align-items:center;gap:16px;box-sizing:border-box;min-height:92px;padding:18px 20px;border:1px solid #E6E8EC;border-radius:24px;background:#FFFFFF;text-align:left;text-decoration:none;font:inherit;color:#0E1116;cursor:pointer';

/** Desktop: every settings area as a card in a grid. An area opens in the right-hand drawer. */
function Desktop({ c }: { c: C }) {
  const body = (id: string, label: string, desc: string) => (<>
    <span style={S(TILE_D)}>{SEC_ICON[id]}</span>
    <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:16px;font-weight:600;letter-spacing:-0.01em')}>{label}</span><span style={S('display:block;margin-top:2px;font-size:13.5px;color:#5E6673')}>{desc}</span></span>
    <Chevron />
  </>);
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Settings" subtitle="Business details and booking rules" showSearch={false} showAction={false} />
      {!!c.notice && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{c.notice}</span>}
      <section aria-label="Settings sections" style={S('display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px')}>
        {SECTIONS.map((x) => (
          <button key={x.id} onClick={() => c.pick(x.id)} aria-label={x.label + ', ' + x.desc} className="s-card" style={S(CARD_D)}>{body(x.id, x.label, x.desc)}</button>
        ))}
        <Link href="/settings/forms" aria-label="Forms and consultations, what clients fill in before a visit" className="s-card" style={S(CARD_D)}>{body('forms', 'Forms and consultations', 'What clients fill in before a visit')}</Link>
      </section>
      {c.open && <div className="m-cal cal-root m-drawer"><SectionPage c={c} /></div>}
    </div>
  );
}

function Mobile({ c }: { c: C }) {
  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Settings" subtitle="Business details and booking rules" showSearch={false} />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:14px')}>
        {!!c.notice && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{c.notice}</span>}
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
      {c.open && <SectionPage c={c} />}
    </div>
  );
}

export function SettingsView({ initial, section, closed }: { initial: Values; section?: string; closed?: Closed[] }) {
  const c = useSettings(initial, SECTIONS.some((x) => x.id === section) ? section : undefined, closed);
  const deep = useRef(section);
  useEffect(() => { if (c.narrow === false && deep.current && SECTIONS.some((x) => x.id === deep.current)) { c.pick(deep.current); deep.current = undefined; } }, [c.narrow]); // eslint-disable-line react-hooks/exhaustive-deps
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
