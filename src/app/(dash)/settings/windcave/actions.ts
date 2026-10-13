'use server';
import { revalidatePath } from 'next/cache';
import { requireOwner, friendly } from '@/lib/session';
import { encrypt } from '@/lib/crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';

const bool = (fd: FormData, k: string) => fd.get(k) === 'on';
const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function savePayments(_: unknown, fd: FormData) {
  const { sb, salon } = await requireOwner();
  const r0 = await sb.from('salon_settings').update({ tax_inclusive: s(fd, 'tax_mode') !== 'exclusive', updated_at: new Date().toISOString() }).eq('salon_id', salon.id);
  if (r0.error) return { error: friendly(r0.error.message) };
  const r = await sb.from('salon_payment_settings').update({
    online_cards_enabled: bool(fd, 'online_cards_enabled'), terminal_enabled: bool(fd, 'terminal_enabled'),
    terminal_station_id: s(fd, 'terminal_station_id') || null, updated_at: new Date().toISOString(),
  }).eq('salon_id', salon.id);
  if (r.error) return { error: friendly(r.error.message) };
  // Credentials are encrypted in the app and stored where only the server can read them. Blank = keep existing.
  const patch: Record<string, string> = {};
  for (const col of ['online_user', 'online_key', 'hit_user', 'hit_key'] as const) { const v = s(fd, col); if (v) patch[col] = encrypt(v); }
  if (Object.keys(patch).length) {
    const { error } = await supabaseAdmin().from('salon_payment_secrets').upsert({ salon_id: salon.id, ...patch, updated_at: new Date().toISOString() });
    if (error) return { error: friendly(error.message) };
  }
  revalidatePath('/settings/windcave');
  return { ok: 'Payment settings saved.' };
}
