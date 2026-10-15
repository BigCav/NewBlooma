'use server';
import { flushOutbox } from '@/lib/notify';
import { checkPhone } from '@/lib/phone';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentClient, salonIdFor, clearClientCookie, clientToken, setClientCookie, type ClientAccount } from '@/lib/client-auth';
import { friendly } from '@/lib/session';
import { minutesOfDay } from '@/lib/format';
import { nextAvailableLabel } from '@/lib/public';

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

/** Next open online time for the chosen services (or the quickest on the menu), for the banner on the first step. */
export async function nextAvailable(slug: string, serviceIds: string[]): Promise<string | null> {
  const { data: salon } = await supabaseAdmin().from('salons').select('id,timezone').eq('slug', slug).maybeSingle();
  if (!salon) return null;
  return nextAvailableLabel(salon.id, salon.timezone, serviceIds).catch(() => null);
}

export type BookInput = { services: string[]; slot: string; name: string; email: string; phone: string; notes: string; website: string; password?: string };

export type Account = { name: string; email: string; phone: string };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const toAccount = (c: ClientAccount | null): Account | null => (c ? { name: c.name, email: c.email, phone: c.phone } : null);

/** The signed-in customer for this salon, if any. Separate from staff logins. */
export async function clientMe(slug: string): Promise<Account | null> {
  const id = await salonIdFor(slug); if (!id) return null;
  return toAccount(await currentClient(id));
}

export async function clientSignIn(input: { slug: string; email: string; password: string }): Promise<{ error?: string; account?: Account }> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address.' };
  if (!input.password) return { error: 'Enter your password.' };
  try {
    const id = await salonIdFor(input.slug); if (!id) return { error: 'This booking page is not available.' };
    const { data, error } = await supabaseAdmin().rpc('client_login', { p_salon: id, p_email: email, p_password: input.password });
    if (error) {
      if (/too_many_attempts/.test(error.message)) return { error: 'Too many attempts. Try again in 15 minutes.' };
      if (!/bad_login/.test(error.message)) console.error('client_login failed', error.message);
      return { error: 'Email or password is incorrect.' };
    }
    if (!data) return { error: 'Email or password is incorrect.' };
    await setClientCookie(String(data));
    const account = toAccount(await currentClient(id));
    if (!account) { console.error('client_login: session not readable after sign-in'); return { error: 'Signed in, but we could not load your details. Please refresh and try again.' }; }
    return { account };
  } catch (e) {
    console.error('clientSignIn threw', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export async function clientSignOut(): Promise<void> {
  const t = await clientToken();
  if (t) await supabaseAdmin().rpc('client_logout', { p_token: t });
  await clearClientCookie();
}

export async function publicBook(slug: string, i: BookInput): Promise<{ error?: string; staffName?: string; account?: 'created' | 'exists' | 'saved' }> {
  if (i.website) return { error: 'Could not complete your booking.' }; // honeypot
  const sb = supabaseAdmin();
  const { data: salon } = await sb.from('salons').select('id').eq('slug', slug).maybeSingle();
  if (!salon) return { error: 'This booking page is not available.' };
  const me = await currentClient(salon.id);
  const name = (me?.name || i.name).trim(), email = (me?.email || i.email).trim().toLowerCase();
  let phone = (i.phone.trim() || me?.phone || '').trim();
  if (!name) return { error: 'Please add your name.' };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Please add a valid email so we can confirm your booking.' };
  const ph = checkPhone(phone, true); if (ph.error) return { error: ph.error };
  phone = ph.value;
  if (!i.services.length || !i.slot) return { error: 'Choose your services and a time.' };
  if (!me && i.password !== undefined && i.password.length < 8) return { error: 'Choose a password with at least 8 characters.' };
  const [staffId, startsAt] = i.slot.split('|');
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
  let account: 'created' | 'exists' | 'saved' | undefined;
  if (me) {
    account = 'saved';
    await sb.rpc('client_update', { p_account: me.id, p_name: me.name || name, p_phone: phone });
  } else if (i.password) {
    const { data: token, error: ce } = await sb.rpc('client_register', { p_salon: salon.id, p_name: name, p_email: email, p_phone: phone, p_password: i.password });
    if (ce || !token) account = 'exists';
    else { await setClientCookie(String(token)); account = 'created'; }
  }
  return { staffName: st?.name ?? '', account };
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
