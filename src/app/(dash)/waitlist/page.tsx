import { clock12 } from '@/lib/display';
import { requireCtx } from '@/lib/session';
import { minutesOfDay, ymd } from '@/lib/format';
import { dayInfo, type CalService } from '@/lib/cal';
import { WEEKDAYS_SHORT } from './weekdays';
import { initialsOf, type WlRow } from './shared';
import { WaitlistView } from './WaitlistView';

export const metadata = { title: 'Waitlist' };
export const dynamic = 'force-dynamic';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const clock = clock12;
const first = (n?: string | null) => String(n ?? '').split(' ')[0];

export default async function Waitlist() {
  const { sb, salon, staff } = await requireCtx();
  const tz = salon.timezone, today = ymd(new Date(), tz);
  const since = new Date(Date.now() - 14 * 86400e3).toISOString();
  const [{ data: ent }, { data: svc }, { data: team }, { data: ss }] = await Promise.all([
    sb.from('waitlist_entries').select('id,status,weekdays,earliest_time,latest_time,offered_start,offered_staff_id,created_at,added_by,clients(name),services(name,duration_min,price_cents),staff:staff_id(name),adder:added_by(name)').or(`status.in.(waiting,offered),and(status.eq.booked,created_at.gte.${since})`).order('created_at', { ascending: false }),
    sb.from('services').select('id,name,duration_min,price_cents,service_categories(name)').eq('active', true).eq('is_addon', false).order('name'),
    sb.from('staff').select('id,name,role_title').eq('active', true).order('name'),
    sb.from('service_staff').select('service_id,staff_id'),
  ]);
  const ago = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime(), h = Math.floor(ms / 3600e3), d = ymd(iso, tz);
    if (ms < 60e3) return 'Just now';
    if (ms < 3600e3) return `${Math.floor(ms / 60e3)} min ago`;
    if (d === today) return h === 1 ? '1 hour ago' : `${h} hours ago`;
    const yd = new Date(new Date(`${today}T00:00:00Z`).getTime() - 86400e3).toISOString().slice(0, 10);
    if (d === yd) return 'Yesterday';
    if (ms < 6 * 86400e3) return dayInfo(d).abbr;
    const [, M, D] = d.split('-').map(Number); return `${D} ${MON[M - 1]}`;
  };
  const rows: WlRow[] = ((ent ?? []) as any[]).map((e) => {
    const days: number[] = e.weekdays ?? [];
    const dayText = days.length === 7 ? 'Any day' : days.join() === '0,1,2,3,4' ? 'Weekdays' : days.join() === '5' ? 'Saturday' : days.map((d) => WEEKDAYS_SHORT[d]).join(', ');
    const from = e.earliest_time?.slice(0, 5), to = e.latest_time?.slice(0, 5);
    const win = from === '12:00' && !to ? 'Afternoon' : to === '12:00' && !from ? 'Morning' : !from && !to ? 'Any time' : [from && `from ${from}`, to && `until ${to}`].filter(Boolean).join(' ');
    const s = e.services;
    const status = e.status === 'offered' ? 'Offered' : e.status === 'booked' ? 'Booked' : 'Waiting';
    const by = !e.added_by ? 'Added' : e.added_by === staff.id ? 'Added by you' : `Added by ${first(e.adder?.name)}`;
    let offer = '';
    if (status === 'Offered' && e.offered_start) offer = `Offered ${dayInfo(ymd(e.offered_start, tz)).short}, ${clock(minutesOfDay(e.offered_start, tz))} with ${first((team ?? []).find((t) => t.id === e.offered_staff_id)?.name)}`;
    const cents = s?.price_cents ?? 0;
    return {
      id: e.id, name: e.clients?.name ?? 'Client', initials: initialsOf(e.clients?.name ?? ''), clientFirst: first(e.clients?.name), status, offer,
      service: `${s?.name ?? 'Service'}, ${s?.duration_min ?? 0} min, $${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`,
      prefs: [e.staff?.name ? first(e.staff.name) : 'Any team member', dayText, win].join(', '),
      meta: `${by}, ${ago(e.created_at)}`,
    };
  });
  const services: CalService[] = (svc ?? []).map((s: any) => ({ id: s.id, name: s.name, dur: s.duration_min, priceCents: s.price_cents, cat: s.service_categories?.name ?? 'Services' }));
  const offers: Record<string, string[]> = {}; for (const r of ss ?? []) (offers[r.service_id] ??= []).push(r.staff_id);
  return <WaitlistView rows={rows} services={services} offers={offers} team={(team ?? []).map((t) => ({ id: t.id, name: t.name, role: t.role_title ?? '' }))} />;
}
