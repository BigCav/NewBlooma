import { requireCtx } from '@/lib/session';
import { ymd } from '@/lib/format';
import { GiftCardsView, type GiftRow } from './GiftCardsView';

export const metadata = { title: 'Gift cards' };
export const dynamic = 'force-dynamic';

export default async function GiftCards() {
  const { sb, salon, staff } = await requireCtx();
  const tz = salon.timezone;
  const [{ data: cards }, { data: sales }] = await Promise.all([
    sb.from('gift_cards').select('id,code,for_name,original_cents,balance_cents,issued_at,voided_at,voided_cents').order('issued_at', { ascending: false }).limit(300),
    sb.from('sales').select('id,gift_card_id,status,total_cents,paid_at,refunded_at,sale_items(label)').not('gift_card_id', 'is', null).order('paid_at', { ascending: false }).limit(1000),
  ]);
  const rows: GiftRow[] = (cards ?? []).map((g) => {
    const hist: GiftRow['hist'] = [];
    for (const s of (sales ?? []).filter((x) => x.gift_card_id === g.id)) {
      const label = ((s.sale_items as any[]) ?? []).map((i) => i.label).join(' + ') || 'Sale';
      if (s.paid_at) hist.push({ d: ymd(s.paid_at, tz), label: `${label}, redeemed at checkout`, a: -s.total_cents });
      if (s.status === 'refunded' && s.refunded_at) hist.push({ d: ymd(s.refunded_at, tz), label: `${label}, refunded to the card`, a: s.total_cents });
    }
    if (g.voided_at) hist.push({ d: ymd(g.voided_at, tz), label: 'Voided by the salon', a: -g.voided_cents });
    hist.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
    return { id: g.id, code: g.code, name: g.for_name ?? '', issued: ymd(g.issued_at, tz), original: g.original_cents, balance: g.balance_cents, voided: !!g.voided_at, hist };
  });
  return <GiftCardsView rows={rows} salonName={salon.name} month={ymd(new Date(), tz).slice(0, 7)} today={ymd(new Date(), tz)} canIssue={staff.app_role === 'owner'} />;
}
