'use client';
// 1:1 conversion of the prototype's Setup.dc.html and MobileSetup.dc.html (first-run wizard).
// Markup and style strings are kept as written; the last step creates the real salon, categories, starter services and team.
import { phoneInput, checkPhone } from '@/lib/phone';
import { duration, makeMoney, plural } from '@/lib/display';
import { TONE } from '@/lib/tones';
import { Avatar, BLACK, CLOSE, FieldError, OUTLINE, RING, Switch, dim, filterChipCss } from '@/components/ui';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { S } from '../(dash)/calendar/pickers';
import { createSalon } from './actions';
import { CATS, DAYS, PRESETS, ROLES, STARTERS, STEPS, currencyFor, slugOf } from './shared';

const INPUT = 'box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:16px;color:#0E1116;background:#FFFFFF';
const noMin = { minHeight: 0 } as const;
const TITLES = ['Tell us about your salon', 'What do you offer?', 'When are you open?', 'Who is on your team?', 'You are ready to go'];
const SUBS = ['This shows on your booking page and receipts.', 'Pick your categories. We add starter services you can edit later.', 'Clients can only book inside these hours.', 'Add the people who take bookings. You can invite them to sign in later.', ''];
type Member = { name: string; role: string };

function useSetup() {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const [busy, startT] = useTransition();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [address, setAddress] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [preset, setPreset] = useState('std');
  const [open, setOpen] = useState<Record<string, boolean>>({ Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: true, Sunday: false });
  const [team, setTeam] = useState<Member[]>([]);
  const [tname, setTname] = useState(''); const [trole, setTrole] = useState('Stylist');
  const [error, setError] = useState('');
  const [slug, setSlug] = useState('');
  const pr = PRESETS.find((p) => p[0] === preset)!;
  const money = makeMoney(currencyFor(Intl.DateTimeFormat().resolvedOptions().timeZone));
  const starters = cats.flatMap((c) => STARTERS[c].map(([n, d, p]) => ({ name: n, cat: c, meta: duration(d), price: money(p * 100) })));
  const openCount = DAYS.filter((d) => open[d]).length;
  const next = () => {
    if (step === 0 && !name.trim()) { setError('Add your salon name to continue.'); return; }
    if (step === 0 && checkPhone(phone).error) { setError(checkPhone(phone).error); return; }
    if (step === 1 && cats.length === 0) { setError('Choose at least one category.'); return; }
    if (step === 2 && !DAYS.some((d) => open[d])) { setError('Open at least one day.'); return; }
    if (step === 3) {
      startT(async () => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const r = await createSalon({ name, phone, address, cats, preset, open, team, timezone: tz });
        if (r.error) { setError(r.error); return; }
        setSlug(r.slug ?? slugOf(name)); setStep(4); setError('');
      });
      return;
    }
    setStep(Math.min(step + 1, 4)); setError('');
  };
  const addMember = () => {
    if (!tname.trim()) { setError("Add the team member's name."); return; }
    setTeam([...team, { name: tname.trim(), role: trole }]); setTname(''); setError('');
  };
  return { narrow, busy, step, setStep, name, setName, phone, setPhone, address, setAddress, cats, setCats, preset, setPreset, open, setOpen, team, setTeam, tname, setTname, trole, setTrole, error, setError, slug, pr, starters, openCount, next, addMember };
}
type C = ReturnType<typeof useSetup>;

const Label = ({ id, children }: { id: string; children: React.ReactNode }) => <label htmlFor={id} style={S('font-size:14px;font-weight:600')}>{children}</label>;

