'use server';
import { flushOutbox } from '@/lib/notify';
import { checkPhone } from '@/lib/phone';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { allow, clientIp } from '@/lib/rate-limit';
import { currentClient, salonIdFor, clearClientCookie, clientToken, setClientCookie, type ClientAccount } from '@/lib/client-auth';
import { friendly } from '@/lib/session';
import { minutesOfDay } from '@/lib/format';
import { nextAvailableLabel } from '@/lib/public';
import { outstandingForBooking } from '@/lib/forms';

export type Slot = { key: string; min: number };

/** Open start times for one day. With "any professional" each start time appears once. */
export async function publicSlots(slug: string, date: string, serviceIds: string[], staffId: string): Promise<{ slots: Slot[]; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !serviceIds.length || serviceIds.length > 12) return { slots: [] };
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
export async function nextAvailable(slug: string, serviceIds: string[], staffId?: string): Promise<string | null> {
  if (serviceIds.length > 12) return null;
  const { data: salon } = await supabaseAdmin().from('salons').select('id,timezone').eq('slug', slug).maybeSingle();
  if (!salon) return null;
  return nextAvailableLabel(salon.id, salon.timezone, serviceIds, staffId).catch(() => null);
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
  if (!EMAIL.test(email) || email.length > 254) return { error: 'Enter a valid email address.' };
  if (!input.password || input.password.length > 200) return { error: 'Enter your password.' };
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

export async function publicBook(slug: string, i: BookInput): Promise<{ error?: string; staffName?: string; account?: 'created' | 'exists' | 'saved'; forms?: { names: string[]; url: string; ask: boolean } }> {
  if (i.website) return { error: 'Could not complete your booking.' }; // honeypot
  if (i.name.length > 80 || i.email.length > 254 || i.phone.length > 30 || i.notes.length > 500 || i.services.length > 12 || i.slot.length > 100 || (i.password ?? '').length > 72) return { error: 'One of the details is too long. Please shorten it and try again.' };
  // Nobody books a salon solid or fills a stranger's inbox: cap bookings per address and per email.
  if (!(await allow('book:' + (await clientIp()), 8, 3600)) || !(await allow('book-to:' + i.email.trim().toLowerCase(), 6, 3600))) return { error: 'Too many bookings from here for now. Please call the salon, or try again later.' };
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
  // Extras must go with a chosen service; an extra on its own is not a booking.
  const { data: picked } = await sb.from('services').select('id,is_addon').eq('salon_id', salon.id).in('id', i.services);
  const extras = (picked ?? []).filter((s) => s.is_addon).map((s) => s.id);
  if (!(picked ?? []).some((s) => !s.is_addon)) return { error: 'Choose a service to book.' };
  if (extras.length) {
    const { data: links } = await sb.from('service_addons').select('addon_id,service_id').in('addon_id', extras);
    if (extras.some((a) => !(links ?? []).some((l) => l.addon_id === a && i.services.includes(l.service_id)))) return { error: 'One of the extras you chose does not go with these services.' };
  }
  let { data: client } = await sb.from('clients').select('id').eq('salon_id', salon.id).ilike('email', email.replace(/[%_]/g, '\\$&')).maybeSingle();
  if (!client) {
    const ins = await sb.from('clients').insert({ salon_id: salon.id, name, email, phone: phone || null }).select('id').single();
    if (ins.error) return { error: 'Could not save your details. Please try again.' };
    client = ins.data;
  }
  const { data: newId, error } = await sb.rpc('create_booking', { p_salon: salon.id, p_client: client.id, p_staff: staffId, p_starts_at: startsAt, p_service_ids: i.services, p_source: 'online', p_notes: i.notes.trim() || null, p_mode: 'public' });
  if (error) return { error: friendly(error.message) };
  const owed = typeof newId === 'string' ? await outstandingForBooking(newId).catch(() => null) : null;
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
  return { staffName: st?.name ?? '', account, forms: owed ? { names: owed.names, url: owed.url, ask: owed.askNames.length > 0 } : undefined };
}

export async function publicWaitlist(slug: string, i: { name: string; phone: string; serviceId: string; staffId: string }): Promise<{ error?: string }> {
  const name = i.name.trim(); let phone = i.phone.trim();
  if (!name) return { error: 'Add your name.' };
  if (name.length > 80 || phone.length > 30) return { error: 'One of the details is too long. Please shorten it and try again.' };
  if (!(await allow('wait:' + (await clientIp()), 8, 3600))) return { error: 'Too many requests from here for now. Please try again later.' };
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
