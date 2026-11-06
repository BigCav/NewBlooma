'use client';
// 1:1 conversion of the prototype's Booking.dc.html and MobileBooking.dc.html (the public online booking flow).
// Markup and style strings are kept as written; the {{ }} holes are the salon's real data and the handlers are real server actions.
import { DayStrip, TimeGrid } from '@/components/DayTimePicker';
import { clock12, clockStr, duration, makeMoney, plural, timeRange } from '@/lib/display';
import { MONTHS_FULL, addDaysYmd, dayInfo } from '@/lib/cal';
import { firstName } from '@/lib/people';
import { TONE } from '@/lib/tones';
import { Avatar, BACK, BLACK, Chip, FieldError, INPUT, Icon, KV_ROW, LabelledField, Note, Notice, OUTLINE, PasswordInput, RING, TEXTAREA, filterChipCss, dim } from '@/components/ui';
import { checkPhone, phoneInput } from '@/lib/phone';
import { useEffect, useMemo, useRef, useState } from 'react';
import { S } from '../../../(dash)/calendar/pickers';
import { clientSignIn, clientSignOut, nextAvailable, publicBook, publicSlots, publicWaitlist, type Account, type Slot } from './actions';

type Svc = { id: string; name: string; desc: string; cat: string; dur: number; cents: number };
type Addon = Svc & { parents: string[] };
type Member = { id: string; name: string; role: string; photo?: string | null; svc: string[] };
type Props = {
  slug: string; name: string; address: string; tz: string; currency: string;
  services: Svc[]; addons: Addon[]; cats: string[]; team: Member[]; hours: ({ from: string; to: string } | null)[];
  today: string; nowMin: number; autoConfirm: boolean; windowDays: number; emailOn: boolean; preselect: string; preStaff: string; account: Account | null;
};

const TITLES = ['Choose your services', 'Choose a team member', 'Pick a date and time', 'Your details'];
const LABELS = ['Services', 'Team member', 'Time', 'Details'];
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const firstOf = (a: Account) => firstName(a.name, a.email.split('@')[0]);
/** The signed-in chip keeps its dark ink look. */
const INK = { bg: '#0E1116', fg: '#FFFFFF' };
const ANY_ICON = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18.5 14.8c1.6.8 2.6 2.4 3 5.2" /></svg>;

type Form = { name: string; email: string; phone: string; notes: string };
type Wl = { open: boolean; done: boolean; name: string; phone: string; error: string };
const EMPTY_FORM: Form = { name: '', email: '', phone: '', notes: '' };
const EMPTY_WL: Wl = { open: false, done: false, name: '', phone: '', error: '' };
type Au = { panel: 'none' | 'in'; email: string; pw: string; show: boolean; error: string; busy: boolean };
const EMPTY_AU: Au = { panel: 'none', email: '', pw: '', show: false, error: '', busy: false };
const formFor = (a: Account | null, notes = ''): Form => ({ name: a?.name ?? '', email: a?.email ?? '', phone: a?.phone ?? '', notes });