function StepBody({ c, m }: { c: C; m: boolean }) {
  const g = m ? 16 : 18;
  const inp = (id: string, label: string, val: string, set: (v: string) => void, ph: string, type = 'text') => (
    <div style={S('display:flex;flex-direction:column;gap:6px')}><Label id={id}>{label}</Label><input id={id} type={type} value={val} onChange={(e) => { set(type === 'tel' ? phoneInput(e.target.value) : e.target.value); c.setError(''); }} placeholder={ph} style={{ ...S(INPUT), ...noMin }} /></div>
  );
  return (<>
    {c.step === 0 && (
      <div style={S(`display:flex;flex-direction:column;gap:${g}px`)}>
        {inp('su-name', 'Salon name', c.name, c.setName, 'e.g. Aster & Co')}
        {inp('su-phone', 'Phone', c.phone, c.setPhone, 'Optional', 'tel')}
        {inp('su-addr', 'Address', c.address, c.setAddress, 'Street, city')}
        <div style={S('padding:14px 16px;border-radius:16px;background:#F4F5F7;display:flex;flex-direction:column;gap:2px')}><span style={S('font-size:13px;color:#5E6673')}>Your online booking link</span><span style={S('font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{'/b/' + slugOf(c.name)}</span></div>
      </div>
    )}
    {c.step === 1 && (
      <div style={S(`display:flex;flex-direction:column;gap:${g}px`)}>
        <div role="group" aria-label="Categories" style={S('display:flex;flex-wrap:wrap;gap:8px')}>
          {CATS.map((x) => { const on = c.cats.includes(x); return <button key={x} onClick={() => { c.setCats(on ? c.cats.filter((y) => y !== x) : [...c.cats, x]); c.setError(''); }} aria-pressed={on} style={S(filterChipCss(on, m))}>{x}</button>; })}
        </div>
        {c.starters.length > 0 && (<>
          <div style={S('display:flex;flex-direction:column;border:1px solid #E6E8EC;border-radius:16px;padding:0 16px')}>
            {c.starters.map((s) => <div key={s.cat + s.name} style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}><div style={S('min-width:0')}><div style={S('font-size:14.5px;font-weight:500;overflow-wrap:anywhere')}>{s.name}</div><div style={S('font-size:12.5px;color:#5E6673')}>{s.cat}, {s.meta}</div></div><div style={S('font-size:14.5px;font-weight:500')}>{s.price}</div></div>)}
          </div>
          <p style={S('margin:0;color:#5E6673;font-size:13.5px')}>{plural(c.starters.length, 'starter service') + ' will be added.'}</p>
        </>)}
      </div>
    )}
    {c.step === 2 && (
      <div style={S(`display:flex;flex-direction:column;gap:${g}px`)}>
        <div role="group" aria-label="Hours preset" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>
          {PRESETS.map((p) => <button key={p[0]} onClick={() => c.setPreset(p[0])} aria-pressed={c.preset === p[0]} style={S(filterChipCss(c.preset === p[0], m))}>{p[1] + ', ' + p[2]}</button>)}
        </div>
        <div style={S('display:flex;flex-direction:column')}>
          {DAYS.map((d) => { const on = !!c.open[d]; return (
            <div key={d} style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:content-box;min-height:56px;border-top:1px solid #EEF0F3')}>
              <span style={S('font-size:14.5px;font-weight:500')}>{d}</span>
              <span style={S('display:flex;align-items:center;gap:14px')}><span style={S('font-size:14px;color:' + (on ? '#0E1116' : '#8A93A0'))}>{on ? c.pr[2] : 'Closed'}</span>
                <Switch on={on} label={d + (on ? ', open' : ', closed')} onToggle={() => { c.setOpen({ ...c.open, [d]: !on }); c.setError(''); }} /></span>
            </div>); })}
        </div>
      </div>
    )}
    {c.step === 3 && (
      <div style={S(`display:flex;flex-direction:column;gap:${g}px`)}>
        <div style={S('display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid #E6E8EC;border-radius:16px')}><Avatar name="You" size="md" /><div><div style={S('font-size:14.5px;font-weight:500')}>You</div><div style={S('font-size:12.5px;color:#5E6673')}>Owner</div></div></div>
        {c.team.map((tm, i) => (
          <div key={i} style={S('display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid #E6E8EC;border-radius:16px')}><Avatar name={tm.name} size="md" /><div style={S('flex:1 1 auto;min-width:0')}><div style={S('font-size:14.5px;font-weight:500;overflow-wrap:anywhere')}>{tm.name}</div><div style={S('font-size:12.5px;color:#5E6673')}>{tm.role}</div></div>
            <button className="ghost" onClick={() => c.setTeam(c.team.filter((_, j) => j !== i))} aria-label={'Remove ' + tm.name} style={S(RING)}>{CLOSE}</button></div>
        ))}
        <div style={S('display:flex;flex-direction:column;gap:12px;padding-top:6px')}>
          {inp('su-tname', 'Add a team member', c.tname, c.setTname, 'Full name')}
          <div role="group" aria-label="Role" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>{ROLES.map((r) => <button key={r} onClick={() => c.setTrole(r)} aria-pressed={c.trole === r} style={S(filterChipCss(c.trole === r, m))}>{r}</button>)}</div>
          <button className="ghost" onClick={c.addMember} style={S(OUTLINE + ';flex:0 0 auto;padding:0 24px')}>Add team member</button>
        </div>
      </div>
    )}
  </>);
}

function Buttons({ c, m }: { c: C; m: boolean }) {
  const label = c.step === 3 && c.team.length === 0 ? 'Skip, just me' : c.step === 3 ? 'Finish setup' : 'Continue';
  return (
    <div style={S('display:flex;gap:10px')}>
      <button className="ghost" onClick={() => { c.setStep(c.step - 1); c.setError(''); }} disabled={c.step === 0} style={S(OUTLINE + ';padding:0;flex:0 0 ' + (m ? '96px' : '120px') + dim(c.step === 0))}>Back</button>
      <button onClick={c.next} disabled={c.busy} style={S(BLACK + ';padding:0 24px' + dim(c.busy))}>{c.busy ? 'Saving…' : label}</button>
    </div>
  );
}

function Done({ c, m }: { c: C; m: boolean }) {
  const rows: [string, string, string][] = [['Salon', c.name.trim() || 'Your salon', ''], ['Hours', plural(c.openCount, 'day') + ' a week, ' + c.pr[2], ''], ['Team', plural(c.team.length + 1, 'person', 'people') + (c.team.length === 0 ? ' (you)' : ' including you'), 'border-bottom:1px solid #EEF0F3;']];
  return (
    <div style={S('display:flex;flex-direction:column;gap:20px')}>
      <div style={S('display:flex;flex-direction:column;gap:12px;align-items:flex-start')}>
        <span aria-hidden="true" style={S('width:52px;height:52px;border-radius:999px;background:' + TONE.green.bg + ';display:flex;align-items:center;justify-content:center')}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={TONE.green.fg} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19 7.5" /></svg></span>
        <h1 style={S(`margin:0;font-size:${m ? 26 : 30}px;line-height:1.15;font-weight:600;letter-spacing:-0.025em`)}>{TITLES[4]}</h1>
        <p style={S('margin:0;color:#5E6673;font-size:15px')}>Here is what we set up. You can change any of it in Settings.</p>
      </div>
      <dl style={S('margin:0;display:flex;flex-direction:column')}>
        {rows.map(([k, v, extra]) => <div key={k} style={S('display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3;' + extra)}><dt style={S('color:#5E6673')}>{k}</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{v}</dd></div>)}
      </dl>
      <Link href={`/b/${c.slug}`} style={S(BLACK + ';flex:0 0 auto;padding:0 24px')}>See your booking page</Link>
      <Link href="/calendar" style={S('text-align:center;color:#5E6673;font-size:14px;font-weight:500;text-decoration:none')}>Go to your calendar</Link>
    </div>
  );
}

const Brand = () => <div style={S('display:flex;align-items:center;gap:10px')}><span aria-hidden="true" style={S('width:36px;height:36px;border-radius:12px;background:#0E1116;color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600')}>A</span><span style={S('font-size:18px;font-weight:600;letter-spacing:-0.02em')}>Aster</span></div>;
const Err = ({ c }: { c: C }) => !!c.error ? <FieldError>{c.error}</FieldError> : null;
const Head = ({ c, m }: { c: C; m: boolean }) => <div style={S('display:flex;flex-direction:column;gap:6px')}><div style={S('font-size:13px;color:#5E6673')}>{'Step ' + (c.step + 1) + ' of 5'}</div><h1 style={S(`margin:0;font-size:${m ? 22 : 28}px;line-height:1.15;font-weight:600;letter-spacing:-0.025em`)}>{TITLES[c.step]}</h1>{!!SUBS[c.step] && <p style={S('margin:0;color:#5E6673;font-size:15px')}>{SUBS[c.step]}</p>}</div>;

function Desktop({ c }: { c: C }) {
  return (
    <div className="only-d d-cal cal-root" style={S("display:flex;width:100%;min-height:1000px;box-sizing:border-box;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <aside aria-label="Setup steps" style={S('flex:0 0 320px;box-sizing:border-box;padding:48px 32px;display:flex;flex-direction:column;gap:40px')}>
        <Brand />
        <nav aria-label="Steps" style={S('display:flex;flex-direction:column;gap:4px')}>
          {STEPS.map((t, i) => (
            <button key={t} onClick={() => { if (i < c.step) { c.setStep(i); c.setError(''); } }} aria-current={i === c.step ? 'step' : undefined} style={S('display:flex;align-items:center;gap:12px;min-height:44px;width:100%;box-sizing:border-box;padding:0 8px;border:0;border-radius:14px;background:' + (i === c.step ? '#FFFFFF' : 'transparent') + ';color:' + (i <= c.step ? '#0E1116' : '#8A93A0') + ';font-size:14.5px;font-weight:' + (i === c.step ? 600 : 500) + ';text-align:left;cursor:' + (i < c.step ? 'pointer' : 'default'))}>
              <span style={S('flex:0 0 28px;width:28px;height:28px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;background:' + (i < c.step ? TONE.green.fg : i === c.step ? '#0E1116' : '#E6E8EC') + ';color:' + (i <= c.step ? '#FFFFFF' : '#5E6673'))}>{i < c.step ? '✓' : String(i + 1)}</span>{t}
            </button>
          ))}
        </nav>
      </aside>
      <main style={S('flex:1 1 auto;min-width:0;display:flex;justify-content:center;padding:48px 32px 64px 0;box-sizing:border-box')}>
        <div style={S('width:100%;max-width:640px;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:40px;display:flex;flex-direction:column;gap:28px;align-self:flex-start')}>
          {c.step < 4 ? (<><Head c={c} m={false} /><StepBody c={c} m={false} /><Err c={c} /><Buttons c={c} m={false} /></>) : <Done c={c} m={false} />}
        </div>
      </main>
    </div>
  );
}

function Mobile({ c }: { c: C }) {
  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <header style={S('flex:0 0 auto;display:flex;flex-direction:column;gap:16px;padding:24px 20px 8px')}>
        <Brand />
        <div role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={5} aria-valuenow={c.step + 1} style={S('height:6px;border-radius:999px;background:#E6E8EC;overflow:hidden')}><div style={S('width:' + ((c.step + 1) / 5 * 100) + '%;height:100%;border-radius:999px;background:#0E1116')} /></div>
      </header>
      {c.step < 4 ? (<>
        <div className="page" style={S('flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:20px;padding:12px 20px 20px')}><Head c={c} m={true} /><StepBody c={c} m={true} /><Err c={c} /></div>
        <div style={S('flex:0 0 auto;padding:12px 20px 24px;background:#F4F5F7;border-top:1px solid #E6E8EC')}><Buttons c={c} m={true} /></div>
      </>) : <div className="page" style={S('flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:20px;padding:12px 20px 24px')}><Done c={c} m={true} /></div>}
    </div>
  );
}

export function SetupView() {
  const c = useSetup();
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
