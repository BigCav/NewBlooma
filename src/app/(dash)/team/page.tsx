import { requireCtx } from '@/lib/session';
import { ymd } from '@/lib/format';
import { dayInfo } from '@/lib/cal';
import { SHIFTS, clock24, shortRange, type TeamRow } from './shared';
import { TeamView } from './TeamView';

export const metadata = { title: 'Team' };
export const dynamic = 'force-dynamic';

export default async function Team() {
  const { sb, salon, staff } = await requireCtx();
  const todayWd = dayInfo(ymd(new Date(), salon.timezone)).wd;
  const [{ data: team }, { data: shifts }, { data: cats }, { data: svcs }, { data: links }] = await Promise.all([
    sb.from('staff').select('id,name,role_title,online_bookable').eq('active', true).order('created_at'),
    sb.from('staff_shifts').select('staff_id,weekday,start_time,end_time'),
    sb.from('service_categories').select('id,name').order('sort').order('name'),
    sb.from('services').select('id,category_id').eq('active', true),
    sb.from('service_staff').select('service_id,staff_id'),
  ]);
  const rows: TeamRow[] = (team ?? []).map((m) => {
    const mine = (shifts ?? []).filter((s) => s.staff_id === m.id);
    const at = (d: number) => mine.find((s) => s.weekday === d);
    const days = mine.map((s) => s.weekday).sort((a, b) => a - b);
    const f = (t: string) => t.slice(0, 5);
    const same = mine.length > 0 && mine.every((s) => f(s.start_time) === f(mine[0].start_time) && f(s.end_time) === f(mine[0].end_time));
    const preset = same ? SHIFTS.find((p) => p.from === f(mine[0].start_time) && p.to === f(mine[0].end_time)) : undefined;
    const offered = new Set((links ?? []).filter((l) => l.staff_id === m.id).map((l) => l.service_id));
    const t = at(todayWd);
    return {
      id: m.id, name: m.name, role: m.role_title, online: m.online_bookable, days, shift: preset?.id ?? null,
      cats: (cats ?? []).filter((c) => (svcs ?? []).some((s) => s.category_id === c.id && offered.has(s.id))).map((c) => c.name),
      cells: Array.from({ length: 7 }, (_, d) => { const s = at(d); return s ? shortRange(f(s.start_time), f(s.end_time)) : 'Off'; }),
      todayOn: !!t, todayLabel: t ? `${clock24(f(t.start_time))} to ${clock24(f(t.end_time))}` : '',
    };
  });
  return <TeamView rows={rows} cats={(cats ?? []).map((c) => c.name)} todayWd={todayWd} owner={staff.app_role === 'owner'} />;
}
