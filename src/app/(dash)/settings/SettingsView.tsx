'use client';
// 1:1 conversion of the prototype's Settings.dc.html and MobileSettings.dc.html. Markup and style strings are kept as written;
// the {{ }} holes are real salon settings and Save writes them through a server action.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
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

function Desktop({ c }: { c: C }) {
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
        <div style={S('flex:999 1 520px;min-width:0;max-width:760px;display:flex;flex-direction:column;gap:12px')}>
          {!!c.notice && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{c.notice}</span>}
          <SectionPage c={c} inline />
        </div>
      </div>
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
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
