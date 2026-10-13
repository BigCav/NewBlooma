'use server';
import { flushOutbox } from '@/lib/notify';
import { checkPhone } from '@/lib/phone';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { friendly } from '@/lib/session';
import { minutesOfDay } from '@/lib/format';

export type Slot = { key: string; min: number };

/** Open start times for one day. With "any professional" each start time appears once. */
export async function publicSlots(slug: string, date: string, serviceIds: string[], staffId: string): Promise<{ slots: Slot[]; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !serviceIds.length) return { slots: [] };
  const sb = supabaseAdmin();
  const { data: salon } = await sb.from('salons').select('id,timezone').eq('slug', slug).maybeSingle();
  if (!salon) return { slots: [] };
  const { data, error } = await sb.rpc('available_slots', { p_salon: salon.id, p_service_ids: serviceIds, p_staff: staffId && staffId !== 'any' ? staffId : null, p_from: date, p_to: date, p_mode: 'public' });
  if (error) return { slots: [], error: 'Could not load times. Please try again.' };
  const seen = new Set<string>(); const slots: Slot[] = [];
  for (const r of data ?? []) { if (seen.has(r.starts_at)) continue; seen.add(r.starts_at); slots.push({ key: `${r.staff_id}|${r.starts_at}`, min: minutesOfDay(r.starts_at, salon.timezone) }); }
  return { slots };
}

export type BookInput = { services: string[]; slot: string; name: string; email: string; phone: string; notes: string; website: string };

export async function publicBook(slug: string, i: BookInput): Promise<{ error?: string; staffName?: string }> {
  if (i.website) return { error: 'Could not complete your booking.' }; // honeypot
  const name = i.name.trim(), email = i.email.trim().toLowerCase(); let phone = i.phone.trim();
  if (!name) return { error: 'Please add your name.' };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Please add a valid email so we can confirm your booking.' };
  const ph = checkPhone(phone); if (ph.error) return { error: ph.error };
  phone = ph.value;
  if (!i.services.length || !i.slot) return { error: 'Choose your services and a time.' };
  const [staffId, startsAt] = i.slot.split('|');
  const sb = supabaseAdmin();
  const { data: salon } = await sb.from('salons').select('id').eq('slug', slug).maybeSingle();
  if (!salon) return { error: 'This booking page is not available.' };
  let { data: client } = await sb.from('clients').select('id').eq('salon_id', salon.id).ilike('email', email.replace(/[%_]/g, '\\$&')).maybeSingle();
  if (!client) {
    const ins = await sb.from('clients').insert({ salon_id: salon.id, name, email, phone: phone || null }).select('id').single();
    if (ins.error) return { error: 'Could not save your details. Please try again.' };
    client = ins.data;
  }
  const { error } = await sb.rpc('create_booking', { p_salon: salon.id, p_client: client.id, p_staff: staffId, p_starts_at: startsAt, p_service_ids: i.services, p_source: 'online', p_notes: i.notes.trim() || null, p_mode: 'public' });
  if (error) return { error: friendly(error.message) };
  await flushOutbox();
  const { data: st } = await sb.from('staff').select('name').eq('id', staffId).maybeSingle();
  return { staffName: st?.name ?? '' };
}

export async function publicWaitlist(slug: string, i: { name: string; phone: string; serviceId: string; staffId: string }): Promise<{ error?: string }> {
  const name = i.name.trim(); let phone = i.phone.trim();
  if (!name) return { error: 'Add your name.' };
  if (phone.replace(/\D/g, '').length < 7) return { error: 'Add a mobile number so we can reach you.' };
  const ph = checkPhone(phone, true); if (ph.error) return { error: ph.error };
  phone = ph.value;
  const sb = supabaseAdmin();
  const { data: salon } = await sb.from('salons').select('id').eq('slug', slug).maybeSingle();
  if (!salon) return { error: 'This booking page is not available.' };
  const { data: svc } = await sb.from('services').select('id').eq('id', i.serviceId).eq('salon_id', salon.id).eq('active', true).eq('online_bookable', true).maybeSingle();
  if (!svc) return { error: 'Choose a service first.' };
  let staffId: string | null = null;
  if (i.staffId && i.staffId !== 'any') { const { data: st } = await sb.from('staff').select('id').eq('id', i.staffId).eq('salon_id', salon.id).maybeSingle(); staffId = st?.id ?? null; }
  let { data: client } = await sb.from('clients').select('id').eq('salon_id', salon.id).eq('phone', phone).limit(1).maybeSingle();
  if (!client) {
    const ins = await sb.from('clients').insert({ salon_id: salon.id, name, phone }).select('id').single();
    if (ins.error) return { error: 'Could not save your details. Please try again.' };
    client = ins.data;
  }
  const { error } = await sb.from('waitlist_entries').insert({ salon_id: salon.id, client_id: client.id, service_id: svc.id, staff_id: staffId });
  if (error) return { error: friendly(error.message) };
  return {};
}
