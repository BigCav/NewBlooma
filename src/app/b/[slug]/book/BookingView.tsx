'use client';
// 1:1 conversion of the prototype's Booking.dc.html and MobileBooking.dc.html (the public online booking flow).
// Markup and style strings are kept as written; the {{ }} holes are the salon's real data and the handlers are real server actions.
import { useEffect, useMemo, useRef, useState } from 'react';
import { S } from '../../../(dash)/calendar/pickers';
import { publicBook, publicSlots, publicWaitlist, type Slot } from './actions';

type Svc = { id: string; name: string; desc: string; cat: string; dur: number; cents: number };
type Member = { id: string; name: string; role: string; svc: string[] };
type Props = {
  slug: string; name: string; address: string; tz: string; currency: string;
  services: Svc[]; cats: string[]; team: Member[]; hours: ({ from: string; to: string } | null)[];
  today: string; nowMin: number; autoConfirm: boolean; preselect: string;
};

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAME = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TITLES = ['Choose your services', 'Choose a professional', 'Pick a date and time', 'Your details'];
const LABELS = ['Services', 'Professional', 'Time', 'Details'];
const hhmm = (m: number) => Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
const fmtDur = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return h ? h + ' hr' + (r ? ' ' + r + ' min' : '') : m + ' min'; };
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const initialsOf = (n: string) => n.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

type Form = { name: string; email: string; phone: string; notes: string };
type Wl = { open: boolean; done: boolean; name: string; phone: string; error: string };
const EMPTY_FORM: Form = { name: '', email: '', phone: '', notes: '' };
const EMPTY_WL: Wl = { open: false, done: false, name: '', phone: '', error: '' };

