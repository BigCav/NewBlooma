import { minutesOfDay, time12, ymd } from '@/lib/format';
import type { Ctx } from '@/lib/session';
import { initialsOf, type ClientRow, type Tag } from './shared';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDay(iso: string, tz: string, today: string) {
  const y = ymd(iso, tz);
  if (y === today) return 'Today';
  const [Y, M, D] = y.split('-').map(Number);
  return `${D} ${MON[M - 1]}` + (String(Y) !== today.slice(0, 4) ? ' ' + Y : '');
}
export function fmtClock(iso: string, tz: string) { return time12(iso, tz); }

export type Overview = { rows: ClientRow[]; count: number; newThisMonth: number; rebookRate: string; recentIds: string[] };

/** Tag rules: Lapsed = has visited but not in 90 days and nothing booked; New = two visits or fewer; otherwise Regular. */
export async function loadOverview(ctx: Pick<Ctx, 'sb' | 'salon'>): Promise<Overview> {
  const { data } = await ctx.sb.rpc('client_overview');
  const tz = ctx.salon.timezone, today = ymd(new Date(), tz), now = Date.now();
  const list = ((data ?? []) as any[]).slice().sort((a, b) => (b.last_at ?? '').localeCompare(a.last_at ?? '') || String(b.created_at).localeCompare(String(a.created_at)));
  let withVisit = 0, rebooked = 0, newMonth = 0;
  const rows: ClientRow[] = list.map((r) => {
    const visits = r.visits as number;
    if (visits > 0) withVisit++; if (visits > 1) rebooked++;
    if (ymd(r.created_at, tz).slice(0, 7) === today.slice(0, 7)) newMonth++;
    const lapsed = visits > 0 && !r.next_at && now - new Date(r.last_at).getTime() > 90 * 86400e3;
    const tag: Tag = lapsed ? 'Lapsed' : visits <= 2 ? 'New' : 'Regular';
    const live = r.next_status === 'checked_in' || r.next_status === 'in_progress';
    const next = !r.next_at ? 'Not booked' : live ? 'In progress' : `${fmtDay(r.next_at, tz, today)}, ${fmtClock(r.next_at, tz)}`;
    return {
      id: r.id, name: r.name, email: r.email ?? '', phone: r.phone ?? '', tag,
      last: r.last_at ? fmtDay(r.last_at, tz, today) : 'None yet', lastService: r.last_service ?? 'No visits', next, staff: r.usual_staff ?? 'Not set',
      visits, spentCents: Number(r.spent_cents),
    };
  });
  return { rows, count: rows.length, newThisMonth: newMonth, rebookRate: withVisit ? Math.round((rebooked / withVisit) * 100) + '%' : '0%', recentIds: rows.map((r) => r.id) };
}
export { initialsOf };
