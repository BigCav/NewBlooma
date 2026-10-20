'use client';
// 1:1 conversion of the prototype's ManageBooking.dc.html and MobileManageBooking.dc.html (the client's appointment page).
// Markup and style strings are kept as written; the {{ }} holes are the appointment's real data and the handlers are real server actions.
import { makeMoney } from '@/lib/display';
import { clock12 } from '@/lib/display';
import { useEffect, useMemo, useRef, useState } from 'react';
import { S } from '../../(dash)/calendar/pickers';
import { cancelBooking, manageSlots, moveBooking } from './actions';

type Item = { name: string; dur: number; cents: number };
type Props = {
  bookingRef: string; token: string; salonName: string; slug: string; address: string; currency: string; staffName: string; status: string;
  items: Item[]; startYmd: string; startMin: number; canAct: boolean; free: boolean; deadline: string;
  hours: ({ from: string; to: string } | null)[]; today: string; windowDays: number;
};
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAME = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const REASONS = ['Change of plans', 'Found another time', 'Something else'];
const hhmm = clock12;
const fmtDur = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return h ? h + ' hr' + (r ? ' ' + r + ' min' : '') : m + ' min'; };
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const dayInfo = (ymd: string) => {
  const [y, mo, d] = ymd.split('-').map(Number); const dt = new Date(Date.UTC(y, mo - 1, d)); const wd = dt.getUTCDay();
  return { ymd, abbr: DAY_ABBR[wd], num: dt.getUTCDate(), month: MONTH_ABBR[dt.getUTCMonth()], dow: (wd + 6) % 7, name: DAY_NAME[wd],
    full: DAY_NAME[wd] + ' ' + dt.getUTCDate() + ' ' + MONTH_NAME[dt.getUTCMonth()], short: DAY_ABBR[wd] + ' ' + dt.getUTCDate() + ' ' + MONTH_ABBR[dt.getUTCMonth()] };
};

