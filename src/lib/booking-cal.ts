import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { bookingRef } from '@/lib/display';
import type { CalEvent } from '@/lib/ics';

const base = () => process.env.NEXT_PUBLIC_APP_URL ?? '';

/** The "add to calendar" event for a booking that is still on (a cancelled or no-show booking has nothing to add), or null. */
export async function calEventFor(bookingId: string, manageToken?: string): Promise<CalEvent | null> {
  const sb = supabaseAdmin();
  const { data: b } = await sb.from('bookings').select('ref_no,starts_at,ends_at,status,salon_id,staff(name),booking_services(services(name))').eq('id', bookingId).maybeSingle();
  if (!b || ['cancelled', 'no_show'].includes(b.status)) return null;
  const { data: salon } = await sb.from('salons').select('name,address').eq('id', b.salon_id).maybeSingle();
  if (!salon) return null;
  const services = ((b as any).booking_services as any[]).map((x) => x.services?.name).filter(Boolean).join(' + ') || 'Appointment';
  const staff = (b as any).staff?.name as string | undefined;
  const url = manageToken ? `${base()}/manage/${manageToken}` : undefined;
  return {
    uid: `booking-${bookingId}@aster`, start: b.starts_at, end: b.ends_at, title: `${services} at ${salon.name}`,
    description: [staff ? `With ${staff}` : '', `Booking ${bookingRef((b as any).ref_no)}`, url ? `Change or cancel: ${url}` : ''].filter(Boolean).join('\n'),
    location: salon.address ?? undefined, url,
  };
}

/** The file link for a booking's manage token, as a path (for the web) or a full address (for email). */
export const icsPath = (token: string) => `/manage/${token}/calendar.ics`;
export const icsUrl = (token: string) => `${base()}${icsPath(token)}`;
