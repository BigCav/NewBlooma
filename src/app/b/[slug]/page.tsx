import { makeMoney } from '@/lib/display';
import { notFound } from 'next/navigation';
import { currentClient } from '@/lib/client-auth';
import { loadClientVisits } from '@/lib/client-visits';
import { getPublicSalon, nextAvailableLabel } from '@/lib/public';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ProfileView } from './ProfileView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const d = await getPublicSalon((await params).slug);
  return { title: d ? d.salon.name : 'Salon' };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getPublicSalon(slug);
  if (!d) notFound();
  const { salon, settings } = d;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: salon.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
  const today = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
  const nowMin = Number(get('hour')) * 60 + Number(get('minute'));
  const hours = Array.from({ length: 7 }, (_, i) => {
    const h = d.hours.find((x: any) => x.weekday === i) as any;
    return h && h.is_open ? { from: String(h.open_time).slice(0, 5), to: String(h.close_time).slice(0, 5) } : null;
  });
  const money = makeMoney(salon.currency || 'NZD');
  const catName = (id: string | null) => d.cats.find((c) => c.id === id)?.name ?? 'Other';
  const services = d.services.map((s) => ({ id: s.id, name: s.name, desc: s.description ?? '', cat: catName(s.category_id), dur: s.duration_min, price: money(s.price_cents) }));
  const cats = d.cats.map((c) => c.name).filter((n) => services.some((s) => s.cat === n));
  if (services.some((s) => s.cat === 'Other')) cats.push('Other');
  const cancel = ({ '2h': '2 hours', '24h': '24 hours', '48h': '48 hours' } as Record<string, string>)[settings.free_cancel_before] ?? '24 hours';
  const next = settings.online_booking ? await nextAvailableLabel(salon.id, salon.timezone).catch(() => null) : null;
  const me = await currentClient(salon.id).catch(() => null);
  const visits = me ? await loadClientVisits(salon, me.email).catch(() => ({ upcoming: [], past: [] })) : { upcoming: [], past: [] };
  const { data: rv } = await supabaseAdmin().from('reviews').select('stars,body,reply,created_at,reviewer_name,clients(name)').eq('salon_id', salon.id).order('created_at', { ascending: false }).limit(200);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const allRv = (rv ?? []) as any[];
  const reviews = allRv.slice(0, 6).map((r) => {
    const parts = String(r.reviewer_name || r.clients?.name || 'Client').trim().split(/\s+/);
    const d = new Date(r.created_at);
    return { name: parts[0] + (parts[1] ? ' ' + parts[1][0].toUpperCase() + '.' : ''), stars: r.stars as number, text: String(r.body ?? ''), reply: String(r.reply ?? ''), date: d.getDate() + ' ' + MON[d.getMonth()] };
  });
  const rating = { avg: allRv.length ? allRv.reduce((a, r) => a + r.stars, 0) / allRv.length : 0, count: allRv.length };
  return <ProfileView reviews={reviews} rating={rating} slug={slug} name={salon.name} headline={salon.headline || salon.name} intro={salon.intro || 'Book your next visit online in under a minute, with the team member you like and a time that suits you.'}
    about={salon.about || ''} address={salon.address || ''} phone={salon.phone || ''} email={salon.email || ''}
    services={services} cats={cats} team={d.team.map((t) => ({ name: t.name, role: t.role_title, photo: t.photo_url ?? null }))} hours={hours} today={today} nowMin={nowMin} cancel={cancel} bookable={settings.online_booking} next={next} account={me ? { name: me.name, email: me.email, phone: me.phone } : null} visits={visits} />;
}
