import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export type Ctx = {
  sb: Awaited<ReturnType<typeof supabaseServer>>;
  userId: string;
  staff: { id: string; name: string; app_role: 'owner' | 'stylist' | 'reception'; salon_id: string };
  salon: { id: string; name: string; slug: string; timezone: string; currency: string };
  settings: Record<string, any>;
};

/** Signed-in staff member with a salon. Redirects otherwise. */
export async function requireCtx(): Promise<Ctx> {
  const sb = await supabaseServer();
  // The middleware already verified the session with Supabase; getClaims checks the JWT locally (no extra network trip).
  const { data: claims } = await sb.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect('/sign-in');
  // Two round trips: staff + salon together, then settings.
  const { data: row } = await sb.from('staff').select('id,name,app_role,salon_id,salons(id,name,slug,timezone,currency)').eq('user_id', uid).eq('active', true).maybeSingle();
  if (!row) redirect('/setup');
  const { data: settings } = await sb.from('salon_settings').select('*').eq('salon_id', row.salon_id).single();
  const { salons: salon, ...staff } = row as any;
  return { sb, userId: uid, staff: staff as Ctx['staff'], salon: salon, settings: settings ?? {} };
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
    price_not_editable: 'This sale has more than one service, so its price can only be changed on the appointment.', client_required: 'Add the client\'s name.',
    booking_not_found: 'That booking no longer exists.', booking_not_editable: 'This booking can no longer be changed.', booking_needs_service: 'Keep at least one service on the booking.',
    service_not_found: 'That service is no longer available.', card_payment_in_progress: 'A card payment is in progress for this sale.', sale_not_pending: 'This sale is already settled.', invalid_price: 'Enter a price above zero, like 45 or 45.50.',
  };
  for (const k of Object.keys(map)) if (msg.includes(k)) return map[k];
  if (msg.includes('duplicate key') && msg.includes('slug')) return 'That web address is taken. Try another.';
  if (msg.includes('bookings_no_overlap') || msg.includes('exclusion')) return 'That team member is already booked then.';
  return msg;
}
