'use server';
import { checkPhone } from '@/lib/phone';
import { revalidatePath } from 'next/cache';
import { requireCtx, friendly } from '@/lib/session';
import { zonedToUtc, ymd } from '@/lib/format';
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

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Close the salon for a day or a run of days. Existing bookings are left alone; the count is returned so the owner can deal with them. */
export async function addClosedPeriod(from: string, to: string, reason: string): Promise<{ error?: string; id?: string; affected?: number }> {
  const { sb, salon, staff } = await requireCtx();
  if (staff.app_role !== 'owner') return { error: 'Only the owner can change closed dates.' };
  to = to || from;
  if (!DAY.test(from) || Number.isNaN(Date.parse(from))) return { error: 'Choose the first day.' };
  if (!DAY.test(to) || Number.isNaN(Date.parse(to))) return { error: 'Choose the last day.' };
  if (to < from) return { error: 'The last day cannot be before the first day.' };
  if (to < ymd(new Date(), salon.timezone)) return { error: 'That is in the past.' };
  if (Date.parse(to) - Date.parse(from) > 366 * 86400000) return { error: 'Keep a closure to under a year.' };
  const ins = await sb.from('closed_periods').insert({ salon_id: salon.id, starts_on: from, ends_on: to, reason: reason.trim().slice(0, 80) || null }).select('id').single();
  if (ins.error) return { error: friendly(ins.error.message) };
  const { count } = await sb.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['pending', 'confirmed'])
    .gte('starts_at', zonedToUtc(from, '00:00', salon.timezone).toISOString()).lte('starts_at', zonedToUtc(to, '23:59:59', salon.timezone).toISOString());
  revalidatePath('/', 'layout');
  return { id: ins.data.id as string, affected: count ?? 0 };
}

export async function removeClosedPeriod(id: string): Promise<{ error?: string }> {
  const { sb, staff } = await requireCtx();
  if (staff.app_role !== 'owner') return { error: 'Only the owner can change closed dates.' };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: 'That closed period no longer exists.' };
  const { error } = await sb.from('closed_periods').delete().eq('id', id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/', 'layout');
  return {};
}
