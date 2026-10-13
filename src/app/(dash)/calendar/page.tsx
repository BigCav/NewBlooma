import { requireCtx } from '@/lib/session';
import { addDays, minutesOfDay, ymd, zonedToUtc } from '@/lib/format';
import { weekStartOf, addDaysYmd, type CalBooking, type CalBlock, type CalHours, type CalService } from '@/lib/cal';
import { CalendarView } from './CalendarView';

export const metadata = { title: 'Calendar' };
export const dynamic = 'force-dynamic';

export default async function Calendar({ searchParams }: { searchParams: Promise<{ d?: string; v?: string; s?: string }> }) {
  const { sb, salon, settings } = await requireCtx();
  const sp = await searchParams;
  const today = ymd(new Date(), salon.timezone);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? '') ? sp.d! : today;
  const view = sp.v === 'week' ? 'week' : 'day';
  const from = view === 'week' ? weekStartOf(day) : day;
  const to = addDaysYmd(from, view === 'week' ? 7 : 1);
  const a = zonedToUtc(from, '00:00', salon.timezone), b = zonedToUtc(to, '00:00', salon.timezone);

  const [{ data: team }, { data: bk }, { data: bl }, { data: oh }, { data: svc }] = await Promise.all([
    sb.from('staff').select('id,name,role_title').eq('active', true).order('name'),
    sb.from('bookings').select('id,staff_id,client_id,starts_at,ends_at,status,source,notes,clients(name),booking_services(price_cents,services(name,category_id))').gte('starts_at', a.toISOString()).lt('starts_at', b.toISOString()).not('status', 'in', '(cancelled,no_show)'),
    sb.from('staff_blocks').select('id,staff_id,starts_at,ends_at,kind,note').lt('starts_at', b.toISOString()).gt('ends_at', a.toISOString()),
    sb.from('opening_hours').select('*'),
    sb.from('services').select('id,name,duration_min,price_cents,service_categories(name)').eq('active', true).order('name'),
  ]);
  const ids = (bk ?? []).map((x) => x.id);
  const { data: sales } = ids.length ? await sb.from('sales').select('id,booking_id,status').in('booking_id', ids).neq('status', 'refunded') : { data: [] as any[] };
  const catIdx = new Map<string, number>(); 
  const bookings: CalBooking[] = (bk ?? []).map((x: any) => {
    const lines = (x.booking_services ?? []) as any[];
    const cid = lines[0]?.services?.category_id as string | undefined;
    if (cid && !catIdx.has(cid)) catIdx.set(cid, catIdx.size);
    const sale = (sales ?? []).find((s: any) => s.booking_id === x.id);
    return {
      id: x.id, staffId: x.staff_id, clientId: x.client_id, client: x.clients?.name ?? 'Client',
      services: lines.map((l) => l.services?.name).filter(Boolean).join(' + '),
      dayYmd: ymd(x.starts_at, salon.timezone), start: minutesOfDay(x.starts_at, salon.timezone), end: minutesOfDay(x.ends_at, salon.timezone) || 24 * 60,
      status: x.status, priceCents: lines.reduce((s, l) => s + l.price_cents, 0), paid: sale?.status === 'paid', saleId: sale?.id ?? null,
      tone: cid ? catIdx.get(cid)! : 0, walkin: x.notes === 'Walk-in', notes: x.notes,
    };
  });
  const blocks: CalBlock[] = (bl ?? []).map((x) => ({ id: x.id, staffId: x.staff_id, dayYmd: ymd(x.starts_at, salon.timezone), start: minutesOfDay(x.starts_at, salon.timezone), end: minutesOfDay(x.ends_at, salon.timezone) || 24 * 60, kind: x.kind, note: x.note }));
  const mm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const hours: CalHours[] = Array.from({ length: 7 }, (_, wd) => { const r = (oh ?? []).find((h) => h.weekday === wd); return { wd, open: !!r?.is_open, from: r?.is_open ? mm(r.open_time) : 8 * 60, to: r?.is_open ? mm(r.close_time) : 18 * 60 }; });
  const services: CalService[] = (svc ?? []).map((s: any) => ({ id: s.id, name: s.name, dur: s.duration_min, priceCents: s.price_cents, cat: s.service_categories?.name ?? 'Services' }));
  const nowMin = minutesOfDay(new Date(), salon.timezone);
  return (
    <CalendarView
      day={day} today={today} view={view} nowMin={nowMin} tz={salon.timezone}
      team={(team ?? []).map((t) => ({ id: t.id, name: t.name, role: t.role_title ?? '' }))}
      bookings={bookings} blocks={blocks} hours={hours} services={services}
      staffFilter={sp.s ?? 'all'} slug={salon.slug}
    />
  );
}
