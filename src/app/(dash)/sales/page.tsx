import { requireCtx } from '@/lib/session';
import { settleTerminals } from '@/lib/windcave';
import { dollars, ymd, time12 } from '@/lib/format';
import { bookingRef, timeRange } from '@/lib/display';
import { firstName } from '@/lib/people';
import { TONE } from '@/lib/tones';
import { addDaysYmd, dayInfo } from '@/lib/cal';
import { type PayMethod, type SaleRow } from './shared';
import { SalesView } from './SalesView';
import { buildOffers, buildServices } from '../calendar/base';

export const metadata = { title: 'Sales' };
export const dynamic = 'force-dynamic';

export default async function Sales({ searchParams }: { searchParams: Promise<{ sale?: string; pay?: string; card?: string }> }) {
  const sp = await searchParams;
  const { sb, salon, staff, settings: st } = await requireCtx();
  const tz = salon.timezone, today = ymd(new Date(), tz);
  const since = new Date(Date.now() - 15 * 86400e3).toISOString();
  // A terminal payment finished while nobody was watching still finishes its sale.
  await settleTerminals(salon.id);
  // A stylist sees their own sales, and any still open so a checkout can be finished, but not the rest of the salon's takings.
  const scope = staff.app_role === 'stylist' ? `and(created_at.gte.${since},staff_id.eq.${staff.id}),status.eq.pending` : `created_at.gte.${since},status.eq.pending`;
  const [{ data: sales }, { data: svcs }, { data: pay }, { data: flagged }, { data: prods }, { data: sa }, { data: ss }] = await Promise.all([
    sb.from('sales').select('id,status,method,subtotal_cents,discount_cents,discount_note,tax_rate,tip_cents,tax_cents,tax_inclusive,total_cents,created_at,paid_at,clients(id,name),staff(id,name,photo_url),bookings(id,ref_no,starts_at,ends_at),sale_items(label,qty,price_cents,service_id,product_id)')
      .or(scope).order('created_at', { ascending: false }).limit(300),
    sb.from('services').select('id,name,price_cents,duration_min,is_addon,service_categories(name,sort)').eq('active', true).order('name'),
    sb.from('salon_payment_settings').select('online_cards_enabled,terminal_enabled').eq('salon_id', salon.id).maybeSingle(),
    // Card payments the system could not match to a sale cleanly (amount differs, or paid another way as well). Shown for 30 days.
    staff.app_role === 'owner' ? sb.from('card_payments').select('id,review_note,amount_cents,resolved_at,sales(clients(name))').eq('needs_review', true).gte('resolved_at', new Date(Date.now() - 30 * 86400e3).toISOString()).order('resolved_at', { ascending: false }).limit(5) : Promise.resolve({ data: [] as any[] }),
    sb.from('products').select('id,name,brand,price_cents,stock').eq('active', true).order('name'),
    sb.from('service_addons').select('addon_id,service_id'),
    sb.from('service_staff').select('service_id,staff_id'),
  ]);
  // Prepaid packages a client has with visits left: they can cover a service at checkout, as on the calendar.
  const cids = [...new Set(((sales ?? []) as any[]).filter((s) => s.status === 'pending').map((s) => s.clients?.id).filter(Boolean))] as string[];
  const { data: cpk } = cids.length ? await sb.from('client_package_status').select('id,client_id,service_id,name,uses_left,expires_at').in('client_id', cids).eq('sale_status', 'paid').gt('uses_left', 0) : { data: [] as any[] };
  const packages: Record<string, { id: string; serviceId: string; name: string; left: number }[]> = {};
  for (const x of (cpk ?? []) as any[]) { if (x.expires_at && new Date(x.expires_at).getTime() <= Date.now()) continue; (packages[x.client_id] ??= []).push({ id: x.id, serviceId: x.service_id, name: x.name, left: x.uses_left }); }
  const canEdit = staff.app_role !== 'stylist';
  const { data: openCards } = await sb.from('card_payments').select('sale_id,txn_ref').eq('kind', 'terminal').eq('status', 'pending');
  const openTxn = new Map<string, string>((openCards ?? []).map((x) => [x.sale_id as string, x.txn_ref as string]));
  const dShort = (d: string) => dayInfo(d).short + (d.slice(0, 4) !== today.slice(0, 4) ? ' ' + d.slice(0, 4) : '');
  const METHOD: Record<string, string> = { card: 'Card', cash: 'Cash', gift_card: 'Gift card', package: 'Package' };
  const durOf = new Map<string, number>(((svcs ?? []) as any[]).map((x) => [x.id as string, x.duration_min as number]));
  const list = ((sales ?? []) as any[]).map((s) => {
    const items = s.sale_items as any[];
    const first = items[0], extra = items.length - 1;
    const status = s.status === 'paid' ? 'Paid' : s.status === 'refunded' ? 'Refunded' : 'Pending';
    const when = s.paid_at ?? s.created_at, day = ymd(when, tz);
    const name = s.clients?.name ?? 'Walk-in';
    const row: SaleRow = {
      id: s.id, ref: s.bookings?.ref_no ? bookingRef(s.bookings.ref_no) : '', bookingId: s.bookings?.id ?? '', staffId: s.staff?.id ?? null, clientId: s.clients?.id ?? null, bookingDay: s.bookings?.starts_at ? ymd(s.bookings.starts_at, tz) : '', client: name, staffName: s.staff?.name ?? 'Unassigned', staffPhoto: s.staff?.photo_url ?? null, firstName: firstName(s.staff?.name ?? 'Unassigned'),
      service: first ? `${first.label}${first.qty > 1 ? ` x${first.qty}` : ''}${extra > 0 ? ` +${extra} more` : ''}` : 'Sale',
      time: status === 'Pending' ? 'In progress' : day === today ? time12(when, tz) : dShort(day),
      method: status === 'Pending' ? 'Not taken yet' : METHOD[s.method] ?? '', status,
      amount: s.subtotal_cents + s.discount_cents, discount: s.discount_cents, discountNote: s.discount_note ?? '', taxRate: Number(s.tax_rate), taxIncl: !!s.tax_inclusive, tip: s.tip_cents, tax: s.tax_inclusive ? 0 : s.tax_cents, total: s.total_cents,
      dayShort: dShort(day), gst: s.tax_cents, range: s.bookings?.starts_at && s.bookings?.ends_at ? timeRange(time12(s.bookings.starts_at, tz), time12(s.bookings.ends_at, tz)) : '',
      lines: items.map((i) => ({ label: i.label as string, qty: i.qty as number, cents: i.price_cents as number, dur: i.service_id ? durOf.get(i.service_id as string) ?? null : null, svc: !!i.service_id, productId: (i.product_id as string | null) ?? null, serviceId: (i.service_id as string | null) ?? null })),
      txn: openTxn.get(s.id),
      canEdit: status === 'Pending' && canEdit && items.filter((i) => i.service_id).length === 1,
    };
    return { row, day, paid: s.status === 'paid' };
  });
  const rows = list.map((x) => x.row);
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(today, i - 6));
  const bars = days.map((d) => ({ day: dayInfo(d).abbr, cents: list.filter((x) => x.paid && x.day === d).reduce((a, x) => a + x.row.total, 0), today: d === today }));
  const todayPaid = list.filter((x) => x.paid && x.day === today);
  const todayTotal = todayPaid.reduce((a, x) => a + x.row.total, 0);

  const card = st.accept_card;
  const methods: PayMethod[] = [];
  // With a card terminal switched on, every card payment goes to it.
  if (card && pay?.terminal_enabled) methods.push({ id: 'terminal', label: 'Card' });
  else if (card && pay?.online_cards_enabled) methods.push({ id: 'online', label: 'Card' });
  if (st.accept_cash) methods.push({ id: 'cash', label: 'Cash' });
  if (st.accept_gift_cards) methods.push({ id: 'gift_card', label: 'Gift card' });

  const t = dayInfo(today);
  const services = ((svcs ?? []) as any[]).sort((a, b) => (a.service_categories?.sort ?? 0) - (b.service_categories?.sort ?? 0)).map((s) => ({ id: s.id as string, name: s.name as string, priceCents: s.price_cents as number }));
  return <>
    {!!flagged?.length && (
      <div role="alert" style={{ margin: '16px 24px 0', padding: '12px 16px', borderRadius: 12, background: TONE.red.bg, color: TONE.red.fg, fontSize: 14, lineHeight: 1.5 }}>
        <strong>{flagged.length === 1 ? 'A card payment needs checking.' : `${flagged.length} card payments need checking.`}</strong> Compare with your Windcave statement.
        {(flagged as any[]).map((f) => <div key={f.id}>{f.sales?.clients?.name ?? 'Walk-in'}, {dollars(f.amount_cents)}: {f.review_note ?? 'Needs a manual check.'}</div>)}
      </div>
    )}
    <SalesView canDiscount={canEdit} rows={rows} bars={bars} todayTotal={todayTotal} paidCount={todayPaid.length} subtitle={t.full}
      methods={methods} acceptCard={st.accept_card !== false} services={services} catalog={buildServices(svcs as any[], sa)} offers={buildOffers(ss)} packages={packages} products={((prods ?? []) as any[]).map((x) => ({ id: x.id as string, name: x.name as string, brand: (x.brand ?? '') as string, priceCents: x.price_cents as number, stock: x.stock as number }))} askTip={st.ask_for_tip} initial={{ sale: sp.sale ?? null, pay: sp.pay === '1', card: sp.card ?? '' }} />
  </>;
}
