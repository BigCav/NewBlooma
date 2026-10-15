import { requireCtx } from '@/lib/session';
import { ymd, time12 } from '@/lib/format';
import { addDaysYmd, dayInfo } from '@/lib/cal';
import { initialsOf, type PayMethod, type SaleRow } from './shared';
import { SalesView } from './SalesView';

export const metadata = { title: 'Sales' };
export const dynamic = 'force-dynamic';

const hm = (iso: string, tz: string) => time12(iso, tz);

export default async function Sales({ searchParams }: { searchParams: Promise<{ sale?: string; pay?: string; card?: string }> }) {
  const sp = await searchParams;
  const { sb, salon, staff, settings: st } = await requireCtx();
  const tz = salon.timezone, today = ymd(new Date(), tz);
  const since = new Date(Date.now() - 15 * 86400e3).toISOString();
  const [{ data: sales }, { data: svcs }, { data: pay }] = await Promise.all([
    sb.from('sales').select('id,status,method,subtotal_cents,discount_cents,discount_note,tax_rate,tip_cents,tax_cents,tax_inclusive,total_cents,created_at,paid_at,clients(name),staff(name),sale_items(label,qty,price_cents,service_id)')
      .or(`created_at.gte.${since},status.eq.pending`).order('created_at', { ascending: false }).limit(300),
    sb.from('services').select('id,name,price_cents,service_categories(name,sort)').eq('active', true).order('name'),
    sb.from('salon_payment_settings').select('online_cards_enabled,terminal_enabled').eq('salon_id', salon.id).maybeSingle(),
  ]);
  const canEdit = staff.app_role !== 'stylist';
  const METHOD: Record<string, string> = { card: 'Card', cash: 'Cash', gift_card: 'Gift card' };
  const list = ((sales ?? []) as any[]).map((s) => {
    const items = s.sale_items as any[];
    const first = items[0], extra = items.length - 1;
    const status = s.status === 'paid' ? 'Paid' : s.status === 'refunded' ? 'Refunded' : 'Pending';
    const when = s.paid_at ?? s.created_at, day = ymd(when, tz);
    const name = s.clients?.name ?? 'Walk-in';
    const row: SaleRow = {
      id: s.id, client: name, initials: initialsOf(name), staffName: s.staff?.name ?? 'Unassigned', firstName: String(s.staff?.name ?? 'Unassigned').split(' ')[0],
      service: first ? `${first.label}${first.qty > 1 ? ` x${first.qty}` : ''}${extra > 0 ? ` +${extra} more` : ''}` : 'Sale',
      time: status === 'Pending' ? 'In progress' : day === today ? hm(when, tz) : dayInfo(day).short,
      method: status === 'Pending' ? 'Not taken yet' : METHOD[s.method] ?? '', status,
      amount: s.subtotal_cents + s.discount_cents, discount: s.discount_cents, discountNote: s.discount_note ?? '', taxRate: Number(s.tax_rate), taxIncl: !!s.tax_inclusive, tip: s.tip_cents, tax: s.tax_inclusive ? 0 : s.tax_cents, total: s.total_cents,
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
  if (card && pay?.terminal_enabled && pay?.online_cards_enabled) methods.push({ id: 'terminal', label: 'Card terminal' }, { id: 'online', label: 'Card on screen' });
  else if (card && pay?.terminal_enabled) methods.push({ id: 'terminal', label: 'Card' });
  else if (card && pay?.online_cards_enabled) methods.push({ id: 'online', label: 'Card' });
  if (st.accept_cash) methods.push({ id: 'cash', label: 'Cash' });
  if (st.accept_gift_cards) methods.push({ id: 'gift_card', label: 'Gift card' });

  const t = dayInfo(today);
  const services = ((svcs ?? []) as any[]).sort((a, b) => (a.service_categories?.sort ?? 0) - (b.service_categories?.sort ?? 0)).map((s) => ({ id: s.id as string, name: s.name as string, priceCents: s.price_cents as number }));
  return <SalesView canDiscount={canEdit} rows={rows} bars={bars} todayTotal={todayTotal} paidCount={todayPaid.length} subtitle={`${t.weekday}, ${t.num} ${t.month}`}
    methods={methods} services={services} askTip={st.ask_for_tip} initial={{ sale: sp.sale ?? null, pay: sp.pay === '1', card: sp.card ?? '' }} />;
}
