'use client';
// 1:1 conversion of the prototype's ManageBooking.dc.html and MobileManageBooking.dc.html (the client's appointment page).
// Markup and style strings are kept as written; the {{ }} holes are the appointment's real data and the handlers are real server actions.
import { DayStrip, TimeGrid } from '@/components/DayTimePicker';
import { clock12, duration, makeMoney, timeRange } from '@/lib/display';
import { addDaysYmd, dayInfo as dayOf } from '@/lib/cal';
import { TONE } from '@/lib/tones';
import { BLACK, Chip, DANGER, FieldError, Icon, KV_ROW, Note, Notice, OUTLINE, filterChipCss, dim } from '@/components/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { S } from '../../(dash)/calendar/pickers';
import { cancelBooking, manageSlots, moveBooking } from './actions';
import { publicStatus } from './shared';

type Item = { name: string; dur: number; cents: number };
type Props = {
  bookingRef: string; token: string; salonName: string; slug: string; address: string; currency: string; staffName: string; status: string;
  items: Item[]; startYmd: string; startMin: number; canAct: boolean; free: boolean; deadline: string;
  hours: ({ from: string; to: string } | null)[]; today: string; windowDays: number;
  /** Forms this client still has to complete before the visit. */
  forms?: { names: string[]; url: string } | null;
  /** Where to add the appointment to a calendar: a file for Apple and Outlook, and a Google Calendar link. */
  cal?: { ics: string; google: string } | null;
};
const REASONS = ['Change of plans', 'Found another time', 'Something else'];
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const dayInfo = (ymd: string) => { const d = dayOf(ymd); return { ymd, abbr: d.abbr, num: d.num, month: d.month.slice(0, 3), dow: d.wd, name: d.weekday, full: d.full, short: d.short }; };

function useManage(p: Props) {
  const days = useMemo(() => Array.from({ length: Math.min(p.windowDays, 57) }, (_, i) => dayInfo(addDaysYmd(p.today, i))), [p.today, p.windowDays]);
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
      setMode('view'); setError(''); setNotice('Moved to ' + days[rs.day].short + ', ' + clock12(rs.time));
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
  const changeLine = rs.time !== null ? 'From ' + whenDay.short + ', ' + clock12(when.min) + ' to ' + days[rs.day].short + ', ' + clock12(rs.time) : 'Pick a new day and time. Your appointment takes ' + duration(totalDur) + '.';
  return { p, days, money, mode, cancelled, when, whenDay, notice, rs, reason, setReason, error, busy, loading, slotErr, slots, grid, open, totalDur, totalCents, hoursDay,
    openResched, openCancel, keep, pickDay, pickTime, confirmResched, confirmCancel, cancelNote, policyLine, changeLine };
}
type M = ReturnType<typeof useManage>;

// The big buttons come from the shared set; inside these cards they sit in a column, so they keep their own height.
const BTN_D = BLACK + ';flex:0 0 auto;width:100%';
const BTN_G = OUTLINE + ';flex:0 0 auto;width:100%';
const BTN_R = DANGER + ';flex:0 0 auto;width:100%';
const CARD = (pad: number) => `box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:${pad}px;display:flex;flex-direction:column;gap:20px`;
const ASIDE_CARD = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:14px';

