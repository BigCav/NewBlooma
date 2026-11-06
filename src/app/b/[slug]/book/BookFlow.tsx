'use client';
// The customer checkout: services, team member, time, details, summary. The step screens are the same ones the salon uses in its own "new appointment" sheet.
// On a computer it is a page (steps on the left, "Your booking" on the right); on a phone it is a full-screen step flow with the button pinned at the bottom.
// Changing the services or the team member from the summary sends the customer back through the time step before the summary, because lengths and availability change.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { DayStrip, TimeGrid } from '@/components/DayTimePicker';
import { Avatar, BLACK, FIELD_IN, Field, FieldError, Icon, INPUT, LabelledField, OUTLINE, PasswordInput, SwitchRow, dim, filterChipCss } from '@/components/ui';
import { MONTHS_FULL, addDaysYmd, dayInfo } from '@/lib/cal';
import { clockStr, clock12, duration, makeMoney, plural, timeRange } from '@/lib/display';
import { birthdayDate } from '@/lib/marketing-shared';
import { firstName } from '@/lib/people';
import { checkPhone, phoneInput } from '@/lib/phone';
import { TONE } from '@/lib/tones';
import { S } from '../../../(dash)/calendar/pickers';
import { DetailRows, ICONS, PeopleStep, ROW, StepShell, TICK } from '../../../(dash)/calendar/wizardUi';
import { SalonHeader } from '../SalonHeader';
import { clientSignIn, nextAvailable, publicBook, publicSlots, publicWaitlist, type Account, type Slot } from './actions';

