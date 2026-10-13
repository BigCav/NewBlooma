import { requireCtx } from '@/lib/session';
import { ymd } from '@/lib/format';
import { dayInfo } from '@/lib/cal';
import { ReviewsView, type ReviewRow } from './ReviewsView';

export const metadata = { title: 'Reviews' };
export const dynamic = 'force-dynamic';

export default async function Reviews() {
  const { sb, salon } = await requireCtx();
  const { data } = await sb.from('reviews').select('id,stars,body,reply,created_at,reviewer_name,clients(name),staff(name),bookings(booking_services(services(name)))').order('created_at', { ascending: false }).limit(500);
  const rows: ReviewRow[] = ((data ?? []) as any[]).map((r) => {
    const names: string[] = (r.bookings?.booking_services ?? []).map((b: any) => b.services?.name).filter(Boolean);
    const d = dayInfo(ymd(r.created_at, salon.timezone));
    return { id: r.id, name: r.reviewer_name || r.clients?.name || 'Client', stars: r.stars, text: r.body, svc: names.length ? names[0] + (names.length > 1 ? ` +${names.length - 1}` : '') : 'Visit',
      pro: String(r.staff?.name ?? 'the team').split(' ')[0], date: `${d.num} ${d.month.slice(0, 3)}`, reply: r.reply ?? '' };
  });
  return <ReviewsView rows={rows} salonName={salon.name} />;
}
