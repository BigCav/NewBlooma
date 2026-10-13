import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function getPublicSalon(slug: string) {
  const sb = supabaseAdmin();
  const { data: salon } = await sb.from('salons').select('id,name,phone,email,address,timezone,currency,headline,intro,about').eq('slug', slug).maybeSingle();
  if (!salon) return null;
  const [{ data: settings }, { data: services }, { data: team }, { data: cats }, { data: hours }, { data: links }] = await Promise.all([
    sb.from('salon_settings').select('online_booking,auto_confirm,free_cancel_before,booking_window').eq('salon_id', salon.id).single(),
    sb.from('services').select('id,name,description,duration_min,price_cents,category_id').eq('salon_id', salon.id).eq('active', true).eq('online_bookable', true).order('name'),
    sb.from('staff').select('id,name,role_title').eq('salon_id', salon.id).eq('active', true).eq('online_bookable', true).order('name'),
    sb.from('service_categories').select('id,name').eq('salon_id', salon.id).order('sort').order('name'),
    sb.from('opening_hours').select('weekday,is_open,open_time,close_time').eq('salon_id', salon.id).order('weekday'),
    sb.from('service_staff').select('staff_id,service_id'),
  ]);
  const staffIds = new Set((team ?? []).map((t) => t.id));
  const allLinks = (links ?? []) as { staff_id: string; service_id: string }[];
  // A service nobody bookable can perform would only lead clients to a dead end, so it is not listed.
  const offered = new Set(allLinks.filter((l) => staffIds.has(l.staff_id)).map((l) => l.service_id));
  return { salon, settings: settings!, services: (services ?? []).filter((s) => offered.has(s.id)), team: team ?? [], cats: cats ?? [], hours: hours ?? [], links: allLinks };
}