type Svc = { id: string; name: string; desc: string; cat: string; dur: number; cents: number };
type Addon = Svc & { parents: string[] };
type Member = { id: string; name: string; role: string; photo?: string | null; svc: string[] };
type Props = {
  slug: string; name: string; address: string; tz: string; currency: string;
  services: Svc[]; addons: Addon[]; cats: string[]; team: Member[]; hours: ({ from: string; to: string } | null)[];
  today: string; nowMin: number; autoConfirm: boolean; windowDays: number; emailOn: boolean; preselect: string; preStaff: string; account: Account | null;
};
type Kind = 'services' | 'team' | 'time' | 'details' | 'summary';
const TITLES: Record<Kind, string> = { services: 'Choose your services', team: 'Choose a team member', time: 'Pick a date and time', details: 'Your details', summary: 'Check and confirm' };
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function BookFlow(p: Props) {
  const money = useMemo(() => makeMoney(p.currency), [p.currency]);
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);

  /* ---------- what the customer has chosen ---------- */
  const [sel, setSel] = useState<string[]>(p.preselect ? [p.preselect] : []);
  const [staff, setStaff] = useState(p.preStaff);
  const days = useMemo(() => Array.from({ length: Math.min(p.windowDays, 57) }, (_, i) => {
    const d = dayInfo(addDaysYmd(p.today, i));
    return { ymd: d.ymd, abbr: d.abbr, num: d.num, month: d.month, full: d.full, weekday: d.weekday, closed: !p.hours[d.wd] };
  }), [p.today, p.windowDays, p.hours]);
  const firstOpen = days.find((d, i) => { const t = p.hours[dayInfo(d.ymd).wd]; return !!t && (i > 0 || p.nowMin < toMin(t.to)); })?.ymd ?? days[0].ymd;
  const [day, setDay] = useState(firstOpen);
  const [slotKey, setSlotKey] = useState('');
  const [min, setMin] = useState<number | null>(null);
  const [acct, setAcct] = useState<Account | null>(p.account);
  const [form, setForm] = useState({ name: p.account?.name ?? '', email: p.account?.email ?? '', phone: p.account?.phone ?? '', notes: '' });
  const [mk, setMk] = useState(false);
  const [bd, setBd] = useState({ month: '', day: '' });
  const [save, setSave] = useState(false);
  const [savePw, setSavePw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [hp, setHp] = useState('');
  const [au, setAu] = useState({ open: false, email: '', pw: '', show: false, error: '', busy: false });
  const [wl, setWl] = useState({ open: false, done: false, name: '', phone: '', error: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ staffName: string; email: string; ics?: string; note: string; forms?: { names: string[]; url: string; ask: boolean }; when: string; day: string; services: string; total: string } | null>(null);

  const all = [...p.services, ...p.addons];
  const list = all.filter((s) => sel.includes(s.id));
  const mains = list.filter((s) => !p.addons.some((a) => a.id === s.id));
  const totalDur = list.reduce((a, s) => a + s.dur, 0);
  const totalCents = list.reduce((a, s) => a + s.cents, 0);
  // Only one person can do what was chosen (a solo salon, or one specialist): there is nobody to choose between, so that step is left out.
  const able = sel.length ? p.team.filter((t) => mains.every((s) => t.svc.includes(s.id))) : [];
  const lone = able.length === 1 ? able[0].id : null;
  const who = lone ?? staff;
  const member = p.team.find((t) => t.id === who);
  const kinds: Kind[] = ['services', ...(lone ? [] : ['team' as const]), 'time', 'details', 'summary'];
  const [kind, setKind] = useState<Kind>('services');
  const here: Kind = kinds.includes(kind) ? kind : 'time';
  const stepNo = kinds.indexOf(here);

  /* ---------- open times ---------- */
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [slotErr, setSlotErr] = useState('');
  const [timeNote, setTimeNote] = useState('');
  const req = useRef(0);
  const hoursToday = p.hours[dayInfo(day).wd];
  const minRef = useRef<number | null>(null);
  minRef.current = min;
  useEffect(() => {
    if (!sel.length || !who || !hoursToday) { setSlots([]); setLoading(false); setSlotErr(''); return; }
    const id = ++req.current; setLoading(true); setSlotErr('');
    publicSlots(p.slug, day, sel, who).then((r) => {
      if (id !== req.current) return;
      setSlots(r.slots); setSlotErr(r.error ?? ''); setLoading(false);
      // A time picked earlier stays picked if it can still be booked with these services; otherwise it is dropped and the customer is told.
      const m = minRef.current;
      if (m !== null) {
        const k = r.slots.find((s) => s.min === m)?.key;
        if (k) setSlotKey(k); else { setMin(null); setSlotKey(''); setTimeNote('That time is no longer free for these services. Please pick another.'); }
      }
    }).catch(() => { if (id !== req.current) return; setSlots([]); setSlotErr('Could not load times. Please try again.'); setLoading(false); });
  }, [p.slug, sel.join(','), who, day, hoursToday ? 1 : 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = new Map(slots.map((s) => [s.min, s.key]));
  const grid = useMemo(() => {
    if (!hoursToday) return [] as number[];
    const set = new Set<number>(); for (let m = toMin(hoursToday.from); m < toMin(hoursToday.to); m += 30) set.add(m);
    for (const s of slots) set.add(s.min);
    return [...set].sort((a, b) => a - b);
  }, [hoursToday, slots]);

  const [nextAt, setNextAt] = useState<string | null>(null);
  useEffect(() => { let live = true; if (!sel.length) { setNextAt(null); return; } nextAvailable(p.slug, sel, who && who !== 'any' ? who : undefined).then((l) => { if (live) setNextAt(l); }).catch(() => { if (live) setNextAt(null); }); return () => { live = false; }; }, [p.slug, sel.join(','), who]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- moving between steps ---------- */
  // From the summary a row opens its step ("ret"). Coming back, the customer first passes through whatever the change makes necessary (the team member, then the time).
  const [ret, setRet] = useState(false);
  const [queue, setQueue] = useState<Kind[]>([]);
  const entry = useRef<{ sel: string[]; who: string }>({ sel: [], who: '' });
  const goto = (k: Kind) => { setError(''); setKind(k); };
  useEffect(() => { window.scrollTo(0, 0); document.querySelectorAll('.bk-scroll').forEach((el) => { el.scrollTop = 0; }); }, [here, done]);
  const jump = (k: Kind) => { entry.current = { sel: [...sel], who }; setRet(true); setQueue([]); goto(k); };

  const detailsError = () => {
    if (!form.name.trim()) return 'Please add your name.';
    if (!/\S+@\S+\.\S+/.test(form.email)) return 'Please add a valid email so we can confirm your booking.';
    if (!(acct && acct.phone)) { const ph = checkPhone(form.phone, true); if (ph.error) return ph.error; }
    if (!acct && save && savePw.length < 8) return 'Choose a password with at least 8 characters.';
    if (mk && !!bd.month !== !!bd.day) return 'Choose both the day and the month of your birthday, or neither.';
    if (mk && bd.month && bd.day && !birthdayDate(Number(bd.month), Number(bd.day))) return 'That is not a real birthday. Check the day and month.';
    if (au.open) return 'Sign in above, or choose Continue as guest.';
    return '';
  };
  const problem = (k: Kind) => k === 'services' ? (sel.length ? '' : 'Choose a service.') : k === 'team' ? (who ? '' : 'Choose a team member.') : k === 'time' ? (slotKey ? '' : 'Choose a time.') : k === 'details' ? detailsError() : '';
  const forward = () => {
    const e = problem(here);
    if (e) { setError(e); return; }
    if (ret) {
      if (queue.length) { const [n, ...rest] = queue; setQueue(rest); goto(n); return; }
      // The services or the person changed: the time has to be chosen again (the old one is kept if it still works), then back to the summary.
      const changed = !same(entry.current.sel, sel) || entry.current.who !== who;
      if (changed && here !== 'time' && here !== 'details') {
        entry.current = { sel: [...sel], who };
        const need: Kind[] = [...(!who && kinds.includes('team') && here !== 'team' ? ['team' as const] : []), 'time'];
        if (need.length > 1) { setQueue(need.slice(1)); }
        goto(need[0]); return;
      }
      setRet(false); goto('summary'); return;
    }
    goto(kinds[Math.min(kinds.length - 1, stepNo + 1)]);
  };
  const back = () => {
    if (done) { window.location.assign('/b/' + p.slug); return; }
    if (ret) { forward(); return; }
    if (stepNo > 0) goto(kinds[stepNo - 1]); else window.location.assign('/b/' + p.slug);
  };

  /* ---------- choosing ---------- */
  const toggle = (id: string) => {
    let next = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    // An extra only stays ticked while a service it goes with is still chosen.
    next = next.filter((x) => { const a = p.addons.find((y) => y.id === x); return !a || a.parents.some((pid) => next.includes(pid)); });
    const m = p.team.find((t) => t.id === staff);
    if (m && !next.filter((x) => !p.addons.some((a) => a.id === x)).every((x) => m.svc.includes(x))) setStaff('');
    setSel(next); setError(''); setTimeNote('');
  };
  const [cat, setCat] = useState('All');
  const extras = p.addons.filter((a) => a.parents.some((id) => sel.includes(id)));
  const whenText = min !== null ? timeRange(clock12(min), clock12(min + totalDur)) : '';
  const whenFull = (m: number) => dayInfo(day).full + ', ' + timeRange(clock12(m), clock12(m + totalDur));

  const signIn = async () => {
    if (au.busy) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(au.email.trim())) { setAu({ ...au, error: 'Enter a valid email address.' }); return; }
    if (!au.pw) { setAu({ ...au, error: 'Enter your password.' }); return; }
    setAu({ ...au, busy: true, error: '' });
    try {
      const r = await clientSignIn({ slug: p.slug, email: au.email, password: au.pw });
      if (r.error || !r.account) { setAu((a) => ({ ...a, busy: false, error: r.error ?? 'Email or password is incorrect.' })); return; }
      setAcct(r.account); setForm((f) => ({ ...f, name: r.account!.name, email: r.account!.email, phone: r.account!.phone })); setSave(false); setSavePw(''); setError('');
      setAu({ open: false, email: '', pw: '', show: false, error: '', busy: false });
    } catch { setAu((a) => ({ ...a, busy: false, error: 'Something went wrong. Please try again.' })); }
  };
  const joinWaitlist = async () => {
    if (!wl.name.trim()) { setWl({ ...wl, error: 'Add your name.' }); return; }
    if (wl.phone.replace(/\D/g, '').length < 7) { setWl({ ...wl, error: 'Add a mobile number so we can reach you.' }); return; }
    const r = await publicWaitlist(p.slug, { name: wl.name, phone: wl.phone, serviceId: mains[0]?.id ?? sel[0], staffId: who || 'any' }).catch(() => ({ error: 'Something went wrong. Please try again.' }));
    if (r.error) { setWl((w) => ({ ...w, error: r.error! })); return; }
    setWl({ open: false, done: true, name: '', phone: '', error: '' });
  };
  const confirm = async () => {
    if (busy) return;
    const e = problem('services') || problem('time') || (who ? '' : 'Choose a team member.') || detailsError();
    if (e) { setError(e); return; }
    setBusy(true); setError('');
    try {
      const wantsAccount = !acct && save;
      const r = await publicBook(p.slug, { services: sel, slot: slotKey, name: form.name, email: form.email, phone: form.phone, notes: form.notes, website: hp, password: wantsAccount ? savePw : undefined, marketing: mk, birthday: mk && bd.month && bd.day ? { month: Number(bd.month), day: Number(bd.day) } : undefined });
      if (r.error) { setError(r.error); return; }
      const note = r.account === 'created' ? 'Your account is ready. Sign in next time to skip the details step.' : r.account === 'saved' ? 'Saved to your account.' : r.account === 'exists' ? 'You already have an account with this email. Sign in next time to skip the details step.' : '';
      if (r.account === 'created') setAcct({ name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() });
      setDone({ staffName: r.staffName || member?.name || 'The team', email: form.email.trim(), ics: r.ics, note, forms: r.forms, when: whenText, day: dayInfo(day).full, services: list.map((s) => s.name).join(' + '), total: money(totalCents) });
    } catch { setError('Something went wrong. Please try again.'); } finally { setBusy(false); }
  };
  const reset = () => { setDone(null); setSel([]); setStaff(''); setDay(firstOpen); setSlotKey(''); setMin(null); setKind('services'); setRet(false); setQueue([]); setError(''); setSave(false); setSavePw(''); setMk(false); setBd({ month: '', day: '' }); setForm((f) => ({ ...f, notes: '' })); setWl({ open: false, done: false, name: '', phone: '', error: '' }); };

  /* ---------- the screens ---------- */
  const wide = narrow === false;
  const row = (on: boolean) => ROW(on);
  const svcRow = (s: Svc, extra: boolean) => {
    const on = sel.includes(s.id);
    return (
      <button key={s.id} onClick={() => toggle(s.id)} aria-pressed={on} aria-label={`${s.name}, ${extra ? 'add ' : ''}${duration(s.dur)}, ${money(s.cents)}`} style={S(row(on))}>
        <span style={S('flex:1 1 auto;min-width:0')}>
          <span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{s.name}</span>
          {!!s.desc && <span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{s.desc}</span>}
          <span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673')}>{(extra ? '+' : '') + duration(s.dur)}</span>
        </span>
        <span style={S('flex:0 0 auto;font-size:15px;font-weight:600')}>{(extra ? '+' : '') + money(s.cents)}</span>
        {on ? TICK : <span aria-hidden="true" style={S('flex:0 0 22px;width:22px;height:22px;border-radius:999px;border:1.5px solid #D5D9E0;display:flex;align-items:center;justify-content:center')}><Icon name="plus" size={12} color="#0E1116" /></span>}
      </button>
    );
  };
  const note = (children: ReactNode, tone: 'green' | 'grey' = 'grey') => <div role="status" style={S(`box-sizing:border-box;border-radius:16px;padding:12px 16px;font-size:14px;background:${TONE[tone].bg};color:${TONE[tone].fg}`)}>{children}</div>;

  const body: ReactNode = here === 'services' ? (
    <div style={S('display:flex;flex-direction:column;gap:14px')}>
      <div role="group" className="hscroll" aria-label="Filter services" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>
        {['All', ...p.cats].map((c) => <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} style={S(filterChipCss(cat === c, true))}>{c === 'All' ? 'All services' : c}</button>)}
      </div>
      <div role="group" aria-label="Services" style={S('display:flex;flex-direction:column')}>{p.services.filter((s) => cat === 'All' || s.cat === cat).map((s) => svcRow(s, false))}</div>
      {extras.length > 0 && <div role="group" aria-label="Extras" style={S('display:flex;flex-direction:column;gap:8px')}><h3 style={S('margin:6px 0 0;font-size:16px;font-weight:600')}>Add an extra</h3><div style={S('display:flex;flex-direction:column')}>{extras.map((s) => svcRow(s, true))}</div></div>}
      {!p.services.length && <div style={S('font-size:14px;color:#5E6673')}>No services are open for online booking yet.</div>}
    </div>
  ) : here === 'team' ? (
    <div style={S('display:flex;flex-direction:column;gap:14px')}>
      {sel.length > 0 && !!nextAt && note(<>Next available{who && who !== 'any' ? ' with ' + firstName(p.team.find((x) => x.id === who)?.name, 'them') : ''}: {nextAt}</>, 'green')}
      <PeopleStep any team={p.team} selected={staff} offers={(id) => { const t = p.team.find((x) => x.id === id); return !t || mains.every((s) => t.svc.includes(s.id)); }} onPick={(id) => { setStaff(id || 'any'); setError(''); setTimeNote(''); }} />
    </div>
  ) : here === 'time' ? (
    <div style={S('display:flex;flex-direction:column;gap:14px')}>
      <DayStrip days={days} selected={day} width={wide ? 84 : 60} pickClosed onPick={(d) => { setDay(d); setMin(null); setSlotKey(''); setTimeNote(''); setError(''); }} />
      {!hoursToday ? <div style={S('font-size:14px;color:#5E6673')}>We are closed on {dayInfo(day).weekday}s. Pick another day.</div> : <>
        <TimeGrid times={grid.map((m) => ({ min: m, ok: open.has(m) }))} selected={min} cols={wide ? 'repeat(auto-fill,minmax(104px,1fr))' : 'repeat(3,minmax(0,1fr))'} onPick={(m) => { setMin(m); setSlotKey(open.get(m) ?? ''); setTimeNote(''); setError(''); }} />
        {loading ? <div style={S('font-size:14px;color:#5E6673')}>Checking availability…</div> : slotErr ? <div style={S('font-size:14px;color:#B42318')}>{slotErr}</div> : !slots.length ? <div style={S('font-size:14px;color:#5E6673')}>No times left on this day. Try another day.</div> : null}
      </>}
      {!!timeNote && note(timeNote)}
      {wl.done ? note('You are on the waitlist. We will message you if a time opens up.', 'green') : !wl.open ? (
        <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px')}><span style={S('flex:1 1 200px;font-size:14px;color:#5E6673')}>Cannot find a time that suits?</span><button className="ghost" onClick={() => setWl({ ...wl, open: true, error: '' })} style={S(OUTLINE + ';flex:0 0 auto;height:44px;padding:0 20px')}>Join the waitlist</button></div>
      ) : (
        <div style={S('display:flex;flex-direction:column;gap:12px;padding:16px;border:1px solid #E6E8EC;border-radius:22px')}>
          <div style={S('font-size:15px;font-weight:600')}>Join the waitlist</div>
          <Field label="Your name" htmlFor="wl-n"><input id="wl-n" type="text" autoComplete="name" value={wl.name} onChange={(e) => setWl({ ...wl, name: e.target.value, error: '' })} style={FIELD_IN} /></Field>
          <Field label="Mobile number" htmlFor="wl-p"><input id="wl-p" type="tel" inputMode="tel" autoComplete="tel" value={wl.phone} onChange={(e) => setWl({ ...wl, phone: phoneInput(e.target.value), error: '' })} style={FIELD_IN} /></Field>
          {!!wl.error && <FieldError>{wl.error}</FieldError>}
          <div style={S('display:flex;gap:10px')}><button onClick={joinWaitlist} style={S(BLACK + ';height:48px')}>Join waitlist</button><button className="ghost" onClick={() => setWl({ ...wl, open: false, error: '' })} style={S(OUTLINE + ';height:48px')}>Cancel</button></div>
        </div>
      )}
    </div>
  ) : here === 'details' ? (
    <div style={S('position:relative;display:flex;flex-direction:column;gap:14px')}>
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={hp} onChange={(e) => setHp(e.target.value)} style={S('position:absolute;left:-9999px;width:1px;height:1px;min-height:0;padding:0;opacity:0')} />
      {acct ? (
        <div style={S('display:flex;align-items:center;gap:14px;padding:16px;border:1px solid #E6E8EC;border-radius:22px')}>
          <Avatar name={acct.name || acct.email} size="xl" />
          <div style={S('min-width:0')}><div style={S('font-size:19px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{acct.name || acct.email}</div><div style={S('margin-top:2px;font-size:13.5px;color:#5E6673;overflow-wrap:anywhere')}>{acct.email}</div></div>
        </div>
      ) : au.open ? (
        <div style={S('display:flex;flex-direction:column;gap:12px;padding:16px;border:1px solid #E6E8EC;border-radius:22px')}>
          <div style={S('font-size:15px;font-weight:600')}>Sign in</div>
          <Field label="Email" htmlFor="ac-email"><input id="ac-email" type="email" inputMode="email" autoComplete="email" value={au.email} onChange={(e) => setAu({ ...au, email: e.target.value, error: '' })} style={FIELD_IN} /></Field>
          <LabelledField id="ac-pw" label="Password"><PasswordInput id="ac-pw" value={au.pw} onChange={(v) => setAu({ ...au, pw: v, error: '' })} show={au.show} onToggle={() => setAu({ ...au, show: !au.show })} placeholder="Your password" autoComplete="current-password" onEnter={signIn} /></LabelledField>
          {!!au.error && <FieldError>{au.error}</FieldError>}
          <div style={S('display:flex;gap:10px')}><button onClick={signIn} disabled={au.busy} style={S(BLACK + ';height:48px' + dim(au.busy))}>{au.busy ? 'Signing in…' : 'Sign in'}</button><button className="ghost" onClick={() => setAu({ ...au, open: false, error: '' })} style={S(OUTLINE + ';height:48px')}>Continue as guest</button></div>
        </div>
      ) : (<>
        <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px;padding:12px 16px;border-radius:16px;background:#F4F5F7')}>
          <span style={S('flex:1 1 200px;font-size:14px;color:#5E6673')}>Have an account? Sign in to use your saved details.</span>
          <button className="ghost" onClick={() => { setError(''); setAu({ ...au, open: true }); }} style={S(OUTLINE + ';flex:0 0 auto;height:44px;padding:0 20px')}>Sign in</button>
        </div>
        <Field label="Full name" htmlFor="bk-name"><input id="bk-name" type="text" autoComplete="name" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(''); }} placeholder="Your name" style={FIELD_IN} /></Field>
        <Field label="Email" htmlFor="bk-email"><input id="bk-email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setError(''); }} placeholder="you@example.com" style={FIELD_IN} /></Field>
      </>)}
      {!(acct && acct.phone) && !au.open && <Field label="Phone" htmlFor="bk-phone"><input id="bk-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => { setForm({ ...form, phone: phoneInput(e.target.value) }); setError(''); }} placeholder="Required" style={FIELD_IN} /></Field>}
      <Field label="Notes for the salon" htmlFor="bk-notes"><textarea id="bk-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" rows={3} style={{ ...FIELD_IN, resize: 'none' }} /></Field>
      {!au.open && <div style={S('display:flex;flex-direction:column;border:1px solid #E6E8EC;border-radius:22px;padding:0 16px')}>
        <SwitchRow id="bk-mk" title="Send me offers and news" sub={`An occasional email from ${p.name}. You can unsubscribe at any time.`} on={mk} toggle={() => { setMk(!mk); setError(''); }} last={!mk} />
        {mk && <div style={S('padding:4px 0 16px')}><LabelledField id="bk-bd-day" label="Birthday (optional)"><div style={S('display:flex;gap:10px')}>
          <select id="bk-bd-day" aria-label="Birthday day" value={bd.day} onChange={(e) => setBd({ ...bd, day: e.target.value })} style={S(INPUT + ';flex:0 0 88px')}><option value="">Day</option>{Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select>
          <select aria-label="Birthday month" value={bd.month} onChange={(e) => setBd({ ...bd, month: e.target.value })} style={S(INPUT + ';flex:1 1 auto;min-width:0')}><option value="">Month</option>{MONTHS_FULL.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select>
        </div></LabelledField></div>}
      </div>}
      {!acct && !au.open && <div style={S('display:flex;flex-direction:column;border:1px solid #E6E8EC;border-radius:22px;padding:0 16px')}>
        <SwitchRow id="bk-save" title="Save my details for next time" sub="Create an account so you can skip this step on your next booking." on={save} toggle={() => { setSave(!save); setError(''); }} last={!save} />
        {save && <div style={S('padding:4px 0 16px')}><LabelledField id="bk-pw" label="Choose a password"><PasswordInput id="bk-pw" value={savePw} onChange={(v) => { setSavePw(v); setError(''); }} show={showPw} onToggle={() => setShowPw(!showPw)} placeholder="At least 8 characters" autoComplete="new-password" /></LabelledField></div>}
      </div>}
      <p style={S('margin:0;font-size:13px;color:#5E6673')}>You pay at the salon after your appointment.{!p.autoConfirm ? (p.emailOn ? ' The salon will confirm your request by email.' : ' The salon will confirm your request.') : ''}</p>
    </div>
  ) : (
    <div style={S('display:flex;flex-direction:column;gap:14px')}>
      <div style={S('display:flex;align-items:center;gap:14px;padding:16px;border:1px solid #E6E8EC;border-radius:22px')}>
        <Avatar name={(form.name || acct?.name || '?').trim()} size="xl" />
        <div style={S('min-width:0;flex:1 1 auto')}><div style={S('font-size:19px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{form.name.trim() || acct?.name}</div><div style={S('margin-top:2px;font-size:13.5px;color:#5E6673;overflow-wrap:anywhere')}>{form.email.trim()}</div></div>
        <button onClick={() => jump('details')} style={S('flex:0 0 auto;height:36px;padding:0 14px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;font:inherit;font-size:13.5px;font-weight:500;cursor:pointer')}>Change</button>
      </div>
      <DetailRows go={(n) => jump(n === 0 ? 'time' : 'team')} rows={[
        { icon: ICONS.day, text: dayInfo(day).full, step: 0 },
        { icon: ICONS.time, text: whenText, step: 0 },
        { icon: ICONS.person, text: member ? member.name : 'First available team member', step: lone ? undefined : 1 },
      ]} />
      <div style={S('display:flex;flex-direction:column;gap:10px')}>
        <div style={S('display:flex;align-items:center;justify-content:space-between')}><h3 style={S('margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Services</h3><button onClick={() => jump('services')} style={S('border:0;background:transparent;font:inherit;font-size:14px;font-weight:500;text-decoration:underline;cursor:pointer')}>Change</button></div>
        {list.map((v) => (
          <div key={v.id} style={S('display:flex;align-items:center;gap:12px')}>
            <span style={S('flex:0 0 4px;align-self:stretch;border-radius:999px;background:#B9AEFB')} />
            <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{v.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{duration(v.dur)}</span></span>
            <span style={S('flex:0 0 auto;font-size:14.5px;font-weight:500')}>{money(v.cents)}</span>
          </div>
        ))}
        <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-top:10px;border-top:1px solid #EEF0F3')}><span style={S('color:#5E6673')}>Total, pay at the salon</span><span style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{money(totalCents)}</span></div>
      </div>
    </div>
  );

  const primaryLabel = here === 'summary' ? (busy ? (p.autoConfirm ? 'Booking…' : 'Sending…') : p.autoConfirm ? 'Confirm booking' : 'Request booking') : 'Continue';
  const primary = () => (here === 'summary' ? confirm() : forward());
  const summaryLine = sel.length > 0 && here !== 'summary' ? <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px')}><span style={S('color:#5E6673;font-size:14px')}>{plural(sel.length, 'service') + ', ' + duration(totalDur)}</span><span style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{money(totalCents)}</span></div> : undefined;
  const titles = kinds.map((k) => TITLES[k]);

  /* ---------- the finished booking ---------- */
  const calLinks = (() => {
    if (!done || min === null) return null;
    const ymd = day.replace(/-/g, '');
    const hm = (m: number) => String(Math.floor(m / 60)).padStart(2, '0') + String(m % 60).padStart(2, '0');
    const title = list.map((x) => x.name).join(' + ') + ' at ' + p.name;
    const details = 'Booked with ' + done.staffName + '. Total ' + done.total + ', pay at the salon.';
    const e = encodeURIComponent;
    return {
      google: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + e(title) + '&dates=' + ymd + 'T' + hm(min) + '00/' + ymd + 'T' + hm(min + totalDur) + '00&ctz=' + e(p.tz) + '&details=' + e(details) + '&location=' + e(p.address),
      outlook: 'https://outlook.live.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=' + e(title) + '&startdt=' + day + 'T' + hm(min).slice(0, 2) + ':' + hm(min).slice(2) + ':00&enddt=' + day + 'T' + hm(min + totalDur).slice(0, 2) + ':' + hm(min + totalDur).slice(2) + ':00&body=' + e(details) + '&location=' + e(p.address),
    };
  })();
  const doneBody = done && (<>
    <p style={S('margin:0;color:#5E6673;font-size:15px;overflow-wrap:anywhere')}>{p.autoConfirm ? (p.emailOn ? `We have emailed the details to ${done.email}.` : 'Your booking is confirmed. Keep these details handy.') : (p.emailOn ? `We will email ${done.email} once the salon confirms.` : 'The salon will confirm your request soon.')}</p>
    {!!done.note && <div role="status" style={S('padding:14px 16px;border-radius:16px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500')}>{done.note}</div>}
    {done.forms && (
      <div role="status" style={S(`display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:20px;background:${TONE.purple.bg};color:${TONE.purple.fg}`)}>
        <div style={S('font-size:16px;font-weight:600')}>{done.forms.ask ? 'One more thing before your visit' : 'Forms for your visit'}</div>
        <p style={S('margin:0;font-size:14.5px;line-height:1.45;overflow-wrap:anywhere')}>{done.forms.ask ? `Please complete ${done.forms.names.join(' and ')} now. It takes about two minutes.` : `Please complete ${done.forms.names.join(' and ')} before your visit.${p.emailOn ? ' We have also emailed you the link.' : ''}`}</p>
        <a href={done.forms.url} style={S(BLACK + ';flex:0 0 auto;align-self:flex-start;padding:0 24px')}>Complete your form</a>
      </div>
    )}
    <DetailRows go={() => {}} rows={[{ icon: ICONS.day, text: done.day }, { icon: ICONS.time, text: done.when }, { icon: ICONS.person, text: done.staffName }, { icon: ICONS.scissors, text: done.services }]} />
    <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:2px 2px')}><span style={S('color:#5E6673;font-size:14px')}>Total, pay at the salon</span><span style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{done.total}</span></div>
    {calLinks && <div role="group" aria-label="Add to calendar" style={S('display:flex;flex-direction:column;gap:8px')}>
      <h3 style={S('margin:6px 0 0;font-size:15px;font-weight:600')}>Add to calendar</h3>
      <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>
        {done.ics && <a href={done.ics} download="appointment.ics" className="ghost" style={S(OUTLINE + ';flex:1 1 150px;height:44px')}>Apple or file</a>}
        <a href={calLinks.google} target="_blank" rel="noopener noreferrer" className="ghost" style={S(OUTLINE + ';flex:1 1 150px;height:44px')}>Google</a>
        <a href={calLinks.outlook} target="_blank" rel="noopener noreferrer" className="ghost" style={S(OUTLINE + ';flex:1 1 150px;height:44px')}>Outlook</a>
      </div>
    </div>}
    <div style={S('display:flex;flex-wrap:wrap;gap:10px')}>
      <button onClick={reset} style={S(BLACK + ';flex:1 1 160px')}>Book again</button>
      <Link href={'/b/' + p.slug} className="ghost" style={S(OUTLINE + ';flex:1 1 160px')}>Back to {p.name}</Link>
    </div>
  </>);

  if (narrow === null) return <div className="cal-root" style={S('min-height:100dvh;background:#F4F5F7')} />;
  const fontCss = "font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;color:#0E1116";

  /* ---------- a phone: one full-screen step at a time ---------- */
  if (!wide) {
    if (done) return (
      <div className="cal-root" style={S(`min-height:100dvh;box-sizing:border-box;background:#FFFFFF;padding:24px 20px 32px;display:flex;flex-direction:column;gap:16px;${fontCss}`)}>
        <h1 style={S('margin:0;font-size:30px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>{p.autoConfirm ? `You are booked, ${firstName(form.name, 'there')}` : 'Request sent'}</h1>
        {doneBody}
      </div>
    );
    return (
      <div className="cal-root" style={S(`height:100dvh;box-sizing:border-box;background:#FFFFFF;padding:20px 20px 40px;display:flex;flex-direction:column;overflow:hidden;${fontCss}`)}>
        <StepShell step={stepNo} titles={titles} onBack={back} onClose={() => window.location.assign('/b/' + p.slug)} error={error} summary={summaryLine}
          actions={here === 'summary' ? [] : [{ label: primaryLabel, onClick: primary }]}
          bar={here === 'summary' ? <button type="button" onClick={primary} disabled={busy} style={S(BLACK + ';width:100%;flex:0 0 auto' + dim(busy))}>{primaryLabel}</button> : undefined}>
          {body}
        </StepShell>
      </div>
    );
  }

  /* ---------- a computer: a page ---------- */
  const t = p.hours[dayInfo(p.today).wd];
  const pillOn = !!t && p.nowMin < toMin(t.to);
  const pill = pillOn ? 'Open today until ' + clockStr(t!.to) : t ? 'Closed for today' : 'Closed today';
  return (
    <div className="cal-root" style={S(`min-height:100dvh;background:#F4F5F7;${fontCss}`)}>
      <div style={S('max-width:1180px;margin:0 auto;box-sizing:border-box;padding:24px 32px 56px;display:flex;flex-direction:column;gap:28px')}>
        <SalonHeader slug={p.slug} name={p.name} subtitle="Online booking" back={{ onClick: back, label: done || stepNo === 0 ? `Back to ${p.name}` : 'Back to previous step' }} status={{ open: pillOn, text: pill }} account={acct ? { name: acct.name || acct.email } : null} />
        {done ? (
          <div style={S('width:100%;max-width:640px;margin:0 auto;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:32px;display:flex;flex-direction:column;gap:16px')}>
            <h1 style={S('margin:0;font-size:30px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>{p.autoConfirm ? 'You are booked' : 'Request sent'}</h1>
            {doneBody}
          </div>
        ) : (<>
          <nav aria-label="Booking steps" style={S('display:flex;flex-direction:column;gap:10px')}>
            <div aria-hidden="true" style={S('display:flex;gap:6px')}>{titles.map((x, i) => <span key={x} style={S('flex:1 1 0;height:4px;border-radius:999px;background:' + (i <= stepNo ? '#0E1116' : '#E6E8EC'))} />)}</div>
            <div style={S('font-size:13px;color:#5E6673')}>Step {stepNo + 1} of {titles.length}</div>
          </nav>
          <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:24px')}>
            <div className="bk-scroll" style={S('flex:999 1 400px;min-width:0;display:flex;flex-direction:column;gap:20px')}>
              <h1 style={S('margin:0;font-size:34px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{TITLES[here]}</h1>
              {body}
              {!!error && <FieldError>{error}</FieldError>}
            </div>
            <aside aria-label="Your booking" style={S('flex:1 1 320px;max-width:380px;min-width:0;position:sticky;top:24px;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:18px')}>
              <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Your booking</h2>
              {list.length === 0 ? <p style={S('margin:0;color:#5E6673;font-size:14px')}>No services yet. Add one from the list.</p> : (
                <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column')}>
                  {list.map((l) => (
                    <li key={l.id} style={S('display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}>
                      <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;overflow-wrap:anywhere')}>{l.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{duration(l.dur)}</span></span>
                      <span style={S('flex:0 0 auto;font-size:14.5px;font-weight:600')}>{money(l.cents)}</span>
                      {here === 'services' && <button className="ghost" onClick={() => toggle(l.id)} aria-label={'Remove ' + l.name} style={S('flex:0 0 44px;width:44px;height:44px;padding:0;border:0;border-radius:999px;background:transparent;display:flex;align-items:center;justify-content:center')}><Icon name="close" color="#5E6673" /></button>}
                    </li>
                  ))}
                </ul>
              )}
              <dl style={S('margin:0;display:flex;flex-direction:column')}>
                {!!who && sel.length > 0 && <div style={S('display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>With</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{member ? member.name : 'Any team member'}</dd></div>}
                {min !== null && <div style={S('display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>When</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{whenFull(min)}</dd></div>}
                <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:14px 0;border-top:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Total, {duration(totalDur)}</dt><dd style={S('margin:0;font-size:22px;font-weight:600;letter-spacing:-0.02em')}>{money(totalCents)}</dd></div>
              </dl>
              <button onClick={primary} disabled={busy} style={S(BLACK + ';flex:0 0 auto;width:100%' + dim(busy))}>{primaryLabel}</button>
            </aside>
          </div>
        </>)}
      </div>
    </div>
  );
}
