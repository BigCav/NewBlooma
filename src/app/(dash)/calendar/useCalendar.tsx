'use client';

// Shared calendar state and handlers. Desktop and mobile layouts both render from this one hook.
import { NO_DISC, discountCents, type DiscPick } from '../sales/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { TONE_LIST, addDaysYmd, dayInfo, fmtMin, initials, weekStartOf, type CalBlock, type CalBooking, type CalHours, type CalService, type CalSettings, type CalStaff, BLOCK_KINDS, slotsBetween } from '@/lib/cal';
import { delayStaffDay, noShowBooking, messageBookingClient, addWalkIn, approveBooking, cancelBooking, checkInBooking, checkoutBooking, createBlock, dayAvailability, deleteBlock, editBooking, rebookBooking, rescheduleBooking, walkinPlan, createNewAppointment, searchBookings, type SearchHit } from './actions';

import { first, usd, m2, BLOCK_DURS_M, METHODS, TIP_OPTS, STEP, chipTone, kindOf, note, HATCH, type Avail, type Props } from './calUi';
export function useCalendar(props: Props) {
  const { day, today, view, tz, team, bookings, blocks, hours, services, offers, cfg } = props;
  const router = useRouter();
  const minsNow = () => { const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date()); return Number(p.find((x) => x.type === 'hour')!.value) * 60 + Number(p.find((x) => x.type === 'minute')!.value); };
  const [now, setNow] = useState(props.nowMin);
  useEffect(() => { setNow(minsNow()); const t = setInterval(() => setNow(minsNow()), 30000); return () => clearInterval(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [busy, startT] = useTransition();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'view' | 'new' | 'checkout' | 'edit' | 'blockview' | 'block' | 'late' | 'walkin' | 'resched' | 'message'>('view');
  const [selId, setSelId] = useState<string | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [wkOpen, setWkOpen] = useState<Record<string, boolean>>({});
  const [bf, setBf] = useState<{ s: string; kind: string; day: string; dur: number; start: number | null }>({ s: '', kind: 'lunch', day: today, dur: 60, start: null });
  const [rs, setRs] = useState<{ day: string; time: number | null; rebook: boolean }>({ day: today, time: null, rebook: false });
  const [wi, setWi] = useState<{ name: string; clientId: string | null; svc: string | null; pro: string; cat: string }>({ name: '', clientId: null, svc: null, pro: 'any', cat: '' });
  const [co, setCo] = useState<{ method: string; tip: number; code: string; disc: DiscPick; svc: string[] | null }>({ method: 'card', tip: 0, code: '', disc: NO_DISC, svc: null });
  const [ed, setEd] = useState<{ ids: string[]; start: number | null }>({ ids: [], start: null });
  const [avail, setAvail] = useState<Avail>(null);
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof walkinPlan>> | null>(null);

  const staffName = (id: string) => team.find((t) => t.id === id)?.name ?? '';
  const closedDays = props.closed ?? {};
  const hrsOf = (ymd: string) => { const h = hours[dayInfo(ymd).wd]; return ymd in closedDays ? { ...h, open: false } : h; };
  const closedWhy = (ymd: string) => closedDays[ymd];
  const [cancelAsk, setCancelAsk] = useState(false);
  useEffect(() => { setCancelAsk(false); }, [selId, mode]);
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
    if (d === today && t < now) return 'past';
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
  const started = (b: { dayYmd: string; start: number }) => b.dayYmd < today || (b.dayYmd === today && b.start <= now);
  const markNoShow = (b: { id: string; client: string }) => act(() => noShowBooking(b.id), first(b.client) + ' marked as a no-show', () => { setOpen(false); setMode('view'); });
  const [msg, setMsg] = useState('');
  const startMessage = () => { setMsg(''); setMode('message'); setError(''); setNotice(''); };
  const sendMessage = () => { if (!cur) return; if (!msg.trim()) { setError('Write a message first.'); return; } act(() => messageBookingClient(cur.id, msg), 'Message sent', () => { setMode('view'); setMsg(''); }); };
  const openBooking = (id: string) => { setSelId(id); setOpen(true); setMode('view'); setError(''); setNotice(''); };
  const openBlock = (id: string) => { setBlockId(id); setOpen(true); setMode('blockview'); setError(''); setNotice(''); };
  const startCheckout = (id: string) => { setSelId(id); setOpen(true); setMode('checkout'); setCo({ method: 'card', tip: cfg.askTip ? cfg.tipDefault : 0, code: '', disc: NO_DISC, svc: null }); setError(''); setNotice(''); };
  const primary = (b: CalBooking) => {
    const k = kindOf(b.status);
    if (k === 'confirmed') { if (b.dayYmd > today) { setError('You can check someone in on the day of their appointment.'); return; } act(() => checkInBooking(b.id), first(b.client) + ' checked in'); }
    else if (k === 'pending') act(() => approveBooking(b.id), first(b.client) + ' approved');
    else if (k === 'live') startCheckout(b.id);
    else if (b.saleId) router.push(`/sales?sale=${b.saleId}`);
  };
  const startResched = (b: CalBooking, rebook: boolean) => {
    let d = rebook ? addDaysYmd(b.dayYmd, 7) : b.dayYmd;
    if (d < today) d = today;
    if (!hrsOf(d)?.open) for (let i = 1; i < 8; i++) { const n = addDaysYmd(d, i); if (hrsOf(n)?.open) { d = n; break; } }
    setSelId(b.id); setOpen(true); setMode('resched'); setRs({ day: d, time: null, rebook }); setError(''); setNotice('');
  };

  /* ---------- derived lists (as Mobile.dc.html renderVals) ---------- */
  const todayList = dayB.filter((b) => !sq || (b.client + ' ' + b.services + ' ' + (b.ref ?? '')).toLowerCase().includes(sq)).sort((a, b) => a.start - b.start).map(vm);
  const activeCards = todayList.filter((x) => x.k === 'live');
  const upcoming = todayList.filter((x) => x.k !== 'done' && x.k !== 'live');
  const cards = activeCards.length ? activeCards : upcoming.slice(0, 1);
  const laterBk = upcoming.filter((x) => !cards.includes(x));
  const doneBk = todayList.filter((x) => x.k === 'done');
  const blockRows = blocks.filter((b) => b.dayYmd === day && (day !== today || b.end > now) && !sq).map((b) => ({
    start: b.start, startText: fmtMin(b.start), client: BLOCK_KINDS.find((k) => k[0] === b.kind)?.[1] ?? 'Blocked', priceText: '',
    sub: first(staffName(b.staffId)) + ', until ' + fmtMin(b.end),
    label: (BLOCK_KINDS.find((k) => k[0] === b.kind)?.[1] ?? 'Blocked') + ', ' + first(staffName(b.staffId)) + ', ' + fmtMin(b.start) + ' to ' + fmtMin(b.end),
    id: b.id, isBlock: true as const,
  }));
  const row = (x: (typeof todayList)[number]) => ({ start: x.b.start, startText: fmtMin(x.b.start), client: x.b.client, sub: x.sub, priceText: x.priceText, label: x.label, id: x.b.id, style: x.style, isBlock: false as const });
  const laterAll = [...laterBk.map(row), ...blockRows].sort((a, b) => a.start - b.start), laterDone = doneBk.map(row);
  // Today's appointments whose start time has passed but who were never checked in.
  const laterLate = day === today ? laterAll.filter((r) => !r.isBlock && r.start <= now) : [];
  const laterUp = laterAll.filter((r) => !laterLate.includes(r));
  const later = [...laterLate, ...laterUp, ...laterDone];

  const dayHrs = hrsOf(day);
  const statCount = dayB.length, statRevenue = usd(dayB.reduce((a, b) => a + b.priceCents, 0));
  let statNext = dayHrs?.open ? 'None left' : 'Closed';
  if (dayHrs?.open) {
    for (let t = Math.max(dayHrs.from, day === today ? Math.ceil(now / STEP) * STEP : 0); t + STEP <= dayHrs.to; t += STEP) {
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
  const coMath = (grossC: number) => {
    const disc = cfg.canDiscount ? discountCents(grossC, co.disc) : 0, priceC = grossC - disc;
    const tip = cfg.askTip ? Math.round(grossC * co.tip / 100) : 0;
    const taxAmt = cfg.taxInclusive ? Math.round(priceC * cfg.taxRate / (100 + cfg.taxRate)) : Math.round(priceC * cfg.taxRate / 100);
    return { disc, net: priceC, tip, taxAmt, total: priceC + tip + (cfg.taxInclusive ? 0 : taxAmt), taxLabel: (cfg.taxInclusive ? 'Includes ' : 'Tax ') + cfg.taxRate + '%' };
  };
  const charge = () => {
    if (!cur) return;
    const method = co.method as 'card' | 'cash' | 'gift_card';
    startT(async () => {
      setError('');
      const r = await checkoutBooking(cur.id, method, cfg.askTip ? co.tip : 0, co.code, cfg.canDiscount ? co.disc : undefined, co.svc ?? undefined);
      if (r.error) { setError(r.error); return; }
      if (method === 'card' && r.saleId) { router.push(`/sales?sale=${r.saleId}&pay=1`); return; }
      setMode('view'); setNotice(''); refresh();
    });
  };

  /* ---------- edit booking ---------- */
  const svcMap = new Map(services.map((s) => [s.id, s]));
  // An add-on is done by whoever does its main service, so it follows the main services rather than having its own team list.
  const offered = (sid: string, staffId: string) => { const sv = svcMap.get(sid); return sv?.addon ? (sv.parents ?? []).some((pid) => (offers[pid] ?? []).includes(staffId)) : (offers[sid] ?? []).includes(staffId); };
  const hasProvider = (sid: string) => { const sv = svcMap.get(sid); return sv?.addon ? (sv.parents ?? []).some((pid) => (offers[pid] ?? []).length > 0) : (offers[sid] ?? []).length > 0; };
  /** Why a service cannot be picked right now (empty when it can). */
  const lockFor = (chosen: string[]) => (x: CalService) => x.addon
    ? ((x.parents ?? []).some((pid) => chosen.includes(pid)) ? '' : 'add-on, choose its main service first')
    : (hasProvider(x.id) ? '' : 'no one offers this yet');
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
    const alts = problem ? slots.filter((t) => !clash(t) && !(cur.dayYmd === today && t < now)).sort((x, y) => Math.abs(x - cur.start) - Math.abs(y - cur.start)).slice(0, 8).sort((x, y) => x - y) : [];
    const mainEnd = start + dur;
    const taken: { s: string; start: number; end: number }[] = [];
    const extras = extraIds.map((id) => {
      const svc = svcMap.get(id)!, sid = (offers[id] ?? [])[0];
      let at: number | undefined;
      if (sid) {
        const free = (t: number) => (cur.dayYmd !== today || t >= now) && t + svc.dur <= close && !occ(sid).some((e) => t < e.e && e.s < t + svc.dur) && !taken.some((k) => k.s === sid && t < k.end && k.start < t + svc.dur);
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
    if (bad) { setError(bad.sid ? bad.f + ' has no free time for ' + bad.svc.name + ' that day. Remove it or pick another day first.' : 'No one offers ' + bad.svc.name + ' yet, so it cannot be added. Remove it first.'); return; }
    const msg = pl.extras.length ? 'Updated, ' + pl.extras.map((x) => x.svc.name + ' with ' + x.f + ' at ' + fmtMin(x.at!)).join(', ') : first(cur.client) + "'s booking updated";
    act(() => editBooking(cur.id, cur.dayYmd, pl.start, pl.removed, pl.added, pl.extras.map((x) => ({ serviceId: x.svc.id, staffId: x.sid!, startMin: x.at! }))), msg, () => { setOpen(false); setMode('view'); });
  };

  /* ---------- running late ---------- */
  const [lf, setLf] = useState({ s: '', mins: 30, tell: true });
  const openLate = () => { setLf({ s: team[0]?.id ?? '', mins: 30, tell: true }); setMode('late'); setOpen(true); setError(''); setNotice(''); };
  const lateList = bookings.filter((b) => b.staffId === lf.s && b.dayYmd === day && (b.status === 'pending' || b.status === 'confirmed')).sort((a, b) => a.start - b.start);
  const saveLate = () => {
    if (!lf.s) { setError('Choose a team member.'); return; }
    if (!lateList.length) { setError('There is nothing left to move for them on this day.'); return; }
    act(() => delayStaffDay(lf.s, day, lf.mins, lf.tell), 'Appointments moved', () => { setOpen(false); setMode('view'); });
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
      const r = await addWalkIn(wi.name, wi.clientId, wi.svc!, wi.pro);
      if (r.error) { setError(r.error); return; }
      setWi({ name: '', clientId: null, svc: null, pro: 'any', cat: '' });
      if (pay && r.id) { await checkInBooking(r.id); startCheckout(r.id); }
      else { setOpen(false); setMode('view'); setNotice(r.note ?? ''); }
      refresh();
    });
  };


  /* ---------- new appointment ---------- */
  const firstOpenDay = (from: string) => { for (let i = 0; i < 14; i++) { const d = addDaysYmd(from, i); if (hrsOf(d)?.open) return d; } return from; };
  const blank = (d: string) => ({ client: '', clientId: null as string | null, services: [] as string[], staff: '', day: d, time: null as number | null });
  const [nf, setNf] = useState(blank(firstOpenDay(day < today ? today : day)));
  const [amap, setAmap] = useState<Record<string, { busy: { s: number; e: number }[]; open: boolean; from: number; to: number }>>({});
  const chk = (a: { busy: { s: number; e: number }[]; open: boolean; from: number; to: number } | undefined, d: string, t: number, dur: number) => {
    if (!a) return 'loading';
    if (!a.open) return 'closed';
    if (d === today && t < now) return 'past';
    if (t < a.from || t + dur > a.to) return 'late';
    if (a.busy.some((x) => t < x.e && x.s < t + dur)) return 'busy';
    return '';
  };
  const nPlan = () => {
    const sel = nf.services.map((i) => svcMap.get(i)).filter(Boolean) as CalService[];
    const same = nf.staff ? sel.filter((x) => offered(x.id, nf.staff)) : sel;
    const others = nf.staff ? sel.filter((x) => !offered(x.id, nf.staff)).map((x) => ({ svc: x, sid: (offers[x.id] ?? [])[0] as string | undefined })) : [];
    return { sel, same, others, dur: same.length ? same.reduce((a, x) => a + x.dur, 0) : 30, priceC: sel.reduce((a, x) => a + x.priceCents, 0), mins: sel.reduce((a, x) => a + x.dur, 0) };
  };
  // With no team member picked yet, a slot is free if anyone who offers every chosen service is free.
  const nCands = () => team.filter((t) => nf.services.every((id) => offered(id, t.id))).map((t) => t.id);
  const nKeys = mode !== 'new' ? [] : (nf.staff ? Array.from(new Set([nf.staff, ...(nPlan().others.map((o) => o.sid).filter(Boolean) as string[])])) : nCands()).map((sid) => `${nf.day}|${sid}`);
  const nKeyStr = nKeys.join(',');
  useEffect(() => {
    nKeys.filter((k) => !amap[k]).forEach((k) => {
      const [d, sid] = k.split('|');
      dayAvailability(d, sid).then((r) => setAmap((m) => ({ ...m, [k]: r })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nKeyStr]);
  const nWhy = (t: number) => {
    const p = nPlan();
    if (!nf.staff) {
      const h = hrsOf(nf.day); if (!h?.open) return 'closed'; if (nf.day === today && t < now) return 'past'; if (t + p.dur > h.to) return 'late';
      const ws = nCands().map((sid) => chk(amap[`${nf.day}|${sid}`], nf.day, t, p.dur));
      if (!ws.length) return 'busy';
      return ws.includes('') ? '' : ws.includes('loading') ? 'loading' : 'busy';
    }
    const w = chk(amap[`${nf.day}|${nf.staff}`], nf.day, t, p.dur); if (w) return w;
    for (const o of p.others) { if (!o.sid || chk(amap[`${nf.day}|${o.sid}`], nf.day, t, o.svc.dur)) return 'busy'; }
    return '';
  };
  const nSlots = (() => {
    if (nf.staff) { const a = amap[`${nf.day}|${nf.staff}`]; return a && a.open ? slotsBetween(a.from, a.to) : []; }
    const h = hrsOf(nf.day); return h?.open ? slotsBetween(h.from, h.to) : [];
  })();
  const nFirstSvc = svcMap.get(nf.services[0]);
  // A team member is available to pick if they offer any chosen service, so the order the services were chosen in does not matter.
  const nOffers = (sid: string) => !nf.services.length || nf.services.some((id) => offered(id, sid));
  const nPickSvc = (id: string) => {
    // Keep the sheet where it was: choosing or dropping a service must not scroll it back to the top.
    let sc: HTMLElement | null = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    while (sc && !(sc.scrollHeight > sc.clientHeight && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    const top = sc?.scrollTop ?? 0;
    if (sc) { const keep = sc; requestAnimationFrame(() => { keep.scrollTop = top; requestAnimationFrame(() => { keep.scrollTop = top; }); }); }
    let ids = nf.services.includes(id) ? nf.services.filter((i) => i !== id) : [...nf.services, id];
    ids = ids.filter((i) => { const sv = svcMap.get(i); return !sv?.addon || (sv.parents ?? []).some((p) => ids.includes(p)); });
    const f0 = svcMap.get(ids[0]);
    let staff = nf.staff;
    if (staff && ids.length && !ids.some((i) => offered(i, staff))) staff = '';
    if (f0 && !staff) { const c = offers[f0.id] ?? []; if (c.length === 1) staff = c[0]; }
    setNf({ ...nf, services: ids, staff, time: null }); setError('');
  };
  const openNew = () => { setNf(blank(firstOpenDay(day < today ? today : day))); setAmap({}); setMode('new'); setOpen(true); setError(''); setNotice(''); };
  const [pendingSel, setPendingSel] = useState<string | null>(null);
  useEffect(() => { if (props.initialNew) { openNew(); if (props.initialClient) setNf((n) => ({ ...n, client: props.initialClient! })); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Opened from a link (for example the inbox): show that booking.
  useEffect(() => { if (props.initialSel) { setSelId(props.initialSel); setOpen(true); setMode('view'); setError(''); setNotice(''); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.initialSel]);
  const createNew = () => {
    const p = nPlan(); const name = nf.client.trim();
    if (!name) { setError("Add the client's name."); return; }
    if (!p.sel.length) { setError('Choose a service.'); return; }
    if (!nf.staff) { setError('Choose a team member.'); return; }
    if (!hrsOf(nf.day)?.open) { setError('The salon is closed on that day.'); return; }
    const orphan = p.others.find((o) => !o.sid); if (orphan) { setError('No one offers ' + orphan.svc.name + ' yet. Remove it, or assign it to a team member in Services.'); return; }
    if (nf.time === null) { setError('Choose a time from the list.'); return; }
    if (nWhy(nf.time)) { setError('That time is no longer free. Pick another from the list.'); return; }
    const known = nf.clientId ? { id: nf.clientId } : null;
    startT(async () => {
      setError('');
      const r = await createNewAppointment(name, known?.id ?? null, nf.staff, nf.day, nf.time!, p.same.map((x) => x.id), p.others.map((o) => ({ serviceId: o.svc.id, staffId: o.sid! })));
      if (r.error) { setError(r.error); if (r.id) refresh(); return; }
      const d = nf.day;
      if (props.onCreated) { props.onCreated({ id: r.id, day: d }); return; }
      setSelId(r.id ?? null); setPendingSel(r.id ?? null); setNf(blank(d)); setAmap({}); setMode('view'); setOpen(false); setError('');
      if (d !== day) router.push(`/calendar?d=${d}&v=${view === 'week' ? 'week' : 'day'}`); else refresh();
      setNotice('Appointment added');
    });
  };

  /* ---------- desktop layout data ---------- */
  const [staffSel, setStaffSel] = useState(props.staffFilter);
  const wkStaff = staffSel === 'all' ? team[0]?.id ?? '' : staffSel;
  const viewEvents = view === 'week' ? bookings.filter((b) => b.staffId === wkStaff) : dayB;
  const openDays = hours.filter((h) => h.open);
  const gStart = openDays.length ? Math.floor(Math.min(...openDays.map((h) => h.from)) / 60) : 8;
  const gEnd = openDays.length ? Math.ceil(Math.max(...openDays.map((h) => h.to)) / 60) : 18;
  const gHours = Array.from({ length: gEnd - gStart }, (_, i) => gStart + i);
  const HOUR_PX = 72;
  const nowTop = (now / 60 - gStart) * HOUR_PX;
  const [sres, setSres] = useState<SearchHit[] | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (!props.remoteSearch || !q) { setSres(null); return; }
    let live = true;
    const t = setTimeout(() => { searchBookings(q).then((r) => { if (live) setSres(r); }); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [query, props.remoteSearch]);
  useEffect(() => { if (pendingSel && bookings.some((b) => b.id === pendingSel)) setPendingSel(null); }, [bookings, pendingSel]);

  const close = () => { setOpen(false); setMode('view'); setError(''); };
  const backToView = () => { setMode('view'); setError(''); };
  const hasError = !!error;
  const sel = cur ? vm(cur) : null;
  const seg = (on: boolean) => 'flex:1 1 0;height:44px;border:0;border-radius:999px;font-size:14px;font-weight:500;background:' + (on ? '#0E1116' : 'transparent') + ';color:' + (on ? '#FFFFFF' : '#0E1116');

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

  const nLock = lockFor(nf.services), edLock = lockFor(ed.ids);
  return { laterUp, laterLate, laterDone, nLock, edLock, lockFor, HOUR_PX, act, activeCards, addWalkin, amap, av, avail, availKey, backToView, bf, bfDur, blank, blockId, blockRows, blocks, bookings, busy, bvB, cards, cfg, charge, chk, close, co, coMath, createNew, cur, day, dayB, dayHrs, days14, di, doneBk, ed, editPlan, error, firstOpenDay, gEnd, gHours, gStart, go, hasError, hours, hrsOf, closedWhy, cancelAsk, setCancelAsk, later, laterBk, minutesFromIso, mode, moveBooking, nFirstSvc, nKeyStr, nKeys, nOffers, nPickSvc, nPlan, nSlots, nWhy, nf, notice, now, nowTop, offered, offers, open, openBlock, openBooking, openDays, openNew, pageSubtitle, pageTitle, pendingSel, plan, primary, query, reason, refresh, router, row, rs, saveBlock, saveEdit, searchOpen, seg, sel, selId, services, setAmap, setAvail, setBf, setBlockId, setCo, setEd, setError, setMode, setNf, setNotice, setNow, setOpen, setPendingSel, setPlan, setQuery, setRs, setSearchOpen, setSelId, setSres, setStaffSel, setWi, setWkOpen, slotsFor, sq, sres, staffName, staffSel, startCheckout, startResched, startT, statCount, statRevenue, statNext, strip, svcMap, team, today, todayList, tz, upcoming, view, viewEvents, vm, weekDays, wi, wiPlanText, wiPlanCss, wiSvc, wkCards, wkOpen, wkRange, wkStaff, wkTitle, ws, msg, setMsg, startMessage, sendMessage, started, markNoShow, lf, setLf, openLate, lateList, saveLate };
}
