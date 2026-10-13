'use server';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { friendly } from '@/lib/session';
import { time12 } from '@/lib/format';

export async function publicSlots(slug: string, date: string, serviceIds: string[], staffId: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !serviceIds.length) return { slots: [] as { key: string; label: string }[] };
  const sb = supabaseAdmin();
  const { data: salon } = await sb.from('salons').select('id,timezone').eq('slug', slug).maybeSingle();
  if (!salon) return { slots: [] };
  const { data, error } = await sb.rpc('available_slots', { p_salon: salon.id, p_service_ids: serviceIds, p_staff: staffId || null, p_from: date, p_to: date, p_mode: 'public' });
  if (error) return { slots: [], error: 'Could not load times. Please try again.' };
  // With "anyone available" show each start time once.
  const seen = new Set<string>(); const slots: { key: string; label: string }[] = [];
  for (const r of data ?? []) { if (seen.has(r.starts_at)) continue; seen.add(r.starts_at); slots.push({ key: `${r.staff_id}|${r.starts_at}`, label: time12(r.starts_at, salon.timezone) }); }
  return { slots };
}

export async function publicBook(slug: string, _: unknown, fd: FormData) {
  if (String(fd.get('website') ?? '')) return { error: 'Could not complete your booking.' }; // honeypot
  const name = String(fd.get('name') ?? '').trim(), email = String(fd.get('email') ?? '').trim().toLowerCase(), phone = String(fd.get('phone') ?? '').trim();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter your name and a valid email.' };
  const services = fd.getAll('service').map(String);
  const slot = String(fd.get('slot') ?? ''); if (!services.length || !slot) return { error: 'Choose your services and a time.' };
  const [staffId, startsAt] = slot.split('|');
  const sb = supabaseAdmin();
  const { data: salon } = await sb.from('salons').select('id').eq('slug', slug).maybeSingle();
  if (!salon) return { error: 'This booking page is not available.' };
  let { data: client } = await sb.from('clients').select('id').eq('salon_id', salon.id).ilike('email', email).maybeSingle();
  if (!client) {
    const ins = await sb.from('clients').insert({ salon_id: salon.id, name, email, phone: phone || null }).select('id').single();
    if (ins.error) return { error: 'Could not save your details. Please try again.' };
    client = ins.data;
  }
  const { data: bookingId, error } = await sb.rpc('create_booking', { p_salon: salon.id, p_client: client.id, p_staff: staffId, p_starts_at: startsAt, p_service_ids: services, p_source: 'online', p_notes: String(fd.get('notes') ?? '').trim() || null, p_mode: 'public' });
  if (error) return { error: friendly(error.message) };
  const { data: tok } = await sb.from('booking_tokens').select('token').eq('booking_id', bookingId).eq('purpose', 'manage_booking').single();
  redirect(`/manage/${tok!.token}?new=1`);
}
