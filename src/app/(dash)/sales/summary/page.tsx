import { redirect } from 'next/navigation';
import { requireCtx } from '@/lib/session';
import { ymd } from '@/lib/format';
import { addDaysYmd, dayInfo, weekStartOf } from '@/lib/cal';
import { SummaryView } from './SummaryView';

export const metadata = { title: 'Daily summary' };
export const dynamic = 'force-dynamic';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const valid = (s?: string) => !!s && DAY.test(s) && !Number.isNaN(Date.parse(s));

export default async function Summary({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const { sb, salon, staff } = await requireCtx();
  if (staff.app_role === 'stylist') redirect('/sales');
  const today = ymd(new Date(), salon.timezone);
  let from = valid(sp.from) ? sp.from! : today;
  let to = valid(sp.to) ? sp.to! : from;
  if (to < from) [from, to] = [to, from];
  if (to > today) to = today;
  if (from > to) from = to;
  if (Date.parse(to) - Date.parse(from) > 366 * 86400000) from = addDaysYmd(to, -366);

  const { data, error } = await sb.rpc('sales_summary', { p_from: from, p_to: to });
  const yesterday = addDaysYmd(today, -1);
  const presets = [
    { id: 'today', label: 'Today', from: today, to: today },
    { id: 'yesterday', label: 'Yesterday', from: yesterday, to: yesterday },
    { id: 'week', label: 'This week', from: weekStartOf(today), to: today },
    { id: 'month', label: 'This month', from: today.slice(0, 8) + '01', to: today },
  ];
  return <SummaryView data={error ? null : (data as any)} from={from} to={to} today={today} presets={presets} dayLabel={dayInfo(from).full} />;
}
