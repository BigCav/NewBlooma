import { requireOwner } from '@/lib/session';
import { SettingsView } from './SettingsView';
import type { Values } from './shared';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function Settings({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section } = await searchParams;
  const { sb, salon } = await requireOwner();
  const [{ data: s }, { data: st }, { data: hrs }] = await Promise.all([
    sb.from('salons').select('name,phone,email,address,slug').eq('id', salon.id).single(),
    sb.from('salon_settings').select('*').eq('salon_id', salon.id).single(),
    sb.from('opening_hours').select('weekday,is_open,open_time,close_time').eq('salon_id', salon.id).order('weekday'),
  ]);
  const hours = Array.from({ length: 7 }, (_, i) => {
    const h = (hrs ?? []).find((x: any) => x.weekday === i) as any;
    return { open: h ? !!h.is_open : i < 5, from: String(h?.open_time ?? '09:00').slice(0, 5), to: String(h?.close_time ?? '17:00').slice(0, 5) };
  });
  const x: any = st ?? {};
  const initial: Values = {
    bizName: s?.name ?? '', bizPhone: s?.phone ?? '', bizEmail: s?.email ?? '', bizAddress: s?.address ?? '', slug: s?.slug ?? '', hours,
    online: !!x.online_booking, window: x.booking_window ?? '4w', notice: x.min_notice ?? '2h', confirm: x.auto_confirm === false ? 'manual' : 'auto', cancel: x.free_cancel_before ?? '24h',
    card: !!x.accept_card, cash: !!x.accept_cash, gift: !!x.accept_gift_cards, tips: !!x.ask_for_tip, tipDefault: String(x.suggested_tip_pct ?? 0), tax: String(Number(x.tax_rate ?? 0)),
    confirmEmail: !!x.email_confirmations, remind24: !!x.remind_24h, remind2: !!x.remind_2h, newBooking: !!x.notify_new_booking, cancelled: !!x.notify_cancellation,
  };
  return <SettingsView initial={initial} section={section} />;
}
