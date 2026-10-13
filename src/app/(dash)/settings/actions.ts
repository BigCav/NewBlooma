'use server';
import { revalidatePath } from 'next/cache';
import { requireOwner, friendly } from '@/lib/session';
import { encrypt } from '@/lib/crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';

const bool = (fd: FormData, k: string) => fd.get(k) === 'on';
const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function saveSettings(_: unknown, fd: FormData) {
  const { sb, salon } = await requireOwner();
  const rate = Number(fd.get('tax_rate'));
  if (!Number.isFinite(rate) || rate < 0 || rate > 30) return { error: 'Tax rate must be between 0 and 30.' };
  const r1 = await sb.from('salons').update({ name: s(fd, 'name'), phone: s(fd, 'phone') || null, email: s(fd, 'email') || null, address: s(fd, 'address') || null }).eq('id', salon.id);
  if (r1.error) return { error: friendly(r1.error.message) };
  const r2 = await sb.from('salon_settings').update({
    online_booking: bool(fd, 'online_booking'), booking_window: s(fd, 'booking_window'), min_notice: s(fd, 'min_notice'),
    auto_confirm: s(fd, 'auto_confirm') === 'auto', free_cancel_before: s(fd, 'free_cancel_before'),
    accept_card: bool(fd, 'accept_card'), accept_cash: bool(fd, 'accept_cash'), accept_gift_cards: bool(fd, 'accept_gift_cards'),
    ask_for_tip: bool(fd, 'ask_for_tip'), suggested_tip_pct: Number(fd.get('suggested_tip_pct')),
    tax_rate: rate, tax_inclusive: s(fd, 'tax_mode') !== 'exclusive',
    email_confirmations: bool(fd, 'email_confirmations'), remind_24h: bool(fd, 'remind_24h'), remind_2h: bool(fd, 'remind_2h'),
    notify_new_booking: bool(fd, 'notify_new_booking'), notify_cancellation: bool(fd, 'notify_cancellation'), updated_at: new Date().toISOString(),
  }).eq('salon_id', salon.id);
  if (r2.error) return { error: friendly(r2.error.message) };
  revalidatePath('/', 'layout');
  return { ok: 'Settings saved.' };
}

export async function savePayments(_: unknown, fd: FormData) {
  const { sb, salon } = await requireOwner();
  const r = await sb.from('salon_payment_settings').update({
    online_cards_enabled: bool(fd, 'online_cards_enabled'), terminal_enabled: bool(fd, 'terminal_enabled'),
    terminal_station_id: s(fd, 'terminal_station_id') || null, updated_at: new Date().toISOString(),
  }).eq('salon_id', salon.id);
  if (r.error) return { error: friendly(r.error.message) };
  // Credentials are encrypted in the app and stored where only the server can read them. Blank = keep existing.
  const patch: Record<string, string> = {};
  for (const [field, col] of [['online_user', 'online_user'], ['online_key', 'online_key'], ['hit_user', 'hit_user'], ['hit_key', 'hit_key']] as const) {
    const v = s(fd, field);
    if (v) patch[col] = encrypt(v);
  }
  if (Object.keys(patch).length) {
    const { error } = await supabaseAdmin().from('salon_payment_secrets').upsert({ salon_id: salon.id, ...patch, updated_at: new Date().toISOString() });
    if (error) return { error: friendly(error.message) };
  }
  revalidatePath('/settings');
  return { ok: 'Payment settings saved.' };
}

export async function saveHours(_: unknown, fd: FormData) {
  const { sb, salon } = await requireOwner();
  for (let d = 0; d < 7; d++) {
    const open = fd.get(`open_${d}`) === 'on', from = s(fd, `from_${d}`), to = s(fd, `to_${d}`);
    if (open && to <= from) return { error: 'Closing time must be after opening time.' };
    const { error } = await sb.from('opening_hours').update({ is_open: open, open_time: from, close_time: to }).eq('salon_id', salon.id).eq('weekday', d);
    if (error) return { error: friendly(error.message) };
  }
  revalidatePath('/settings');
  return { ok: 'Opening hours saved.' };
}
