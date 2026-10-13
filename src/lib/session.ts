import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export type Ctx = {
  sb: Awaited<ReturnType<typeof supabaseServer>>;
  userId: string;
  staff: { id: string; name: string; app_role: 'owner' | 'staff'; salon_id: string };
  salon: { id: string; name: string; slug: string; timezone: string; currency: string };
  settings: Record<string, any>;
};

/** Signed-in staff member with a salon. Redirects otherwise. */
export async function requireCtx(): Promise<Ctx> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/sign-in');
  const { data: staff } = await sb.from('staff').select('id,name,app_role,salon_id').eq('user_id', user.id).eq('active', true).maybeSingle();
  if (!staff) redirect('/setup');
  const [{ data: salon }, { data: settings }] = await Promise.all([
    sb.from('salons').select('id,name,slug,timezone,currency').eq('id', staff.salon_id).single(),
    sb.from('salon_settings').select('*').eq('salon_id', staff.salon_id).single(),
  ]);
  return { sb, userId: user.id, staff: staff as Ctx['staff'], salon: salon!, settings: settings ?? {} };
}

export async function requireOwner() {
  const c = await requireCtx();
  if (c.staff.app_role !== 'owner') redirect('/calendar');
  return c;
}

/** Turn a Postgres error into a short human message. */
export function friendly(msg?: string | null) {
  if (!msg) return 'Something went wrong';
  const map: Record<string, string> = {
    slot_unavailable: 'That time is no longer available.', forbidden: 'You do not have access to that.', owner_only: 'Only the owner can do that.',
    already_has_salon: 'This account already has a salon.', invalid_timezone: 'Pick a valid timezone.', sale_already_exists: 'This appointment already has a sale.',
    empty_sale: 'Add at least one service or product.', gift_card_insufficient: 'Gift card balance is too low.', gift_card_not_found: 'Gift card not found.',
    method_disabled: 'That payment method is switched off in Settings.', staff_cannot_perform: 'That team member does not offer these services.',
  };
  for (const k of Object.keys(map)) if (msg.includes(k)) return map[k];
  if (msg.includes('duplicate key') && msg.includes('slug')) return 'That web address is taken. Try another.';
  if (msg.includes('bookings_no_overlap') || msg.includes('exclusion')) return 'That team member is already booked then.';
  return msg;
}
