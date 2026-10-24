import { requireCtx } from '@/lib/session';
import { minutesOfDay, ymd, zonedToUtc } from '@/lib/format';
import { weekStartOf, addDaysYmd, money2, toneFor, TONE_LIST, type CalBooking, type CalBlock } from '@/lib/cal';
import { loadSubs, loadTemplates } from '@/lib/forms';
import { formRows } from '@/lib/forms-shared';
import { CalendarView } from './CalendarView';
import { buildCfg, buildHours, buildOffers, buildRecent, buildServices } from './base';

export const metadata = { title: 'Calendar' };
export const dynamic = 'force-dynamic';

export default async function Calendar({ searchParams }: { searchParams: Promise<{ d?: string; v?: string; s?: string; new?: string; c?: string; b?: string }> }) {
  const { sb, salon, settings, staff } = await requireCtx();
  const sp = await searchParams;
  const today = ymd(new Date(), salon.timezone);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? '') ? sp.d! : today;
  const view = sp.v === 'week' ? 'week' : 'day';
  const from = view === 'week' ? weekStartOf(day) : day;
  const to = addDaysYmd(from, view === 'week' ? 7 : 1);
  const a = zonedToUtc(from, '00:00', salon.timezone), b = zonedToUtc(to, '00:00', salon.timezone);

  const [{ data: team }, { data: bk }, { data: bl }, { data: oh }, { data: svc }, { data: ss }, { data: sa }, { data: rc }] = await Promise.all([
    sb.from('staff').select('id,name,role_title').eq('active', true).order('name'),
    sb.from('bookings').select('id,ref_no,staff_id,client_id,starts_at,ends_at,status,source,notes,clients(name),booking_services(service_id,price_cents,services(name,category_id,service_categories(name)))').gte('starts_at', a.toISOString()).lt('starts_at', b.toISOString()).not('status', 'in', '(cancelled,no_show)'),
    sb.from('staff_blocks').select('id,staff_id,starts_at,ends_at,kind,note').lt('starts_at', b.toISOString()).gt('ends_at', a.toISOString()),
    sb.from('opening_hours').select('*'),
    sb.from('services').select('id,name,duration_min,price_cents,is_addon,service_categories(name)').eq('active', true).order('name'),
    sb.from('service_staff').select('service_id,staff_id'),
    sb.from('service_addons').select('addon_id,service_id'),
    sb.from('bookings').select('client_id,clients(name)').not('client_id', 'is', null).order('starts_at', { ascending: false }).limit(80),
  ]);
  const ids = (bk ?? []).map((x) => x.id);
  const { data: sales } = ids.length ? await sb.from('sales').select('id,booking_id,status,total_cents,method').in('booking_id', ids).neq('status', 'refunded') : { data: [] as any[] };
  const catIdx = new Map<string, number>(); 
  const tpls = await loadTemplates(sb, salon.id);
  const subs = tpls.length ? await loadSubs(sb, [...new Set((bk ?? []).map((x: any) => x.client_id).filter(Boolean))] as string[]) : [];
  const bookings: CalBooking[] = (bk ?? []).map((x: any) => {
    const lines = (x.booking_services ?? []) as any[];
    const cid = lines[0]?.services?.category_id as string | undefined;
    const cname = lines[0]?.services?.service_categories?.name as string | undefined;
    if (cid && !catIdx.has(cid)) catIdx.set(cid, catIdx.size);
    const sale = (sales ?? []).find((s: any) => s.booking_id === x.id);
    return {
      id: x.id, ref: x.ref_no, staffId: x.staff_id, clientId: x.client_id, client: x.clients?.name ?? 'Client',
      services: lines.map((l) => l.services?.name).filter(Boolean).join(' + '),
      dayYmd: ymd(x.starts_at, salon.timezone), start: minutesOfDay(x.starts_at, salon.timezone), end: minutesOfDay(x.ends_at, salon.timezone) || 24 * 60,
      status: x.status, priceCents: lines.reduce((s, l) => s + l.price_cents, 0), paid: sale?.status === 'paid', paidText: sale?.status === 'paid' ? `Paid ${money2(sale.total_cents / 100).replace(/\.00$/, '')}${sale.method ? ' by ' + ({ card: 'Card', cash: 'Cash', gift_card: 'Gift card' } as Record<string, string>)[sale.method] : ''}` : '', saleId: sale?.id ?? null, serviceIds: lines.map((l) => l.service_id),
      tone: Math.max(0, TONE_LIST.indexOf(toneFor(cname, cid ? catIdx.get(cid)! : 0))), walkin: x.notes === 'Walk-in', notes: x.notes,
      forms: (() => {
        if (!tpls.length || !x.client_id || x.status === 'completed') return null;
        const rows = formRows(tpls, subs.filter((s) => s.client_id === x.client_id), { id: x.id, dayYmd: ymd(x.starts_at, salon.timezone), catIds: [...new Set(lines.map((l) => l.services?.category_id).filter(Boolean))] as string[] }, salon.timezone, ymd).filter((r) => r.needed);
        const bad = rows.find((r) => r.state === 'reaction');
        if (bad) return { level: 'alert' as const, text: bad.tpl.name + ': a reaction is on file. Check before treating.' };
        const todo = rows.filter((r) => r.state === 'missing' || r.state === 'expired');
        return todo.length ? { level: 'todo' as const, text: 'Forms needed: ' + todo.map((r) => r.tpl.name).join(', ') } : null;
      })(),
    };
  });
  const blocks: CalBlock[] = (bl ?? []).map((x) => ({ id: x.id, staffId: x.staff_id, dayYmd: ymd(x.starts_at, salon.timezone), start: minutesOfDay(x.starts_at, salon.timezone), end: minutesOfDay(x.ends_at, salon.timezone) || 24 * 60, kind: x.kind, note: x.note }));
  const hours = buildHours(oh), services = buildServices(svc, sa), offers = buildOffers(ss);
  const cfg = buildCfg(settings, staff.app_role), recent = buildRecent(rc);
  const nowMin = minutesOfDay(new Date(), salon.timezone);
  return (
    <CalendarView
      day={day} today={today} view={view} nowMin={nowMin} tz={salon.timezone}
      team={(team ?? []).map((t) => ({ id: t.id, name: t.name, role: t.role_title ?? '' }))}
      bookings={bookings} blocks={blocks} hours={hours} services={services}
      staffFilter={sp.s ?? 'all'} slug={salon.slug} offers={offers} cfg={cfg} recent={recent} initialNew={sp.new === '1'} initialClient={sp.c ?? ''} initialSel={/^[0-9a-f-]{36}$/i.test(sp.b ?? '') ? sp.b : undefined}
    />
  );
}
