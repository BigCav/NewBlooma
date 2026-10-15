import { notFound } from 'next/navigation';
import { getPublicSalon } from '@/lib/public';
import { emailConfigured } from '@/lib/notify';
import { ymd } from '@/lib/format';
import { BookingView } from './BookingView';
import { clientMe } from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const d = await getPublicSalon((await params).slug);
  return { title: d ? `Book at ${d.salon.name}` : 'Booking' };
}

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ service?: string }> }) {
  const { slug } = await params;
  const { service } = await searchParams;
  const d = await getPublicSalon(slug);
  if (!d) notFound();
  const { salon, settings } = d;
  if (!settings.online_booking) return <div className="auth"><div className="card"><h1>{salon.name}</h1><p className="muted">Online booking is not available right now. Please contact the salon{salon.phone ? ` on ${salon.phone}` : ''}.</p></div></div>;
  const account = await clientMe(slug);
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: salon.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
  const catName = (id: string | null) => d.cats.find((c) => c.id === id)?.name ?? 'Other';
  const services = d.services.map((s) => ({ id: s.id, name: s.name, desc: s.description ?? '', cat: catName(s.category_id), dur: s.duration_min, cents: s.price_cents }));
  const addons = d.addons.map((s) => ({ id: s.id, name: s.name, desc: s.description ?? '', cat: 'Extras', dur: s.duration_min, cents: s.price_cents, parents: s.parents }));
  const cats = d.cats.map((c) => c.name).filter((n) => services.some((s) => s.cat === n));
  if (services.some((s) => s.cat === 'Other')) cats.push('Other');
  const svcIds = new Set(services.map((s) => s.id));
  const team = d.team.map((t) => ({ id: t.id, name: t.name, role: t.role_title, photo: t.photo_url ?? null, svc: d.links.filter((l) => l.staff_id === t.id && svcIds.has(l.service_id)).map((l) => l.service_id) }));
  const hours = Array.from({ length: 7 }, (_, i) => {
    const h = d.hours.find((x: any) => x.weekday === i) as any;
    return h && h.is_open ? { from: String(h.open_time).slice(0, 5), to: String(h.close_time).slice(0, 5) } : null;
  });
  return <BookingView slug={slug} name={salon.name} address={salon.address ?? ''} tz={salon.timezone} currency={salon.currency || 'NZD'} services={services} addons={addons} cats={cats} team={team} hours={hours}
    today={ymd(now, salon.timezone)} nowMin={Number(get('hour')) * 60 + Number(get('minute'))} autoConfirm={settings.auto_confirm} windowDays={({ '1w': 8, '2w': 15, '4w': 29, '8w': 57 } as Record<string, number>)[settings.booking_window] ?? 29} emailOn={emailConfigured() && settings.email_confirmations !== false} account={account} preselect={service && svcIds.has(service) ? service : ''} />;
}