function useBooking(p: Props) {
  const days = useMemo(() => {
    const [y, mo, d] = p.today.split('-').map(Number);
    return Array.from({ length: 28 }, (_, i) => {
      const dt = new Date(Date.UTC(y, mo - 1, d + i));
      const wd = dt.getUTCDay();
      return {
        ymd: dt.toISOString().slice(0, 10), abbr: DAY_ABBR[wd], num: dt.getUTCDate(), month: MONTH_ABBR[dt.getUTCMonth()], dow: (wd + 6) % 7, name: DAY_NAME[wd],
        full: DAY_NAME[wd] + ' ' + dt.getUTCDate() + ' ' + MONTH_NAME[dt.getUTCMonth()],
      };
    });
  }, [p.today]);
  const cur = useMemo(() => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: p.currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0, maximumFractionDigits: 2 }), [p.currency]);
  const money = (cents: number) => cur.format(cents / 100);

  const [step, setStep] = useState(1);
  const [done, setDone] = useState<{ staffName: string; email: string; first: string; when: string; count: string; dur: string; total: string } | null>(null);
  const [sel, setSel] = useState<string[]>(p.preselect ? [p.preselect] : []);
  const [cat, setCat] = useState('All');
  const [staff, setStaff] = useState('');
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState('');
  const [slotMin, setSlotMin] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [hp, setHp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [wl, setWl] = useState<Wl>(EMPTY_WL);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [slotErr, setSlotErr] = useState('');
  const req = useRef(0);

  const list = p.services.filter((s) => sel.includes(s.id));
  const totalDur = list.reduce((a, s) => a + s.dur, 0);
  const totalCents = list.reduce((a, s) => a + s.cents, 0);
  const member = p.team.find((t) => t.id === staff);
  const hoursToday = days[day] ? p.hours[days[day].dow] : null;

  useEffect(() => {
    setSlot(''); setSlotMin(null);
    if (!sel.length || !staff || !hoursToday) { setSlots([]); setLoading(false); setSlotErr(''); return; }
    const id = ++req.current; setLoading(true); setSlotErr('');
    publicSlots(p.slug, days[day].ymd, sel, staff).then((r) => { if (id !== req.current) return; setSlots(r.slots); setSlotErr(r.error ?? ''); setLoading(false); })
      .catch(() => { if (id !== req.current) return; setSlots([]); setSlotErr('Could not load times. Please try again.'); setLoading(false); });
  }, [p.slug, sel, staff, day, hoursToday ? 1 : 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => {
    const next = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    const m = p.team.find((t) => t.id === staff);
    if (m && !next.every((x) => m.svc.includes(x))) setStaff('');
    setSel(next);
  };
  const back = () => { if (step > 1) { setStep(step - 1); setError(''); } };
  const goStep = (n: number) => { if (n < step) { setStep(n); setError(''); } };
  const setField = (k: keyof Form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(''); };
  const setWlField = (k: 'name' | 'phone', v: string) => setWl((w) => ({ ...w, [k]: v, error: '' }));
  const reset = () => { setStep(1); setDone(null); setSel([]); setCat('All'); setStaff(''); setDay(0); setSlot(''); setSlotMin(null); setForm(EMPTY_FORM); setError(''); setCalOpen(false); setWl(EMPTY_WL); };

  const whenOf = (min: number) => days[day].full + ', ' + hhmm(min) + ' to ' + hhmm(min + totalDur);
  const countText = list.length + (list.length === 1 ? ' service' : ' services');
  const durText = totalDur ? fmtDur(totalDur) : '0 min';

  const next = async () => {
    if (busy) return;
    if (step === 1 && !sel.length) return;
    if (step === 2 && !staff) return;
    if (step === 3 && !slot) return;
    if (step === 4) {
      if (!form.name.trim()) { setError('Please add your name.'); return; }
      if (!/\S+@\S+\.\S+/.test(form.email)) { setError('Please add a valid email so we can confirm your booking.'); return; }
      setBusy(true);
      try {
        const r = await publicBook(p.slug, { services: sel, slot, name: form.name, email: form.email, phone: form.phone, notes: form.notes, website: hp });
        if (r.error) { setError(r.error); return; }
        setDone({ staffName: r.staffName || member?.name || 'The team', email: form.email.trim(), first: form.name.trim().split(' ')[0] || 'there', when: whenOf(slotMin ?? 0), count: countText, dur: durText, total: money(totalCents) });
        setError('');
      } catch { setError('Something went wrong. Please try again.'); } finally { setBusy(false); }
      return;
    }
    setStep(step + 1); setError('');
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
  return { p, days, money, step, done, sel, cat, setCat, staff, setStaff, day, setDay, slot, setSlot, slotMin, setSlotMin, form, setField, hp, setHp, error, busy, calOpen, setCalOpen, wl, setWl, setWlField, submitWl,
    slots, loading, slotErr, list, totalDur, totalCents, member, hoursToday, toggle, back, goStep, reset, next, whenOf, countText, durText, grid, open, calLinks, canGo };
}
type M = ReturnType<typeof useBooking>;

const Check = ({ size = 16, color = '#FFFFFF', w = 2.4 }: { size?: number; color?: string; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19 7.5" /></svg>
);
const Arrow = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>;

const INPUT = 'box-sizing:border-box;width:100%;height:48px;min-height:0;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF';
const circle = (on: boolean) => 'flex:0 0 32px;width:32px;height:32px;border-radius:999px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border:1.5px solid ' + (on ? '#0E1116' : '#D5D9E0') + ';background:' + (on ? '#0E1116' : '#FFFFFF');

type O = { rowH: number; rowPad: string; dayW: number; cols: string; btnH: number };

function Steps({ m, o }: { m: M; o: O }) {
  const { p } = m;
  const rowStyle = (on: boolean) => 'display:flex;align-items:center;gap:16px;width:100%;box-sizing:border-box;min-height:' + o.rowH + 'px;padding:' + o.rowPad + ';border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;color:#0E1116;cursor:pointer;background:' + (on ? '#F4F5F7' : 'transparent');
  const chip = (on: boolean) => 'flex:0 0 auto;height:44px;padding:0 18px;border-radius:999px;font-size:14px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
  const closed = !m.hoursToday;
  const anyOk = m.slots.length > 0;
  const hasSlots = !closed && !m.loading && !m.slotErr && anyOk;
  const slotMessage = closed ? `We are closed on ${m.days[m.day].name}s. Pick another day.` : m.loading ? 'Checking availability…' : m.slotErr ? m.slotErr : 'No times left on this day. Try another day.';
  const { wl } = m;
  return <>
    {m.step === 1 && (
      <div className="bk-flow" style={S('display:flex;flex-direction:column;gap:16px')}>
        <div role="group" className="hscroll" aria-label="Filter services" style={S('display:flex;gap:8px;overflow-x:auto')}>
          {['All', ...p.cats].map((c) => <button key={c} onClick={() => m.setCat(c)} aria-pressed={m.cat === c} style={S(chip(m.cat === c))}>{c === 'All' ? 'All services' : c}</button>)}
        </div>
        <ul className="bk-list" style={S('margin:0;padding:0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
          {p.services.filter((s) => m.cat === 'All' || s.cat === m.cat).map((s) => {
            const on = m.sel.includes(s.id);
            return <li key={s.id}>
              <button onClick={() => m.toggle(s.id)} aria-pressed={on} aria-label={`${s.name}, ${fmtDur(s.dur)}, ${m.money(s.cents)}`} style={S(rowStyle(on))}>
                <span style={S('flex:1 1 auto;min-width:0')}>
                  <span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{s.name}</span>
                  <span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{s.desc}</span>
                  <span style={S('display:block;margin-top:4px;font-size:13px;color:#5E6673')}>{fmtDur(s.dur)}</span>
                </span>
                <span style={S('flex:0 0 auto;font-size:15px;font-weight:600')}>{m.money(s.cents)}</span>
                <span style={S(circle(on))}>
                  {on && <Check />}
                  {!on && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
                </span>
              </button>
            </li>;
          })}
        </ul>
      </div>
    )}

    {m.step === 2 && (
      <ul className="bk-flow bk-list" style={S('margin:0;padding:0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
        {[{ id: 'any', name: 'Any professional', role: 'Best available time', svc: null as string[] | null }, ...p.team].map((t) => {
          const bad = t.svc ? m.list.find((s) => !t.svc!.includes(s.id)) : null;
          const on = m.staff === t.id;
          return <li key={t.id}>
            <button onClick={() => { if (!bad) m.setStaff(t.id); }} aria-pressed={on} aria-disabled={!!bad} aria-label={t.name + ', ' + (bad ? "doesn't offer " + bad.name : t.role)} style={S(rowStyle(on) + (bad ? ';cursor:default' : ''))}>
              <span style={S('flex:0 0 48px;width:48px;height:48px;border-radius:999px;background:#EEF0F3;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:#0E1116')}>
                {t.id !== 'any' && initialsOf(t.name)}
                {t.id === 'any' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18.5 14.8c1.6.8 2.6 2.4 3 5.2" /></svg>}
              </span>
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
        <div role="group" className="hscroll" aria-label="Choose a day" style={S('display:flex;gap:8px;overflow-x:auto')}>
          {m.days.map((d, i) => {
            const on = m.day === i; const sub = on ? '#D5D9E0' : '#5E6673';
            return <button key={d.ymd} onClick={() => m.setDay(i)} aria-pressed={on} aria-label={d.full + (p.hours[d.dow] ? '' : ', closed')}
              style={S('flex:0 0 ' + o.dayW + 'px;height:76px;box-sizing:border-box;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:inherit;padding:0;border:1px solid ' + (on ? '#0E1116' : '#E6E8EC') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116'))}>
              <span style={S('font-size:12.5px;color:' + sub)}>{d.abbr}</span>
              <span style={S('font-size:17px;font-weight:600')}>{d.num}</span>
              <span style={S('font-size:11.5px;color:' + sub)}>{d.month}</span>
            </button>;
          })}
        </div>
        <div style={S('background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px;display:flex;flex-direction:column;gap:16px')}>
          <h2 style={S('margin:0;font-size:16px;font-weight:600')}>{m.days[m.day].full}</h2>
          {hasSlots && (
            <div role="group" aria-label="Available times" style={S('display:grid;grid-template-columns:' + o.cols + ';gap:8px')}>
              {m.grid.map((min) => {
                const key = m.open.get(min); const ok = !!key; const on = m.slot === key && ok;
                return <button key={min} onClick={() => { if (ok) { m.setSlot(key!); m.setSlotMin(min); } }} disabled={!ok} aria-pressed={on} aria-label={hhmm(min) + (ok ? '' : ', unavailable')}
                  style={S('width:100%;height:44px;padding:0;border-radius:14px;font-size:14px;font-weight:500;font-family:inherit;border:1px solid ' + (on ? '#0E1116' : (ok ? '#E1E4E9' : '#EEF0F3')) + ';background:' + (on ? '#0E1116' : (ok ? '#FFFFFF' : '#F4F5F7')) + ';color:' + (on ? '#FFFFFF' : (ok ? '#0E1116' : '#8A93A0')) + (ok ? '' : ';text-decoration:line-through;cursor:default'))}>{hhmm(min)}</button>;
              })}
            </div>
          )}
          {!hasSlots && <p style={S('margin:0;color:#5E6673;font-size:14px')}>{slotMessage}</p>}
          <div style={S('border-top:1px solid #EEF0F3;padding-top:16px;display:flex;flex-direction:column;gap:12px')}>
            {!wl.open && !wl.done && m.sel.length > 0 && <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px')}><span style={S('flex:1 1 200px;font-size:14px;color:#5E6673')}>Cannot find a time that suits?</span><button className="ghost" onClick={() => m.setWl({ ...wl, open: true, error: '' })} style={S('height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500;padding:0 20px')}>Join the waitlist</button></div>}
            {wl.open && (
              <div style={S('display:flex;flex-direction:column;gap:12px')}>
                <span style={S('font-size:15px;font-weight:600')}>Join the waitlist</span>
                <span style={S('font-size:13.5px;color:#5E6673')}>We will message you if a time opens up for your services.</span>
                <div style={S('display:flex;flex-direction:column;gap:6px')}><label htmlFor="wl-n" style={S('font-size:14px;font-weight:600')}>Full name</label><input id="wl-n" className="bkf" type="text" value={wl.name} onChange={(e) => m.setWlField('name', e.target.value)} placeholder="Your name" style={S(INPUT)} /></div>
                <div style={S('display:flex;flex-direction:column;gap:6px')}><label htmlFor="wl-p" style={S('font-size:14px;font-weight:600')}>Mobile number</label><input id="wl-p" className="bkf" type="tel" value={wl.phone} onChange={(e) => m.setWlField('phone', e.target.value)} placeholder="Your number" style={S(INPUT)} /></div>
                {!!wl.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{wl.error}</p>}
                <div style={S('display:flex;gap:10px')}><button onClick={m.submitWl} style={S('flex:1 1 0;height:44px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500')}>Join waitlist</button><button className="ghost" onClick={() => m.setWl({ ...wl, open: false, error: '' })} style={S('flex:1 1 0;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500')}>Cancel</button></div>
              </div>
            )}
            {wl.done && <div role="status" style={S('border-radius:16px;background:#DDF3EA;color:#14624A;padding:12px 14px;font-size:14px;font-weight:500')}>You are on the waitlist. We will message you if a time opens up.</div>}
          </div>
        </div>
      </div>
    )}

    {m.step === 4 && (
      <div className="bk-flow" style={S('position:relative;display:flex;flex-direction:column;gap:18px;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px')}>
        <input tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={m.hp} onChange={(e) => m.setHp(e.target.value)} style={S('position:absolute;left:-9999px;width:1px;height:1px;min-height:0;padding:0;opacity:0')} />
        <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="bk-name" style={S('font-size:14px;font-weight:600')}>Full name</label><input id="bk-name" className="bkf" type="text" autoComplete="name" value={m.form.name} onChange={(e) => m.setField('name', e.target.value)} placeholder="Your name" style={S(INPUT)} /></div>
        <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="bk-email" style={S('font-size:14px;font-weight:600')}>Email</label><input id="bk-email" className="bkf" type="email" autoComplete="email" value={m.form.email} onChange={(e) => m.setField('email', e.target.value)} placeholder="you@example.com" style={S(INPUT)} /></div>
        <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="bk-phone" style={S('font-size:14px;font-weight:600')}>Phone (optional)</label><input id="bk-phone" className="bkf" type="tel" inputMode="tel" autoComplete="tel" value={m.form.phone} onChange={(e) => m.setField('phone', e.target.value)} placeholder="Optional" style={S(INPUT)} /></div>
        <div style={S('display:flex;flex-direction:column;gap:8px')}>
          <label htmlFor="bk-notes" style={S('font-size:14px;font-weight:600')}>Notes for the salon (optional)</label>
          <textarea id="bk-notes" className="bkf" value={m.form.notes} onChange={(e) => m.setField('notes', e.target.value)} placeholder="Anything we should know before you arrive" style={S('box-sizing:border-box;width:100%;min-height:96px;resize:vertical;padding:12px 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF')} />
        </div>
        <p style={S('margin:0;font-size:13px;color:#5E6673')}>You pay at the salon after your appointment.</p>
        {!p.autoConfirm && <p style={S('margin:0;font-size:13px;color:#5E6673')}>The salon will confirm your request by email.</p>}
        {!!m.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{m.error}</p>}
      </div>
    )}
  </>;
}

const HINTS = ['Choose at least one service to continue.', 'Choose who you would like to see.', 'Pick a day and a time.', ''];
const primaryLabel = (m: M) => m.busy ? (m.p.autoConfirm ? 'Booking…' : 'Sending…') : m.step === 4 ? (m.p.autoConfirm ? 'Confirm booking' : 'Request booking') : 'Continue';
const primaryStyle = (m: M, h: number) => 'width:100%;height:' + h + 'px;border:0;border-radius:999px;font-size:14.5px;font-weight:500;font-family:inherit;background:' + (m.canGo ? '#0E1116' : '#D5D9E0') + ';color:' + (m.canGo ? '#FFFFFF' : '#5E6673') + ';cursor:' + (m.canGo ? 'pointer' : 'default');

function DoneCard({ m }: { m: M }) {
  const d = m.done!;
  const row = (k: string, v: string, last = false, bold = false) => <div style={S('display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3' + (last ? ';border-bottom:1px solid #EEF0F3' : ''))}><dt style={S('color:#5E6673')}>{k}</dt><dd style={S('margin:0;font-weight:' + (bold ? 600 : 500) + ';text-align:right' + (k === 'With' ? ';overflow-wrap:anywhere' : ''))}>{v}</dd></div>;
  const booked = m.p.autoConfirm;
  return (
    <div role="status" style={S('display:flex;flex-direction:column;gap:20px;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:28px')}>
      <div style={S('flex:0 0 56px;width:56px;height:56px;border-radius:999px;background:#DDF3EA;display:flex;align-items:center;justify-content:center')}><Check size={26} color="#14624A" w={2.2} /></div>
      <div>
        <h1 style={S('margin:0;font-size:30px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;overflow-wrap:anywhere')}>{booked ? `You're booked, ${d.first}` : `Request sent, ${d.first}`}</h1>
        <p style={S('margin:8px 0 0;color:#5E6673;font-size:15px;overflow-wrap:anywhere')}>{booked ? `We've sent the details to ${d.email}.` : `We'll email ${d.email} once the salon confirms.`}</p>
      </div>
      <dl style={S('margin:0;display:flex;flex-direction:column')}>
        {row('When', d.when)}{row('With', d.staffName)}{row('Services', `${d.count}, ${d.dur}`)}{row('Total to pay at the salon', d.total, true, true)}
      </dl>
      <div style={S('display:flex;gap:10px')}>
        <button onClick={m.reset} style={S('flex:1 1 0;height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500')}>Book another</button>
        <button className="ghost" onClick={() => m.setCalOpen(!m.calOpen)} aria-expanded={m.calOpen} aria-haspopup="menu" style={S('flex:1 1 0;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500')}>Add to calendar</button>
      </div>
      {m.calOpen && (
        <div role="menu" aria-label="Add to calendar" style={S('display:flex;flex-direction:column;border:1px solid #E6E8EC;border-radius:18px;overflow:hidden;background:#FFFFFF')}>
          {([['Google Calendar', m.calLinks.google], ['Outlook', m.calLinks.outlook], ['Yahoo Calendar', m.calLinks.yahoo]] as const).map(([l, h], i) => (
            <a key={l} role="menuitem" href={h} target="_blank" rel="noopener noreferrer" style={S('display:flex;align-items:center;justify-content:space-between;min-height:52px;box-sizing:border-box;padding:0 16px;color:#0E1116;text-decoration:none;font-size:14.5px;font-weight:500' + (i < 2 ? ';border-bottom:1px solid #EEF0F3' : ''))}>{l}<Arrow /></a>
          ))}
        </div>
      )}
    </div>
  );
}

function Desktop({ m }: { m: M }) {
  const { p } = m;
  const o: O = { rowH: 88, rowPad: '16px 24px', dayW: 84, cols: 'repeat(auto-fill,minmax(92px,1fr))', btnH: 48 };
  const t = p.hours[m.days[0].dow];
  const pillOn = !!t && p.nowMin < toMin(t.to);
  const pill = pillOn ? 'Open today until ' + t!.to : t ? 'Closed for today' : 'Closed today';
  const hasWhen = m.slotMin !== null;
  return (
    <div style={S('max-width:1180px;margin:0 auto;box-sizing:border-box;padding:24px 32px 56px;display:flex;flex-direction:column;gap:28px')}>
      <header style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px')}>
        <div style={S('display:flex;align-items:center;gap:12px')}>
          <div>
            <div style={S('font-size:17px;font-weight:600;letter-spacing:-0.01em')}>{p.name}</div>
            <div style={S('font-size:13px;color:#5E6673')}>Online booking</div>
          </div>
        </div>
        <span style={S('padding:6px 14px;border-radius:999px;font-size:13px;font-weight:500;background:' + (pillOn ? '#DDF3EA' : '#EEF0F3') + ';color:' + (pillOn ? '#14624A' : '#4A525E'))}>{pill}</span>
      </header>

      {!m.done && <>
        <nav aria-label="Booking steps">
          <ol style={S('margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:12px 28px')}>
            {LABELS.map((l, i) => {
              const n = i + 1; const cur = m.step === n; const past = n < m.step;
              return <li key={l}>
                <button onClick={() => m.goStep(n)} disabled={!past} aria-label={`Step ${n}, ${l}` + (cur ? ', current step' : past ? ', completed' : '')} style={S('display:flex;align-items:center;gap:10px;min-height:44px;padding:0;border:0;background:transparent;font:inherit')}>
                  <span style={S('flex:0 0 28px;width:28px;height:28px;box-sizing:content-box;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;background:' + (cur ? '#0E1116' : past ? '#DDF3EA' : '#FFFFFF') + ';color:' + (cur ? '#FFFFFF' : past ? '#14624A' : '#5E6673') + ';border:1px solid ' + (cur ? '#0E1116' : past ? '#DDF3EA' : '#E1E4E9'))}>{n}</span>
                  <span style={S('font-size:14px;font-weight:' + (cur ? 600 : 500) + ';color:' + (cur ? '#0E1116' : '#5E6673'))}>{l}</span>
                </button>
              </li>;
            })}
          </ol>
        </nav>

        <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:24px')}>
          <div className="bk-flow" style={S('flex:999 1 560px;min-width:0;display:flex;flex-direction:column;gap:20px')}>
            <h1 style={S('margin:0;font-size:34px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{TITLES[m.step - 1]}</h1>
            <Steps m={m} o={o} />
          </div>
          <aside aria-label="Your booking" style={S('flex:1 1 340px;max-width:380px;min-width:0;position:sticky;top:24px;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:18px')}>
            <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Your booking</h2>
            {!m.list.length && <p style={S('margin:0;color:#5E6673;font-size:14px')}>No services yet. Add one from the list.</p>}
            {!!m.list.length && (
              <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column')}>
                {m.list.map((l) => (
                  <li key={l.id} style={S('display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}>
                    <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;overflow-wrap:anywhere')}>{l.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{fmtDur(l.dur)}</span></span>
                    <span style={S('flex:0 0 auto;font-size:14.5px;font-weight:600')}>{m.money(l.cents)}</span>
                    <button className="ghost" onClick={() => m.toggle(l.id)} aria-label={'Remove ' + l.name} style={S('flex:0 0 44px;width:44px;height:44px;padding:0;border:0;border-radius:999px;background:transparent;display:flex;align-items:center;justify-content:center')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
                  </li>
                ))}
              </ul>
            )}
            <dl style={S('margin:0;display:flex;flex-direction:column')}>
              {(m.staff ? true : false) && <div style={S('display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>With</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{m.member ? m.member.name : 'Any professional'}</dd></div>}
              {hasWhen && <div style={S('display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>When</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{m.whenOf(m.slotMin!)}</dd></div>}
              <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:14px 0;border-top:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Total, {m.durText}</dt><dd style={S('margin:0;font-size:22px;font-weight:600;letter-spacing:-0.02em')}>{m.money(m.totalCents)}</dd></div>
            </dl>
            <div style={S('display:flex;flex-direction:column;gap:10px')}>
              <button onClick={m.next} disabled={!m.canGo || m.busy} style={S(primaryStyle(m, o.btnH))}>{primaryLabel(m)}</button>
              {!m.canGo && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:13px')}>{HINTS[m.step - 1]}</p>}
            </div>
          </aside>
        </div>
      </>}

      {m.done && <div style={S('width:100%;max-width:560px;margin:0 auto;box-sizing:border-box')}><DoneCard m={m} /></div>}
    </div>
  );
}

function Mobile({ m }: { m: M }) {
  const { p } = m;
  const o: O = { rowH: 80, rowPad: '14px 16px', dayW: 60, cols: 'repeat(4,minmax(0,1fr))', btnH: 48 };
  if (m.done) return (
    <div className="bk-flow" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:28px 20px 20px;display:flex;flex-direction:column;gap:20px')}>
      <div style={S('display:flex;align-items:center;gap:12px')}><span style={S('font-size:17px;font-weight:600')}>{p.name}</span></div>
      <DoneCard m={m} />
    </div>
  );
  return <>
    <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px')}>
      <button className="ghost" onClick={m.back} disabled={m.step <= 1} aria-label="Back to previous step" style={S('flex:0 0 44px;width:44px;height:44px;padding:0;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6 8.5 12l6 6" /></svg>
      </button>
      <div style={S('flex:1 1 auto;min-width:0')}>
        <div style={S('font-size:13px;color:#5E6673')}>{p.name}, Step {m.step} of 4</div>
        <h1 style={S('margin:0;font-size:20px;line-height:1.2;font-weight:600;letter-spacing:-0.02em')}>{TITLES[m.step - 1]}</h1>
      </div>
    </header>
    <div style={S('flex:0 0 auto;margin:0 20px 16px;height:4px;border-radius:999px;background:#E1E4E9;overflow:hidden')}><div style={S('height:100%;border-radius:999px;background:#0E1116;width:' + m.step * 25 + '%')}></div></div>
    <main className="bk-flow" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
      <Steps m={m} o={o} />
    </main>
    <div style={S('flex:0 0 auto;box-sizing:border-box;padding:12px 20px 24px;background:#FFFFFF;border-top:1px solid #E6E8EC;display:flex;flex-direction:column;gap:10px')}>
      <div style={S('display:flex;align-items:baseline;justify-content:space-between;gap:12px')}>
        <span style={S('color:#5E6673;font-size:13.5px')}>{m.countText}, {m.durText}</span>
        <span style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{m.money(m.totalCents)}</span>
      </div>
      <button onClick={m.next} disabled={!m.canGo || m.busy} style={S(primaryStyle(m, o.btnH))}>{primaryLabel(m)}</button>
      {!m.canGo && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:13px')}>{HINTS[m.step - 1]}</p>}
    </div>
  </>;
}

export function BookingView(p: Props) {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => { const mq = window.matchMedia('(max-width:900px)'); const f = () => setNarrow(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  const m = useBooking(p);
  return <>
    {narrow !== false && <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}><Mobile m={m} /></div>}
    {narrow !== true && <div className="only-d d-cal cal-root" style={S("box-sizing:border-box;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;min-height:100vh")}><Desktop m={m} /></div>}
  </>;
}
