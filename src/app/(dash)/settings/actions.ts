'use server';
import { checkPhone } from '@/lib/phone';
import { revalidatePath } from 'next/cache';
import { requireCtx, friendly } from '@/lib/session';
import { validate, type Values } from './shared';

const pick = (v: string, ok: string[], d: string) => (ok.includes(v) ? v : d);

export async function saveSettings(v: Values): Promise<{ error?: string; section?: string }> {
  const { sb, salon, staff } = await requireCtx();
  if (staff.app_role !== 'owner') return { error: 'Only the owner can change settings.' };
  const bad = validate(v);
  if (bad) return bad;
  const r1 = await sb.from('salons').update({ name: v.bizName.trim(), phone: checkPhone(v.bizPhone).value || null, email: v.bizEmail.trim(), address: v.bizAddress.trim() || null, slug: v.slug }).eq('id', salon.id);
  if (r1.error) return { error: r1.error.code === '23505' ? 'That booking page address is taken. Try another.' : friendly(r1.error.message), section: 'business' };
  const r2 = await sb.from('salon_settings').update({
    online_booking: !!v.online, booking_window: pick(v.window, ['1w', '2w', '4w', '8w'], '4w'), min_notice: pick(v.notice, ['none', '1h', '2h', '24h'], '2h'),
    auto_confirm: v.confirm !== 'manual', free_cancel_before: pick(v.cancel, ['2h', '24h', '48h'], '24h'),
    accept_card: !!v.card, accept_cash: !!v.cash, accept_gift_cards: !!v.gift, ask_for_tip: !!v.tips,
    suggested_tip_pct: Number(pick(v.tipDefault, ['0', '10', '15', '20'], '0')), tax_rate: parseFloat(v.tax),
    email_confirmations: !!v.confirmEmail, remind_24h: !!v.remind24, remind_2h: !!v.remind2,
    notify_new_booking: !!v.newBooking, notify_cancellation: !!v.cancelled, updated_at: new Date().toISOString(),
  }).eq('salon_id', salon.id);
  if (r2.error) return { error: friendly(r2.error.message) };
  const rows = v.hours.map((h, i) => ({ salon_id: salon.id, weekday: i, is_open: !!h.open, open_time: h.from, close_time: h.to }));
  const r3 = await sb.from('opening_hours').upsert(rows, { onConflict: 'salon_id,weekday' });
  if (r3.error) return { error: friendly(r3.error.message), section: 'hours' };
  revalidatePath('/', 'layout');
  return {};
}
