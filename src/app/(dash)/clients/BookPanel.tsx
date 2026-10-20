'use client';
// "Book appointment" panel from Clients.dc.html (aside) and MobileClients.dc.html (sheet). Availability and booking are real.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { addDaysYmd, dayInfo, slotsBetween, type CalHours, type CalService, type CalStaff } from '@/lib/cal';
import { S, ServicePicker, TeamPicker } from '../calendar/pickers';
import { dayAvailability, createNewAppointment } from '../calendar/actions';

export type BookData = { services: CalService[]; team: CalStaff[]; offers: Record<string, string[]>; hours: CalHours[]; today: string; tz: string };
type Av = { busy: { s: number; e: number }[]; open: boolean; from: number; to: number };

const fmtMin = (m: number) => Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
const nowMinIn = (tz: string) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date()); return Number(p.find((x) => x.type === 'hour')!.value) * 60 + Number(p.find((x) => x.type === 'minute')!.value); };

export function BookPanel({ data, client, mobile, onBooked, onCancel }: { data: BookData; client: { id: string; name: string; first: string }; mobile: boolean; onBooked: (when: string) => void; onCancel: () => void }) {
  const { services, team, offers, hours, tz } = data;
  const [busy, startT] = useTransition();
  const today = data.today;
  const hrsOf = (d: string) => hours[dayInfo(d).wd];
  const svcMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const offered = (sid: string, staffId: string) => (offers[sid] ?? []).includes(staffId);
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
    const ids = b.services.includes(id) ? b.services.filter((i) => i !== id) : [...b.services, id];
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

  const h = mobile ? 44 : 40, bh = mobile ? 48 : 44, dw = mobile ? 60 : 64, dh = mobile ? 76 : 72;
  const dayCss = (on: boolean, closed: boolean) => 'flex:0 0 ' + dw + 'px;height:' + dh + 'px;box-sizing:border-box;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:inherit;border:1px solid ' + (on ? '#0E1116' : '#E6E8EC') + ';background:' + (on ? '#0E1116' : (closed ? '#F4F5F7' : '#FFFFFF')) + ';color:' + (on ? '#FFFFFF' : (closed ? '#8A93A0' : '#0E1116')) + (closed ? ';cursor:default' : '');
  const slotCss = (on: boolean, w: boolean) => 'width:100%;height:44px;padding:0;border-radius:14px;font-size:14px;font-weight:500;font-family:inherit;border:1px solid ' + (on ? '#0E1116' : (w ? '#EEF0F3' : '#E1E4E9')) + ';background:' + (on ? '#0E1116' : (w ? '#F4F5F7' : '#FFFFFF')) + ';color:' + (on ? '#FFFFFF' : (w ? '#8A93A0' : '#0E1116')) + (w ? ';text-decoration:line-through;cursor:default' : '');
  const BTN = 'flex:1 1 0;height:' + bh + 'px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500';
  const BTN2 = 'flex:1 1 0;height:' + bh + 'px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500';
  const summary = p.sel.length ? p.sel.map((x) => x.name).join(' + ') + ', ' + p.mins + ' min, $' + p.priceC / 100 + (b.time !== null && !why(b.time) ? ', ' + dayInfo(b.day).short + ' ' + fmtMin(b.time) + ' to ' + fmtMin(b.time + p.dur) : '') : 'Choose a service to see its length and price.';

  return (
    <div style={S('display:flex;flex-direction:column;gap:18px')}>
      <div><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>Book {client.first}</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>{summary}</p></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-service-label" style={S('font-size:14px;font-weight:600')}>Service</span>
        <ServicePicker services={services} selected={b.services} initialCat={firstSvc?.cat} chipHeight={h} onPick={pick} note={(x) => (b.staff && !offered(x.id, b.staff) ? ((offers[x.id] ?? [])[0] ? 'separate booking with ' + staffName(offers[x.id][0]).split(' ')[0] : 'no one offers this') : '')} /></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-team-label" style={S('font-size:14px;font-weight:600')}>Team member</span>
        <TeamPicker team={team} selected={b.staff} offers={(sid) => !b.services.length || b.services.some((id) => offered(id, sid))} onPick={(id) => { setB({ ...b, staff: id, time: null }); setError(''); }} /></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-day-label" style={S('font-size:14px;font-weight:600')}>Day</span>
        <div role="group" className="hscroll" aria-labelledby="bk-day-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
          {days14.map((d) => <button key={d.ymd} onClick={() => { if (!d.closed) { setB({ ...b, day: d.ymd, time: null }); setError(''); } }} disabled={d.closed} aria-pressed={b.day === d.ymd} aria-label={d.full + (d.closed ? ', closed' : '')} style={S(dayCss(b.day === d.ymd, d.closed))}><span style={S('font-size:12.5px')}>{d.abbr}</span><span style={S('font-size:17px;font-weight:600')}>{d.num}</span></button>)}
        </div></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-time-label" style={S('font-size:14px;font-weight:600')}>Time</span>
        <div role="group" aria-labelledby="bk-time-label" style={S('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px')}>
          {slots.map((t) => { const w = why(t); const on = b.time === t && !w; return <button key={t} onClick={() => { if (!w) { setB({ ...b, time: t }); setError(''); } }} disabled={!!w} aria-pressed={on} aria-label={fmtMin(t) + (w ? ', unavailable' : '')} style={S(slotCss(on, !!w))}>{fmtMin(t)}</button>; })}
        </div></div>
      {!!error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{error}</p>}
      <div style={S('display:flex;gap:10px')}><button onClick={book} disabled={busy} style={S(BTN)}>Book appointment</button><button className="ghost" onClick={onCancel} style={S(BTN2)}>Cancel</button></div>
    </div>
  );
}
