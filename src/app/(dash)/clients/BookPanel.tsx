'use client';
// "Book appointment" panel from Clients.dc.html (aside) and MobileClients.dc.html (sheet). Availability and booking are real.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { addDaysYmd, dayInfo, fmtMin, slotsBetween, type CalHours, type CalService, type CalStaff } from '@/lib/cal';
import { duration, timeRange } from '@/lib/display';
import { dollars } from '@/lib/format';
import { firstName } from '@/lib/people';
import { BLACK, FieldError, OUTLINE, dim } from '@/components/ui';
import { DayStrip, TimeGrid } from '@/components/DayTimePicker';
import { S, ServicePicker, TeamPicker } from '../calendar/pickers';
import { dayAvailability, createNewAppointment } from '../calendar/actions';

export type BookData = { services: CalService[]; team: CalStaff[]; offers: Record<string, string[]>; hours: CalHours[]; today: string; tz: string };
type Av = { busy: { s: number; e: number }[]; open: boolean; from: number; to: number };

const nowMinIn = (tz: string) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date()); return Number(p.find((x) => x.type === 'hour')!.value) * 60 + Number(p.find((x) => x.type === 'minute')!.value); };

export function BookPanel({ data, client, mobile, onBooked, onCancel }: { data: BookData; client: { id: string; name: string; first: string }; mobile: boolean; onBooked: (when: string) => void; onCancel: () => void }) {
  const { services, team, offers, hours, tz } = data;
  const [busy, startT] = useTransition();
  const today = data.today;
  const hrsOf = (d: string) => hours[dayInfo(d).wd];
  const svcMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const offered = (sid: string, staffId: string) => { const sv = svcMap.get(sid); return sv?.addon ? (sv.parents ?? []).some((pid) => (offers[pid] ?? []).includes(staffId)) : (offers[sid] ?? []).includes(staffId); };
  const lock = (x: CalService) => x.addon
    ? ((x.parents ?? []).some((pid) => b.services.includes(pid)) ? '' : 'add-on, choose its main service first')
    : ((offers[x.id] ?? []).length ? '' : 'no one offers this yet');
  const staffName = (id: string) => team.find((t) => t.id === id)?.name ?? '';
  const firstOpen = () => { for (let i = 0; i < 14; i++) { const d = addDaysYmd(today, i); if (hrsOf(d)?.open) return d; } return today; };
  const [b, setB] = useState({ services: [] as string[], staff: '', day: firstOpen(), time: null as number | null });
  const [error, setError] = useState('');
  const [amap, setAmap] = useState<Record<string, Av>>({});
  const days14 = Array.from({ length: 14 }, (_, i) => { const d = addDaysYmd(today, i); return { ...dayInfo(d), closed: !hrsOf(d)?.open }; });

  const plan = () => {
    const sel = b.services.map((i) => svcMap.get(i)).filter(Boolean) as CalService[];
    const same = b.staff ? sel.filter((x) => offered(x.id, b.staff)) : sel;
    const others = b.staff ? sel.filter((x) => !offered(x.id, b.staff)).map((x) => ({ svc: x, sid: (offers[x.id] ?? [])[0] as string | undefined })) : [];
    return { sel, same, others, dur: same.length ? same.reduce((a, x) => a + x.dur, 0) : 30, priceC: sel.reduce((a, x) => a + x.priceCents, 0), mins: sel.reduce((a, x) => a + x.dur, 0) };
  };
  const p = plan();
  const keys = b.staff ? Array.from(new Set([b.staff, ...(p.others.map((o) => o.sid).filter(Boolean) as string[])])).map((sid) => `${b.day}|${sid}`) : [];
  const keyStr = keys.join(',');
  useEffect(() => {
    keys.filter((k) => !amap[k]).forEach((k) => { const [d, sid] = k.split('|'); dayAvailability(d, sid).then((r) => setAmap((m) => ({ ...m, [k]: r }))); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyStr]);

  const chk = (a: Av | undefined, d: string, t: number, dur: number) => {
    if (!a) return 'loading';
    if (!a.open) return 'closed';
    if (d === today && t < nowMinIn(tz)) return 'past';
    if (t < a.from || t + dur > a.to) return 'late';
    if (a.busy.some((x) => t < x.e && x.s < t + dur)) return 'busy';
    return '';
  };
  const why = (t: number) => {
    if (!b.staff) { const h = hrsOf(b.day); if (!h?.open) return 'closed'; if (b.day === today && t < nowMinIn(tz)) return 'past'; if (t + p.dur > h.to) return 'late'; return ''; }
    const w = chk(amap[`${b.day}|${b.staff}`], b.day, t, p.dur); if (w) return w;
    for (const o of p.others) { if (!o.sid || chk(amap[`${b.day}|${o.sid}`], b.day, t, o.svc.dur)) return 'busy'; }
    return '';
  };
  const slots = (() => {
    if (b.staff) { const a = amap[`${b.day}|${b.staff}`]; return a && a.open ? slotsBetween(a.from, a.to) : []; }
    const h = hrsOf(b.day); return h?.open ? slotsBetween(h.from, h.to) : [];
  })();
  const firstSvc = svcMap.get(b.services[0]);
  const pick = (id: string) => {
    let ids = b.services.includes(id) ? b.services.filter((i) => i !== id) : [...b.services, id];
    ids = ids.filter((i) => { const sv = svcMap.get(i); return !sv?.addon || (sv.parents ?? []).some((p) => ids.includes(p)); });
    const f0 = svcMap.get(ids[0]);
    let staff = b.staff;
    if (staff && ids.length && !ids.some((i) => offered(i, staff))) staff = '';
    if (f0 && !staff) { const c = offers[f0.id] ?? []; if (c.length === 1) staff = c[0]; }
    setB({ ...b, services: ids, staff, time: null }); setError('');
  };
  const book = () => {
    if (!p.sel.length) { setError('Choose a service.'); return; }
    if (!b.staff) { setError('Choose a team member.'); return; }
    if (b.time === null) { setError('Choose a time from the list.'); return; }
    if (why(b.time)) { setError('That time is no longer free. Pick another from the list.'); return; }
    const t = b.time;
    startT(async () => {
      setError('');
      const r = await createNewAppointment(client.name, client.id, b.staff, b.day, t, p.same.map((x) => x.id), p.others.map((o) => ({ serviceId: o.svc.id, staffId: o.sid! })));
      if (r.error) { setError(r.error); return; }
      onBooked(`${dayInfo(b.day).short}, ${fmtMin(t)}`);
    });
  };

  const h = mobile ? 44 : 40;
  const summary = p.sel.length ? p.sel.map((x) => x.name).join(' + ') + ', ' + duration(p.mins) + ', ' + dollars(p.priceC) + (b.time !== null && !why(b.time) ? ', ' + dayInfo(b.day).short + ' ' + timeRange(fmtMin(b.time), fmtMin(b.time + p.dur)) : '') : 'Choose a service to see its length and price.';

  return (
    <div style={S('display:flex;flex-direction:column;gap:18px')}>
      <div><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>Book {client.first}</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>{summary}</p></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-service-label" style={S('font-size:14px;font-weight:600')}>Service</span>
        <ServicePicker lock={lock} services={services} selected={b.services} initialCat={firstSvc?.cat} chipHeight={h} onPick={pick} note={(x) => (b.staff && !offered(x.id, b.staff) ? ((offers[x.id] ?? [])[0] ? 'separate booking with ' + firstName(staffName(offers[x.id][0])) : 'no one offers this') : '')} /></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-team-label" style={S('font-size:14px;font-weight:600')}>Team member</span>
        <TeamPicker team={team} selected={b.staff} offers={(sid) => !b.services.length || b.services.some((id) => offered(id, sid))} onPick={(id) => { setB({ ...b, staff: id, time: null }); setError(''); }} /></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-day-label" style={S('font-size:14px;font-weight:600')}>Day</span>
        <DayStrip days={days14} selected={b.day} onPick={(ymd) => { setB({ ...b, day: ymd, time: null }); setError(''); }} labelledBy="bk-day-label" /></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-time-label" style={S('font-size:14px;font-weight:600')}>Time</span>
        <TimeGrid times={slots.map((min) => ({ min, ok: !why(min) }))} selected={b.time} onPick={(min) => { setB({ ...b, time: min }); setError(''); }} labelledBy="bk-time-label" /></div>
      {!!error && <FieldError>{error}</FieldError>}
      <div style={S('display:flex;gap:10px')}><button onClick={book} disabled={busy} style={S(BLACK + dim(busy))}>{busy ? 'Booking…' : 'Book appointment'}</button><button className="ghost" onClick={onCancel} style={S(OUTLINE)}>Cancel</button></div>
    </div>
  );
}
