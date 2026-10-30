import { requireOwner } from '@/lib/session';
import { ymd } from '@/lib/format';
import { PERIOD_DEFS, buildHeat, buildPeriod, ranges } from './shared';
import { ReportsView } from './ReportsView';

export const metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

export default async function Reports() {
  const { sb, salon } = await requireOwner();
  const today = ymd(new Date(), salon.timezone);
  const nowHour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: salon.timezone }).format(new Date()));
  const rg = ranges(today);
  const { data: st } = await sb.from('staff').select('name,photo_url');
  const photos: Record<string, string> = {};
  for (const x of (st ?? []) as { name: string; photo_url: string | null }[]) if (x.photo_url) photos[x.name] = x.photo_url;
  const res = await Promise.all(PERIOD_DEFS.map((d) => sb.rpc('report_dashboard', { p_from: rg[d.id].from, p_to: rg[d.id].to, p_prev_from: rg[d.id].pf, p_prev_to: rg[d.id].pt })));
  const bad = res.find((r) => r.error);
  if (bad) return <ReportsView periods={[]} heat={[]} currency={salon.currency} error="Could not load the report." />;
  const periods = PERIOD_DEFS.map((d, i) => buildPeriod(d, res[i].data, rg[d.id].from, rg[d.id].to, nowHour));
  return <ReportsView periods={periods} heat={buildHeat(res[1].data)} currency={salon.currency} photos={photos} />;
}
