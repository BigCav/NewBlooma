// TEMPORARY test page: the customer booking in the sheet style of the staff "new appointment" sheet. The real booking page (../book) is untouched.
// It uses the same data and the same booking actions. Delete this folder when the test is over.
import { notFound } from 'next/navigation';
import { getPublicSalon } from '@/lib/public';
import { ymd } from '@/lib/format';
import { CardText, PublicCard } from '../PublicCard';
import { clientMe } from '../book/actions';
import { SheetBooking } from './SheetBooking';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Booking sheet (test)', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getPublicSalon(slug);
  if (!d) notFound();
  const { salon, settings } = d;
  if (!settings.online_booking) return <PublicCard title={salon.name}><CardText>Online booking is not available right now. Please contact the salon{salon.phone ? ` on ${salon.phone}` : ''}.</CardText></PublicCard>;
  const account = await clientMe(slug);
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: salon.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
  const catName = (id: string | null) => d.cats.find((c) => c.id === id)?.name ?? 'Other';
  const mains = d.services.map((s) => ({ id: s.id, name: s.name, cat: catName(s.category_id), dur: s.duration_min, priceCents: s.price_cents }));
  const addons = d.addons.map((s) => ({ id: s.id, name: s.name, cat: 'Extras', dur: s.duration_min, priceCents: s.price_cents, addon: true, parents: s.parents }));
  const svcIds = new Set(mains.map((s) => s.id));
  const team = d.team.map((t) => ({ id: t.id, name: t.name, role: t.role_title, photo: t.photo_url ?? null, svc: d.links.filter((l) => l.staff_id === t.id && svcIds.has(l.service_id)).map((l) => l.service_id) }));
  const hours = Array.from({ length: 7 }, (_, i) => {
    const h = d.hours.find((x: any) => x.weekday === i) as any;
    return h && h.is_open ? { from: String(h.open_time).slice(0, 5), to: String(h.close_time).slice(0, 5) } : null;
  });
  return <SheetBooking slug={slug} name={salon.name} currency={salon.currency || 'NZD'} services={[...mains, ...addons]} team={team} hours={hours}
    today={ymd(now, salon.timezone)} nowMin={Number(get('hour')) * 60 + Number(get('minute'))} autoConfirm={settings.auto_confirm}
    windowDays={({ '1w': 8, '2w': 15, '4w': 29, '8w': 57 } as Record<string, number>)[settings.booking_window] ?? 29} account={account} />;
}
