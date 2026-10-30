import { requireCtx } from '@/lib/session';
import { ymd, zonedToUtc } from '@/lib/format';
import { addDaysYmd, dayInfo, weekStartOf } from '@/lib/cal';
import { hrs, type PayRow } from './shared';
import { PayrollView } from './PayrollView';

export const metadata = { title: 'Payroll' };
export const dynamic = 'force-dynamic';
const DAYN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default async function Payroll({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const sp = await searchParams;
  const { sb, salon, staff } = await requireCtx();
  const owner = staff.app_role === 'owner', tz = salon.timezone;
  const w = Math.min(104, Math.max(0, Math.floor(Number(sp.w) || 0)));
  const today = ymd(new Date(), tz);
  const from = addDaysYmd(weekStartOf(today), -7 * w), to = addDaysYmd(from, 6);
  const dates = Array.from({ length: 7 }, (_, i) => addDaysYmd(from, i));
  const edges = [...dates, addDaysYmd(to, 1)].map((d) => zonedToUtc(d, '00:00', tz).getTime());
  const nowMs = Date.now();

  const [pw, { data: team }, { data: shifts }, { data: sheets }] = await Promise.all([
    owner ? sb.rpc('payroll_week', { p_from: from, p_to: to }) : Promise.resolve({ data: null as any[] | null }),
    sb.from('staff').select('id,name,role_title,commission_pct,photo_url').eq('active', true).order('name'),
    sb.from('staff_shifts').select('staff_id,weekday,start_time,end_time'),
    sb.from('timesheets').select('staff_id,clock_in,clock_out').lt('clock_in', new Date(edges[7]).toISOString()).or(`clock_out.is.null,clock_out.gt.${new Date(edges[0]).toISOString()}`),
  ]);
  const money = new Map<string, any>((pw.data ?? []).map((r: any) => [r.staff_id, r]));
  const people: { id: string; name: string; role: string }[] = owner ? (pw.data ?? []).map((r: any) => ({ id: r.staff_id as string, name: r.staff_name as string, role: r.role_title as string })) : (team ?? []).filter((t) => t.id === staff.id).map((t) => ({ id: t.id, name: t.name, role: t.role_title }));
  const photoOf = new Map<string, string | null>((team ?? []).map((t) => [t.id, t.photo_url ?? null]));
  const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h + m / 60; };

  let anySun = false;
  const rows: PayRow[] = people.map((p) => {
    const mine = (sheets ?? []).filter((s) => s.staff_id === p.id);
    const open = mine.find((s) => !s.clock_out);
    const worked = dates.map((_, i) => mine.reduce((a, s) => {
      const a0 = Math.max(new Date(s.clock_in).getTime(), edges[i]), b0 = Math.min(s.clock_out ? new Date(s.clock_out).getTime() : nowMs, edges[i + 1]);
      return a + Math.max(0, b0 - a0) / 3600e3;
    }, 0));
    const sched = dates.map((_, i) => { const sh = (shifts ?? []).find((x) => x.staff_id === p.id && x.weekday === i); return sh ? mins(sh.end_time) - mins(sh.start_time) : 0; });
    const state = dates.map((d) => (d < today ? 'done' : d === today ? 'today' : 'plan') as 'done' | 'today' | 'plan');
    if (worked[6] > 0 || (state[6] !== 'done' && sched[6] > 0)) anySun = true;
    const cells = dates.map((_, i) => {
      const k = state[i];
      if (k === 'today') return { day: DAYN[i], kind: k, txt: open || worked[i] > 0 ? hrs(worked[i]) : 'Out' };
      const h = k === 'done' ? worked[i] : sched[i];
      return { day: DAYN[i], kind: k, txt: h > 0 ? hrs(h) : 'Off' };
    });
    const total = worked.reduce((a, b) => a + b, 0);
    const planned = dates.reduce((a, _, i) => a + (state[i] === 'done' ? worked[i] : state[i] === 'today' ? Math.max(worked[i], sched[i]) : sched[i]), 0);
    const m = money.get(p.id);
    const since = open ? (() => { const x = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: 'numeric', minute: '2-digit' }).formatToParts(new Date(open.clock_in)); return `${x.find((y) => y.type === 'hour')!.value}:${x.find((y) => y.type === 'minute')!.value}`; })() : null;
    return {
      id: p.id, name: p.name, role: p.role, photo: photoOf.get(p.id) ?? null, cells, total: hrs(total), planned: w === 0 ? 'of ' + hrs(planned) + ' planned' : 'worked', inSince: since,
      canClock: owner || p.id === staff.id,
      svc: Number(m?.service_cents ?? 0), prod: Number(m?.product_cents ?? 0), tips: Number(m?.tips_cents ?? 0), rate: Number(m?.commission_pct ?? 0), prodPct: Number(m?.product_pct ?? 10),
      commission: Number(m?.service_commission_cents ?? 0) + Number(m?.product_commission_cents ?? 0), paid: !!m?.paid_at,
    };
  });
  const days = anySun ? 7 : 6;
  const a = dayInfo(from), b = dayInfo(dates[days - 1]);
  const range = `${a.abbr} ${a.num}${a.month !== b.month ? ' ' + a.month.slice(0, 3) : ''} to ${b.abbr} ${b.num} ${b.month.slice(0, 3)}`;
  rows.forEach((r) => (r.cells = r.cells.slice(0, days)));
  return <PayrollView rows={rows} w={w} from={from} to={to} over={to < today} days={days} owner={owner} title={w === 0 ? 'This week' : w === 1 ? 'Last week' : `${w} weeks ago`} range={range} />;
}
