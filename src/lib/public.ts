import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function getPublicSalon(slug: string) {
  const sb = supabaseAdmin();
  const { data: salon } = await sb.from('salons').select('id,name,phone,email,address,timezone,currency,headline,intro,about').eq('slug', slug).maybeSingle();
  if (!salon) return null;
  const [{ data: settings }, { data: services }, { data: team }, { data: cats }, { data: hours }, { data: links }, { data: addonLinks }] = await Promise.all([
    sb.from('salon_settings').select('online_booking,auto_confirm,free_cancel_before,booking_window,email_confirmations').eq('salon_id', salon.id).single(),
    sb.from('services').select('id,name,description,duration_min,price_cents,category_id,is_addon').eq('salon_id', salon.id).eq('active', true).eq('online_bookable', true).order('name'),
    sb.from('staff').select('id,name,role_title,photo_url').eq('salon_id', salon.id).eq('active', true).eq('online_bookable', true).order('name'),
    sb.from('service_categories').select('id,name').eq('salon_id', salon.id).order('sort').order('name'),
    sb.from('opening_hours').select('weekday,is_open,open_time,close_time').eq('salon_id', salon.id).order('weekday'),
    sb.from('service_staff').select('staff_id,service_id'),
    sb.from('service_addons').select('addon_id,service_id'),
  ]);
  const staffIds = new Set((team ?? []).map((t) => t.id));
  const allLinks = (links ?? []) as { staff_id: string; service_id: string }[];
  // A service nobody bookable can perform would only lead clients to a dead end, so it is not listed.
  const offered = new Set(allLinks.filter((l) => staffIds.has(l.staff_id)).map((l) => l.service_id));
  const mains = (services ?? []).filter((s) => !s.is_addon && offered.has(s.id));
  const mainIds = new Set(mains.map((s) => s.id));
  // An add-on is only shown with the services it is attached to, and only when one of them can be booked.
  const addons = (services ?? []).filter((s) => s.is_addon).map((s) => ({ ...s, parents: (addonLinks ?? []).filter((l) => l.addon_id === s.id && mainIds.has(l.service_id)).map((l) => l.service_id) })).filter((s) => s.parents.length);
  return { salon, settings: settings!, services: mains, addons, team: team ?? [], cats: cats ?? [], hours: hours ?? [], links: allLinks };
}

/** Earliest open online time ("Today, 2:30pm") for the given services, or the quickest services on the menu when none are chosen. Past times, booked times and the notice window are already excluded by available_slots. */
export async function nextAvailableLabel(salonId: string, tz: string, serviceIds: string[] = [], staffId?: string): Promise<string | null> {
  const sb = supabaseAdmin();
  let sets: string[][] = serviceIds.length ? [serviceIds] : [];
  if (!sets.length) {
    const { data } = await sb.from('services').select('id').eq('salon_id', salonId).eq('active', true).eq('online_bookable', true).eq('is_addon', false).order('duration_min').limit(4);
    sets = (data ?? []).map((s) => [s.id]);
  }
  const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
  const now = new Date();
  const from = ymd(now), to = ymd(new Date(now.getTime() + 56 * 864e5));
  let best: Date | null = null;
  for (const ids of sets) {
    const { data } = await sb.rpc('available_slots', { p_salon: salonId, p_service_ids: ids, p_staff: staffId ?? null, p_from: from, p_to: to, p_mode: 'public' });
    const first = (data ?? [])[0]?.starts_at;
    if (first && (!best || new Date(first) < best)) best = new Date(first);
  }
  if (!best) return null;
  const day = ymd(best);
  const time = new Intl.DateTimeFormat('en-NZ', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(best).replace(/\s/g, '').toLowerCase();
  const tomorrow = ymd(new Date(now.getTime() + 864e5));
  const when = day === from ? 'Today' : day === tomorrow ? 'Tomorrow' : new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(best).replace(',', '');
  return `${when}, ${time}`;
}
