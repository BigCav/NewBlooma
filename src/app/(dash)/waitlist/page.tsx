import { clock12, clockStr, duration, plural } from '@/lib/display';
import { dollars } from '@/lib/format';
import { requireCtx } from '@/lib/session';
import { minutesOfDay, ymd } from '@/lib/format';
import { WEEKDAYS_FULL, addDaysYmd, dayInfo, type CalService } from '@/lib/cal';
import { firstName } from '@/lib/people';
import type { WlRow } from './shared';
import { WaitlistView } from './WaitlistView';

export const metadata = { title: 'Waitlist' };
export const dynamic = 'force-dynamic';

const first = (n?: string | null) => firstName(n, '');

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
    if (ms < 3600e3) return `${duration(Math.floor(ms / 60e3))} ago`;
    if (d === today) return `${plural(h, 'hour')} ago`;
    if (d === addDaysYmd(today, -1)) return 'Yesterday';
    if (ms < 6 * 86400e3) return dayInfo(d).abbr;
    const di = dayInfo(d); return `${di.num} ${di.month.slice(0, 3)}` + (d.slice(0, 4) !== today.slice(0, 4) ? ' ' + d.slice(0, 4) : '');
  };
  const rows: WlRow[] = ((ent ?? []) as any[]).map((e) => {
    const days: number[] = e.weekdays ?? [];
    const dayText = days.length === 7 ? 'Any day' : days.join() === '0,1,2,3,4' ? 'Weekdays' : days.join() === '5' ? 'Saturday' : days.map((d) => WEEKDAYS_FULL[(d + 1) % 7].slice(0, 3)).join(', ');
    const from = e.earliest_time?.slice(0, 5), to = e.latest_time?.slice(0, 5);
    const win = from === '12:00' && !to ? 'Afternoon' : to === '12:00' && !from ? 'Morning' : !from && !to ? 'Any time' : [from && `from ${clockStr(from)}`, to && `until ${clockStr(to)}`].filter(Boolean).join(' ');
    const s = e.services;
    const status = e.status === 'offered' ? 'Offered' : e.status === 'booked' ? 'Booked' : 'Waiting';
    const by = !e.added_by ? 'Added' : e.added_by === staff.id ? 'Added by you' : `Added by ${first(e.adder?.name)}`;
    let offer = '';
    if (status === 'Offered' && e.offered_start) offer = `Offered ${dayInfo(ymd(e.offered_start, tz)).short}, ${clock12(minutesOfDay(e.offered_start, tz))} with ${first((team ?? []).find((t) => t.id === e.offered_staff_id)?.name)}`;
    const cents = s?.price_cents ?? 0;
    return {
      id: e.id, name: e.clients?.name ?? 'Client', clientFirst: first(e.clients?.name), status, offer,
      service: `${s?.name ?? 'Service'}, ${duration(s?.duration_min ?? 0)}, ${dollars(cents)}`,
      prefs: [e.staff?.name ? first(e.staff.name) : 'Any team member', dayText, win].join(', '),
      meta: `${by}, ${ago(e.created_at)}`,
    };
  });
  const services: CalService[] = (svc ?? []).map((s: any) => ({ id: s.id, name: s.name, dur: s.duration_min, priceCents: s.price_cents, cat: s.service_categories?.name ?? 'Services' }));
  const offers: Record<string, string[]> = {}; for (const r of ss ?? []) (offers[r.service_id] ??= []).push(r.staff_id);
  return <WaitlistView rows={rows} services={services} offers={offers} team={(team ?? []).map((t) => ({ id: t.id, name: t.name, role: t.role_title ?? '' }))} />;
}
