'use client';
// 1:1 conversion of the prototype's Mobile.dc.html (+ MobileHeader, MobileTabs). Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { TONE_LIST, addDaysYmd, dayInfo, fmtMin, initials, weekStartOf, type CalBlock, type CalBooking, type CalHours, type CalService, type CalSettings, type CalStaff, BLOCK_KINDS } from '@/lib/cal';
import { addWalkIn, approveBooking, cancelBooking, checkInBooking, checkoutBooking, createBlock, dayAvailability, deleteBlock, editBooking, rebookBooking, rescheduleBooking, walkinPlan } from './actions';
import { S, ServicePicker, TeamPicker } from './pickers';

const HATCH = 'repeating-linear-gradient(135deg,#F7F8FA 0,#F7F8FA 8px,#ECEEF2 8px,#ECEEF2 16px)';
const first = (n: string) => n.split(' ')[0];
const usd = (c: number) => '$' + (Math.round(c) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
const m2 = (c: number) => '$' + (Math.round(c) / 100).toFixed(2).replace(/\.00$/, '');
const BLOCK_DURS_M: [number, string][] = [[30, '30 min'], [60, '1 hour'], [120, '2 hours'], [180, '3 hours'], [-1, 'All day']];
const METHODS: [string, string][] = [['card', 'Card'], ['cash', 'Cash'], ['gift_card', 'Gift card']];
const TIP_OPTS: [number, string][] = [[0, 'No tip'], [10, '10%'], [15, '15%'], [20, '20%']];
const STEP = 30;

const chipTone: Record<string, { t: string; bg: string; fg: string }> = {
  live: { t: 'In progress', bg: '#5B3DF5', fg: '#FFFFFF' }, confirmed: { t: 'Confirmed', bg: '#DDF3EA', fg: '#14624A' }, done: { t: 'Done', bg: '#EEF0F3', fg: '#4A525E' },
  pending: { t: 'Needs approval', bg: '#FFF4E5', fg: '#B25E09' },
};
const kindOf = (s: CalBooking['status']) => (s === 'checked_in' || s === 'in_progress' ? 'live' : s === 'completed' ? 'done' : s === 'pending' ? 'pending' : 'confirmed');
const chip = (on: boolean, off = false) => 'flex:0 0 auto;height:44px;padding:0 16px;border-radius:999px;font-size:14px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : (off ? '#F4F5F7' : '#FFFFFF')) + ';color:' + (on ? '#FFFFFF' : (off ? '#8A93A0' : '#0E1116')) + (off ? ';cursor:default' : '');
const slotCss = (on: boolean, why: boolean) => 'width:100%;height:44px;padding:0;border-radius:14px;font-size:14px;font-weight:500;font-family:inherit;border:1px solid ' + (on ? '#0E1116' : (why ? '#EEF0F3' : '#E1E4E9')) + ';background:' + (on ? '#0E1116' : (why ? '#F4F5F7' : '#FFFFFF')) + ';color:' + (on ? '#FFFFFF' : (why ? '#8A93A0' : '#0E1116')) + (why ? ';text-decoration:line-through;cursor:default' : '');
const dayCss = (on: boolean, closed: boolean) => 'flex:0 0 60px;height:76px;box-sizing:border-box;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:inherit;border:1px solid ' + (on ? '#0E1116' : '#E6E8EC') + ';background:' + (on ? '#0E1116' : (closed ? '#F4F5F7' : '#FFFFFF')) + ';color:' + (on ? '#FFFFFF' : (closed ? '#8A93A0' : '#0E1116')) + (closed ? ';cursor:default' : '');
const note = (bg: string, fg: string) => 'border-radius:16px;background:' + bg + ';color:' + fg + ';padding:12px 14px;font-size:13.5px;font-weight:500';
const PRIMARY = 'flex:1 1 0;height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;cursor:pointer';
const SECOND = 'flex:1 1 0;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500;cursor:pointer';
const CLOSE_BTN = 'flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer';
const H2S = 'margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em';
const ERR = 'margin:0;color:#B42318;font-size:13.5px;font-weight:500';
const DLROW = 'display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3';

function CloseX({ sw = 1.9 }: { sw?: number }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth={sw} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;
}
const Mag = ({ size, color }: { size: number; color: string }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;

type Avail = { key: string; busy: { s: number; e: number }[]; open: boolean; from: number; to: number } | null;
type Props = {
  day: string; today: string; view: 'day' | 'week'; nowMin: number; team: CalStaff[]; bookings: CalBooking[]; blocks: CalBlock[]; hours: CalHours[]; services: CalService[];
  offers: Record<string, string[]>; cfg: CalSettings; slug: string; tz: string;
};

export function MobileCalendar(props: Props) {
  const { day, today, view, nowMin, tz, team, bookings, blocks, hours, services, offers, cfg } = props;
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'view' | 'checkout' | 'edit' | 'blockview' | 'block' | 'walkin' | 'resched'>('view');
  const [selId, setSelId] = useState<string | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [wkOpen, setWkOpen] = useState<Record<string, boolean>>({});
  const [bf, setBf] = useState<{ s: string; kind: string; day: string; dur: number; start: number | null }>({ s: '', kind: 'lunch', day: today, dur: 60, start: null });
  const [rs, setRs] = useState<{ day: string; time: number | null; rebook: boolean }>({ day: today, time: null, rebook: false });
  const [wi, setWi] = useState<{ name: string; svc: string | null; pro: string; cat: string }>({ name: '', svc: null, pro: 'any', cat: '' });
  const [co, setCo] = useState<{ method: string; tip: number; code: string }>({ method: 'card', tip: 0, code: '' });
  const [ed, setEd] = useState<{ ids: string[]; start: number | null }>({ ids: [], start: null });
  const [avail, setAvail] = useState<Avail>(null);
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof walkinPlan>> | null>(null);

  const staffName = (id: string) => team.find((t) => t.id === id)?.name ?? '';
  const hrsOf = (ymd: string) => hours[dayInfo(ymd).wd];
  const go = (d: string, v: 'day' | 'week' = view) => { setNotice(''); setOpen(false); setMode('view'); startT(() => router.push(`/calendar?d=${d}&v=${v}`)); };
  const refresh = () => router.refresh();

  const cur = bookings.find((b) => b.id === selId) ?? null;
  const bvB = blocks.find((b) => b.id === blockId) ?? null;
  const dayB = bookings.filter((b) => b.dayYmd === day);
  const sq = query.trim().toLowerCase();

  /* ---------- availability for block / reschedule ---------- */
  const availKey = mode === 'block' ? `${bf.day}|${bf.s}` : mode === 'resched' && cur ? `${rs.day}|${cur.staffId}` : '';
  useEffect(() => {
    if (!availKey) return;
    const [d, s] = availKey.split('|');
    if (!s) { setAvail(null); return; }
    let live = true;
    dayAvailability(d, s, mode === 'resched' && cur && !rs.rebook ? cur.id : undefined).then((r) => { if (live) setAvail({ key: availKey, ...r }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availKey]);
  const av = avail && avail.key === availKey ? avail : null;
  const reason = (d: string, t: number, dur: number) => {
    if (!av) return 'loading';
    if (!av.open) return 'closed';
    if (d === today && t < nowMin) return 'past';
    if (t < av.from || t + dur > av.to) return 'late';
    if (av.busy.some((x) => t < x.e && x.s < t + dur)) return 'busy';
    return '';
  };
  const slotsFor = av && av.open ? Array.from({ length: Math.max(0, Math.floor((av.to - av.from) / STEP)) }, (_, i) => av.from + i * STEP) : [];
  const days14 = Array.from({ length: 14 }, (_, i) => { const d = addDaysYmd(today, i); const info = dayInfo(d); return { ...info, closed: !hrsOf(d)?.open }; });

  /* ---------- walk-in plan ---------- */
  useEffect(() => {
    if (mode !== 'walkin' || !wi.svc) { setPlan(null); return; }
    let live = true;
    walkinPlan(wi.svc, wi.pro).then((r) => { if (live) setPlan(r); });
    return () => { live = false; };
  }, [mode, wi.svc, wi.pro]);

  /* ---------- view-models ---------- */
  const vm = (b: CalBooking) => {
    const k = kindOf(b.status), ct = chipTone[k], tone = TONE_LIST[b.tone % 4];
    const time = fmtMin(b.start) + ' – ' + fmtMin(b.end);
    const f = first(staffName(b.staffId));
    return {
      b, k, tone, time, f,
      line: b.services + ' with ' + f + ', ' + (k === 'live' ? 'until ' + fmtMin(b.end) : time),
      sub: b.services + ' with ' + f, priceText: usd(b.priceCents),
      label: b.client + ', ' + b.services + ', ' + time,
      chipText: ct.t, chipStyle: 'display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + ct.bg + ';color:' + ct.fg,
      avatarStyle: 'flex:0 0 52px;width:52px;height:52px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;background:' + tone.bg + ';color:' + tone.fg,
      primaryLabel: k === 'live' ? 'Start checkout' : k === 'confirmed' ? 'Check in' : k === 'pending' ? 'Approve' : b.saleId ? 'View sale' : 'Done',
      secondaryLabel: k === 'done' ? 'Rebook' : 'Reschedule',
      canEdit: k !== 'done',
      style: 'flex:1 1 0;min-width:0;min-height:64px;box-sizing:border-box;padding:10px 16px;border:0;border-radius:18px;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;background:' + tone.bg + ';color:' + tone.fg,
    };
  };
  const act = (fn: () => Promise<{ error?: string; note?: string; ok?: true } | void>, ok: string, done?: () => void) => startT(async () => {
    setError(''); const r = await fn();
    if (r && r.error) { setError(r.error); return; }
    setNotice((r && r.note) || ok); done?.(); refresh();
  });
  const openBooking = (id: string) => { setSelId(id); setOpen(true); setMode('view'); setError(''); setNotice(''); };
  const openBlock = (id: string) => { setBlockId(id); setOpen(true); setMode('blockview'); setError(''); setNotice(''); };
  const startCheckout = (id: string) => { setSelId(id); setOpen(true); setMode('checkout'); setCo({ method: 'card', tip: cfg.askTip ? cfg.tipDefault : 0, code: '' }); setError(''); setNotice(''); };
  const primary = (b: CalBooking) => {
    const k = kindOf(b.status);
    if (k === 'confirmed') act(() => checkInBooking(b.id), first(b.client) + ' checked in');
    else if (k === 'pending') act(() => approveBooking(b.id), first(b.client) + ' approved');
    else if (k === 'live') startCheckout(b.id);
    else if (b.saleId) router.push(`/sales/${b.saleId}`);
  };
  const startResched = (b: CalBooking, rebook: boolean) => {
    let d = rebook ? addDaysYmd(b.dayYmd, 7) : b.dayYmd;
    if (d < today) d = today;
    if (!hrsOf(d)?.open) for (let i = 1; i < 8; i++) { const n = addDaysYmd(d, i); if (hrsOf(n)?.open) { d = n; break; } }
    setSelId(b.id); setOpen(true); setMode('resched'); setRs({ day: d, time: null, rebook }); setError(''); setNotice('');
  };

  /* ---------- derived lists (as Mobile.dc.html renderVals) ---------- */
  const todayList = dayB.filter((b) => !sq || (b.client + ' ' + b.services + ' ' + staffName(b.staffId)).toLowerCase().includes(sq)).sort((a, b) => a.start - b.start).map(vm);
  const activeCards = todayList.filter((x) => x.k === 'live');
  const upcoming = todayList.filter((x) => x.k !== 'done' && x.k !== 'live');
  const cards = activeCards.length ? activeCards : upcoming.slice(0, 1);
  const laterBk = upcoming.filter((x) => !cards.includes(x));
  const doneBk = todayList.filter((x) => x.k === 'done');
  const blockRows = blocks.filter((b) => b.dayYmd === day && (day !== today || b.end > nowMin) && !sq).map((b) => ({
    start: b.start, startText: fmtMin(b.start), client: BLOCK_KINDS.find((k) => k[0] === b.kind)?.[1] ?? 'Blocked', priceText: '',
    sub: first(staffName(b.staffId)) + ', until ' + fmtMin(b.end),
    label: (BLOCK_KINDS.find((k) => k[0] === b.kind)?.[1] ?? 'Blocked') + ', ' + first(staffName(b.staffId)) + ', ' + fmtMin(b.start) + ' to ' + fmtMin(b.end),
    id: b.id, isBlock: true as const,
  }));
  const row = (x: (typeof todayList)[number]) => ({ start: x.b.start, startText: fmtMin(x.b.start), client: x.b.client, sub: x.sub, priceText: x.priceText, label: x.label, id: x.b.id, style: x.style, isBlock: false as const });
  const later = [...[...laterBk.map(row), ...blockRows].sort((a, b) => a.start - b.start), ...doneBk.map(row)];

  const dayHrs = hrsOf(day);
  const statCount = dayB.length, statRevenue = usd(dayB.reduce((a, b) => a + b.priceCents, 0));
  let statNext = dayHrs?.open ? 'None left' : 'Closed';
  if (dayHrs?.open) {
    for (let t = Math.max(dayHrs.from, day === today ? Math.ceil(nowMin / STEP) * STEP : 0); t + STEP <= dayHrs.to; t += STEP) {
      if (team.some((m) => !dayB.some((b) => b.staffId === m.id && t < b.end && b.start < t + STEP) && !blocks.some((b) => b.staffId === m.id && b.dayYmd === day && t < b.end && b.start < t + STEP))) { statNext = fmtMin(t); break; }
    }
  }

  const di = dayInfo(day);
  const ws = weekStartOf(day), thisWs = weekStartOf(today);
  const weekDays = Array.from({ length: 7 }, (_, i) => dayInfo(addDaysYmd(ws, i)));
  const wkTitle = ws === thisWs ? 'This week' : ws === addDaysYmd(thisWs, 7) ? 'Next week' : ws === addDaysYmd(thisWs, -7) ? 'Last week' : weekDays[0].short;
  const wkRange = weekDays[0].short + ' to ' + weekDays[6].short;
  const pageTitle = view === 'week' ? wkTitle : day === today ? 'Today' : di.weekday;
  const pageSubtitle = view === 'week' ? wkRange : di.weekday + ', ' + di.num + ' ' + di.month;
  const strip = weekDays;

  /* ---------- checkout math ---------- */
  const coMath = (priceC: number) => {
    const tip = cfg.askTip ? Math.round(priceC * co.tip / 100) : 0;
    const taxAmt = cfg.taxInclusive ? Math.round(priceC * cfg.taxRate / (100 + cfg.taxRate)) : Math.round(priceC * cfg.taxRate / 100);
    return { tip, taxAmt, total: priceC + tip + (cfg.taxInclusive ? 0 : taxAmt), taxLabel: (cfg.taxInclusive ? 'Includes ' : 'Tax ') + cfg.taxRate + '%' };
  };
  const charge = () => {
    if (!cur) return;
    const method = co.method as 'card' | 'cash' | 'gift_card';
    startT(async () => {
      setError('');
      const r = await checkoutBooking(cur.id, method, cfg.askTip ? co.tip : 0, co.code);
      if (r.error) { setError(r.error); return; }
      if (method === 'card' && r.saleId) { router.push(`/sales/${r.saleId}`); return; }
      setMode('view'); setNotice(''); refresh();
    });
  };

  /* ---------- edit booking ---------- */
  const svcMap = new Map(services.map((s) => [s.id, s]));
  const offered = (sid: string, staffId: string) => (offers[sid] ?? []).includes(staffId);
  const editPlan = () => {
    if (!cur) return null;
    const hrs = hrsOf(cur.dayYmd), close = hrs?.open ? hrs.to : 24 * 60, openAt = hrs?.open ? hrs.from : 0;
    const removed = cur.serviceIds.filter((id) => svcMap.has(id) && !ed.ids.includes(id));
    const added = ed.ids.filter((id) => !cur.serviceIds.includes(id) && offered(id, cur.staffId));
    const extraIds = ed.ids.filter((id) => !cur.serviceIds.includes(id) && !offered(id, cur.staffId));
    const dur = (cur.end - cur.start) - removed.reduce((a, id) => a + svcMap.get(id)!.dur, 0) + added.reduce((a, id) => a + (svcMap.get(id)?.dur ?? 0), 0);
    const priceC = cur.priceCents - removed.reduce((a, id) => a + svcMap.get(id)!.priceCents, 0) + added.reduce((a, id) => a + (svcMap.get(id)?.priceCents ?? 0), 0);
    const start = ed.start ?? cur.start;
    const occ = (staffId: string, except?: string) => [
      ...bookings.filter((x) => x.dayYmd === cur.dayYmd && x.staffId === staffId && x.id !== except).map((x) => ({ s: x.start, e: x.end, who: x.client })),
      ...blocks.filter((x) => x.dayYmd === cur.dayYmd && x.staffId === staffId).map((x) => ({ s: x.start, e: x.end, who: 'a blocked period' })),
    ];
    const clash = (t: number) => {
      if (t + dur > close) return { kind: 'late' as const };
      const c = occ(cur.staffId, cur.id).find((e) => t < e.e && e.s < t + dur);
      return c ? { kind: 'busy' as const, with: c } : null;
    };
    const problem = dur > 0 ? clash(start) : null;
    const slots: number[] = []; for (let t = openAt; t + STEP <= close; t += STEP) slots.push(t);
    const alts = problem ? slots.filter((t) => !clash(t) && !(cur.dayYmd === today && t < nowMin)).sort((x, y) => Math.abs(x - cur.start) - Math.abs(y - cur.start)).slice(0, 8).sort((x, y) => x - y) : [];
    const mainEnd = start + dur;
    const taken: { s: string; start: number; end: number }[] = [];
    const extras = extraIds.map((id) => {
      const svc = svcMap.get(id)!, sid = (offers[id] ?? [])[0];
      let at: number | undefined;
      if (sid) {
        const free = (t: number) => (cur.dayYmd !== today || t >= nowMin) && t + svc.dur <= close && !occ(sid).some((e) => t < e.e && e.s < t + svc.dur) && !taken.some((k) => k.s === sid && t < k.end && k.start < t + svc.dur);
        at = slots.find((t) => t >= mainEnd && free(t)) ?? slots.find((t) => t + svc.dur <= start && free(t));
        if (at !== undefined) taken.push({ s: sid, start: at, end: at + svc.dur });
      }
      return { svc, sid, member: sid ? staffName(sid) : '', f: sid ? first(staffName(sid)) : '', at };
    });
    return { removed, added, extras, dur, priceC, start, problem, alts, mainEnd, f: first(staffName(cur.staffId)), empty: dur <= 0 };
  };
  const saveEdit = () => {
    const pl = editPlan(); if (!pl || !cur) return;
    if (pl.empty) { setError('Keep at least one service on the booking.'); return; }
    if (pl.problem) { setError('The extra time does not fit yet. Pick one of the start times above, or remove a service.'); return; }
    const bad = pl.extras.find((x) => x.at === undefined);
    if (bad) { setError((bad.f || 'Nobody') + ' has no free time for ' + bad.svc.name + ' that day. Remove it or pick another day first.'); return; }
    const msg = pl.extras.length ? 'Updated, ' + pl.extras.map((x) => x.svc.name + ' with ' + x.f + ' at ' + fmtMin(x.at!)).join(', ') : first(cur.client) + "'s booking updated";
    act(() => editBooking(cur.id, cur.dayYmd, pl.start, pl.removed, pl.added, pl.extras.map((x) => ({ serviceId: x.svc.id, staffId: x.sid!, startMin: x.at! }))), msg, () => { setOpen(false); setMode('view'); });
  };

  /* ---------- block ---------- */
  const bfDur = bf.dur === -1 ? (av ? av.to - av.from : 0) : bf.dur;
  const saveBlock = () => {
    if (!bf.s) { setError('Choose a team member.'); return; }
    if (bf.start === null) { setError('Choose a start time from the list.'); return; }
    if (reason(bf.day, bf.start, bfDur)) { setError('That time is not free. Pick another from the list.'); return; }
    const label = BLOCK_KINDS.find((k) => k[0] === bf.kind)![1];
    act(() => createBlock(bf.s, bf.day, bf.start!, bfDur, bf.kind), label + ' blocked for ' + first(staffName(bf.s)), () => { setOpen(false); setMode('view'); });
  };

  /* ---------- reschedule ---------- */
  const moveBooking = () => {
    if (!cur) return;
    if (rs.time === null) { setError('Choose a new time from the list.'); return; }
    if (reason(rs.day, rs.time, cur.end - cur.start)) { setError('That time is no longer free. Pick another from the list.'); return; }
    const when = dayInfo(rs.day).short + ', ' + fmtMin(rs.time);
    if (rs.rebook) act(() => rebookBooking(cur.id, rs.day, rs.time!), first(cur.client) + ' rebooked for ' + when, () => { setOpen(false); setMode('view'); });
    else act(() => rescheduleBooking(cur.id, rs.day, rs.time!), first(cur.client) + ' moved to ' + when, () => { setOpen(false); setMode('view'); });
  };

  /* ---------- walk-in ---------- */
  const wiSvc = wi.svc ? svcMap.get(wi.svc) ?? null : null;
  let wiPlanText = 'Pick a service to see who is free.', wiPlanCss = note('#F4F5F7', '#5E6673');
  if (wiSvc && plan) {
    if ('startsAt' in plan) { wiPlanText = first(plan.staff) + ' is free ' + (plan.nowish ? 'now' : 'from ' + plan.label) + '. ' + plan.label + ' to ' + fmtMin(minutesFromIso(plan.startsAt!) + wiSvc.dur) + ', ' + wiSvc.dur + ' min, ' + usd(wiSvc.priceCents) + '.'; wiPlanCss = note('#DDF3EA', '#14624A'); }
    else if ('none' in plan) { wiPlanText = 'No free time today for ' + wiSvc.name + (wi.pro === 'any' ? '.' : ' with that team member.'); wiPlanCss = note('#FDECEA', '#B42318'); }
  }
  function minutesFromIso(iso: string) {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso));
    return Number(p.find((x) => x.type === 'hour')!.value) * 60 + Number(p.find((x) => x.type === 'minute')!.value);
  }
  const addWalkin = (pay: boolean) => {
    if (!wi.name.trim()) { setError("Add the client's name."); return; }
    if (!wi.svc) { setError('Choose a service.'); return; }
    startT(async () => {
      setError('');
      const r = await addWalkIn(wi.name, wi.svc!, wi.pro);
      if (r.error) { setError(r.error); return; }
      setWi({ name: '', svc: null, pro: 'any', cat: '' });
      if (pay && r.id) { await checkInBooking(r.id); startCheckout(r.id); }
      else { setOpen(false); setMode('view'); setNotice(r.note ?? ''); }
      refresh();
    });
  };

  const close = () => { setOpen(false); setMode('view'); setError(''); };
  const backToView = () => { setMode('view'); setError(''); };
  const hasError = !!error;
  const sel = cur ? vm(cur) : null;
  const seg = (on: boolean) => 'flex:1 1 0;height:44px;border:0;border-radius:999px;font-size:14px;font-weight:500;background:' + (on ? '#0E1116' : 'transparent') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
  const errP = () => hasError ? <p role="alert" style={S(ERR)}>{error}</p> : null;

  /* ---------- week cards ---------- */
  const wkCards = view === 'week' ? weekDays.map((d) => {
    const hrs = hrsOf(d.ymd);
    const bk = bookings.filter((b) => b.dayYmd === d.ymd);
    const revenue = bk.reduce((a, b) => a + b.priceCents, 0), booked = bk.reduce((a, b) => a + (b.end - b.start), 0);
    const rows = [
      ...bk.map((b) => { const v = vm(b); return { start: b.start, startText: fmtMin(b.start), client: b.client, sub: b.services + ' with ' + v.f + (b.walkin ? ', walk-in' : ''), priceText: v.priceText, dot: v.tone.fg, isBlock: false, pick: () => openBooking(b.id) }; }),
      ...blocks.filter((b) => b.dayYmd === d.ymd).map((b) => ({ start: b.start, startText: fmtMin(b.start), client: BLOCK_KINDS.find((k) => k[0] === b.kind)?.[1] ?? 'Blocked', sub: first(staffName(b.staffId)) + ', until ' + fmtMin(b.end), priceText: '', dot: '#B5BBC5', isBlock: true, pick: () => openBlock(b.id) })),
    ].sort((a, b) => a.start - b.start);
    const cap = hrs?.open ? Math.max(1, team.length) * (hrs.to - hrs.from) : 0;
    const util = cap ? Math.min(100, Math.round(booked / cap * 100)) : 0;
    const isOpen = !!wkOpen[d.ymd], limit = 5;
    return { d, hrs, rows, shown: isOpen ? rows : rows.slice(0, limit), util, isOpen, limit, summary: !hrs?.open ? 'Closed' : bk.length + ' appointments, ' + usd(revenue) };
  }) : [];

  const tabsA = (id: string, href: string, label: string, on: boolean, svg: React.ReactNode) => (
    <Link key={id} href={href} aria-current={on ? 'page' : 'false'} style={S('width:100%;min-height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-decoration:none;font-size:12px;font-weight:' + (on ? 600 : 500) + ';color:' + (on ? '#0E1116' : '#5E6673'))}>
      {svg}{label}
    </Link>
  );
  const ic = (color: string, children: React.ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;

  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>

      {/* MobileHeader */}
      <header style={S("display:flex;flex-direction:column;gap:12px;padding:28px 20px 16px;font-family:'Geist',system-ui,sans-serif;color:#0E1116")}>
        <div style={S('display:flex;align-items:flex-end;justify-content:space-between;gap:12px')}>
          <div style={S('min-width:0')}>
            <h1 style={S('margin:0;font-size:30px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{pageTitle}</h1>
            <p style={S('margin:4px 0 0;color:#5E6673;font-size:14.5px')}>{pageSubtitle}</p>
          </div>
          <button onClick={() => { if (searchOpen) setQuery(''); setSearchOpen(!searchOpen); }} aria-label={searchOpen ? 'Close search' : 'Search'} aria-expanded={searchOpen}
            style={S('flex:0 0 44px;width:44px;height:44px;border:1px solid ' + (searchOpen ? '#0E1116' : '#E1E4E9') + ';border-radius:999px;background:' + (searchOpen ? '#0E1116' : '#FFFFFF') + ';display:flex;align-items:center;justify-content:center;cursor:pointer')}>
            <Mag size={20} color={searchOpen ? '#FFFFFF' : '#0E1116'} />
          </button>
        </div>
        {searchOpen && (
          <label style={S('display:flex;align-items:center;gap:10px;height:48px;box-sizing:border-box;padding:0 16px;border-radius:999px;background:#FFFFFF;border:1px solid #E6E8EC')}>
            <Mag size={18} color="#5E6673" />
            <input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search appointments" aria-label="Search appointments"
              style={{ ...S('flex:1 1 auto;min-width:0;border:0;outline:none;background:transparent;font:inherit;color:#0E1116'), padding: '1px 2px', minHeight: 0, width: 'auto', borderRadius: 0, margin: 0 }} />
          </label>
        )}
      </header>

      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <div role="tablist" aria-label="Calendar view" style={S('flex:0 0 auto;display:flex;gap:4px;padding:4px;margin:0 0 -8px;border-radius:999px;background:#E9ECF0')}>
          {([['day', 'Day'], ['week', 'Week']] as const).map(([v, l]) => (
            <button key={v} role="tab" onClick={() => { setNotice(''); go(day, v); }} aria-selected={view === v} style={S(seg(view === v))}>{l}</button>
          ))}
        </div>

        {view === 'day' && (
          <div style={S('flex:0 0 auto;display:flex;gap:8px;overflow-x:auto;padding:0 20px;margin:0 -20px')}>
            {strip.map((d) => {
              const on = d.ymd === day;
              return (
                <button key={d.ymd} onClick={() => go(d.ymd, 'day')} aria-label={d.weekday + ' ' + d.num + (on ? ', selected' : '')} aria-current={on ? 'date' : undefined}
                  style={S('flex:0 0 52px;height:72px;border:1px solid ' + (on ? '#0E1116' : '#E6E8EC') + ';border-radius:18px;background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116') + ';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px')}>
                  <span style={S('font-size:12.5px;color:' + (on ? '#D5D9E0' : '#5E6673'))}>{d.abbr}</span><span style={S('font-size:17px;font-weight:600')}>{d.num}</span>
                </button>
              );
            })}
          </div>
        )}
        {view === 'week' && (
          <div role="group" aria-label="Week" style={S('flex:0 0 auto;display:flex;align-items:center;gap:8px;margin:0;padding:8px;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:999px')}>
            <button onClick={() => go(addDaysYmd(day, -7), 'week')} aria-label="Previous week" style={S('flex:0 0 44px;width:44px;height:44px;border-radius:999px;border:0;background:#F4F5F7;font-size:20px;color:#0E1116')}>‹</button>
            <div style={S('flex:1 1 auto;min-width:0;text-align:center;white-space:nowrap')}><div style={S('font-size:15px;font-weight:600')}>{wkTitle}</div><div style={S('font-size:12.5px;color:#5E6673')}>{wkRange}</div></div>
            <button onClick={() => go(addDaysYmd(day, 7), 'week')} aria-label="Next week" style={S('flex:0 0 44px;width:44px;height:44px;border-radius:999px;border:0;background:#F4F5F7;font-size:20px;color:#0E1116')}>›</button>
          </div>
        )}

        {!!notice && (
          <div role="status" style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box;padding:12px 16px;border-radius:18px;background:#DDF3EA;color:#14624A;font-size:14px;font-weight:500')}>
            <span style={S('min-width:0;overflow-wrap:anywhere')}>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Dismiss message" style={S('flex:0 0 44px;width:44px;height:44px;margin:-8px -8px -8px 0;border:0;border-radius:999px;background:transparent;display:flex;align-items:center;justify-content:center')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14624A" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </div>
        )}

        {view === 'day' && (<>
          <section aria-label="Today at a glance" style={S('display:flex;justify-content:space-between;gap:12px')}>
            <div><div style={S('color:#5E6673;font-size:13px')}>Appointments</div><div style={S('margin-top:2px;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{statCount}</div></div>
            <div><div style={S('color:#5E6673;font-size:13px')}>Booked revenue</div><div style={S('margin-top:2px;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{statRevenue}</div></div>
            <div><div style={S('color:#5E6673;font-size:13px')}>Next opening</div><div style={S('margin-top:2px;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{statNext}</div></div>
          </section>

          {!!sq && todayList.length === 0 && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:14px')}>{'No appointments today match "' + query.trim() + '".'}</p>}

          {cards.length > 0 && (
            <section aria-label="Current and next appointments" style={S('display:flex;flex-direction:column;gap:10px')}>
              {activeCards.length > 0 && <h2 style={S('margin:0 0 2px;font-size:16px;font-weight:600')}>{'In progress, ' + activeCards.length}</h2>}
              <div className="hscroll" style={S('display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 20px;margin:0 -20px;padding:0 20px')}>
                {cards.map((c) => (
                  <div key={c.b.id} style={S((activeCards.length > 1 ? 'flex:0 0 300px;' : 'flex:1 1 100%;min-width:0;') + 'box-sizing:border-box;scroll-snap-align:start;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px;display:flex;flex-direction:column;gap:14px')}>
                    <button onClick={() => openBooking(c.b.id)} aria-label={c.label} style={S('display:flex;flex-direction:column;align-items:flex-start;gap:14px;width:100%;padding:0;border:0;background:transparent;text-align:left;font:inherit;color:inherit;cursor:pointer')}>
                      <span style={S('display:flex;flex-wrap:wrap;gap:8px')}><span style={S(c.chipStyle)}>{c.chipText}</span>{c.b.paid && <span style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.b.paidText}</span>}</span>
                      <span style={S('display:block;min-width:0;max-width:100%')}>
                        <span style={S('display:block;font-size:21px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{c.b.client}</span>
                        <span style={S('display:block;margin-top:4px;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{c.line}</span>
                      </span>
                    </button>
                    <button onClick={() => primary(c.b)} style={S('height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;cursor:pointer')}>{c.primaryLabel}</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-label="Later today" style={S('display:flex;flex-direction:column;gap:10px')}>
            <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
              <h2 style={S('margin:0;font-size:16px;font-weight:600')}>{day === today ? 'Later today' : 'Later'}</h2>
              <span style={S('display:flex;gap:8px')}>
                <button onClick={() => { setOpen(true); setMode('walkin'); setWi({ name: '', svc: null, pro: 'any', cat: '' }); setError(''); setNotice(''); }} style={S('height:36px;padding:0 14px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:13px;font-weight:500;cursor:pointer')}>Walk-in</button>
                <button onClick={() => { setOpen(true); setMode('block'); setBf({ s: team[0]?.id ?? '', kind: 'lunch', day: day < today ? today : day, dur: 60, start: null }); setError(''); setNotice(''); }} style={S('height:36px;padding:0 14px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:13px;font-weight:500;cursor:pointer')}>Block time</button>
              </span>
            </div>
            {later.map((b) => (
              <div key={b.id} style={S('display:flex;align-items:center;gap:12px')}>
                <span style={S('flex:0 0 40px;font-size:13px;color:#5E6673')}>{b.startText}</span>
                <button onClick={() => (b.isBlock ? openBlock(b.id) : openBooking(b.id))} aria-label={b.label}
                  style={S(b.isBlock ? 'flex:1 1 0;min-width:0;min-height:64px;box-sizing:border-box;padding:10px 16px;border:1px solid #DDE0E6;border-radius:18px;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;font:inherit;color:#4A525E;background:' + HATCH : (b as any).style)}>
                  <span style={S('min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.client}</span><span style={S('display:block;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.sub}</span></span>
                  <span style={S('flex:0 0 auto;font-size:13.5px;font-weight:500')}>{b.priceText}</span>
                </button>
              </div>
            ))}
          </section>
        </>)}

        {view === 'week' && wkCards.map(({ d, hrs, rows, shown, util, isOpen, limit, summary }) => (
          <section key={d.ymd} style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:16px;display:flex;flex-direction:column;gap:12px')}>
            <div style={S('display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px')}><h2 style={S('margin:0;font-size:16px;font-weight:600')}>{d.abbr + ' ' + d.num + (d.ymd === today ? ', today' : '')}</h2><span style={S('color:#5E6673;font-size:13px')}>{summary}</span></div>
            {hrs?.open && <div style={S('display:flex;align-items:center;gap:10px')}><div style={S('flex:1 1 auto;background:#EEF0F3;border-radius:999px')}><div style={S('height:6px;border-radius:999px;background:#0E1116;width:' + util + '%')} /></div><span style={S('flex:0 0 auto;font-size:12px;color:#5E6673')}>{util + '% booked'}</span></div>}
            {rows.length === 0 && hrs?.open && <p style={S('margin:0;color:#5E6673;font-size:13.5px')}>Nothing booked yet.</p>}
            {shown.map((r, i) => (
              <div key={i} style={S('display:flex;align-items:center;gap:8px')}><span style={S('flex:0 0 40px;font-size:12.5px;color:#5E6673')}>{r.startText}</span>
                <button onClick={r.pick} aria-label={r.startText + ', ' + r.client + ', ' + r.sub}
                  style={S('width:100%;box-sizing:border-box;min-height:52px;padding:8px 12px;border-radius:14px;border:' + (r.isBlock ? '1px solid #DDE0E6' : '0') + ';display:flex;align-items:center;gap:10px;text-align:left;font:inherit;color:#0E1116;background:' + (r.isBlock ? HATCH : '#F7F8FA') + ';cursor:pointer')}>
                  <span style={S('flex:0 0 8px;width:8px;height:8px;border-radius:999px;background:' + r.dot)} />
                  <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.client}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.sub}</span></span>
                  <span style={S('flex:0 0 auto;font-size:13px;font-weight:500')}>{r.priceText}</span>
                </button>
              </div>
            ))}
            {!isOpen && rows.length > limit && <button onClick={() => setWkOpen({ ...wkOpen, [d.ymd]: true })} style={S('height:40px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:13.5px;font-weight:500;cursor:pointer')}>{'Show ' + (rows.length - limit) + ' more'}</button>}
            {isOpen && rows.length > limit && <button onClick={() => setWkOpen({ ...wkOpen, [d.ymd]: false })} style={S('height:40px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:13.5px;font-weight:500;cursor:pointer')}>Show less</button>}
          </section>
        ))}
      </main>

      {/* MobileTabs */}
      <nav aria-label="Main" style={S("box-sizing:border-box;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center;justify-items:center;padding:10px 8px 22px;background:#FFFFFF;border-top:1px solid #E6E8EC;font-family:'Geist',system-ui,sans-serif")}>
        {tabsA('calendar', '/calendar', 'Calendar', true, ic('#0E1116', <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>))}
        {tabsA('services', '/services', 'Services', false, ic('#5E6673', <><circle cx="6" cy="7" r="2.5" /><circle cx="6" cy="17" r="2.5" /><path d="M8 8.5 20 18M8 15.5 20 6" /></>))}
        <Link href="/calendar/new" aria-label="New appointment" style={S('width:48px;height:48px;border-radius:999px;background:#0E1116;display:flex;align-items:center;justify-content:center;text-decoration:none')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </Link>
        {tabsA('clients', '/clients', 'Clients', false, ic('#5E6673', <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18.5 14.8c1.6.8 2.6 2.4 3 5.2" /></>))}
        {tabsA('more', '/more', 'More', false, ic('#5E6673', <><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></>))}
      </nav>

      {open && (
        <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:5')}>
          <button onClick={close} aria-label="Close details" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
          <div className="sheet" role="dialog" aria-label="Appointment details" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:16px')}>
            <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0')} />

            {mode === 'view' && sel && (<>
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
                <div style={S('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}><span style={S(sel.chipStyle)}>{sel.chipText}</span>
                  {sel.b.paid && <span style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{sel.b.paidText}</span>}
                  {!!notice && <span role="status" style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{notice}</span>}</div>
                <button onClick={close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button>
              </div>
              <div style={S('display:flex;align-items:center;gap:14px')}>
                <div style={S(sel.avatarStyle)}>{initials(sel.b.client)}</div>
                <div style={S('min-width:0')}>
                  <div style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{sel.b.client}</div>
                  <div style={S('font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{sel.b.services}</div>
                </div>
              </div>
              <dl style={S('margin:0;display:flex;flex-direction:column')}>
                <div style={S(DLROW)}><dt style={S('color:#5E6673')}>Time</dt><dd style={S('margin:0;font-weight:500;text-align:right;white-space:nowrap')}>{sel.time}</dd></div>
                <div style={S(DLROW)}><dt style={S('color:#5E6673')}>With</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{staffName(sel.b.staffId)}</dd></div>
                <div style={S(DLROW + ';border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Price</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{sel.priceText}</dd></div>
              </dl>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={() => primary(sel.b)} style={S(PRIMARY)}>{sel.primaryLabel}</button>
                <button onClick={() => startResched(sel.b, sel.k === 'done')} style={S(SECOND)}>{sel.secondaryLabel}</button>
              </div>
              {sel.canEdit && <button onClick={() => { setEd({ ids: sel.b.serviceIds.slice(), start: null }); setMode('edit'); setError(''); setNotice(''); }} style={S('height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500;cursor:pointer')}>Edit booking</button>}
              {sel.canEdit && sel.k !== 'live' && <button onClick={() => act(() => cancelBooking(sel.b.id), first(sel.b.client) + "'s booking cancelled", () => { setOpen(false); setMode('view'); })} style={S('height:48px;border:0;border-radius:999px;background:transparent;color:#B42318;font-size:14.5px;font-weight:500;cursor:pointer')}>Cancel booking</button>}
            </>)}

            {mode === 'checkout' && sel && (() => {
              const cm = coMath(sel.b.priceCents);
              return (<>
                <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
                  <div style={S('min-width:0')}><h2 style={S(H2S)}>Checkout</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{sel.b.client + ', ' + sel.b.services}</p></div>
                  <button onClick={close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button>
                </div>
                <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="co-method-label" style={S('font-size:14px;font-weight:600')}>Payment method</span><div role="group" className="hscroll" aria-labelledby="co-method-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
                  {METHODS.filter(([m]) => (m === 'card' ? cfg.acceptCard : m === 'cash' ? cfg.acceptCash : cfg.acceptGift)).map(([m, l]) => <button key={m} onClick={() => setCo({ ...co, method: m })} aria-pressed={co.method === m} style={S(chip(co.method === m))}>{l}</button>)}</div></div>
                {co.method === 'gift_card' && <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="co-code" style={S('font-size:14px;font-weight:600')}>Gift card code</label><input id="co-code" type="text" value={co.code} onChange={(e) => setCo({ ...co, code: e.target.value })} placeholder="Code" style={{ ...S('box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF'), minHeight: 0 }} /></div>}
                {cfg.askTip && <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="co-tip-label" style={S('font-size:14px;font-weight:600')}>Tip</span><div role="group" className="hscroll" aria-labelledby="co-tip-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
                  {TIP_OPTS.map(([p, l]) => <button key={p} onClick={() => setCo({ ...co, tip: p })} aria-pressed={co.tip === p} style={S(chip(co.tip === p))}>{l}</button>)}</div></div>}
                <dl style={S('margin:0;display:flex;flex-direction:column')}>
                  <div style={S(DLROW)}><dt style={S('color:#5E6673')}>Service</dt><dd style={S('margin:0;text-align:right;font-weight:500;white-space:nowrap')}>{m2(sel.b.priceCents)}</dd></div>
                  <div style={S(DLROW)}><dt style={S('color:#5E6673')}>Tip</dt><dd style={S('margin:0;text-align:right;font-weight:500;white-space:nowrap')}>{cm.tip ? m2(cm.tip) : 'None'}</dd></div>
                  <div style={S(DLROW)}><dt style={S('color:#5E6673')}>{cm.taxLabel}</dt><dd style={S('margin:0;text-align:right;font-weight:500;white-space:nowrap')}>{m2(cm.taxAmt)}</dd></div>
                  <div style={S(DLROW + ';border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Total</dt><dd style={S('margin:0;text-align:right;font-weight:600;white-space:nowrap')}>{m2(cm.total)}</dd></div>
                </dl>
                {errP()}
                <div style={S('display:flex;gap:10px')}>
                  <button onClick={charge} disabled={busy} style={S(PRIMARY)}>{'Charge ' + m2(cm.total)}</button>
                  <button onClick={backToView} style={S(SECOND)}>Cancel</button>
                </div>
              </>);
            })()}

            {mode === 'edit' && cur && (() => {
              const pl = editPlan()!;
              const homeCat = svcMap.get(cur.serviceIds[0])?.cat;
              const summary = cur.client + ' with ' + pl.f + ', ' + dayInfo(cur.dayYmd).short + ' at ' + fmtMin(cur.start) + '.';
              const oldDur = cur.end - cur.start;
              const dur = pl.dur === oldDur ? pl.dur + ' min' : oldDur + ' min to ' + pl.dur + ' min';
              const end = fmtMin(pl.mainEnd) + (pl.dur !== oldDur || pl.start !== cur.start ? ' (was ' + fmtMin(cur.end) + ')' : '');
              const price = pl.priceC === cur.priceCents ? usd(pl.priceC) : usd(cur.priceCents) + ' to ' + usd(pl.priceC);
              let blockText = '';
              if (pl.problem) {
                blockText = pl.problem.kind === 'late' ? 'That would run past closing at ' + fmtMin(hrsOf(cur.dayYmd)?.to ?? 1080) + '.' : pl.f + ' is booked with ' + pl.problem.with.who + ' from ' + fmtMin(pl.problem.with.s) + ', so ' + pl.dur + ' min from ' + fmtMin(pl.start) + ' does not fit.';
                if (!pl.alts.length) blockText += ' ' + pl.f + ' has no gap long enough today. Remove a service or reschedule to another day.';
              }
              return (<>
                <div style={S('min-width:0')}><h2 style={S(H2S)}>Edit booking</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{summary}</p></div>
                <ServicePicker services={services} selected={ed.ids} initialCat={homeCat} chipHeight={44}
                  onPick={(id) => setEd({ ids: ed.ids.includes(id) ? ed.ids.filter((i) => i !== id) : [...ed.ids, id], start: null })}
                  note={(x) => (cur.serviceIds.includes(x.id) || offered(x.id, cur.staffId) ? '' : (offers[x.id] ?? [])[0] ? 'separate booking with ' + first(staffName(offers[x.id][0])) : 'no one offers this')} />
                <div style={S('display:flex;flex-direction:column;border:1px solid #E6E8EC;border-radius:16px;padding:4px 16px')}>
                  <div style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #EEF0F3')}><span style={S('color:#5E6673')}>Length</span><span style={S('font-weight:500;text-align:right')}>{dur}</span></div>
                  <div style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #EEF0F3')}><span style={S('color:#5E6673')}>Finishes</span><span style={S('font-weight:500;text-align:right')}>{end}</span></div>
                  <div style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0')}><span style={S('color:#5E6673')}>Price</span><span style={S('font-weight:500;text-align:right')}>{price}</span></div>
                </div>
                {!!pl.problem && <div role="alert" style={S('border-radius:16px;background:#FDECEA;color:#B42318;padding:12px 14px;font-size:13.5px;font-weight:500')}>{blockText}</div>}
                {pl.alts.length > 0 && (
                  <div style={S('display:flex;flex-direction:column;gap:8px')}><span style={S('font-size:14px;font-weight:600')}>Start earlier or later so it fits</span>
                    <div className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>{pl.alts.map((t) => <button key={t} onClick={() => { setEd({ ids: ed.ids, start: t }); setError(''); }} aria-pressed={pl.start === t} style={S(chip(pl.start === t))}>{fmtMin(t) + ' to ' + fmtMin(t + pl.dur)}</button>)}</div></div>
                )}
                {!pl.problem && (pl.dur > cur.end - cur.start || pl.start !== cur.start) && <div style={S(note('#DDF3EA', '#14624A'))}>{pl.f + ' is free for the full ' + pl.dur + ' min' + (pl.start !== cur.start ? ' from ' + fmtMin(pl.start) : '') + '.'}</div>}
                {pl.extras.map((x) => x.at !== undefined
                  ? <div key={x.svc.id} style={S(note('#ECE8FF', '#3B2BB5'))}>{x.svc.name + ' is a ' + x.svc.cat.toLowerCase() + ' service. It will be booked as a separate appointment with ' + x.f + ' at ' + fmtMin(x.at) + ', ' + x.svc.dur + ' min.'}</div>
                  : <div key={x.svc.id} style={S(note('#FDECEA', '#B42318'))}>{(x.f || 'Nobody') + ' has no free time for ' + x.svc.name + ' on this day.'}</div>)}
                {errP()}
                <div style={S('display:flex;gap:10px')}>
                  <button onClick={saveEdit} disabled={busy} style={S(PRIMARY)}>Save changes</button>
                  <button onClick={backToView} style={S(SECOND)}>Cancel</button>
                </div>
              </>);
            })()}

            {mode === 'blockview' && bvB && (<>
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><span style={S('display:inline-block;padding:4px 12px;border-radius:999px;background:#EEF0F3;color:#4A525E;font-size:12.5px;font-weight:500')}>Blocked</span><button onClick={close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX sw={2} /></button></div>
              <div><div style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{BLOCK_KINDS.find((k) => k[0] === bvB.kind)?.[1] ?? 'Blocked'}</div><div style={S('font-size:14px;color:#5E6673')}>{staffName(bvB.staffId)}</div></div>
              <dl style={S('margin:0;display:flex;flex-direction:column')}>
                <div style={S(DLROW)}><dt style={S('color:#5E6673')}>Day</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{dayInfo(bvB.dayYmd).full}</dd></div>
                <div style={S(DLROW + ';border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Time</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{fmtMin(bvB.start) + ' – ' + fmtMin(bvB.end)}</dd></div>
              </dl>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={() => act(() => deleteBlock(bvB.id), 'Block removed', () => { setBlockId(null); setOpen(false); setMode('view'); })} style={S(PRIMARY)}>Remove block</button>
                <button onClick={backToView} style={S(SECOND)}>Close</button>
              </div>
            </>)}

            {mode === 'block' && (<>
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><div style={S('min-width:0')}><h2 style={S(H2S)}>Block time</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>Clients cannot book blocked time.</p></div><button onClick={close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX sw={2} /></button></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-who" style={S('font-size:14px;font-weight:600')}>Team member</span><TeamPicker team={team} selected={bf.s} onPick={(id) => { setBf({ ...bf, s: id, start: null }); setError(''); }} /></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-kind" style={S('font-size:14px;font-weight:600')}>Reason</span><div role="group" aria-labelledby="bk-kind" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>
                {BLOCK_KINDS.map(([k, l]) => <button key={k} onClick={() => setBf({ ...bf, kind: k })} aria-pressed={bf.kind === k} style={S(chip(bf.kind === k))}>{l}</button>)}</div></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-dur" style={S('font-size:14px;font-weight:600')}>Length</span><div role="group" aria-labelledby="bk-dur" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>
                {BLOCK_DURS_M.map(([m, l]) => <button key={m} onClick={() => { setBf({ ...bf, dur: m, start: null }); setError(''); }} aria-pressed={bf.dur === m} style={S(chip(bf.dur === m))}>{l}</button>)}</div></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-day" style={S('font-size:14px;font-weight:600')}>Day</span><div role="group" className="hscroll" aria-labelledby="bk-day" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>
                {days14.map((d) => <button key={d.ymd} onClick={() => { if (!d.closed) { setBf({ ...bf, day: d.ymd, start: null }); setError(''); } }} disabled={d.closed} aria-pressed={bf.day === d.ymd} aria-label={d.full + (d.closed ? ', closed' : '')} style={S(dayCss(bf.day === d.ymd, d.closed))}><span style={S('font-size:12.5px')}>{d.abbr}</span><span style={S('font-size:17px;font-weight:600')}>{d.num}</span></button>)}</div></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-time" style={S('font-size:14px;font-weight:600')}>Starts at</span><div role="group" aria-labelledby="bk-time" style={S('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px')}>
                {slotsFor.map((t) => { const why = reason(bf.day, t, bfDur); const on = bf.start === t && !why; return <button key={t} onClick={() => { if (!why) { setBf({ ...bf, start: t }); setError(''); } }} disabled={!!why} aria-pressed={on} aria-label={fmtMin(t) + (why ? ', unavailable' : '')} style={S(slotCss(on, !!why))}>{fmtMin(t)}</button>; })}</div></div>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={saveBlock} disabled={busy} style={S(PRIMARY)}>Block time</button>
                <button onClick={backToView} style={S(SECOND)}>Cancel</button>
              </div>
            </>)}

            {mode === 'walkin' && (<>
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><div style={S('min-width:0')}><h2 style={S(H2S)}>Walk-in</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>We will find the first free time today.</p></div><button onClick={close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="wi-name" style={S('font-size:14px;font-weight:600')}>Client name</label><input id="wi-name" type="text" value={wi.name} onChange={(e) => { setWi({ ...wi, name: e.target.value }); setError(''); }} placeholder="Full name" style={{ ...S('box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF'), minHeight: 0 }} /></div>
              <div style={S('display:flex;flex-direction:column;gap:10px')}><span id="wi-svc" style={S('font-size:14px;font-weight:600')}>Service</span>
                <ServicePicker services={services} selected={wi.svc ? [wi.svc] : []} initialCat={wiSvc?.cat || wi.cat || undefined} chipHeight={44} onCat={(c) => setWi({ ...wi, cat: c })}
                  onPick={(id) => { const sv = svcMap.get(id)!; const pro = wi.pro !== 'any' && !offered(id, wi.pro) ? 'any' : wi.pro; setWi(wi.svc === id ? { ...wi, svc: null } : { ...wi, svc: id, cat: sv.cat, pro }); setError(''); }} /></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="wi-pro" style={S('font-size:14px;font-weight:600')}>Team member</span>
                <TeamPicker team={team} selected={wi.pro} anyLabel="First available" offers={wi.svc ? (sid) => offered(wi.svc!, sid) : undefined} onPick={(id) => { setWi({ ...wi, pro: id || 'any' }); setError(''); }} /></div>
              <div role="status" style={S(wiPlanCss)}>{wiPlanText}</div>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={() => addWalkin(true)} disabled={busy} style={S(PRIMARY)}>Add &amp; check out</button>
                <button onClick={() => addWalkin(false)} disabled={busy} style={S(SECOND)}>Add to calendar</button>
              </div>
            </>)}

            {mode === 'resched' && cur && (<>
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
                <div style={S('min-width:0')}><h2 style={S(H2S)}>{rs.rebook ? 'Rebook' : 'Reschedule'}</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{rs.rebook ? cur.client + ', ' + cur.services + ' with ' + first(staffName(cur.staffId)) + ', ' + (cur.end - cur.start) + ' min, ' + usd(cur.priceCents) + '.' : cur.client + ', ' + cur.services + ' with ' + first(staffName(cur.staffId)) + '.'}</p></div>
                <button onClick={close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button>
              </div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="rs-day-label" style={S('font-size:14px;font-weight:600')}>{rs.rebook ? 'Day' : 'New day'}</span>
                <div role="group" className="hscroll" aria-labelledby="rs-day-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
                  {days14.map((d) => <button key={d.ymd} onClick={() => { if (!d.closed) setRs({ ...rs, day: d.ymd, time: null }); setError(''); }} disabled={d.closed} aria-pressed={rs.day === d.ymd} aria-label={d.full + (d.closed ? ', closed' : '')} style={S(dayCss(rs.day === d.ymd, d.closed))}><span style={S('font-size:12.5px')}>{d.abbr}</span><span style={S('font-size:17px;font-weight:600')}>{d.num}</span></button>)}
                </div></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="rs-time-label" style={S('font-size:14px;font-weight:600')}>{rs.rebook ? 'Time' : 'New time'}</span>
                <div role="group" aria-labelledby="rs-time-label" style={S('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px')}>
                  {slotsFor.map((t) => { const why = reason(rs.day, t, cur.end - cur.start); const on = rs.time === t && !why; return <button key={t} onClick={() => { if (!why) { setRs({ ...rs, time: t }); setError(''); } }} disabled={!!why} aria-pressed={on} aria-label={fmtMin(t) + (why ? ', unavailable' : '')} style={S(slotCss(on, !!why))}>{fmtMin(t)}</button>; })}
                </div></div>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={moveBooking} disabled={busy} style={S(PRIMARY)}>{rs.rebook ? 'Book again' : 'Move appointment'}</button>
                <button onClick={backToView} style={S(SECOND)}>Cancel</button>
              </div>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}
