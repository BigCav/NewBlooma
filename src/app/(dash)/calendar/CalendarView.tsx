'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import {
  BLOCK_DURS, BLOCK_KINDS, TONE_LIST, addDaysYmd, dayInfo, dollars, fmtMin, hourLabel, initials, slotsBetween, weekStartOf,
  type CalBlock, type CalBooking, type CalHours, type CalService, type CalStaff,
} from '@/lib/cal';
import { MobileCalendar } from './MobileCalendar';
import type { CalSettings } from '@/lib/cal';
import { addWalkIn, approveBooking, cancelBooking, checkInBooking, createBlock, dayAvailability, deleteBlock, noShowBooking, rescheduleBooking, startCheckout, walkinPlan } from './actions';

const PX = 72;
const INK = '#0E1116', MUTED = '#5E6673', LINE = '#E6E8EC', LINE2 = '#E1E4E9';
const HATCH = 'repeating-linear-gradient(135deg,#F7F8FA 0,#F7F8FA 8px,#ECEEF2 8px,#ECEEF2 16px)';
const btnDark: CSSProperties = { height: 44, border: 0, borderRadius: 999, background: INK, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', flex: '1 1 0', padding: '0 18px' };
const btnGhost: CSSProperties = { height: 44, border: `1px solid ${LINE2}`, borderRadius: 999, background: '#fff', color: INK, fontSize: 14, fontWeight: 500, cursor: 'pointer', flex: '1 1 0', padding: '0 18px' };
const chip = (on: boolean, off = false): CSSProperties => ({ flex: '0 0 auto', height: 44, padding: '0 16px', borderRadius: 999, fontSize: 14, fontWeight: 500, border: `1px solid ${on ? INK : LINE2}`, background: on ? INK : off ? '#F4F5F7' : '#fff', color: on ? '#fff' : off ? '#8A93A0' : INK, cursor: off ? 'default' : 'pointer' });
const slotBtn = (on: boolean, off: boolean): CSSProperties => ({ width: '100%', height: 44, padding: 0, borderRadius: 14, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', border: `1px solid ${on ? INK : off ? '#EEF0F3' : LINE2}`, background: on ? INK : off ? '#F4F5F7' : '#fff', color: on ? '#fff' : off ? '#8A93A0' : INK, textDecoration: off ? 'line-through' : 'none', cursor: off ? 'default' : 'pointer' });
const dayBtn = (on: boolean, closed: boolean): CSSProperties => ({ flex: '0 0 60px', height: 76, boxSizing: 'border-box', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, font: 'inherit', border: `1px solid ${on ? INK : LINE}`, background: on ? INK : closed ? '#F4F5F7' : '#fff', color: on ? '#fff' : closed ? '#8A93A0' : INK, cursor: closed ? 'default' : 'pointer' });
const noteStyle = (bg: string, fg: string): CSSProperties => ({ borderRadius: 16, background: bg, color: fg, padding: '12px 14px', fontSize: 13.5, fontWeight: 500 });
const h2: CSSProperties = { margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' };
const lbl: CSSProperties = { fontSize: 14, fontWeight: 600 };

type Status = CalBooking['status'];
const CHIP: Record<string, { t: string; bg: string; fg: string }> = {
  pending: { t: 'Needs approval', bg: '#FFF4E5', fg: '#B25E09' }, confirmed: { t: 'Confirmed', bg: '#DDF3EA', fg: '#14624A' },
  live: { t: 'In progress', bg: '#5B3DF5', fg: '#FFFFFF' }, done: { t: 'Done', bg: '#EEF0F3', fg: '#4A525E' },
};
const kind = (s: Status) => (s === 'checked_in' || s === 'in_progress' ? 'live' : s === 'completed' ? 'done' : s);
const chipStyle = (k: string): CSSProperties => ({ display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 500, background: CHIP[k].bg, color: CHIP[k].fg });
const first = (n: string) => n.split(' ')[0];

function Icon({ d, size = 18, sw = 1.8 }: { d: string; size?: number; sw?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
function nowIn(tz: string) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date());
  return Number(p.find((x) => x.type === 'hour')!.value) * 60 + Number(p.find((x) => x.type === 'minute')!.value);
}

export function CalendarView(props: {
  day: string; today: string; view: 'day' | 'week'; nowMin: number; tz: string; team: CalStaff[]; bookings: CalBooking[]; blocks: CalBlock[];
  hours: CalHours[]; services: CalService[]; staffFilter: string; slug: string; offers: Record<string, string[]>; cfg: CalSettings;
}) {
  const { day, today, view, tz, team, bookings, blocks, hours, services } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nowMin, setNow] = useState(props.nowMin);
  useEffect(() => { const t = setInterval(() => setNow(nowIn(tz)), 30000); setNow(nowIn(tz)); return () => clearInterval(t); }, [tz]);

  const [staffSel, setStaffSel] = useState(props.staffFilter);
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'resched' | 'block' | 'blockview' | 'walkin'>('view');
  const [sheet, setSheet] = useState(false);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [wkOpen, setWkOpen] = useState<Record<string, boolean>>({});

  const di = dayInfo(day);
  const hrsOf = (ymd: string) => hours[dayInfo(ymd).wd];
  const wkStaff = staffSel === 'all' ? team[0]?.id : staffSel;
  const go = (d: string, v = view) => start(() => { setMode('view'); setSheet(false); setNotice(''); setError(''); router.push(`/calendar?d=${d}&v=${v}`); });
  const step = view === 'week' ? 7 : 1;

  const dayB = useMemo(() => bookings.filter((b) => b.dayYmd === day), [bookings, day]);
  const selB = bookings.find((b) => b.id === sel) ?? null;
  const selBlock = blocks.find((b) => b.id === blockId) ?? null;
  const staffName = (id: string) => team.find((t) => t.id === id)?.name ?? '';
  const q = query.trim().toLowerCase();
  const results = q ? bookings.filter((b) => (b.client + ' ' + b.services + ' ' + staffName(b.staffId)).toLowerCase().includes(q)).sort((a, b) => a.dayYmd.localeCompare(b.dayYmd) || a.start - b.start).slice(0, 12) : [];

  // Grid range
  const openHrs = hours.filter((h) => h.open);
  const gStart = openHrs.length ? Math.floor(Math.min(...openHrs.map((h) => h.from)) / 60) : 8;
  const gEnd = openHrs.length ? Math.ceil(Math.max(...openHrs.map((h) => h.to)) / 60) : 18;
  const gHours = Array.from({ length: gEnd - gStart }, (_, i) => gStart + i);
  const gH = (gEnd - gStart) * PX;
  const topOf = (m: number) => (m / 60 - gStart) * PX;

  const dayHrs = hrsOf(day);
  const pool = staffSel === 'all' ? team : team.filter((t) => t.id === staffSel);
  const busyAt = (list: CalBooking[], blk: CalBlock[], sid: string, t: number) =>
    list.some((b) => b.staffId === sid && t < b.end && b.start < t + 30) || blk.some((b) => b.staffId === sid && b.dayYmd === day && t < b.end && b.start < t + 30);
  let nextOpening = dayHrs?.open ? 'None left' : 'Closed', openingWho = staffSel === 'all' ? 'Whole team' : pool[0]?.name ?? '';
  if (dayHrs?.open) {
    for (let t = Math.max(dayHrs.from, day === today ? Math.ceil(nowMin / 30) * 30 : 0); t + 30 <= dayHrs.to; t += 30) {
      if (pool.some((m) => !busyAt(dayB, blocks, m.id, t))) { nextOpening = fmtMin(t); break; }
    }
  }
  const liveCount = dayB.length, revenueC = dayB.reduce((a, b) => a + b.priceCents, 0);

  const openBooking = (id: string) => { setSel(id); setMode('view'); setSheet(true); setError(''); setNotice(''); };
  const closePanel = () => { setMode('view'); setSheet(false); setError(''); };
  const run = (fn: () => Promise<{ error?: string; note?: string } | void>, ok?: string, after?: () => void) => start(async () => {
    setError(''); const r = await fn(); if (r && 'error' in r && r.error) { setError(r.error); return; }
    setNotice((r && 'note' in r && r.note) || ok || ''); after?.(); router.refresh();
  });

  // ---------- booking vm ----------
  const vm = (b: CalBooking) => {
    const k = kind(b.status), tone = TONE_LIST[b.tone % 4];
    return { b, k, tone, time: `${fmtMin(b.start)} – ${fmtMin(b.end)}`, line: `${b.services} with ${first(staffName(b.staffId))}` };
  };
  const primary = (b: CalBooking) => {
    const k = kind(b.status);
    if (k === 'pending') return { label: 'Approve', fn: () => run(() => approveBooking(b.id), `${first(b.client)} approved`) };
    if (k === 'confirmed') return { label: 'Check in', fn: () => run(() => checkInBooking(b.id), `${first(b.client)} checked in`) };
    if (k === 'live') return { label: b.saleId ? 'Continue checkout' : 'Start checkout', fn: () => { const fd = new FormData(); fd.set('id', b.id); start(async () => { await startCheckout(fd); }); } };
    return b.saleId ? { label: 'View sale', fn: () => router.push(`/sales/${b.saleId}`) } : null;
  };

  // ---------- panels ----------
  const Row = ({ k, v, last }: { k: string; v: ReactNode; last?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderTop: '1px solid #EEF0F3', ...(last ? { borderBottom: '1px solid #EEF0F3' } : {}) }}>
      <dt style={{ color: MUTED }}>{k}</dt><dd style={{ margin: 0, fontWeight: 500, textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</dd>
    </div>
  );
  const Err = () => (error ? <p role="alert" style={{ margin: 0, color: '#B42318', fontSize: 13.5, fontWeight: 500 }}>{error}</p> : null);

  const upNext = bookings.filter((b) => b.dayYmd > today || (b.dayYmd === today && b.start > nowMin)).sort((a, b) => a.dayYmd.localeCompare(b.dayYmd) || a.start - b.start).slice(0, 4);

  const ViewPanel = () => {
    const b = selB ?? dayB.slice().sort((x, y) => x.start - y.start)[0] ?? null;
    if (!b) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={h2}>Nothing booked</h2>
        <p style={{ margin: 0, color: MUTED, fontSize: 14 }}>{dayHrs?.open ? `No appointments on ${di.short} yet.` : 'The salon is closed that day.'}</p>
        <Link href={`/calendar/new?d=${day}`} style={{ ...btnDark, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>New appointment</Link>
      </div>
    );
    const v = vm(b), p = primary(b), done = v.k === 'done';
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={chipStyle(v.k)}>{CHIP[v.k].t}</span>
            {b.paid && <span style={{ padding: '4px 12px', borderRadius: 999, background: '#DDF3EA', color: '#14624A', fontSize: 12.5, fontWeight: 500 }}>Paid</span>}
            {notice && <span role="status" style={{ padding: '4px 12px', borderRadius: 999, background: '#DDF3EA', color: '#14624A', fontSize: 12.5, fontWeight: 500 }}>{notice}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: '0 0 48px', width: 48, height: 48, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, background: v.tone.bg, color: v.tone.fg }}>{initials(b.client)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2, overflowWrap: 'anywhere' }}>{b.client}</div>
              <div style={{ fontSize: 14, color: MUTED, overflowWrap: 'anywhere' }}>{b.services}</div>
            </div>
          </div>
          <dl style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
            <Row k="Day" v={dayInfo(b.dayYmd).short} /><Row k="Time" v={v.time} /><Row k="With" v={staffName(b.staffId)} /><Row k="Price" v={dollars(b.priceCents)} last />
          </dl>
          <Err />
          <div style={{ display: 'flex', gap: 10 }}>
            {p && <button disabled={pending} onClick={p.fn} style={btnDark}>{p.label}</button>}
            {done ? <Link href={`/calendar/new?d=${b.dayYmd}`} style={{ ...btnGhost, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Rebook</Link>
              : <button onClick={() => { setSel(b.id); setMode('resched'); setRs({ day: b.dayYmd, time: null }); setError(''); setNotice(''); }} style={btnGhost}>Reschedule</button>}
          </div>
          <Link href={`/calendar/${b.id}`} style={{ ...btnGhost, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Booking details</Link>
          {!done && <div style={{ display: 'flex', gap: 10 }}>
            <button disabled={pending} onClick={() => run(() => noShowBooking(b.id), 'Marked no-show', () => setSel(null))} style={btnGhost}>No-show</button>
            <button disabled={pending} onClick={() => run(() => cancelBooking(b.id), 'Booking cancelled', () => { setSel(null); closePanel(); })} style={{ ...btnGhost, color: '#B42318' }}>Cancel booking</button>
          </div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600 }}>Up next</h2>
          {upNext.length === 0 && <p style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>Nothing else coming up.</p>}
          {upNext.map((u) => (
            <button key={u.id} onClick={() => openBooking(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 52, padding: '8px 10px', border: 0, borderRadius: 14, background: 'transparent', textAlign: 'left', color: INK, cursor: 'pointer', font: 'inherit' }}>
              <span style={{ flex: '0 0 10px', width: 10, height: 10, borderRadius: 999, background: TONE_LIST[u.tone % 4].dot }} />
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.client}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.services} with {first(staffName(u.staffId))}</span>
              </span>
              <span style={{ flex: '0 0 auto', fontSize: 13, color: MUTED }}>{u.dayYmd === today ? '' : dayInfo(u.dayYmd).short + ', '}{fmtMin(u.start)}</span>
            </button>
          ))}
        </div>
      </>
    );
  };

  // Reschedule
  const [rs, setRs] = useState<{ day: string; time: number | null }>({ day, time: null });
  const [rsAv, setRsAv] = useState<{ busy: { s: number; e: number }[]; open: boolean; from: number; to: number } | null>(null);
  useEffect(() => {
    if (mode !== 'resched' || !selB) return; let live = true; setRsAv(null);
    dayAvailability(rs.day, selB.staffId, selB.id).then((a) => live && setRsAv(a)); return () => { live = false; };
  }, [mode, rs.day, selB?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const upcomingDays = Array.from({ length: 14 }, (_, i) => dayInfo(addDaysYmd(today, i)));
  const slotState = (av: typeof rsAv, ymd: string, dur: number) => (t: number) => {
    if (!av || !av.open) return true;
    if (t + dur > av.to) return true;
    if (ymd === today && t < nowMin) return true;
    return av.busy.some((x) => t < x.e && x.s < t + dur);
  };
  const ReschedPanel = () => {
    if (!selB) return null; const b = selB, dur = b.end - b.start;
    const bad = slotState(rsAv, rs.day, dur);
    const slots = rsAv ? slotsBetween(rsAv.from, rsAv.open ? rsAv.to : rsAv.from) : [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div><h2 style={h2}>Reschedule</h2><p style={{ margin: '4px 0 0', color: MUTED, fontSize: 14 }}>{b.client}, {b.services} with {first(staffName(b.staffId))}.</p></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={lbl}>New day</span>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {upcomingDays.map((d) => { const closed = !hrsOf(d.ymd)?.open; return (
              <button key={d.ymd} disabled={closed} aria-pressed={rs.day === d.ymd} aria-label={d.full + (closed ? ', closed' : '')} onClick={() => setRs({ day: d.ymd, time: null })} style={dayBtn(rs.day === d.ymd, closed)}>
                <span style={{ fontSize: 12.5 }}>{d.abbr}</span><span style={{ fontSize: 17, fontWeight: 600 }}>{d.num}</span></button>); })}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={lbl}>New time</span>
          {!rsAv ? <p style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>Checking {first(staffName(b.staffId))}'s day…</p> : !rsAv.open ? <p style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>{first(staffName(b.staffId))} is not working that day.</p> :
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
              {slots.map((t) => { const off = bad(t); return <button key={t} disabled={off} aria-pressed={rs.time === t} onClick={() => setRs({ ...rs, time: t })} style={slotBtn(rs.time === t && !off, off)}>{fmtMin(t)}</button>; })}
            </div>}
        </div>
        <Err />
        <div style={{ display: 'flex', gap: 10 }}>
          <button disabled={pending} onClick={() => { if (rs.time === null) { setError('Choose a new time from the list.'); return; } run(() => rescheduleBooking(b.id, rs.day, rs.time!), `${first(b.client)} moved to ${dayInfo(rs.day).short}, ${fmtMin(rs.time!)}`, () => { setMode('view'); if (rs.day !== day) go(rs.day); }); }} style={btnDark}>Move appointment</button>
          <button onClick={() => { setMode('view'); setError(''); }} style={btnGhost}>Cancel</button>
        </div>
      </div>
    );
  };

  // Block time
  const [bf, setBf] = useState<{ s: string; kind: string; dur: number; day: string; start: number | null }>({ s: '', kind: 'lunch', dur: 60, day, start: null });
  const [bfAv, setBfAv] = useState<typeof rsAv>(null);
  useEffect(() => {
    if (mode !== 'block' || !bf.s) { setBfAv(null); return; } let live = true; setBfAv(null);
    dayAvailability(bf.day, bf.s).then((a) => live && setBfAv(a)); return () => { live = false; };
  }, [mode, bf.s, bf.day]);
  const BlockPanel = () => {
    const bad = slotState(bfAv, bf.day, bf.dur);
    const slots = bfAv && bfAv.open ? slotsBetween(bfAv.from, bfAv.to) : [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div><h2 style={h2}>Block time</h2><p style={{ margin: '4px 0 0', color: MUTED, fontSize: 14 }}>Lunch, time off or training. Clients cannot book blocked time.</p></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={lbl}>Team member</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{team.map((t) => <button key={t.id} aria-pressed={bf.s === t.id} onClick={() => setBf({ ...bf, s: t.id, start: null })} style={chip(bf.s === t.id)}>{first(t.name)}</button>)}</div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={lbl}>Reason</span>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>{BLOCK_KINDS.map(([k, l]) => <button key={k} aria-pressed={bf.kind === k} onClick={() => setBf({ ...bf, kind: k })} style={chip(bf.kind === k)}>{l}</button>)}</div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={lbl}>Length</span>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>{BLOCK_DURS.map(([m, l]) => <button key={m} aria-pressed={bf.dur === m} onClick={() => setBf({ ...bf, dur: m, start: null })} style={chip(bf.dur === m)}>{l}</button>)}</div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={lbl}>Day</span>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {upcomingDays.map((d) => { const closed = !hrsOf(d.ymd)?.open; return (
              <button key={d.ymd} disabled={closed} aria-pressed={bf.day === d.ymd} onClick={() => setBf({ ...bf, day: d.ymd, start: null })} style={dayBtn(bf.day === d.ymd, closed)}>
                <span style={{ fontSize: 12.5 }}>{d.abbr}</span><span style={{ fontSize: 17, fontWeight: 600 }}>{d.num}</span></button>); })}
          </div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={lbl}>Starts at</span>
          {!bf.s ? <p style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>Choose a team member first.</p> : !bfAv ? <p style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>Checking the day…</p> : !bfAv.open ? <p style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>Not working that day.</p> :
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
              {slots.map((t) => { const off = bad(t); return <button key={t} disabled={off} aria-pressed={bf.start === t} onClick={() => setBf({ ...bf, start: t })} style={slotBtn(bf.start === t && !off, off)}>{fmtMin(t)}</button>; })}
            </div>}
        </div>
        <Err />
        <div style={{ display: 'flex', gap: 10 }}>
          <button disabled={pending} onClick={() => {
            if (!bf.s) return setError('Choose a team member.'); if (bf.start === null) return setError('Choose a start time from the list.');
            run(() => createBlock(bf.s, bf.day, bf.start!, bf.dur, bf.kind), `${BLOCK_KINDS.find((k) => k[0] === bf.kind)![1]} blocked for ${first(staffName(bf.s))}`, () => { setMode('view'); setSheet(false); });
          }} style={btnDark}>Block time</button>
          <button onClick={closePanel} style={btnGhost}>Cancel</button>
        </div>
      </div>
    );
  };
  const BlockView = () => {
    if (!selBlock) return null; const b = selBlock;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span style={{ display: 'inline-block', alignSelf: 'flex-start', padding: '4px 12px', borderRadius: 999, background: '#EEF0F3', color: '#4A525E', fontSize: 12.5, fontWeight: 500 }}>Blocked</span>
        <div><div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>{BLOCK_KINDS.find((k) => k[0] === b.kind)?.[1] ?? b.kind}</div><div style={{ fontSize: 14, color: MUTED }}>{staffName(b.staffId)}</div></div>
        <dl style={{ margin: 0 }}><Row k="Day" v={dayInfo(b.dayYmd).full} /><Row k="Time" v={`${fmtMin(b.start)} – ${fmtMin(b.end)}`} last /></dl>
        <p style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>Clients cannot book {first(staffName(b.staffId))} during this time.</p>
        <Err />
        <div style={{ display: 'flex', gap: 10 }}>
          <button disabled={pending} onClick={() => run(() => deleteBlock(b.id), 'Block removed', () => { setMode('view'); setSheet(false); })} style={btnDark}>Remove block</button>
          <button onClick={closePanel} style={btnGhost}>Close</button>
        </div>
      </div>
    );
  };

  // Walk-in
  const cats = useMemo(() => Array.from(new Set(services.map((s) => s.cat))), [services]);
  const [wi, setWi] = useState<{ name: string; svc: string; pro: string; cat: string }>({ name: '', svc: '', pro: 'any', cat: cats[0] ?? '' });
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof walkinPlan>> | null>(null);
  useEffect(() => {
    if (mode !== 'walkin' || !wi.svc) { setPlan(null); return; } let live = true; setPlan(null);
    walkinPlan(wi.svc, wi.pro).then((p) => live && setPlan(p)); return () => { live = false; };
  }, [mode, wi.svc, wi.pro]);
  const WalkinPanel = () => {
    let text = 'Pick a service to see who is free.', st = noteStyle('#F4F5F7', MUTED);
    const svc = services.find((s) => s.id === wi.svc);
    if (svc && !plan) text = 'Checking who is free…';
    else if (svc && plan && 'startsAt' in plan) { text = `${first(plan.staff)} is free ${plan.nowish ? 'now' : 'from ' + plan.label}. ${svc.dur} min, ${dollars(svc.priceCents)}.`; st = noteStyle('#DDF3EA', '#14624A'); }
    else if (svc && plan && 'none' in plan) { text = `No free time today for ${svc.name}.`; st = noteStyle('#FDECEA', '#B42318'); }
    else if (svc && plan && 'error' in plan) { text = plan.error ?? 'Could not check availability.'; st = noteStyle('#FDECEA', '#B42318'); }
    const submit = (pay: boolean) => run(async () => {
      const r = await addWalkIn(wi.name, wi.svc, wi.pro); if (r.error) return r;
      if (pay && r.id) { const fd = new FormData(); fd.set('id', r.id); await startCheckout(fd); }
      setMode('view'); setSheet(false); setWi({ name: '', svc: '', pro: 'any', cat: wi.cat }); return r;
    });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div><h2 style={h2}>Walk-in</h2><p style={{ margin: '4px 0 0', color: MUTED, fontSize: 14 }}>We will find the first free time today.</p></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><label htmlFor="wi-name" style={lbl}>Client name</label>
          <input id="wi-name" value={wi.name} onChange={(e) => setWi({ ...wi, name: e.target.value })} placeholder="Full name" style={{ boxSizing: 'border-box', width: '100%', height: 44, padding: '0 14px', border: `1px solid ${LINE2}`, borderRadius: 14, font: 'inherit', color: INK, background: '#fff' }} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><span style={lbl}>Service</span>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>{cats.map((c) => <button key={c} aria-pressed={wi.cat === c} onClick={() => setWi({ ...wi, cat: c })} style={{ ...chip(wi.cat === c), height: 40 }}>{c}</button>)}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{services.filter((s) => s.cat === wi.cat).map((s) => <button key={s.id} aria-pressed={wi.svc === s.id} onClick={() => setWi({ ...wi, svc: wi.svc === s.id ? '' : s.id })} style={{ ...chip(wi.svc === s.id), height: 40 }}>{s.name} · {dollars(s.priceCents)}</button>)}</div>
          {services.length === 0 && <p style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>Add services first, under Services.</p>}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={lbl}>Team member</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{[{ id: 'any', name: 'First available' }, ...team].map((t) => <button key={t.id} aria-pressed={wi.pro === t.id} onClick={() => setWi({ ...wi, pro: t.id })} style={{ ...chip(wi.pro === t.id), height: 40 }}>{t.id === 'any' ? t.name : first(t.name)}</button>)}</div></div>
        <div role="status" style={st}>{text}</div>
        <Err />
        <div style={{ display: 'flex', gap: 10 }}>
          <button disabled={pending} onClick={() => submit(true)} style={btnDark}>Add &amp; check out</button>
          <button disabled={pending} onClick={() => submit(false)} style={btnGhost}>Add to calendar</button>
        </div>
        <button onClick={closePanel} style={{ ...btnGhost, flex: 'none' }}>Cancel</button>
      </div>
    );
  };
  const SearchPanel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div><h2 style={h2}>Search results</h2><p style={{ margin: '4px 0 0', color: MUTED, fontSize: 14 }}>{results.length} {results.length === 1 ? 'appointment' : 'appointments'} for "{query.trim()}" in this view</p></div>
      {results.length === 0 && <p style={{ margin: 0, color: MUTED, fontSize: 14 }}>Nothing matches. Try a client name, a service or a team member.</p>}
      {results.map((r) => { const t = TONE_LIST[r.tone % 4]; return (
        <button key={r.id} onClick={() => { setQuery(''); if (r.dayYmd !== day && view === 'day') go(r.dayYmd); openBooking(r.id); }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, padding: '8px 10px', border: 0, borderRadius: 14, background: 'transparent', textAlign: 'left', color: INK, cursor: 'pointer', font: 'inherit' }}>
          <span style={{ flex: '0 0 40px', width: 40, height: 40, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, background: t.bg, color: t.fg }}>{initials(r.client)}</span>
          <span style={{ flex: '1 1 auto', minWidth: 0 }}><span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{r.client}</span><span style={{ display: 'block', fontSize: 12.5, color: MUTED }}>{r.services} with {first(staffName(r.staffId))}</span></span>
          <span style={{ fontSize: 12.5, color: MUTED }}>{dayInfo(r.dayYmd).short}, {fmtMin(r.start)}</span>
        </button>); })}
    </div>
  );
  const Panel = () => mode === 'resched' ? ReschedPanel() : mode === 'block' ? BlockPanel() : mode === 'blockview' ? BlockView() : mode === 'walkin' ? WalkinPanel() : q ? SearchPanel() : ViewPanel();

  const openWalkin = () => { setMode('walkin'); setSheet(true); setError(''); setNotice(''); setWi({ name: '', svc: '', pro: 'any', cat: cats[0] ?? '' }); };
  const openBlock = () => { setMode('block'); setSheet(true); setError(''); setNotice(''); setBf({ s: team[0]?.id ?? '', kind: 'lunch', dur: 60, day, start: null }); };

  // ---------- event rendering (desktop) ----------
  const evStyle = (b: CalBooking, wk: boolean): CSSProperties => {
    const t = TONE_LIST[b.tone % 4], compact = b.end - b.start <= 30, on = b.id === sel && mode === 'view';
    return { position: 'absolute', left: wk ? 3 : 5, right: wk ? 3 : 5, top: topOf(b.start) + 2, height: ((b.end - b.start) / 60) * PX - 4, boxSizing: 'border-box', border: 0, borderRadius: wk ? 10 : 12, textAlign: 'left', overflow: 'hidden', font: 'inherit', background: t.bg, color: t.fg, padding: compact ? '0 10px' : wk ? '6px 8px' : '7px 10px', display: 'flex', flexDirection: compact && !wk ? 'row' : 'column', alignItems: compact && !wk ? 'center' : 'flex-start', justifyContent: compact && wk ? 'center' : undefined, gap: compact ? 8 : 1, outline: on ? '1.5px solid rgba(14,17,22,0.35)' : 'none', outlineOffset: on ? 1 : 0, cursor: 'pointer', opacity: b.status === 'pending' ? 0.85 : 1 };
  };
  const blockStyle = (b: CalBlock, wk: boolean): CSSProperties => ({ position: 'absolute', left: wk ? 3 : 5, right: wk ? 3 : 5, top: topOf(b.start) + 2, height: ((b.end - b.start) / 60) * PX - 4, boxSizing: 'border-box', border: '1px solid #DDE0E6', borderRadius: 12, background: HATCH, color: '#4A525E', font: 'inherit', textAlign: 'left', padding: '6px 10px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 1, cursor: 'pointer', outline: mode === 'blockview' && blockId === b.id ? '1.5px solid rgba(14,17,22,0.35)' : 'none' });
  const Paid = () => <span aria-hidden="true" style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 999, background: '#14624A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19 7.5" /></svg></span>;
  const nowTop = topOf(nowMin);
  const showNow = nowMin >= gStart * 60 && nowMin <= gEnd * 60;
  const blockKindLabel = (k: string) => BLOCK_KINDS.find((x) => x[0] === k)?.[1] ?? k;

  const titleDay = day === today ? 'Today' : di.weekday;
  const wkS = weekStartOf(day), wkLabel = `${dayInfo(wkS).short} to ${dayInfo(addDaysYmd(wkS, 6)).short}`;
  const pageTitle = view === 'week' ? (wkS === weekStartOf(today) ? 'This week' : wkS === addDaysYmd(weekStartOf(today), 7) ? 'Next week' : 'Week of ' + dayInfo(wkS).num + ' ' + dayInfo(wkS).month.slice(0, 3)) : titleDay;
  const pageSub = view === 'week' ? `${wkLabel}, ${staffName(wkStaff ?? '')}` : `${di.weekday}, ${di.num} ${di.month}`;

  // ================= DESKTOP =================
  const desktop = (
    <div className="only-d" style={{ padding: '28px 32px 40px 8px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 88 }}>
        <div><h1 style={{ margin: 0, fontSize: 34, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{pageTitle}</h1><p style={{ margin: '6px 0 0', color: MUTED, fontSize: 15 }}>{pageSub}</p></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input aria-label="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients" style={{ boxSizing: 'border-box', width: 260, height: 44, padding: '0 18px', border: `1px solid ${LINE2}`, borderRadius: 999, font: 'inherit', color: INK, background: '#fff' }} />
          <Link href={`/calendar/new?d=${day}`} style={{ height: 44, padding: '0 22px', borderRadius: 999, background: INK, color: '#fff', fontSize: 14.5, fontWeight: 500, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>New appointment</Link>
        </div>
      </div>
      <section aria-label="Today at a glance" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 64px' }}>
        {[['Appointments', String(liveCount)], ['Booked revenue', dollars(revenueC)], ['Next opening', nextOpening]].map(([k, v], i) => (
          <div key={k}><div style={{ color: MUTED, fontSize: 13.5 }}>{k}</div><div style={{ marginTop: 4, fontSize: 38, lineHeight: 1.1, fontWeight: 500, letterSpacing: '-0.03em' }}>{v}</div>{i === 2 && <div style={{ marginTop: 6, fontSize: 13, color: MUTED }}>{openingWho}</div>}</div>
        ))}
      </section>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 20 }}>
        <section aria-label="Schedule" style={{ flex: '999 1 620px', minWidth: 0, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 24, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${LINE}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button aria-label={view === 'week' ? 'Previous week' : 'Previous day'} onClick={() => go(addDaysYmd(day, -step))} style={{ width: 40, height: 40, border: `1px solid ${LINE2}`, borderRadius: 999, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon d="M14.5 6 8.5 12l6 6" /></button>
              <button aria-label={view === 'week' ? 'Next week' : 'Next day'} onClick={() => go(addDaysYmd(day, step))} style={{ width: 40, height: 40, border: `1px solid ${LINE2}`, borderRadius: 999, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon d="M9.5 6l6 6-6 6" /></button>
              <span style={{ marginLeft: 8, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{view === 'week' ? wkLabel : di.short}</span>
              {view === 'day' && !dayHrs?.open && <span style={{ color: MUTED, fontSize: 13.5 }}>Closed</span>}
              {day !== today && view === 'day' && <button onClick={() => go(today)} style={{ ...btnGhost, flex: 'none', height: 34, fontSize: 13 }}>Today</button>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={openWalkin} style={{ height: 40, padding: '0 16px', border: 0, borderRadius: 999, background: INK, color: '#fff', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>Walk-in</button>
              <button onClick={openBlock} style={{ height: 40, padding: '0 16px', border: `1px solid ${LINE2}`, borderRadius: 999, background: '#fff', color: INK, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>Block time</button>
            </div>
            <div role="group" aria-label="Calendar view" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: '#F4F5F7' }}>
              {(['day', 'week'] as const).map((v) => <button key={v} aria-pressed={view === v} onClick={() => { if (v === 'week' && staffSel === 'all') setStaffSel(team[0]?.id ?? 'all'); go(day, v); }} style={{ height: 34, padding: '0 16px', border: 0, borderRadius: 999, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', background: view === v ? INK : 'transparent', color: view === v ? '#fff' : INK }}>{v === 'day' ? 'Day' : 'Week'}</button>)}
            </div>
            <div role="group" aria-label="Filter by team member" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(view === 'week' ? [] : [{ id: 'all', name: 'Whole team' }]).concat(team.map((t) => ({ id: t.id, name: first(t.name) }))).map((c) => { const on = (view === 'week' ? wkStaff : staffSel) === c.id; return <button key={c.id} aria-pressed={on} onClick={() => setStaffSel(c.id)} style={{ height: 40, padding: '0 16px', borderRadius: 999, fontSize: 13.5, fontWeight: 500, border: `1px solid ${on ? INK : LINE2}`, background: on ? INK : '#fff', color: on ? '#fff' : INK, cursor: 'pointer' }}>{c.name}</button>; })}
            </div>
          </div>
          {team.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Add a team member to start taking appointments. <Link href="/team" style={{ fontWeight: 600, color: INK }}>Go to Team</Link></div>
          ) : view === 'day' ? (
            <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 760 }}>
              <div style={{ display: 'flex', borderBottom: `1px solid ${LINE}` }}>
                <div style={{ flex: '0 0 56px' }} />
                {pool.map((c) => (
                  <div key={c.id} style={{ flex: '1 1 0', minWidth: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderLeft: '1px solid #EEF0F3' }}>
                    <div style={{ flex: '0 0 34px', width: 34, height: 34, borderRadius: 999, background: '#EEF0F3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{initials(c.name)}</div>
                    <div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div><div style={{ fontSize: 12.5, color: MUTED }}>{c.role}</div></div>
                  </div>
                ))}
              </div>
              <div style={{ position: 'relative', display: 'flex' }}>
                <div style={{ flex: '0 0 56px' }}>{gHours.map((h) => <div key={h} style={{ height: PX, boxSizing: 'border-box', padding: '6px 12px 0 0', textAlign: 'right', fontSize: 12, color: MUTED }}>{hourLabel(h)}</div>)}</div>
                {pool.map((c) => (
                  <div key={c.id} style={{ flex: '1 1 0', minWidth: 0, position: 'relative', height: gH, borderLeft: '1px solid #EEF0F3', backgroundColor: dayHrs?.open ? '#fff' : '#F7F8FA', backgroundImage: 'linear-gradient(#EEF0F3 1px, transparent 1px)', backgroundSize: `100% ${PX}px` }}>
                    {dayB.filter((b) => b.staffId === c.id).map((b) => { const compact = b.end - b.start <= 30; return (
                      <button key={b.id} onClick={() => openBooking(b.id)} aria-label={`${b.client}, ${b.services}, ${fmtMin(b.start)} to ${fmtMin(b.end)}`} style={evStyle(b, false)}>
                        {b.paid && <Paid />}
                        {compact ? <><span style={{ flex: '0 1 auto', minWidth: 0, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.client}</span><span style={{ flex: '0 100000 auto', minWidth: 0, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.services}</span></> :
                          <><span style={{ maxWidth: '100%', fontSize: 13, fontWeight: 600, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.client}</span><span style={{ maxWidth: '100%', fontSize: 12, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.services}</span>{b.end - b.start >= 60 && <span style={{ fontSize: 12, lineHeight: 1.25, marginTop: 2 }}>{fmtMin(b.start)} – {fmtMin(b.end)}</span>}</>}
                      </button>); })}
                    {blocks.filter((b) => b.staffId === c.id && b.dayYmd === day).map((b) => (
                      <button key={b.id} onClick={() => { setBlockId(b.id); setMode('blockview'); setSheet(true); setError(''); setNotice(''); }} aria-label={`${blockKindLabel(b.kind)}, ${first(c.name)}, ${fmtMin(b.start)} to ${fmtMin(b.end)}`} style={blockStyle(b, false)}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{b.note || blockKindLabel(b.kind)}</span>{b.end - b.start >= 60 && <span style={{ fontSize: 12 }}>{first(c.name)}, {fmtMin(b.start)} to {fmtMin(b.end)}</span>}
                      </button>))}
                  </div>
                ))}
                {day === today && showNow && (
                  <div style={{ position: 'absolute', left: 56, right: 0, top: nowTop, height: 0, borderTop: '2px solid #5B3DF5', pointerEvents: 'none', zIndex: 2 }}>
                    <span style={{ position: 'absolute', left: -5, top: -6, width: 10, height: 10, borderRadius: 999, background: '#5B3DF5' }} />
                    <span style={{ position: 'absolute', left: -52, top: -11, padding: '2px 7px', borderRadius: 999, background: '#5B3DF5', color: '#fff', fontSize: 11.5, fontWeight: 500 }}>{fmtMin(nowMin)}</span>
                  </div>)}
              </div>
            </div></div>
          ) : (
            <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 760 }}>
              <div style={{ display: 'flex', borderBottom: `1px solid ${LINE}` }}>
                <div style={{ flex: '0 0 56px' }} />
                {Array.from({ length: 7 }, (_, i) => dayInfo(addDaysYmd(wkS, i))).map((d) => (
                  <button key={d.ymd} onClick={() => go(d.ymd, 'day')} aria-label={d.full + '. Open this day'} style={{ flex: '1 1 0', minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 4px', border: 0, borderLeft: '1px solid #EEF0F3', background: 'transparent', font: 'inherit', color: INK, cursor: 'pointer' }}>
                    <span style={{ fontSize: 12.5, color: MUTED }}>{d.abbr}</span>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 999, fontSize: 16, fontWeight: 600, ...(d.ymd === today ? { background: INK, color: '#fff' } : {}) }}>{d.num}</span>
                  </button>))}
              </div>
              <div style={{ position: 'relative', display: 'flex' }}>
                <div style={{ flex: '0 0 56px' }}>{gHours.map((h) => <div key={h} style={{ height: PX, boxSizing: 'border-box', padding: '6px 12px 0 0', textAlign: 'right', fontSize: 12, color: MUTED }}>{hourLabel(h)}</div>)}</div>
                {Array.from({ length: 7 }, (_, i) => dayInfo(addDaysYmd(wkS, i))).map((d) => { const closed = !hrsOf(d.ymd)?.open; return (
                  <div key={d.ymd} style={{ flex: '1 1 0', minWidth: 0, position: 'relative', height: gH, borderLeft: '1px solid #EEF0F3', backgroundColor: closed ? '#F7F8FA' : '#fff', backgroundImage: 'linear-gradient(#EEF0F3 1px, transparent 1px)', backgroundSize: `100% ${PX}px` }}>
                    {closed && <span style={{ position: 'absolute', left: 0, right: 0, top: 12, textAlign: 'center', fontSize: 12.5, color: '#8A93A0' }}>Closed</span>}
                    {bookings.filter((b) => b.dayYmd === d.ymd && b.staffId === wkStaff).map((b) => (
                      <button key={b.id} onClick={() => openBooking(b.id)} aria-label={`${b.client}, ${b.services}, ${fmtMin(b.start)}`} style={evStyle(b, true)}>
                        {b.paid && <Paid />}
                        <span style={{ maxWidth: '100%', fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.client}</span>
                        {b.end - b.start > 30 && <span style={{ maxWidth: '100%', fontSize: 11.5, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.services}</span>}
                      </button>))}
                    {blocks.filter((b) => b.dayYmd === d.ymd && b.staffId === wkStaff).map((b) => (
                      <button key={b.id} onClick={() => { setBlockId(b.id); setMode('blockview'); setSheet(true); }} style={blockStyle(b, true)}><span style={{ fontSize: 12.5, fontWeight: 600 }}>{blockKindLabel(b.kind)}</span></button>))}
                    {d.ymd === today && showNow && <div style={{ position: 'absolute', left: 0, right: 0, top: nowTop, height: 0, borderTop: '2px solid #5B3DF5', pointerEvents: 'none', zIndex: 2 }}><span style={{ position: 'absolute', left: -4, top: -5, width: 8, height: 8, borderRadius: 999, background: '#5B3DF5' }} /></div>}
                  </div>); })}
              </div>
            </div></div>
          )}
        </section>
        <aside aria-label="Appointment details" style={{ flex: '1 1 440px', maxWidth: 520, minWidth: 0, boxSizing: 'border-box', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>
          {Panel()}
        </aside>
      </div>
    </div>
  );

  // ================= MOBILE =================
  const mToday = dayB.slice().sort((a, b) => a.start - b.start);
  const mFiltered = q ? mToday.filter((b) => (b.client + ' ' + b.services + ' ' + staffName(b.staffId)).toLowerCase().includes(q)) : mToday;
  const active = mFiltered.filter((b) => kind(b.status) === 'live');
  const cards = active.length ? active : mFiltered.slice(0, 1);
  const later = mFiltered.filter((b) => !cards.includes(b));
  const mBlocks = q ? [] : blocks.filter((b) => b.dayYmd === day && (day !== today || b.end > nowMin));
  const laterRows = [
    ...later.map((b) => ({ t: b.start, k: 'b' as const, b })),
    ...mBlocks.map((b) => ({ t: b.start, k: 'x' as const, x: b })),
  ].sort((a, b) => a.t - b.t);
  const wkDays = Array.from({ length: 7 }, (_, i) => dayInfo(addDaysYmd(wkS, i)));
  const mobile = (
    <div className="only-m" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#F4F5F7' }}>
      <header style={{ padding: '24px 20px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div><h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{view === 'week' ? pageTitle : titleDay}</h1><p style={{ margin: '4px 0 0', fontSize: 14.5, color: MUTED }}>{view === 'week' ? wkLabel : `${di.weekday}, ${di.num} ${di.month}`}</p></div>
        </div>
        <input aria-label="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients" style={{ boxSizing: 'border-box', width: '100%', height: 48, padding: '0 18px', border: `1px solid ${LINE2}`, borderRadius: 999, font: 'inherit', fontSize: 16, color: INK, background: '#fff' }} />
      </header>
      <main style={{ flex: 1, padding: '0 20px 120px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div role="group" aria-label="Calendar view" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: '#E9ECF0' }}>
          {(['day', 'week'] as const).map((v) => <button key={v} aria-pressed={view === v} onClick={() => go(day, v)} style={{ flex: '1 1 0', height: 44, border: 0, borderRadius: 999, fontSize: 14, fontWeight: 500, background: view === v ? INK : 'transparent', color: view === v ? '#fff' : INK }}>{v === 'day' ? 'Day' : 'Week'}</button>)}
        </div>
        {notice && <div role="status" style={noteStyle('#DDF3EA', '#14624A')}>{notice}</div>}
        {view === 'day' ? (<>
          <div className="hscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px 2px' }}>
            {upcomingDays.map((d) => { const on = d.ymd === day, closed = !hrsOf(d.ymd)?.open; return (
              <button key={d.ymd} onClick={() => go(d.ymd)} aria-label={d.full + (closed ? ', closed' : '')} aria-pressed={on} style={{ flex: '0 0 52px', height: 72, boxSizing: 'border-box', borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, font: 'inherit', border: `1px solid ${on ? INK : LINE}`, background: on ? INK : closed ? '#EEF0F3' : '#fff', color: on ? '#fff' : closed ? '#8A93A0' : INK }}>
                <span style={{ fontSize: 12.5 }}>{d.abbr}</span><span style={{ fontSize: 18, fontWeight: 600 }}>{d.num}</span></button>); })}
          </div>
          <section aria-label="At a glance" style={{ display: 'flex', gap: 24 }}>
            {[['Appointments', String(liveCount)], ['Booked revenue', dollars(revenueC)], ['Next opening', nextOpening]].map(([k, v]) => <div key={k}><div style={{ fontSize: 13, color: MUTED }}>{k}</div><div style={{ marginTop: 2, fontSize: 30, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{v}</div></div>)}
          </section>
          {q && mFiltered.length === 0 && <p style={{ margin: 0, color: MUTED }}>No appointments match "{query.trim()}".</p>}
          {!dayHrs?.open && mFiltered.length === 0 && <p style={{ margin: 0, color: MUTED }}>The salon is closed that day.</p>}
          {cards.length > 0 && (<section>
            <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 600 }}>{active.length ? `In progress, ${active.length}` : 'Next up'}</h2>
            <div className="hscroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', margin: '0 -20px', padding: '0 20px 2px' }}>
              {cards.map((b) => { const v = vm(b), p = primary(b); return (
                <div key={b.id} style={{ flex: cards.length > 1 ? '0 0 300px' : '1 1 100%', minWidth: 0, boxSizing: 'border-box', scrollSnapAlign: 'start', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 24, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={chipStyle(v.k)}>{CHIP[v.k].t}</span>{b.paid && <span style={{ padding: '4px 12px', borderRadius: 999, background: '#DDF3EA', color: '#14624A', fontSize: 12.5, fontWeight: 500 }}>Paid</span>}</div>
                  <button onClick={() => openBooking(b.id)} style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', font: 'inherit', color: INK }}>
                    <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em' }}>{b.client}</div>
                    <div style={{ fontSize: 14, color: MUTED }}>{v.line}, {v.k === 'live' ? 'until ' + fmtMin(b.end) : v.time}</div>
                  </button>
                  {p && <button disabled={pending} onClick={p.fn} style={{ ...btnDark, flex: 'none', height: 48 }}>{p.label}</button>}
                </div>); })}
            </div>
          </section>)}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{day === today ? 'Later today' : 'Schedule'}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={openWalkin} style={{ height: 40, padding: '0 16px', border: 0, borderRadius: 999, background: INK, color: '#fff', fontSize: 13.5, fontWeight: 500 }}>Walk-in</button>
                <button onClick={openBlock} style={{ height: 40, padding: '0 16px', border: `1px solid ${LINE2}`, borderRadius: 999, background: '#fff', color: INK, fontSize: 13.5, fontWeight: 500 }}>Block time</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {laterRows.length === 0 && <p style={{ margin: 0, color: MUTED, fontSize: 14 }}>Nothing else booked.</p>}
              {laterRows.map((r) => r.k === 'b' ? (
                <div key={r.b.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ flex: '0 0 62px', fontSize: 13.5, color: MUTED }}>{fmtMin(r.b.start)}</span>
                  <button onClick={() => openBooking(r.b.id)} aria-label={vm(r.b).line} style={{ flex: '1 1 0', minWidth: 0, minHeight: 64, boxSizing: 'border-box', padding: '10px 16px', border: 0, borderRadius: 18, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, font: 'inherit', background: TONE_LIST[r.b.tone % 4].bg, color: TONE_LIST[r.b.tone % 4].fg }}>
                    <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.b.client}</span><span style={{ display: 'block', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vm(r.b).line}{r.b.walkin ? ', walk-in' : ''}</span></span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{dollars(r.b.priceCents)}</span>
                  </button>
                </div>) : (
                <div key={r.x.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ flex: '0 0 62px', fontSize: 13.5, color: MUTED }}>{fmtMin(r.x.start)}</span>
                  <button onClick={() => { setBlockId(r.x.id); setMode('blockview'); setSheet(true); setError(''); }} style={{ flex: '1 1 0', minWidth: 0, minHeight: 64, boxSizing: 'border-box', padding: '10px 16px', border: '1px solid #DDE0E6', borderRadius: 18, textAlign: 'left', font: 'inherit', color: '#4A525E', background: HATCH }}>
                    <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>{blockKindLabel(r.x.kind)}</span><span style={{ display: 'block', fontSize: 13 }}>{first(staffName(r.x.staffId))}, until {fmtMin(r.x.end)}</span>
                  </button>
                </div>))}
            </div>
          </section>
        </>) : (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 24, padding: 12 }}>
            <button aria-label="Previous week" onClick={() => go(addDaysYmd(day, -7))} style={{ flex: '0 0 44px', width: 44, height: 44, borderRadius: 999, border: 0, background: '#F4F5F7', fontSize: 20, color: INK }}>‹</button>
            <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 600 }}>{pageTitle}</div><div style={{ fontSize: 13, color: MUTED }}>{wkLabel}</div></div>
            <button aria-label="Next week" onClick={() => go(addDaysYmd(day, 7))} style={{ flex: '0 0 44px', width: 44, height: 44, borderRadius: 999, border: 0, background: '#F4F5F7', fontSize: 20, color: INK }}>›</button>
          </div>
          {wkDays.map((d) => {
            const h = hrsOf(d.ymd), rows = bookings.filter((b) => b.dayYmd === d.ymd).sort((a, b) => a.start - b.start);
            const bl = blocks.filter((b) => b.dayYmd === d.ymd);
            const all = [...rows.map((b) => ({ t: b.start, b })), ...bl.map((x) => ({ t: x.start, x }))].sort((a, b) => a.t - b.t);
            const cap = h?.open ? Math.max(1, team.length) * (h.to - h.from) : 0, booked = rows.reduce((a, b) => a + (b.end - b.start), 0);
            const util = cap ? Math.min(100, Math.round((booked / cap) * 100)) : 0, open = !!wkOpen[d.ymd], shown = open ? all : all.slice(0, 5);
            return (
              <section key={d.ymd} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 24, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><div style={{ fontSize: 17, fontWeight: 600 }}>{d.abbr} {d.num}{d.ymd === today ? ', today' : ''}</div><div style={{ fontSize: 13.5, color: MUTED }}>{h?.open ? `${rows.length} appointments, ${dollars(rows.reduce((a, b) => a + b.priceCents, 0))}` : 'Closed'}</div></div>
                {h?.open && <><div style={{ height: 6, borderRadius: 999, background: '#EEF0F3' }}><div style={{ height: 6, borderRadius: 999, background: INK, width: util + '%' }} /></div><div style={{ fontSize: 12.5, color: MUTED }}>{util}% booked</div></>}
                {shown.map((r, i) => 'b' in r && r.b ? (
                  <button key={r.b.id} onClick={() => openBooking(r.b!.id)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 52, padding: '8px 12px', borderRadius: 14, border: 0, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', font: 'inherit', color: INK, background: '#F7F8FA' }}>
                    <span style={{ flex: '0 0 8px', width: 8, height: 8, borderRadius: 999, background: TONE_LIST[r.b.tone % 4].dot }} />
                    <span style={{ flex: '0 0 62px', fontSize: 13, color: MUTED }}>{fmtMin(r.b.start)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{r.b.client}</span><span style={{ display: 'block', fontSize: 12.5, color: MUTED }}>{vm(r.b).line}</span></span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{dollars(r.b.priceCents)}</span>
                  </button>) : (
                  <button key={'x' + i} onClick={() => { setBlockId((r as any).x.id); setMode('blockview'); setSheet(true); }} style={{ width: '100%', boxSizing: 'border-box', minHeight: 52, padding: '8px 12px', borderRadius: 14, border: '1px solid #DDE0E6', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', font: 'inherit', color: '#4A525E', background: HATCH }}>
                    <span style={{ flex: '0 0 62px', fontSize: 13 }}>{fmtMin((r as any).x.start)}</span><span style={{ fontSize: 14, fontWeight: 600 }}>{blockKindLabel((r as any).x.kind)}</span><span style={{ fontSize: 12.5 }}>{first(staffName((r as any).x.staffId))}</span>
                  </button>))}
                {all.length > 5 && <button onClick={() => setWkOpen({ ...wkOpen, [d.ymd]: !open })} style={{ height: 40, border: 0, background: 'transparent', color: INK, fontSize: 13.5, fontWeight: 600 }}>{open ? 'Show less' : `Show ${all.length - 5} more`}</button>}
              </section>);
          })}
        </>)}
      </main>
      {sheet && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={closePanel} style={{ position: 'absolute', inset: 0, background: 'rgba(14,17,22,0.45)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: '28px 28px 0 0', padding: '12px 20px 28px', maxHeight: '90dvh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 999, background: '#DCDFE5' }} />
            {Panel()}
          </div>
        </div>)}
    </div>
  );

  return (
    <div className="cal-root">
      {desktop}
      <MobileCalendar day={day} today={today} view={view} nowMin={nowMin} tz={tz} team={team} bookings={bookings} blocks={blocks} hours={hours} services={services} offers={props.offers} cfg={props.cfg} slug={props.slug} />
      {/* Desktop modes open in the side panel; on mobile they open in the sheet. */}
    </div>
  );
}
