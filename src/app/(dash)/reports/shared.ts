// Shapes the report_dashboard RPC output into the view model the Reports screens render.
export type Dir = 'up' | 'down' | 'flat';
export type Period = {
  id: 'today' | 'week' | 'month' | 'year'; label: string; prev: string; sentence: string;
  revenue: number; appts: number; rebook: number; d: { revenue: [string, Dir]; appts: [string, Dir]; avg: [string, Dir]; rebook: [string, Dir] };
  hi: number; bars: [string, number][]; services: [string, number, number][]; team: [string, number, number][]; fresh: number; hasClients: boolean;
};
export type Heat = { label: string; values: number[] }[];
export const PERIOD_DEFS = [
  { id: 'today', label: 'Today', prev: 'yesterday', sentence: 'today' },
  { id: 'week', label: '7 days', prev: 'the previous 7 days', sentence: 'in the last 7 days' },
  { id: 'month', label: '30 days', prev: 'the previous 30 days', sentence: 'in the last 30 days' },
  { id: 'year', label: 'This year', prev: 'last year', sentence: 'so far this year' },
] as const;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const utc = (s: string) => { const { y, m, d } = parse(s); return Date.UTC(y, m - 1, d); };
export const addD = (s: string, n: number) => iso(utc(s) + n * 86400000);
const wd = (s: string) => (new Date(utc(s)).getUTCDay() + 6) % 7;

export function ranges(today: string) {
  const { y, m, d } = parse(today);
  const pyd = m === 2 && d === 29 ? 28 : d;
  const p2 = (n: number) => String(n).padStart(2, '0');
  return {
    today: { from: today, to: today, pf: addD(today, -1), pt: addD(today, -1) },
    week: { from: addD(today, -6), to: today, pf: addD(today, -13), pt: addD(today, -7) },
    month: { from: addD(today, -29), to: today, pf: addD(today, -59), pt: addD(today, -30) },
    year: { from: `${y}-01-01`, to: today, pf: `${y - 1}-01-01`, pt: `${y - 1}-${p2(m)}-${p2(pyd)}` },
  };
}

const pctText = (cur: number, prev: number): [string, Dir] => {
  if (!prev) return cur ? ['new', 'up'] : ['no change', 'flat'];
  const p = Math.round((cur - prev) / prev * 100);
  return p === 0 ? ['no change', 'flat'] : [(p > 0 ? '+' : '-') + Math.abs(p) + '%', p > 0 ? 'up' : 'down'];
};
const ptsText = (cur: number, prev: number): [string, Dir] => {
  const p = cur - prev;
  return p === 0 ? ['no change', 'flat'] : [(p > 0 ? '+' : '-') + Math.abs(p) + (Math.abs(p) === 1 ? ' pt' : ' pts'), p > 0 ? 'up' : 'down'];
};

export function buildPeriod(def: (typeof PERIOD_DEFS)[number], r: any, from: string, to: string, nowHour: number): Period {
  const cur = r.cur, prev = r.prev;
  const rate = (k: any) => (k.rebook_total ? Math.round(k.rebooked / k.rebook_total * 100) : 0);
  const rev = Number(cur.revenue_cents), appts = Number(cur.appts), prevRev = Number(prev.revenue_cents), prevAppts = Number(prev.appts);
  const avg = appts ? rev / appts : 0, prevAvg = prevAppts ? prevRev / prevAppts : 0;
  let bars: [string, number][] = [], hi = 0;
  const day: Record<string, number> = {}; for (const x of r.by_day) day[x.d] = Number(x.cents);
  if (def.id === 'today') {
    const hrs: Record<number, number> = {}; for (const x of r.by_hour) hrs[x.hour] = Number(x.cents);
    const keys = Object.keys(hrs).map(Number);
    if (keys.length) { const lo = Math.min(...keys), hiH = Math.max(...keys); for (let h = lo; h <= hiH; h++) bars.push([String(h), hrs[h] ?? 0]); }
    hi = Math.max(0, bars.findIndex((b) => b[0] === String(nowHour)));
    if (!bars.some((b) => b[0] === String(nowHour))) hi = bars.length - 1;
  } else if (def.id === 'week') {
    for (let i = 0; i < 7; i++) { const s = addD(from, i); bars.push([DOW[wd(s)], day[s] ?? 0]); }
    hi = 6;
  } else if (def.id === 'month') {
    for (let b = 0; b < 6; b++) { let t = 0; for (let i = 0; i < 5; i++) t += day[addD(from, b * 5 + i)] ?? 0; const p = parse(addD(from, b * 5)); bars.push([`${MON[p.m - 1]} ${p.d}`, t]); }
    hi = 5;
  } else {
    const mo: number[] = Array(12).fill(0); for (const k of Object.keys(day)) mo[parse(k).m - 1] += day[k];
    for (let i = 0; i < parse(to).m; i++) bars.push([MON[i], mo[i]]);
    hi = bars.length - 1;
  }
  const team: [string, number, number][] = (r.team as any[]).map((t) => [t.name, Number(t.cents), t.avail_min ? Math.min(100, Math.round(t.booked_min / t.avail_min * 100)) : 0]);
  const clients = Number(cur.clients);
  return {
    id: def.id, label: def.label, prev: def.prev, sentence: def.sentence, revenue: Math.round(rev / 100), appts, rebook: rate(cur),
    d: { revenue: pctText(rev, prevRev), appts: pctText(appts, prevAppts), avg: pctText(Math.round(avg), Math.round(prevAvg)), rebook: ptsText(rate(cur), rate(prev)) },
    hi, bars: bars.map(([l, c]) => [l, Math.round(c / 100)] as [string, number]),
    services: (r.services as any[]).map((s) => [s.name, s.count, Math.round(Number(s.cents) / 100)] as [string, number, number]),
    team: team.map(([n, c, u]) => [n, Math.round(c / 100), u] as [string, number, number]),
    fresh: clients ? Math.round(Number(cur.new_clients) / clients * 100) : 0, hasClients: clients > 0,
  };
}

export function buildHeat(r: any): Heat {
  const labels = ['Morning', 'Midday', 'Afternoon'];
  return labels.map((label, band) => ({ label, values: DOW.map((_, w) => {
    const c = (r.heat as any[]).find((h) => h.wd === w && h.band === band);
    if (!c || !c.avail) return 0;
    return Math.max(1, Math.min(100, Math.round(c.booked / c.avail * 100)));
  }) }));
}