function useManage(p: Props) {
  const days = useMemo(() => { const [y, mo, d] = p.today.split('-').map(Number); return Array.from({ length: Math.min(p.windowDays, 57) }, (_, i) => dayInfo(new Date(Date.UTC(y, mo - 1, d + i)).toISOString().slice(0, 10))); }, [p.today, p.windowDays]);
  const money = useMemo(() => makeMoney(p.currency), [p.currency]);
  const [mode, setMode] = useState<'view' | 'resched' | 'cancel'>('view');
  const [cancelled, setCancelled] = useState(p.status === 'cancelled');
  const [when, setWhen] = useState({ ymd: p.startYmd, min: p.startMin });
  const [pol, setPol] = useState({ free: p.free, deadline: p.deadline });
  const startIdx = days.findIndex((d) => d.ymd === p.startYmd);
  const [notice, setNotice] = useState('');
  const [rs, setRs] = useState<{ day: number; time: number | null; iso: string }>({ day: Math.max(0, startIdx), time: null, iso: '' });
  const [reason, setReason] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [slots, setSlots] = useState<{ iso: string; min: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [slotErr, setSlotErr] = useState('');
  const req = useRef(0);
  const totalDur = p.items.reduce((a, i) => a + i.dur, 0), totalCents = p.items.reduce((a, i) => a + i.cents, 0);
  const hoursDay = p.hours[days[rs.day].dow];
  const whenDay = dayInfo(when.ymd);

  useEffect(() => {
    if (mode !== 'resched') return;
    if (!hoursDay) { setSlots([]); setLoading(false); setSlotErr(''); return; }
    const id = ++req.current; setLoading(true); setSlotErr('');
    manageSlots(p.token, days[rs.day].ymd).then((r) => { if (id !== req.current) return; setSlots(r.slots); setSlotErr(r.error ?? ''); setLoading(false); })
      .catch(() => { if (id !== req.current) return; setSlots([]); setSlotErr('Could not load times. Please try again.'); setLoading(false); });
  }, [mode, rs.day, hoursDay ? 1 : 0, p.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const grid = useMemo(() => {
    const set = new Set<number>();
    if (hoursDay) for (let m = toMin(hoursDay.from); m < toMin(hoursDay.to); m += 30) set.add(m);
    for (const s of slots) set.add(s.min);
    return hoursDay ? [...set].sort((a, b) => a - b) : [];
  }, [hoursDay, slots]);
  const open = new Map(slots.map((s) => [s.min, s.iso]));

  const openResched = () => { setMode('resched'); setRs({ day: Math.max(0, startIdx), time: null, iso: '' }); setError(''); setNotice(''); };
  const openCancel = () => { setMode('cancel'); setReason(null); setNotice(''); setError(''); };
  const keep = () => { setMode('view'); setError(''); };
  const pickDay = (i: number) => { setRs({ day: i, time: null, iso: '' }); setError(''); };
  const pickTime = (min: number, iso: string) => { setRs({ ...rs, time: min, iso }); setError(''); };
  const confirmResched = async () => {
    if (busy) return;
    if (rs.time === null) { setError('Pick a new time from the list.'); return; }
    if (days[rs.day].ymd === when.ymd && rs.time === when.min) { setError('That is your current time. Pick a different one.'); return; }
    setBusy(true);
    try {
      const r = await moveBooking(p.token, rs.iso);
      if (r.error) { setError(r.error); return; }
      setWhen({ ymd: days[rs.day].ymd, min: rs.time }); setPol({ free: !!r.free, deadline: r.deadline ?? '' });
      setMode('view'); setError(''); setNotice('Moved to ' + days[rs.day].short + ', ' + hhmm(rs.time));
    } catch { setError('Something went wrong. Please try again.'); } finally { setBusy(false); }
  };
  const confirmCancel = async () => {
    if (busy) return; setBusy(true);
    try {
      const r = await cancelBooking(p.token, reason ?? '');
      if (r.error) { setError(r.error); return; }
      setCancelled(true); setMode('view'); setError('');
    } catch { setError('Something went wrong. Please try again.'); } finally { setBusy(false); }
  };
  const cancelNote = pol.free ? 'You will not be charged.' : 'A late cancellation fee may apply, as free cancellation has ended.';
  const policyLine = pol.free ? 'Free cancellation until ' + pol.deadline + '.' : 'Free cancellation has ended for this appointment. A late cancellation fee may apply.';
  const changeLine = rs.time !== null ? 'From ' + whenDay.short + ', ' + hhmm(when.min) + ' to ' + days[rs.day].short + ', ' + hhmm(rs.time) : 'Pick a new day and time. Your appointment takes ' + fmtDur(totalDur) + '.';
  return { p, days, money, mode, cancelled, when, whenDay, notice, rs, reason, setReason, error, busy, loading, slotErr, slots, grid, open, totalDur, totalCents, hoursDay,
    openResched, openCancel, keep, pickDay, pickTime, confirmResched, confirmCancel, cancelNote, policyLine, changeLine };
}
type M = ReturnType<typeof useManage>;

const STATUS: Record<string, [string, string, string]> = {
  confirmed: ['Confirmed', '#DDF3EA', '#14624A'], pending: ['Awaiting confirmation', '#FFEBD0', '#7A4204'],
  cancelled: ['Cancelled', '#EEF0F3', '#4A525E'], completed: ['Completed', '#EEF0F3', '#4A525E'], no_show: ['Missed', '#EEF0F3', '#4A525E'],
  checked_in: ['Checked in', '#DDF3EA', '#14624A'], in_progress: ['In progress', '#DDF3EA', '#14624A'],
};
const BTN_D = 'width:100%;height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500';
const BTN_G = 'width:100%;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500';
const CARD = (pad: number) => `box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:${pad}px;display:flex;flex-direction:column;gap:20px`;
const ASIDE_CARD = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:14px';

function Summary({ m, pad }: { m: M; pad: number }) {
  const { p } = m;
  return <div style={S(pad ? CARD(pad) : 'display:contents')}>
    <div><div style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{m.whenDay.full}</div><div style={S('margin-top:2px;color:#5E6673;font-size:15px')}>{hhmm(m.when.min) + ' to ' + hhmm(m.when.min + m.totalDur)}</div><div style={S('margin-top:2px;color:#5E6673;font-size:13.5px')}>{'Booking ' + m.p.bookingRef}</div></div>
    <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column')}>
      {p.items.map((it, i) => <li key={i} style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}><span style={S('min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{it.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{fmtDur(it.dur)}</span></span><span style={S('flex:0 0 auto;font-size:15px;font-weight:600')}>{m.money(it.cents)}</span></li>)}
    </ul>
    <dl style={S('margin:0;display:flex;flex-direction:column')}>
      <div style={S('display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>With</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{p.staffName}</dd></div>
      <div style={S('display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Where</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{p.address}</dd></div>
      <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:14px 0;border-top:1px solid #EEF0F3;border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Total, pay at the salon</dt><dd style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{m.money(m.totalCents)}</dd></div>
    </dl>
  </div>;
}

function StatusRow({ m }: { m: M }) {
  const [label, bg, fg] = STATUS[m.p.status] ?? [m.p.status, '#EEF0F3', '#4A525E'];
  return <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px')}><span style={S('display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + bg + ';color:' + fg)}>{label}</span>
    {!!m.notice && <span role="status" style={S('padding:4px 12px;border-radius:999px;background:#E9F0FF;color:#1B4A8A;font-size:12.5px;font-weight:500')}>{m.notice}</span>}</div>;
}

function Picker({ m, cols, dayW, pad }: { m: M; cols: string; dayW: number; pad: number }) {
  const { p } = m;
  const closed = !m.hoursDay;
  const hasSlots = !closed && !m.loading && !m.slotErr && m.slots.length > 0;
  const msg = closed ? `We are closed on ${m.days[m.rs.day].name}s. Pick another day.` : m.loading ? 'Checking availability…' : m.slotErr ? m.slotErr : 'No times left on this day. Try another day.';
  return <>
    <div role="group" className="hscroll" aria-label="Choose a day" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
      {m.days.map((d, i) => { const on = m.rs.day === i; const sub = on ? '#D5D9E0' : '#5E6673';
        return <button key={d.ymd} onClick={() => m.pickDay(i)} aria-pressed={on} aria-label={d.full + (p.hours[d.dow] ? '' : ', closed')} style={S('flex:0 0 ' + dayW + 'px;height:80px;box-sizing:border-box;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:inherit;padding:0;border:1px solid ' + (on ? '#0E1116' : '#E6E8EC') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116'))}>
          <span style={S('font-size:12.5px;color:' + sub)}>{d.abbr}</span><span style={S('font-size:17px;font-weight:600')}>{d.num}</span><span style={S('font-size:11.5px;color:' + sub)}>{d.month}</span></button>; })}
    </div>
    <div style={S(CARD(pad))}>
      <h2 style={S('margin:0;font-size:16px;font-weight:600')}>{m.days[m.rs.day].full}</h2>
      {hasSlots && <div role="group" aria-label="Available times" style={S('display:grid;grid-template-columns:' + cols + ';gap:8px')}>
        {m.grid.map((min) => { const iso = m.open.get(min); const ok = !!iso; const curr = m.days[m.rs.day].ymd === m.when.ymd && min === m.when.min; const on = m.rs.time === min && ok;
          return <button key={min} onClick={() => { if (ok) m.pickTime(min, iso!); }} disabled={!ok} aria-pressed={on} aria-label={hhmm(min) + (ok ? '' : ', unavailable') + (curr ? ', your current time' : '')}
            style={S('width:100%;height:44px;padding:0;border-radius:14px;font-size:14px;font-weight:500;font-family:inherit;border:1px solid ' + (on ? '#0E1116' : (ok ? (curr ? '#5E6673' : '#E1E4E9') : '#EEF0F3')) + ';background:' + (on ? '#0E1116' : (ok ? '#FFFFFF' : '#F4F5F7')) + ';color:' + (on ? '#FFFFFF' : (ok ? '#0E1116' : '#8A93A0')) + (ok ? '' : ';text-decoration:line-through;cursor:default'))}>{hhmm(min)}</button>; })}
      </div>}
      {!hasSlots && <p style={S('margin:0;color:#5E6673;font-size:14px')}>{msg}</p>}
    </div>
  </>;
}

function Reasons({ m }: { m: M }) {
  return <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="cx-reason" style={S('font-size:14px;font-weight:600')}>Reason (optional)</span>
    <div role="group" className="hscroll" aria-labelledby="cx-reason" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
      {REASONS.map((r) => { const on = m.reason === r; return <button key={r} onClick={() => m.setReason(on ? null : r)} aria-pressed={on} style={S('flex:0 0 auto;height:44px;padding:0 18px;border-radius:999px;font-size:14px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116'))}>{r}</button>; })}
    </div></div>;
}

function CancelledCard({ m, pad, h1 }: { m: M; pad: number; h1: number }) {
  return <div role="status" style={S(CARD(pad))}>
    <div style={S('flex:0 0 56px;width:56px;height:56px;border-radius:999px;background:#EEF0F3;display:flex;align-items:center;justify-content:center')}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A525E" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></div>
    <div><h1 style={S(`margin:0;font-size:${h1}px;line-height:1.15;font-weight:600;letter-spacing:-0.03em`)}>Appointment cancelled</h1><p style={S('margin:8px 0 0;color:#5E6673;font-size:15px')}>{m.whenDay.short + ', ' + hhmm(m.when.min)} with {m.p.staffName} has been cancelled. We have emailed you a confirmation.</p></div>
    <a href={`/b/${m.p.slug}/book`} style={S('height:48px;box-sizing:border-box;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;display:flex;align-items:center;justify-content:center;text-decoration:none;' + (pad === 28 ? 'max-width:320px' : ''))}>Book a new appointment</a>
  </div>;
}

function Desktop({ m }: { m: M }) {
  const { p } = m;
  const view = m.mode === 'view' && !m.cancelled;
  const short = m.whenDay.short + ', ' + hhmm(m.when.min);
  const showAside = !m.cancelled && (m.mode !== 'view' || p.canAct);
  return (
    <div className="bk-flow" style={S('max-width:1180px;margin:0 auto;box-sizing:border-box;padding:24px 32px 56px;display:flex;flex-direction:column;gap:28px')}>
      <header style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px')}>
        <div style={S('display:flex;align-items:center;gap:12px')}><div><a href={'/b/' + p.slug} style={S('display:block;font-size:17px;font-weight:600;letter-spacing:-0.01em;color:#0E1116;text-decoration:none')}>{p.salonName}</a><div style={S('font-size:13px;color:#5E6673')}>Manage your booking</div></div></div>
      </header>
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:24px')}>
        <div className="bk-flow" style={S('flex:999 1 560px;min-width:0;display:flex;flex-direction:column;gap:20px')}>
          {view && <>
            <StatusRow m={m} />
            <h1 style={S('margin:0;font-size:34px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>Your appointment</h1>
            <Summary m={m} pad={28} />
          </>}
          {m.mode === 'resched' && !m.cancelled && <>
            <div><h1 style={S('margin:0;font-size:34px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>Pick a new time</h1><p style={S('margin:6px 0 0;color:#5E6673;font-size:15px')}>Your appointment takes {fmtDur(m.totalDur)}.</p></div>
            <Picker m={m} cols="repeat(auto-fill,minmax(92px,1fr))" dayW={84} pad={28} />
          </>}
          {m.mode === 'cancel' && !m.cancelled && <>
            <div><h1 style={S('margin:0;font-size:34px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>Cancel this appointment?</h1><p style={S('margin:6px 0 0;color:#5E6673;font-size:15px')}>{short} with {p.staffName}, {fmtDur(m.totalDur)}, {m.money(m.totalCents)}.</p></div>
            <div style={S(CARD(28))}>
              <p style={S('margin:0;padding:14px 16px;border-radius:16px;background:#F4F5F7;font-size:14px')}>{m.cancelNote}</p>
              <Reasons m={m} />
            </div>
          </>}
          {m.cancelled && <CancelledCard m={m} pad={28} h1={34} />}
        </div>
        {showAside && (
          <aside className="bk-flow" style={S('flex:1 1 340px;max-width:380px;min-width:0;position:sticky;top:24px;display:flex;flex-direction:column;gap:16px')}>
            {view && <div style={S(ASIDE_CARD)}>
              <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Manage your appointment</h2>
              <p style={S('margin:0;color:#5E6673;font-size:14px')}>{m.policyLine}</p>
              <button onClick={m.openResched} style={S(BTN_D)}>Reschedule</button>
              <button className="ghost" onClick={m.openCancel} style={S(BTN_G)}>Cancel appointment</button>
            </div>}
            {m.mode === 'resched' && <div style={S(ASIDE_CARD)}>
              <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Your change</h2>
              <p style={S('margin:0;color:#5E6673;font-size:14px')}>{m.changeLine}</p>
              {!!m.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{m.error}</p>}
              <button onClick={m.confirmResched} disabled={m.busy} style={S(BTN_D)}>{m.busy ? 'Saving…' : 'Confirm new time'}</button>
              <button className="ghost" onClick={m.keep} style={S(BTN_G)}>Keep current time</button>
            </div>}
            {m.mode === 'cancel' && <div style={S(ASIDE_CARD)}>
              <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Confirm cancellation</h2>
              <p style={S('margin:0;color:#5E6673;font-size:14px')}>{m.cancelNote}</p>
              {!!m.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{m.error}</p>}
              <button onClick={m.confirmCancel} disabled={m.busy} style={S('width:100%;height:48px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font-size:14.5px;font-weight:500')}>{m.busy ? 'Cancelling…' : 'Yes, cancel'}</button>
              <button className="ghost" onClick={m.keep} style={S(BTN_G)}>Keep appointment</button>
            </div>}
          </aside>
        )}
      </div>
    </div>
  );
}

function Mobile({ m }: { m: M }) {
  const { p } = m;
  const view = m.mode === 'view' && !m.cancelled;
  const short = m.whenDay.short + ', ' + hhmm(m.when.min);
  const H1 = 'margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em';
  const half = 'flex:1 1 0;height:48px;font-size:14.5px;font-weight:500;border-radius:999px;';
  return (
    <div className="bk-flow" style={S('flex:1 1 0;min-height:0;box-sizing:border-box;overflow-y:auto;padding:24px 20px 28px;display:flex;flex-direction:column;gap:20px')}>
      <header style={S('display:flex;align-items:center;gap:12px')}><div><a href={'/b/' + p.slug} style={S('display:block;font-size:17px;font-weight:600;letter-spacing:-0.01em;color:#0E1116;text-decoration:none')}>{p.salonName}</a><div style={S('font-size:13px;color:#5E6673')}>Manage your booking</div></div></header>
      {view && <>
        <StatusRow m={m} />
        <h1 style={S(H1)}>Your appointment</h1>
        <div style={S(CARD(20))}>
          <Summary m={m} pad={0} />
          {p.canAct && <>
            <p style={S('margin:0;color:#5E6673;font-size:13.5px')}>{m.policyLine}</p>
            <div style={S('display:flex;gap:10px')}>
              <button onClick={m.openResched} style={S(half + 'border:0;background:#0E1116;color:#FFFFFF')}>Reschedule</button>
              <button className="ghost" onClick={m.openCancel} style={S(half + 'border:1px solid #E1E4E9;background:#FFFFFF;color:#0E1116')}>Cancel appointment</button>
            </div>
          </>}
        </div>
      </>}
      {m.mode === 'resched' && !m.cancelled && <>
        <div><h1 style={S(H1)}>Pick a new time</h1><p style={S('margin:6px 0 0;color:#5E6673;font-size:15px')}>{m.changeLine}</p></div>
        <Picker m={m} cols="repeat(4,minmax(0,1fr))" dayW={60} pad={20} />
        {!!m.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{m.error}</p>}
        <div style={S('display:flex;gap:10px')}>
          <button onClick={m.confirmResched} disabled={m.busy} style={S(half + 'border:0;background:#0E1116;color:#FFFFFF')}>{m.busy ? 'Saving…' : 'Confirm new time'}</button>
          <button className="ghost" onClick={m.keep} style={S(half + 'border:1px solid #E1E4E9;background:#FFFFFF;color:#0E1116')}>Keep current time</button>
        </div>
      </>}
      {m.mode === 'cancel' && !m.cancelled && (
        <div style={S(CARD(20))}>
          <div><h1 style={S(H1)}>Cancel this appointment?</h1><p style={S('margin:8px 0 0;color:#5E6673;font-size:15px')}>{short} with {p.staffName}, {fmtDur(m.totalDur)}, {m.money(m.totalCents)}.</p></div>
          <p style={S('margin:0;padding:14px 16px;border-radius:16px;background:#F4F5F7;font-size:14px')}>{m.cancelNote}</p>
          <Reasons m={m} />
          {!!m.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{m.error}</p>}
          <div style={S('display:flex;gap:10px')}>
            <button onClick={m.confirmCancel} disabled={m.busy} style={S(half + 'border:0;background:#C0261B;color:#FFFFFF')}>{m.busy ? 'Cancelling…' : 'Yes, cancel'}</button>
            <button className="ghost" onClick={m.keep} style={S(half + 'border:1px solid #E1E4E9;background:#FFFFFF;color:#0E1116')}>Keep appointment</button>
          </div>
        </div>
      )}
      {m.cancelled && <CancelledCard m={m} pad={20} h1={26} />}
    </div>
  );
}

export function ManageView(p: Props) {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => { const mq = window.matchMedia('(max-width:900px)'); const f = () => setNarrow(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  const m = useManage(p);
  return <>
    {narrow !== false && <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}><Mobile m={m} /></div>}
    {narrow !== true && <div className="only-d d-cal cal-root" style={S("box-sizing:border-box;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;min-height:100vh")}><Desktop m={m} /></div>}
  </>;
}