function Summary({ m, pad }: { m: M; pad: number }) {
  const { p } = m;
  return <div style={S(pad ? CARD(pad) : 'display:contents')}>
    <div><div style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{m.whenDay.full}</div><div style={S('margin-top:2px;color:#5E6673;font-size:15px')}>{timeRange(clock12(m.when.min), clock12(m.when.min + m.totalDur))}</div><div style={S('margin-top:2px;color:#5E6673;font-size:13.5px')}>{'Booking ' + m.p.bookingRef}</div></div>
    <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column')}>
      {p.items.map((it, i) => <li key={i} style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}><span style={S('min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{it.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{duration(it.dur)}</span></span><span style={S('flex:0 0 auto;font-size:15px;font-weight:600')}>{m.money(it.cents)}</span></li>)}
    </ul>
    <dl style={S('margin:0;display:flex;flex-direction:column')}>
      <div style={S(KV_ROW)}><dt style={S('color:#5E6673')}>With</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{p.staffName}</dd></div>
      <div style={S(KV_ROW)}><dt style={S('color:#5E6673')}>Where</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{p.address}</dd></div>
      <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:14px 0;border-top:1px solid #EEF0F3;border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Total, pay at the salon</dt><dd style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{m.money(m.totalCents)}</dd></div>
    </dl>
  </div>;
}

function StatusRow({ m }: { m: M }) {
  const st = publicStatus(m.p.status);
  return <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px')}><Chip tone={st.tone}>{st.label}</Chip>
    {!!m.notice && <Notice tone="blue">{m.notice}</Notice>}</div>;
}

function Picker({ m, cols, dayW, pad }: { m: M; cols: string; dayW: number; pad: number }) {
  const { p } = m;
  const closed = !m.hoursDay;
  const hasSlots = !closed && !m.loading && !m.slotErr && m.slots.length > 0;
  const msg = closed ? `We are closed on ${m.days[m.rs.day].name}s. Pick another day.` : m.loading ? 'Checking availability…' : m.slotErr ? m.slotErr : 'No times left on this day. Try another day.';
  return <>
    <DayStrip days={m.days.map((d) => ({ ymd: d.ymd, abbr: d.abbr, num: d.num, month: d.month, full: d.full, closed: !p.hours[d.dow] }))} selected={m.days[m.rs.day].ymd} onPick={(ymd) => m.pickDay(m.days.findIndex((d) => d.ymd === ymd))} width={dayW} pickClosed label="Choose a day" />
    <div style={S(CARD(pad))}>
      <h2 style={S('margin:0;font-size:16px;font-weight:600')}>{m.days[m.rs.day].full}</h2>
      {hasSlots && <TimeGrid times={m.grid.map((min) => ({ min, ok: !!m.open.get(min) }))} selected={m.rs.time} onPick={(min) => m.pickTime(min, m.open.get(min)!)} cols={cols} current={m.days[m.rs.day].ymd === m.when.ymd ? m.when.min : null} label="Available times" />}
      {!hasSlots && <Note>{msg}</Note>}
    </div>
  </>;
}

function Reasons({ m, phone }: { m: M; phone: boolean }) {
  return <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="cx-reason" style={S('font-size:14px;font-weight:600')}>Reason (optional)</span>
    <div role="group" className="hscroll" aria-labelledby="cx-reason" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
      {REASONS.map((r) => { const on = m.reason === r; return <button key={r} onClick={() => m.setReason(on ? null : r)} aria-pressed={on} style={S(filterChipCss(on, phone))}>{r}</button>; })}
    </div></div>;
}

function CancelledCard({ m, pad, h1 }: { m: M; pad: number; h1: number }) {
  return <div role="status" style={S(CARD(pad))}>
    <div style={S('flex:0 0 56px;width:56px;height:56px;border-radius:999px;background:' + TONE.red.bg + ';display:flex;align-items:center;justify-content:center')}><Icon name="close" size={24} color={TONE.red.fg} /></div>
    <div><h1 style={S(`margin:0;font-size:${h1}px;line-height:1.15;font-weight:600;letter-spacing:-0.03em`)}>Appointment cancelled</h1><p style={S('margin:8px 0 0;color:#5E6673;font-size:15px')}>{m.whenDay.short + ', ' + clock12(m.when.min)} with {m.p.staffName} has been cancelled. We have emailed you a confirmation.</p></div>
    <a href={`/b/${m.p.slug}/book`} style={S(BLACK + ';flex:0 0 auto;' + (pad === 28 ? 'max-width:320px' : ''))}>Book a new appointment</a>
  </div>;
}

/** Two ways to put the appointment in a calendar. Shown only while it can still go ahead. */
function CalendarLinks({ cal }: { cal?: { ics: string; google: string } | null }) {
  if (!cal) return null;
  return (<>
    <a href={cal.ics} download="appointment.ics" className="ghost" style={S(BTN_G + ';text-decoration:none')}>Add to Apple or Outlook calendar</a>
    <a href={cal.google} target="_blank" rel="noopener noreferrer" className="ghost" style={S(BTN_G + ';text-decoration:none')}>Add to Google Calendar</a>
  </>);
}

function Desktop({ m }: { m: M }) {
  const { p } = m;
  const view = m.mode === 'view' && !m.cancelled;
  const short = m.whenDay.short + ', ' + clock12(m.when.min);
  const showAside = !m.cancelled && (m.mode !== 'view' || p.canAct);
  return (
    <div className="bk-flow" style={S('max-width:1180px;margin:0 auto;box-sizing:border-box;padding:24px 32px 56px;display:flex;flex-direction:column;gap:28px')}>
      <header style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px')}>
        <div style={S('display:flex;align-items:center;gap:12px')}><div><a href={'/b/' + p.slug} style={S('display:block;font-size:17px;font-weight:600;letter-spacing:-0.01em;color:#0E1116;text-decoration:none')}>{p.salonName}</a><div style={S('font-size:13px;color:#5E6673')}>Manage your booking</div></div></div>
      </header>
      {view && <div style={S('display:flex;flex-direction:column;gap:20px')}>
        <StatusRow m={m} />
        <h1 style={S('margin:0;font-size:34px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>Your appointment</h1>
      </div>}
      {m.mode === 'resched' && !m.cancelled && <div><h1 style={S('margin:0;font-size:34px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>Pick a new time</h1><p style={S('margin:6px 0 0;color:#5E6673;font-size:15px')}>Your appointment takes {duration(m.totalDur)}.</p></div>}
      {m.mode === 'cancel' && !m.cancelled && <div><h1 style={S('margin:0;font-size:34px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>Cancel this appointment?</h1><p style={S('margin:6px 0 0;color:#5E6673;font-size:15px')}>{short} with {p.staffName}, {duration(m.totalDur)}, {m.money(m.totalCents)}.</p></div>}
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:24px')}>
        <div className="bk-flow" style={S('flex:999 1 400px;min-width:0;display:flex;flex-direction:column;gap:20px')}>
          {view && <Summary m={m} pad={28} />}
          {m.mode === 'resched' && !m.cancelled && <Picker m={m} cols="repeat(auto-fill,minmax(92px,1fr))" dayW={84} pad={28} />}
          {m.mode === 'cancel' && !m.cancelled && <div style={S(CARD(28))}>
            <p style={S('margin:0;padding:14px 16px;border-radius:16px;background:#F4F5F7;font-size:14px')}>{m.cancelNote}</p>
            <Reasons m={m} phone={false} />
          </div>}
          {m.cancelled && <CancelledCard m={m} pad={28} h1={34} />}
        </div>
        {showAside && (
          <aside className="bk-flow" style={S('flex:1 1 320px;max-width:380px;min-width:0;position:sticky;top:24px;display:flex;flex-direction:column;gap:16px')}>
            {view && !!m.p.forms && <div style={S(ASIDE_CARD + ';background:' + TONE.purple.bg + ';border-color:#D9D1FF')}>
              <h2 style={S('margin:0;font-size:18px;font-weight:600;letter-spacing:-0.02em;color:' + TONE.purple.fg)}>Before your visit</h2>
              <p style={S('margin:0;color:' + TONE.purple.fg + ';font-size:14px;overflow-wrap:anywhere')}>Please complete {m.p.forms.names.join(' and ')}. It takes about two minutes.</p>
              <a href={m.p.forms.url} style={S(BTN_D)}>Complete your form</a>
            </div>}
            {view && <div style={S(ASIDE_CARD)}>
              <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Manage your appointment</h2>
              <Note>{m.policyLine}</Note>
              <button onClick={m.openResched} style={S(BTN_D)}>Reschedule</button>
              <button className="ghost" onClick={m.openCancel} style={S(BTN_G)}>Cancel appointment</button>
              <CalendarLinks cal={p.cal} />
            </div>}
            {m.mode === 'resched' && <div style={S(ASIDE_CARD)}>
              <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Your change</h2>
              <Note>{m.changeLine}</Note>
              {!!m.error && <FieldError>{m.error}</FieldError>}
              <button onClick={m.confirmResched} disabled={m.busy} style={S(BTN_D + dim(m.busy))}>{m.busy ? 'Saving…' : 'Confirm new time'}</button>
              <button className="ghost" onClick={m.keep} style={S(BTN_G)}>Keep current time</button>
            </div>}
            {m.mode === 'cancel' && <div style={S(ASIDE_CARD)}>
              <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Confirm cancellation</h2>
              <Note>{m.cancelNote}</Note>
              {!!m.error && <FieldError>{m.error}</FieldError>}
              <button onClick={m.confirmCancel} disabled={m.busy} style={S(BTN_R + dim(m.busy))}>{m.busy ? 'Cancelling…' : 'Cancel appointment'}</button>
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
  const short = m.whenDay.short + ', ' + clock12(m.when.min);
  const H1 = 'margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em';
  const col = 'display:flex;flex-direction:column;gap:10px';
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
            <div style={S(col)}>
              <button onClick={m.openResched} style={S(BTN_D)}>Reschedule</button>
              <button className="ghost" onClick={m.openCancel} style={S(BTN_G)}>Cancel appointment</button>
              <CalendarLinks cal={p.cal} />
            </div>
          </>}
        </div>
      </>}
      {m.mode === 'resched' && !m.cancelled && <>
        <div><h1 style={S(H1)}>Pick a new time</h1><p style={S('margin:6px 0 0;color:#5E6673;font-size:15px')}>{m.changeLine}</p></div>
        <Picker m={m} cols="repeat(4,minmax(0,1fr))" dayW={60} pad={20} />
        {!!m.error && <FieldError>{m.error}</FieldError>}
        <div style={S(col)}>
          <button onClick={m.confirmResched} disabled={m.busy} style={S(BTN_D + dim(m.busy))}>{m.busy ? 'Saving…' : 'Confirm new time'}</button>
          <button className="ghost" onClick={m.keep} style={S(BTN_G)}>Keep current time</button>
        </div>
      </>}
      {m.mode === 'cancel' && !m.cancelled && (
        <div style={S(CARD(20))}>
          <div><h1 style={S(H1)}>Cancel this appointment?</h1><p style={S('margin:8px 0 0;color:#5E6673;font-size:15px')}>{short} with {p.staffName}, {duration(m.totalDur)}, {m.money(m.totalCents)}.</p></div>
          <p style={S('margin:0;padding:14px 16px;border-radius:16px;background:#F4F5F7;font-size:14px')}>{m.cancelNote}</p>
          <Reasons m={m} phone />
          {!!m.error && <FieldError>{m.error}</FieldError>}
          <div style={S(col)}>
            <button onClick={m.confirmCancel} disabled={m.busy} style={S(BTN_R + dim(m.busy))}>{m.busy ? 'Cancelling…' : 'Cancel appointment'}</button>
            <button className="ghost" onClick={m.keep} style={S(BTN_G)}>Keep appointment</button>
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
