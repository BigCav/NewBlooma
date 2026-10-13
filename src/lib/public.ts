import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function getPublicSalon(slug: string) {
  const sb = supabaseAdmin();
  const { data: salon } = await sb.from('salons').select('id,name,phone,email,address,timezone,currency').eq('slug', slug).maybeSingle();
  if (!salon) return null;
  const [{ data: settings }, { data: services }, { data: team }, { data: cats }] = await Promise.all([
    sb.from('salon_settings').select('online_booking,auto_confirm,free_cancel_before').eq('salon_id', salon.id).single(),
    sb.from('services').select('id,name,description,duration_min,price_cents,category_id').eq('salon_id', salon.id).eq('active', true).eq('online_bookable', true).order('name'),
    sb.from('staff').select('id,name,role_title').eq('salon_id', salon.id).eq('active', true).eq('online_bookable', true).order('name'),
    sb.from('service_categories').select('id,name').eq('salon_id', salon.id).order('sort').order('name'),
  ]);
  return { salon, settings: settings!, services: services ?? [], team: team ?? [], cats: cats ?? [] };
}