function useBooking(p: Props) {
  const days = useMemo(() => Array.from({ length: Math.min(p.windowDays, 57) }, (_, i) => {
    const d = dayInfo(addDaysYmd(p.today, i));
    return { ymd: d.ymd, abbr: d.abbr, num: d.num, month: d.month.slice(0, 3), dow: d.wd, name: d.weekday, full: d.full };
  }), [p.today, p.windowDays]);
  const money = useMemo(() => makeMoney(p.currency), [p.currency]);

  const [step, setStep] = useState(1);
  const [done, setDone] = useState<{ staffName: string; email: string; first: string; when: string; count: string; dur: string; total: string; note: string; forms?: { names: string[]; url: string; ask: boolean }; ics?: string } | null>(null);
  const [acct, setAcct] = useState<Account | null>(p.account);
  const [au, setAuState] = useState<Au>(EMPTY_AU);
  const [save, setSave] = useState(false);
  const [savePw, setSavePw] = useState('');
  const [mk, setMk] = useState(false);
  const [bd, setBdState] = useState({ month: '', day: '' });
  const setBd = (v: Partial<{ month: string; day: string }>) => setBdState((b) => ({ ...b, ...v }));
  const [sel, setSel] = useState<string[]>(p.preselect ? [p.preselect] : []);
  const [cat, setCat] = useState('All');
  const [staff, setStaff] = useState(p.preStaff);
  const [nextAt, setNextAt] = useState<string | null>(null);
  useEffect(() => { let live = true; nextAvailable(p.slug, sel, staff && staff !== 'any' ? staff : undefined).then((l) => { if (live) setNextAt(l); }).catch(() => { if (live) setNextAt(null); }); return () => { live = false; }; }, [p.slug, sel, staff]);
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState('');
  const [slotMin, setSlotMin] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(formFor(p.account));
  const [hp, setHp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [wl, setWl] = useState<Wl>(EMPTY_WL);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [slotErr, setSlotErr] = useState('');
  const req = useRef(0);

  const list = [...p.services, ...p.addons].filter((s) => sel.includes(s.id));
  const totalDur = list.reduce((a, s) => a + s.dur, 0);
  const totalCents = list.reduce((a, s) => a + s.cents, 0);
  const member = p.team.find((t) => t.id === staff);
  // Only one person can do what was chosen (a solo salon, or one specialist): there is nobody to choose between, so that step is left out and they are picked.
  const mains = list.filter((s) => !p.addons.some((a) => a.id === s.id));
  const able = sel.length ? p.team.filter((t) => mains.every((s) => t.svc.includes(s.id))) : [];
  const lone = able.length === 1 ? able[0].id : null;
  const flow = lone ? [1, 3, 4] : [1, 2, 3, 4];
  useEffect(() => { if (lone && staff !== lone) setStaff(lone); }, [lone]); // eslint-disable-line react-hooks/exhaustive-deps
  const hoursToday = days[day] ? p.hours[days[day].dow] : null;

  useEffect(() => {
    setSlot(''); setSlotMin(null);
    if (!sel.length || !staff || !hoursToday) { setSlots([]); setLoading(false); setSlotErr(''); return; }
    const id = ++req.current; setLoading(true); setSlotErr('');
    publicSlots(p.slug, days[day].ymd, sel, staff).then((r) => { if (id !== req.current) return; setSlots(r.slots); setSlotErr(r.error ?? ''); setLoading(false); })
      .catch(() => { if (id !== req.current) return; setSlots([]); setSlotErr('Could not load times. Please try again.'); setLoading(false); });
  }, [p.slug, sel, staff, day, hoursToday ? 1 : 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const addonIds = useMemo(() => new Set(p.addons.map((a) => a.id)), [p.addons]);
  const offers = p.addons.filter((a) => a.parents.some((id) => sel.includes(id)));
  const toggle = (id: string) => {
    let next = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    // An extra only stays ticked while a service it goes with is still chosen.
    next = next.filter((x) => !addonIds.has(x) || p.addons.find((a) => a.id === x)!.parents.some((pid) => next.includes(pid)));
    const m = p.team.find((t) => t.id === staff);
    if (m && !next.filter((x) => !addonIds.has(x)).every((x) => m.svc.includes(x))) setStaff('');
    setSel(next);
  };
  // On the first step, back returns to the salon page instead of doing nothing.
  const back = () => { if (done) window.location.assign('/b/' + p.slug); else if (step > 1) { setStep(flow[Math.max(0, flow.indexOf(step) - 1)]); setError(''); } else window.location.assign('/b/' + p.slug); };
  // Every step starts at the top: the phone layout scrolls inside .bk-flow, the desktop layout scrolls the window.
  useEffect(() => { window.scrollTo(0, 0); document.querySelectorAll('.bk-flow').forEach((el) => { el.scrollTop = 0; }); }, [step, done]);
  const goStep = (n: number) => { if (n < step) { setStep(n); setError(''); } };
  const setField = (k: keyof Form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(''); };
  const setWlField = (k: 'name' | 'phone', v: string) => setWl((w) => ({ ...w, [k]: v, error: '' }));
  const reset = () => { setStep(1); setDone(null); setSel([]); setCat('All'); setStaff(''); setDay(0); setSlot(''); setSlotMin(null); setForm(formFor(acct)); setError(''); setCalOpen(false); setWl(EMPTY_WL); setSave(false); setSavePw(''); setMk(false); setBdState({ month: '', day: '' }); setAuState(EMPTY_AU); };
  const setAu = (v: Partial<Au>) => setAuState((a) => ({ ...a, ...v }));
  const openIn = () => setAu({ panel: 'in', error: '' });
  const closePanel = () => setAu({ panel: 'none', error: '', pw: '' });
  const submitIn = async () => {
    if (au.busy) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(au.email.trim())) { setAu({ error: 'Enter a valid email address.' }); return; }
    if (!au.pw) { setAu({ error: 'Enter your password.' }); return; }
    setAu({ busy: true, error: '' });
    try {
      const r = await clientSignIn({ slug: p.slug, email: au.email, password: au.pw });
      if (r.error || !r.account) { setAu({ busy: false, error: r.error ?? 'Email or password is incorrect.' }); return; }
      setAcct(r.account); setForm((f) => formFor(r.account ?? null, f.notes)); setSave(false); setSavePw(''); setError(''); setAuState(EMPTY_AU);
    } catch { setAu({ busy: false, error: 'Something went wrong. Please try again.' }); }
  };
  const signOutNow = async () => {
    try { await clientSignOut(); } catch { /* the session is cleared on the next load either way */ }
    setAcct(null); setForm((f) => formFor(null, f.notes)); setError(''); setAuState(EMPTY_AU);
  };

  const whenOf = (min: number) => days[day].full + ', ' + timeRange(clock12(min), clock12(min + totalDur));
  const countText = plural(list.length, 'service');
  const durText = duration(totalDur);

  const next = async () => {
    if (busy) return;
    if (step === 1 && !sel.length) return;
    if (step === 2 && !staff) return;
    if (step === 3 && !slot) return;
    if (step === 4) {
      if (!form.name.trim()) { setError('Please add your name.'); return; }
      if (!/\S+@\S+\.\S+/.test(form.email)) { setError('Please add a valid email so we can confirm your booking.'); return; }
      if (!(acct && acct.phone)) { const ph = checkPhone(form.phone, true); if (ph.error) { setError(ph.error); return; } }
      const wantsAccount = !acct && save;
      if (wantsAccount && savePw.length < 8) { setError('Choose a password with at least 8 characters.'); return; }
      setBusy(true);
      try {
        const r = await publicBook(p.slug, { services: sel, slot, name: form.name, email: form.email, phone: form.phone, notes: form.notes, website: hp, password: wantsAccount ? savePw : undefined, marketing: mk, birthday: mk && bd.month && bd.day ? { month: Number(bd.month), day: Number(bd.day) } : undefined });
        if (r.error) { setError(r.error); return; }
        const note = r.account === 'created' ? 'Your account is ready. Sign in next time to skip the details step.' : r.account === 'saved' ? 'Saved to your account.' : r.account === 'exists' ? 'You already have an account with this email. Sign in next time to skip the details step.' : '';
        if (r.account === 'created') setAcct({ name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() });
        else if (r.account === 'saved' && acct) setAcct({ ...acct, name: acct.name || form.name.trim(), phone: form.phone.trim() || acct.phone });
        setDone({ staffName: r.staffName || member?.name || 'The team', email: form.email.trim(), first: firstName(form.name), when: whenOf(slotMin ?? 0), count: countText, dur: durText, total: money(totalCents), note, forms: r.forms, ics: r.ics });
        setError('');
      } catch { setError('Something went wrong. Please try again.'); } finally { setBusy(false); }
      return;
    }
    setStep(flow[Math.min(flow.length - 1, flow.indexOf(step) + 1)]); setError('');
  };

  const submitWl = async () => {
    if (!wl.name.trim()) { setWl({ ...wl, error: 'Add your name.' }); return; }
    if (wl.phone.replace(/\D/g, '').length < 7) { setWl({ ...wl, error: 'Add a mobile number so we can reach you.' }); return; }
    const r = await publicWaitlist(p.slug, { name: wl.name, phone: wl.phone, serviceId: sel[0], staffId: staff }).catch(() => ({ error: 'Something went wrong. Please try again.' }));
    if (r.error) { setWl((w) => ({ ...w, error: r.error! })); return; }
    setWl({ open: false, done: true, name: '', phone: '', error: '' });
  };

  // Time grid: every half hour the salon is open, with the times that are not bookable crossed out.
  const grid = useMemo(() => {
    if (!hoursToday) return [] as number[];
    const set = new Set<number>(); for (let m = toMin(hoursToday.from); m < toMin(hoursToday.to); m += 30) set.add(m);
    for (const s of slots) set.add(s.min);
    return [...set].sort((a, b) => a - b);
  }, [hoursToday, slots]);
  const open = new Map(slots.map((s) => [s.min, s.key]));

  const calLinks = (() => {
    if (slotMin === null || !list.length) return { google: '#', outlook: '#', yahoo: '#' };
    const ymd = days[day].ymd.replace(/-/g, '');
    const hm = (m: number) => String(Math.floor(m / 60)).padStart(2, '0') + String(m % 60).padStart(2, '0');
    const iso = (m: number) => days[day].ymd + 'T' + hm(m).slice(0, 2) + ':' + hm(m).slice(2) + ':00';
    const a = slotMin, b = slotMin + totalDur;
    const title = list.map((x) => x.name).join(' + ') + ' at ' + p.name;
    const details = 'Booked with ' + (done?.staffName || member?.name || 'the team') + '. Total ' + money(totalCents) + ', pay at the salon.';
    const e = encodeURIComponent;
    return {
      google: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + e(title) + '&dates=' + ymd + 'T' + hm(a) + '00/' + ymd + 'T' + hm(b) + '00&ctz=' + e(p.tz) + '&details=' + e(details) + '&location=' + e(p.address),
      outlook: 'https://outlook.live.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=' + e(title) + '&startdt=' + iso(a) + '&enddt=' + iso(b) + '&body=' + e(details) + '&location=' + e(p.address),
      yahoo: 'https://calendar.yahoo.com/?v=60&title=' + e(title) + '&st=' + ymd + 'T' + hm(a) + '00&et=' + ymd + 'T' + hm(b) + '00&desc=' + e(details) + '&in_loc=' + e(p.address),
    };
  })();

  const canGo = (step === 1 && sel.length > 0) || (step === 2 && !!staff) || (step === 3 && !!slot) || step === 4;
  return { flow, p, nextAt, offers, acct, au, setAu, openIn, closePanel, submitIn, signOutNow, save, setSave, savePw, setSavePw, mk, setMk, bd, setBd, setError, days, money, step, done, sel, cat, setCat, staff, setStaff, day, setDay, slot, setSlot, slotMin, setSlotMin, form, setField, hp, setHp, error, busy, calOpen, setCalOpen, wl, setWl, setWlField, submitWl,
    slots, loading, slotErr, list, totalDur, totalCents, member, hoursToday, toggle, back, goStep, reset, next, whenOf, countText, durText, grid, open, calLinks, canGo };
}
type M = ReturnType<typeof useBooking>;

const Check = ({ size = 16, color = '#FFFFFF', w = 2.4 }: { size?: number; color?: string; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19 7.5" /></svg>
);
const Arrow = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>;

const circle = (on: boolean) => 'flex:0 0 32px;width:32px;height:32px;border-radius:999px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border:1.5px solid ' + (on ? '#0E1116' : '#D5D9E0') + ';background:' + (on ? '#0E1116' : '#FFFFFF');

type O = { rowH: number; rowPad: string; dayW: number; cols: string; btnH: number; mob: boolean };

function Steps({ m, o }: { m: M; o: O }) {
  const { p } = m;
  const rowStyle = (on: boolean) => 'display:flex;align-items:center;gap:16px;width:100%;box-sizing:border-box;min-height:' + o.rowH + 'px;padding:' + o.rowPad + ';border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;color:#0E1116;cursor:pointer;background:' + (on ? '#F8F9FB' : 'transparent');
  const closed = !m.hoursToday;
  const anyOk = m.slots.length > 0;
  const hasSlots = !closed && !m.loading && !m.slotErr && anyOk;
  const slotMessage = closed ? `We are closed on ${m.days[m.day].name}s. Pick another day.` : m.loading ? 'Checking availability…' : m.slotErr ? m.slotErr : 'No times left on this day. Try another day.';
  const { wl } = m;
  return <>
    {m.step === 1 && (
      <div className="bk-flow" style={S('display:flex;flex-direction:column;gap:16px')}>
        {m.sel.length > 0 && !!m.nextAt && <div role="status" style={S(`display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;border-radius:16px;background:${TONE.green.bg};color:${TONE.green.fg};padding:12px 16px;font-size:14px;font-weight:500`)}><span style={S(`width:8px;height:8px;border-radius:999px;background:${TONE.green.fg}`)}></span>Next available: {m.nextAt}</div>}
        <div role="group" className="hscroll" aria-label="Filter services" style={S('display:flex;gap:8px;overflow-x:auto')}>
          {['All', ...p.cats].map((c) => <button key={c} onClick={() => m.setCat(c)} aria-pressed={m.cat === c} style={S(filterChipCss(m.cat === c, o.mob))}>{c === 'All' ? 'All services' : c}</button>)}
        </div>
        <ul className="bk-list" style={S('margin:0;padding:0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
          {p.services.filter((s) => m.cat === 'All' || s.cat === m.cat).map((s) => {
            const on = m.sel.includes(s.id);
            return <li key={s.id}>
              <button onClick={() => m.toggle(s.id)} aria-pressed={on} aria-label={`${s.name}, ${duration(s.dur)}, ${m.money(s.cents)}`} style={S(rowStyle(on))}>
                <span style={S('flex:1 1 auto;min-width:0')}>
                  <span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{s.name}</span>
                  <span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{s.desc}</span>
                  <span style={S('display:block;margin-top:4px;font-size:13px;color:#5E6673')}>{duration(s.dur)}</span>
                </span>
                <span style={S('flex:0 0 auto;font-size:15px;font-weight:600')}>{m.money(s.cents)}</span>
                <span style={S(circle(on))}>
                  {on && <Check />}
                  {!on && <Icon name="plus" color="#0E1116" />}
                </span>
              </button>
            </li>;
          })}
        </ul>
        {m.offers.length > 0 && (
          <div style={S('display:flex;flex-direction:column;gap:10px')}>
            <h2 style={S('margin:0;font-size:16px;font-weight:600')}>Add an extra</h2>
            <ul className="bk-list" style={S('margin:0;padding:0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
              {m.offers.map((s) => {
                const on = m.sel.includes(s.id);
                return <li key={s.id}>
                  <button onClick={() => m.toggle(s.id)} aria-pressed={on} aria-label={`${s.name}, add ${duration(s.dur)}, ${m.money(s.cents)}`} style={S(rowStyle(on))}>
                    <span style={S('flex:1 1 auto;min-width:0')}>
                      <span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{s.name}</span>
                      {!!s.desc && <span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{s.desc}</span>}
                      <span style={S('display:block;margin-top:4px;font-size:13px;color:#5E6673')}>+{duration(s.dur)}</span>
                    </span>
                    <span style={S('flex:0 0 auto;font-size:15px;font-weight:600')}>+{m.money(s.cents)}</span>
                    <span style={S(circle(on))}>
                      {on && <Check />}
                      {!on && <Icon name="plus" color="#0E1116" />}
                    </span>
                  </button>
                </li>;
              })}
            </ul>
          </div>
        )}
      </div>
    )}

    {m.step === 2 && m.sel.length > 0 && !!m.nextAt && <div role="status" style={S(`display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;margin-bottom:16px;border-radius:16px;background:${TONE.green.bg};color:${TONE.green.fg};padding:12px 16px;font-size:14px;font-weight:500`)}><span style={S(`flex:0 0 8px;width:8px;height:8px;border-radius:999px;background:${TONE.green.fg}`)}></span>{(m.staff && m.staff !== 'any' ? 'Next available with ' + firstName(p.team.find((x) => x.id === m.staff)?.name, 'them') : 'Next available') + ': ' + m.nextAt}</div>}
    {m.step === 2 && (
      <ul className="bk-flow bk-list" style={S('margin:0;padding:0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
        {[{ id: 'any', name: 'Any team member', role: 'Best available time', svc: null as string[] | null }, ...p.team].map((t) => {
          const bad = t.svc ? m.list.find((s) => !p.addons.some((a) => a.id === s.id) && !t.svc!.includes(s.id)) : null;
          const on = m.staff === t.id;
          return <li key={t.id}>
            <button onClick={() => { if (!bad) m.setStaff(t.id); }} aria-pressed={on} aria-disabled={!!bad} aria-label={t.name + ', ' + (bad ? "doesn't offer " + bad.name : t.role)} style={S(rowStyle(on) + (bad ? ';cursor:default' : ''))}>
              <Avatar name={t.name} photo={'photo' in t ? t.photo : null} size="lg" icon={t.id === 'any' ? ANY_ICON : undefined} />
              <span style={S('flex:1 1 auto;min-width:0;color:' + (bad ? '#8A93A0' : '#0E1116'))}>
                <span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{t.name}</span>
                <span style={S('display:block;margin-top:2px;font-size:13px;overflow-wrap:anywhere')}>{bad ? "Doesn't offer " + bad.name : t.role}</span>
              </span>
              <span style={S(circle(on))}>{on && <Check />}</span>
            </button>
          </li>;
        })}
      </ul>
    )}

    {m.step === 3 && (
      <div className="bk-flow" style={S('display:flex;flex-direction:column;gap:20px')}>
        <DayStrip days={m.days.map((d) => ({ ymd: d.ymd, abbr: d.abbr, num: d.num, month: d.month, full: d.full, closed: !p.hours[d.dow] }))} selected={m.days[m.day].ymd} onPick={(ymd) => m.setDay(m.days.findIndex((d) => d.ymd === ymd))} width={o.dayW} pickClosed label="Choose a day" />
        <div style={S('background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px;display:flex;flex-direction:column;gap:16px')}>
          <h2 style={S('margin:0;font-size:16px;font-weight:600')}>{m.days[m.day].full}</h2>
          {hasSlots && (
            <TimeGrid times={m.grid.map((min) => ({ min, ok: !!m.open.get(min) }))} selected={m.grid.find((min) => m.open.get(min) === m.slot) ?? null} onPick={(min) => { m.setSlot(m.open.get(min)!); m.setSlotMin(min); }} cols={o.cols} label="Available times" />
          )}
          {!hasSlots && <Note>{slotMessage}</Note>}
          <div style={S('border-top:1px solid #EEF0F3;padding-top:16px;display:flex;flex-direction:column;gap:12px')}>
            {!wl.open && !wl.done && m.sel.length > 0 && <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px')}><span style={S('flex:1 1 200px;font-size:14px;color:#5E6673')}>Cannot find a time that suits?</span><button className="ghost" onClick={() => m.setWl({ ...wl, open: true, error: '' })} style={S(OUTLINE + ';flex:0 0 auto;height:44px;padding:0 20px')}>Join the waitlist</button></div>}
            {wl.open && (
              <div style={S('display:flex;flex-direction:column;gap:12px')}>
                <span style={S('font-size:15px;font-weight:600')}>Join the waitlist</span>
                <span style={S('font-size:13.5px;color:#5E6673')}>We will message you if a time opens up for your services.</span>
                <LabelledField id="wl-n" label="Full name"><input id="wl-n" className="bkf" type="text" value={wl.name} onChange={(e) => m.setWlField('name', e.target.value)} placeholder="Your name" style={S(INPUT)} /></LabelledField>
                <LabelledField id="wl-p" label="Mobile number"><input id="wl-p" className="bkf" type="tel" value={wl.phone} onChange={(e) => m.setWlField('phone', phoneInput(e.target.value))} placeholder="Your number" style={S(INPUT)} /></LabelledField>
                {!!wl.error && <FieldError>{wl.error}</FieldError>}
                <div style={S('display:flex;gap:10px')}><button onClick={m.submitWl} style={S(BLACK)}>Join waitlist</button><button className="ghost" onClick={() => m.setWl({ ...wl, open: false, error: '' })} style={S(OUTLINE)}>Cancel</button></div>
              </div>
            )}
            {wl.done && <Notice>You are on the waitlist. We will message you if a time opens up.</Notice>}
          </div>
        </div>
      </div>
    )}

    {m.step === 4 && (
      <div className="bk-flow" style={S('position:relative;display:flex;flex-direction:column;gap:18px;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px')}>
        <input tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={m.hp} onChange={(e) => m.setHp(e.target.value)} style={S('position:absolute;left:-9999px;width:1px;height:1px;min-height:0;padding:0;opacity:0')} />
        {!m.acct && m.au.panel === 'none' && (
          <div style={S(o.mob ? 'display:flex;flex-direction:column;align-items:stretch;gap:12px;padding:16px;border-radius:16px;background:#F4F5F7' : 'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px;padding:14px 16px;border-radius:16px;background:#F4F5F7')}>
            <span style={S(o.mob ? 'font-size:14px;line-height:1.45;color:#5E6673' : 'flex:1 1 220px;font-size:14px;color:#5E6673')}>Have an account? Sign in to use your saved details.</span>
            <button className="ghost" onClick={m.openIn} style={S(OUTLINE + ';flex:0 0 auto;height:' + (o.mob ? 52 : 44) + 'px;padding:0 20px')}>Sign in</button>
          </div>
        )}
        {!m.acct && m.au.panel === 'in' && (
          <div role="group" aria-label="Sign in" style={S('display:flex;flex-direction:column;gap:14px;padding:20px;border-radius:20px;background:#F4F5F7')}>
            <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 12px')}><span style={S('font-size:16px;font-weight:600')}>Sign in</span><button className="ghost" onClick={m.closePanel} style={S('min-height:44px;padding:0 14px;border:0;border-radius:999px;background:transparent;color:#5E6673;font-size:14px;font-weight:500')}>Continue as guest</button></div>
            <LabelledField id="ac-email" label="Email"><input id="ac-email" className="bkf" type="email" value={m.au.email} onChange={(e) => m.setAu({ email: e.target.value, error: '' })} placeholder="you@example.com" autoComplete="email" style={S(INPUT)} /></LabelledField>
            <LabelledField id="ac-pw" label="Password">
              <PasswordInput id="ac-pw" value={m.au.pw} onChange={(v) => m.setAu({ pw: v, error: '' })} show={m.au.show} onToggle={() => m.setAu({ show: !m.au.show })} placeholder="Password" autoComplete="current-password" onEnter={() => m.submitIn()} />
            </LabelledField>
            {!!m.au.error && <FieldError>{m.au.error}</FieldError>}
            <button onClick={m.submitIn} disabled={m.au.busy} style={S(BLACK + ';flex:0 0 auto' + dim(m.au.busy))}>{m.au.busy ? 'Signing in…' : 'Sign in'}</button>
          </div>
        )}
        {m.acct && (
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:14px 16px;border-radius:16px;background:#F4F5F7')}>
            <Avatar name={m.acct.name || m.acct.email} size="lg" tone={INK} />
            <div style={S('flex:1 1 140px;min-width:0')}><div style={S('font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{m.acct.name || m.acct.email}</div><div style={S('font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{m.acct.email}</div></div>
          </div>
        )}
        {m.acct && !m.acct.name && (
          <LabelledField id="bk-name" label="Full name"><input id="bk-name" className="bkf" type="text" autoComplete="name" value={m.form.name} onChange={(e) => m.setField('name', e.target.value)} placeholder="Your name" style={S(INPUT)} /></LabelledField>
        )}
        {!m.acct && m.au.panel === 'none' && <>
          <LabelledField id="bk-name" label="Full name"><input id="bk-name" className="bkf" type="text" autoComplete="name" value={m.form.name} onChange={(e) => m.setField('name', e.target.value)} placeholder="Your name" style={S(INPUT)} /></LabelledField>
          <LabelledField id="bk-email" label="Email"><input id="bk-email" className="bkf" type="email" autoComplete="email" value={m.form.email} onChange={(e) => m.setField('email', e.target.value)} placeholder="you@example.com" style={S(INPUT)} /></LabelledField>
        </>}
        {!(m.acct && m.acct.phone) && <LabelledField id="bk-phone" label="Phone"><input id="bk-phone" className="bkf" type="tel" inputMode="tel" autoComplete="tel" value={m.form.phone} onChange={(e) => m.setField('phone', phoneInput(e.target.value))} placeholder="Required" style={S(INPUT)} /></LabelledField>}
        <LabelledField id="bk-notes" label="Notes for the salon">
          <textarea id="bk-notes" className="bkf" value={m.form.notes} onChange={(e) => m.setField('notes', e.target.value)} placeholder="Optional" style={S(TEXTAREA + ';min-height:96px;resize:none')} />
        </LabelledField>
        <div style={S('display:flex;flex-direction:column;gap:14px;padding:16px;border:1px solid #E6E8EC;border-radius:18px')}>
          <button type="button" role="checkbox" aria-checked={m.mk} onClick={() => m.setMk(!m.mk)} style={S('display:flex;align-items:flex-start;gap:12px;min-height:44px;padding:0;border:0;background:transparent;text-align:left;font:inherit;color:#0E1116')}>
            <span style={S('flex:0 0 22px;width:22px;height:22px;margin-top:1px;border-radius:7px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border:1.5px solid ' + (m.mk ? '#0E1116' : '#D5D9E0') + ';background:' + (m.mk ? '#0E1116' : '#FFFFFF'))}>{m.mk && <Check size={14} w={3} />}</span>
            <span><span style={S('display:block;font-size:14px;font-weight:600')}>Send me offers and news</span><span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673')}>An occasional email from {m.p.name}. You can unsubscribe at any time.</span></span>
          </button>
          {m.mk && (
            <LabelledField id="bk-bd-day" label="Birthday (optional)">
              <div style={S('display:flex;gap:10px')}>
                <select id="bk-bd-day" className="bkf" aria-label="Birthday day" value={m.bd.day} onChange={(e) => m.setBd({ day: e.target.value })} style={S(INPUT + ';flex:0 0 88px')}><option value="">Day</option>{Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select>
                <select className="bkf" aria-label="Birthday month" value={m.bd.month} onChange={(e) => m.setBd({ month: e.target.value })} style={S(INPUT + ';flex:1 1 auto;min-width:0')}><option value="">Month</option>{MONTHS_FULL.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select>
              </div>
            </LabelledField>
          )}
        </div>
        {!m.acct && m.au.panel === 'none' && (
          <div style={S('display:flex;flex-direction:column;gap:14px;padding:16px;border:1px solid #E6E8EC;border-radius:18px')}>
            <button type="button" role="checkbox" aria-checked={m.save} onClick={() => { m.setSave(!m.save); m.setError(''); }} style={S('display:flex;align-items:flex-start;gap:12px;min-height:44px;padding:0;border:0;background:transparent;text-align:left;font:inherit;color:#0E1116')}>
              <span style={S('flex:0 0 22px;width:22px;height:22px;margin-top:1px;border-radius:7px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border:1.5px solid ' + (m.save ? '#0E1116' : '#D5D9E0') + ';background:' + (m.save ? '#0E1116' : '#FFFFFF'))}>{m.save && <Check size={14} w={3} />}</span>
              <span><span style={S('display:block;font-size:14px;font-weight:600')}>Save my details for next time</span><span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673')}>Create an account so you can skip this step on your next booking.</span></span>
            </button>
            {m.save && (
              <LabelledField id="bk-pw" label="Choose a password">
                <PasswordInput id="bk-pw" value={m.savePw} onChange={(v) => { m.setSavePw(v); m.setError(''); }} show={m.au.show} onToggle={() => m.setAu({ show: !m.au.show })} placeholder="At least 8 characters" autoComplete="new-password" />
              </LabelledField>
            )}
          </div>
        )}
        <p style={S('margin:0;font-size:13px;color:#5E6673')}>You pay at the salon after your appointment.</p>
        {!p.autoConfirm && <p style={S('margin:0;font-size:13px;color:#5E6673')}>{m.p.emailOn ? 'The salon will confirm your request by email.' : 'The salon will confirm your request.'}</p>}
        {!!m.error && <FieldError>{m.error}</FieldError>}
      </div>
    )}
  </>;
}

const HINTS = ['Choose at least one service to continue.', 'Choose who you would like to see.', 'Pick a day and a time.', ''];
const primaryLabel = (m: M) => m.busy ? (m.p.autoConfirm ? 'Booking…' : 'Sending…') : m.step === 4 ? (m.p.autoConfirm ? 'Confirm booking' : 'Request booking') : 'Continue';
const primaryStyle = (m: M) => BLACK + ';flex:0 0 auto;width:100%' + dim(!m.canGo || m.busy);

function DoneNote({ m }: { m: M }) {
  const n = m.done?.note, f = m.done?.forms;
  if (!n && !f) return null;
  return (<>
    {n && <div role="status" style={S('box-sizing:border-box;padding:18px 20px;border-radius:24px;background:#0E1116;color:#FFFFFF;font-size:15px;font-weight:500;line-height:1.4')}>{n}</div>}
    {f && (
      <div role="status" style={S('box-sizing:border-box;padding:20px;border-radius:24px;background:' + TONE.purple.bg + ';color:' + TONE.purple.fg + ';display:flex;flex-direction:column;gap:10px')}>
        <div style={S('font-size:16px;font-weight:600')}>{f.ask ? 'One more thing before your visit' : 'Forms for your visit'}</div>
        <p style={S('margin:0;font-size:14.5px;line-height:1.45;overflow-wrap:anywhere')}>{f.ask ? `Please complete ${f.names.join(' and ')} now. It takes about two minutes.` : `Please complete ${f.names.join(' and ')} before your visit.${m.p.emailOn ? ' We have also emailed you the link.' : ''}`}</p>
        <a href={f.url} style={S(BLACK + ';flex:0 0 auto;align-self:flex-start;padding:0 24px')}>Complete your form</a>
      </div>
    )}
  </>);
}

function DoneCard({ m, wide = false }: { m: M; wide?: boolean }) {
  const d = m.done!;
  const row = (k: string, v: string, last = false, bold = false) => <div style={S(KV_ROW + (last ? ';border-bottom:1px solid #EEF0F3' : ''))}><dt style={S('color:#5E6673')}>{k}</dt><dd style={S('margin:0;font-weight:' + (bold ? 600 : 500) + ';text-align:right' + (k === 'With' ? ';overflow-wrap:anywhere' : ''))}>{v}</dd></div>;
  const booked = m.p.autoConfirm;
  return (
    <div role="status" style={S(wide ? 'display:flex;flex-wrap:wrap;align-items:center;gap:32px 56px;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:40px' : 'display:flex;flex-direction:column;gap:20px;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:28px')}>
      <div style={S(wide ? 'flex:1 1 380px;min-width:0;display:flex;flex-direction:column;gap:20px' : 'display:contents')}>
      <div style={S('flex:0 0 56px;width:56px;height:56px;border-radius:999px;background:' + TONE.green.bg + ';display:flex;align-items:center;justify-content:center')}><Check size={26} color={TONE.green.fg} w={2.2} /></div>
      <div>
        <h1 style={S('margin:0;font-size:30px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;overflow-wrap:anywhere')}>{booked ? `You're booked, ${d.first}` : `Request sent, ${d.first}`}</h1>
        <p style={S('margin:8px 0 0;color:#5E6673;font-size:15px;overflow-wrap:anywhere')}>{booked ? (m.p.emailOn ? `We've sent the details to ${d.email}.` : 'Your booking is confirmed. Keep these details handy.') : (m.p.emailOn ? `We'll email ${d.email} once the salon confirms.` : 'The salon will confirm your request soon.')}</p>
      </div>
      {wide && <DoneActions m={m} />}
      </div>
      <div style={S(wide ? 'flex:1 1 380px;min-width:0' : 'display:contents')}>
      <dl style={S('margin:0;display:flex;flex-direction:column')}>
        {row('When', d.when)}{row('With', d.staffName)}{row('Services', `${d.count}, ${d.dur}`)}{row('Total to pay at the salon', d.total, true, true)}
      </dl>
      </div>
      {!wide && <DoneActions m={m} />}
    </div>
  );
}

function DoneActions({ m }: { m: M }) {
  const d = m.done!;
  return (
    <>
      <div style={S('display:flex;gap:10px')}>
        <button onClick={m.reset} style={S(BLACK)}>Book again</button>
        <button className="ghost" onClick={() => m.setCalOpen(!m.calOpen)} aria-expanded={m.calOpen} aria-haspopup="menu" style={S(OUTLINE)}>Add to calendar</button>
      </div>
      <a href={'/b/' + m.p.slug} style={S(OUTLINE + ';flex:0 0 auto')}>Back to {m.p.name}</a>
      {m.calOpen && (
        <div role="menu" aria-label="Add to calendar" style={S('display:flex;flex-direction:column;border:1px solid #E6E8EC;border-radius:18px;overflow:hidden;background:#FFFFFF')}>
          {([...(d.ics ? [['Apple Calendar or file', d.ics, true]] : []), ['Google Calendar', m.calLinks.google, false], ['Outlook', m.calLinks.outlook, false], ['Yahoo Calendar', m.calLinks.yahoo, false]] as [string, string, boolean][]).map(([l, h, file], i, all) => (
            <a key={l} role="menuitem" href={h} {...(file ? { download: 'appointment.ics' } : { target: '_blank', rel: 'noopener noreferrer' })} style={S('display:flex;align-items:center;justify-content:space-between;min-height:52px;box-sizing:border-box;padding:0 16px;color:#0E1116;text-decoration:none;font-size:14.5px;font-weight:500' + (i < all.length - 1 ? ';border-bottom:1px solid #EEF0F3' : ''))}>{l}<Arrow /></a>
          ))}
        </div>
      )}
    </>
  );
}

function Desktop({ m }: { m: M }) {
  const { p } = m;
  const o: O = { rowH: 88, rowPad: '16px 24px', dayW: 84, cols: 'repeat(auto-fill,minmax(92px,1fr))', btnH: 48, mob: false };
  const t = p.hours[m.days[0].dow];
  const pillOn = !!t && p.nowMin < toMin(t.to);
  const pill = pillOn ? 'Open today until ' + clockStr(t!.to) : t ? 'Closed for today' : 'Closed today';
  const hasWhen = m.slotMin !== null;
  return (
    <div style={S('max-width:1180px;margin:0 auto;box-sizing:border-box;padding:24px 32px 56px;display:flex;flex-direction:column;gap:28px')}>
      <header style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px')}>
        <div style={S('display:flex;align-items:center;gap:12px')}>
          <button className="ghost" onClick={m.back} aria-label={m.step <= 1 ? `Back to ${p.name}` : 'Back to previous step'} style={S(RING)}>{BACK}</button>
          <div>
            <a href={'/b/' + p.slug} style={S('display:block;font-size:17px;font-weight:600;letter-spacing:-0.01em;color:#0E1116;text-decoration:none')}>{p.name}</a>
            <div style={S('font-size:13px;color:#5E6673')}>Online booking</div>
          </div>
        </div>
        <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px')}>
          {m.acct && (
            <div style={S('display:flex;align-items:center;gap:8px;min-height:44px;box-sizing:border-box;padding:0 6px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF')}>
              <Avatar name={m.acct.name || m.acct.email} size="xs" tone={INK} />
              <span style={S('font-size:14px;font-weight:500')}>{firstOf(m.acct)}</span>
              <button className="ghost" onClick={m.signOutNow} style={S('height:32px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:#5B3DF5;font-size:13px;font-weight:600')}>Sign out</button>
            </div>
          )}
          <Chip tone={pillOn ? 'green' : 'grey'}>{pill}</Chip>
        </div>
      </header>

      {!m.done && <>
        <nav aria-label="Booking steps">
          <ol style={S('margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:12px 28px')}>
            {m.flow.map((n, i) => {
              const l = LABELS[n - 1]; const cur = m.step === n; const past = n < m.step;
              return <li key={l}>
                <button onClick={() => m.goStep(n)} disabled={!past} aria-label={`Step ${i + 1}, ${l}` + (cur ? ', current step' : past ? ', completed' : '')} style={S('display:flex;align-items:center;gap:10px;min-height:44px;padding:0;border:0;background:transparent;font:inherit')}>
                  <span style={S('flex:0 0 28px;width:28px;height:28px;box-sizing:content-box;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;background:' + (cur ? '#0E1116' : past ? TONE.green.bg : '#FFFFFF') + ';color:' + (cur ? '#FFFFFF' : past ? TONE.green.fg : '#5E6673') + ';border:1px solid ' + (cur ? '#0E1116' : past ? TONE.green.bg : '#E1E4E9'))}>{i + 1}</span>
                  <span style={S('font-size:14px;font-weight:' + (cur ? 600 : 500) + ';color:' + (cur ? '#0E1116' : '#5E6673'))}>{l}</span>
                </button>
              </li>;
            })}
          </ol>
        </nav>

        <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:24px')}>
          <div className="bk-flow" style={S('flex:999 1 400px;min-width:0;display:flex;flex-direction:column;gap:20px')}>
            <h1 style={S('margin:0;font-size:34px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{TITLES[m.step - 1]}</h1>
            <Steps m={m} o={o} />
          </div>
          <aside aria-label="Your booking" style={S('flex:1 1 320px;max-width:380px;min-width:0;position:sticky;top:24px;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:18px')}>
            <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Your booking</h2>
            {!m.list.length && <Note>No services yet. Add one from the list.</Note>}
            {!!m.list.length && (
              <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column')}>
                {m.list.map((l) => (
                  <li key={l.id} style={S('display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}>
                    <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;overflow-wrap:anywhere')}>{l.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{duration(l.dur)}</span></span>
                    <span style={S('flex:0 0 auto;font-size:14.5px;font-weight:600')}>{m.money(l.cents)}</span>
                    <button className="ghost" onClick={() => m.toggle(l.id)} aria-label={'Remove ' + l.name} style={S('flex:0 0 44px;width:44px;height:44px;padding:0;border:0;border-radius:999px;background:transparent;display:flex;align-items:center;justify-content:center')}><Icon name="close" color="#5E6673" /></button>
                  </li>
                ))}
              </ul>
            )}
            <dl style={S('margin:0;display:flex;flex-direction:column')}>
              {(m.staff ? true : false) && <div style={S(KV_ROW)}><dt style={S('color:#5E6673')}>With</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{m.member ? m.member.name : 'Any team member'}</dd></div>}
              {hasWhen && <div style={S(KV_ROW)}><dt style={S('color:#5E6673')}>When</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{m.whenOf(m.slotMin!)}</dd></div>}
              <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:14px 0;border-top:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Total, {m.durText}</dt><dd style={S('margin:0;font-size:22px;font-weight:600;letter-spacing:-0.02em')}>{m.money(m.totalCents)}</dd></div>
            </dl>
            <div style={S('display:flex;flex-direction:column;gap:10px')}>
              <button onClick={m.next} disabled={!m.canGo || m.busy} style={S(primaryStyle(m))}>{primaryLabel(m)}</button>
              {!m.canGo && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:13px')}>{HINTS[m.step - 1]}</p>}
            </div>
          </aside>
        </div>
      </>}

      {m.done && <div style={S('width:100%;margin:0;box-sizing:border-box;display:flex;flex-direction:column;gap:16px')}><DoneNote m={m} /><DoneCard m={m} wide /></div>}
    </div>
  );
}

function Mobile({ m }: { m: M }) {
  const { p } = m;
  const o: O = { rowH: 80, rowPad: '14px 16px', dayW: 60, cols: 'repeat(4,minmax(0,1fr))', btnH: 48, mob: true };
  if (m.done) return (
    <div className="bk-flow" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:28px 20px 20px;display:flex;flex-direction:column;gap:20px')}>
      <div style={S('display:flex;align-items:center;gap:12px')}><a href={'/b/' + p.slug} style={S('font-size:17px;font-weight:600;color:#0E1116;text-decoration:none;display:inline-flex;align-items:center;min-height:44px')}>{p.name}</a></div>
      <DoneNote m={m} />
      <DoneCard m={m} />
    </div>
  );
  return <>
    <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px')}>
      <button className="ghost" onClick={m.back} aria-label={m.step <= 1 ? `Back to ${p.name}` : 'Back to previous step'} style={S(RING)}>{BACK}</button>
      <div style={S('flex:1 1 auto;min-width:0')}>
        <div style={S('font-size:13px;color:#5E6673')}>{p.name}, Step {m.flow.indexOf(m.step) + 1} of {m.flow.length}</div>
        <h1 style={S('margin:0;font-size:20px;line-height:1.2;font-weight:600;letter-spacing:-0.02em')}>{TITLES[m.step - 1]}</h1>
      </div>
    </header>
    <div style={S('flex:0 0 auto;margin:0 20px 16px;height:4px;border-radius:999px;background:#E1E4E9;overflow:hidden')}><div style={S('height:100%;border-radius:999px;background:#0E1116;width:' + ((m.flow.indexOf(m.step) + 1) / m.flow.length) * 100 + '%')}></div></div>
    <main className="bk-flow" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
      <Steps m={m} o={o} />
    </main>
    <div style={S('flex:0 0 auto;box-sizing:border-box;padding:12px 20px 24px;background:#FFFFFF;border-top:1px solid #E6E8EC;display:flex;flex-direction:column;gap:10px')}>
      <div style={S('display:flex;align-items:baseline;justify-content:space-between;gap:12px')}>
        <span style={S('color:#5E6673;font-size:13.5px')}>{m.countText}, {m.durText}</span>
        <span style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{m.money(m.totalCents)}</span>
      </div>
      <button onClick={m.next} disabled={!m.canGo || m.busy} style={S(primaryStyle(m))}>{primaryLabel(m)}</button>
      {!m.canGo && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:13px')}>{HINTS[m.step - 1]}</p>}
    </div>
  </>;
}

export function BookingView(p: Props) {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => { const mq = window.matchMedia('(max-width:900px)'); const f = () => setNarrow(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  const m = useBooking(p);
  return <>
    {narrow !== false && <div className="only-m m-cal cal-root bk-app" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}><Mobile m={m} /></div>}
    {narrow !== true && <div className="only-d d-cal cal-root bk-app" style={S("box-sizing:border-box;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;min-height:100vh")}><Desktop m={m} /></div>}
  </>;
}
