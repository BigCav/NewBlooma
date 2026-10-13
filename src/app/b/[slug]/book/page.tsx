import { notFound } from 'next/navigation';
import { getPublicSalon } from '@/lib/public';
import { ymd } from '@/lib/format';
import BookingFlow from './BookingFlow';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const d = await getPublicSalon((await params).slug);
  return { title: d ? `Book at ${d.salon.name}` : 'Booking' };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getPublicSalon(slug);
  if (!d) notFound();
  if (!d.settings.online_booking) return <div className="auth"><div className="card"><h1>{d.salon.name}</h1><p className="muted">Online booking is not available right now. Please contact the salon{d.salon.phone ? ` on ${d.salon.phone}` : ''}.</p></div></div>;
  return <BookingFlow slug={slug} salon={d.salon} services={d.services} team={d.team} cats={d.cats} autoConfirm={d.settings.auto_confirm} today={ymd(new Date(), d.salon.timezone)} />;
}
