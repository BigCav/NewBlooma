'use server';
import { checkPhone } from '@/lib/phone';
import { revalidatePath } from 'next/cache';
import { requireCtx, friendly } from '@/lib/session';
import { ymd } from '@/lib/format';
import { sendCustomMessage } from '@/lib/notify';
import { dropEmptyThread, ensureThread, logStaffMessage, replyUrl } from '@/lib/conversation';
import { type ClientRow } from './shared';

type R = { error?: string; ok?: boolean };

export async function createClient(name: string, email: string, phone: string): Promise<R & { row?: ClientRow }> {
  const { sb, salon } = await requireCtx();
  name = name.trim(); email = email.trim(); phone = phone.trim();
  if (!name) return { error: "Add the client's name." };
  if (name.length > 80 || email.length > 254) return { error: 'That name or email is too long.' };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Add a valid email address, or leave it blank.' };
  const ph = checkPhone(phone); if (ph.error) return { error: ph.error };
  phone = ph.value;
  const { data, error } = await sb.from('clients').insert({ salon_id: salon.id, name, email: email || null, phone: phone || null }).select('id').single();
  if (error) return { error: error.code === '23505' ? 'A client with that email already exists.' : friendly(error.message) };
  revalidatePath('/clients');
  return { ok: true, row: { id: data.id, name, email, phone, tag: 'New', last: 'None yet', lastService: 'No visits', next: 'Not booked', staff: 'Not set', visits: 0, spentCents: 0 } };
}

/** Change a client's name, email and phone. Email is optional, but must be valid and not used by another client. */
export async function updateClient(id: string, name: string, email: string, phone: string): Promise<R> {
  const { sb } = await requireCtx();
  name = name.trim(); email = email.trim(); phone = phone.trim();
  if (!name) return { error: "Add the client's name." };
  if (name.length > 80 || email.length > 254) return { error: 'That name or email is too long.' };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Add a valid email address.' };
  const ph = checkPhone(phone); if (ph.error) return { error: ph.error };
  const { error } = await sb.from('clients').update({ name, email: email || null, phone: ph.value || null }).eq('id', id);
  if (error) return { error: error.code === '23505' ? 'Another client already has that email.' : friendly(error.message) };
  revalidatePath('/clients'); revalidatePath(`/clients/${id}`);
  return { ok: true };
}

/** Owner only, and only for a client with no bookings or sales (so no history is lost). Their notes and waitlist entries go with them. */
export async function deleteClient(id: string): Promise<R> {
  const { sb, staff } = await requireCtx();
  if (staff.app_role !== 'owner') return { error: 'Only the owner can delete a client.' };
  const [{ count: b }, { count: s }] = await Promise.all([
    sb.from('bookings').select('id', { count: 'exact', head: true }).eq('client_id', id),
    sb.from('sales').select('id', { count: 'exact', head: true }).eq('client_id', id),
  ]);
  if ((b ?? 0) > 0 || (s ?? 0) > 0) return { error: 'This client has bookings or sales on record, so they cannot be deleted.' };
  await Promise.all([sb.from('client_notes').delete().eq('client_id', id), sb.from('waitlist_entries').delete().eq('client_id', id), sb.from('inbox_items').delete().eq('client_id', id)]);
  const { error } = await sb.from('clients').delete().eq('id', id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/clients');
  return { ok: true };
}

export async function sendClientMessage(clientId: string, text: string): Promise<R> {
  const { sb, salon } = await requireCtx();
  text = text.trim(); if (!text) return { error: 'Write a message first.' };
  if (text.length > 600) return { error: 'Keep the message under 600 characters.' };
  const { data: c } = await sb.from('clients').select('phone,email').eq('id', clientId).maybeSingle();
  if (!c) return { error: 'Client not found.' };
  const th = await ensureThread(salon.id, clientId, null);
  const r = await sendCustomMessage(salon.id, c, text, undefined, replyUrl(th.token));
  if (!r.ok) { if (th.created) await dropEmptyThread(th.id); return { error: r.error }; }
  await logStaffMessage(salon.id, th.id, text);
  return { ok: true };
}

export async function addNote(clientId: string, text: string): Promise<R & { id?: string }> {
  const { sb, salon, staff } = await requireCtx();
  text = text.trim(); if (!text) return { error: 'Write a note first.' };
  const { data, error } = await sb.from('client_notes').insert({ salon_id: salon.id, client_id: clientId, body: text, created_by: staff.id }).select('id').single();
  if (error) return { error: friendly(error.message) };
  return { ok: true, id: data.id };
}
export async function removeNote(id: string): Promise<R> {
  const { sb } = await requireCtx();
  const { error } = await sb.from('client_notes').delete().eq('id', id);
  return error ? { error: friendly(error.message) } : { ok: true };
}

export async function setAllergies(clientId: string, list: string[]): Promise<R> {
  const { sb } = await requireCtx();
  const clean = Array.from(new Set(list.map((x) => x.trim()).filter(Boolean))).slice(0, 30);
  const { error } = await sb.from('clients').update({ allergies: clean }).eq('id', clientId);
  return error ? { error: friendly(error.message) } : { ok: true };
}

export async function recordPatchTest(clientId: string): Promise<R & { on?: string }> {
  const { sb, salon } = await requireCtx();
  const on = ymd(new Date(), salon.timezone);
  const { error } = await sb.from('clients').update({ patch_test_on: on }).eq('id', clientId);
  return error ? { error: friendly(error.message) } : { ok: true, on };
}

/** Set the patch test date (not in the future), or clear it with null. */
export async function setPatchTest(clientId: string, on: string | null): Promise<R & { on?: string | null }> {
  const { sb, salon } = await requireCtx();
  if (on !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) return { error: 'Choose a date.' };
    if (on > ymd(new Date(), salon.timezone)) return { error: 'The test date cannot be in the future.' };
  }
  const { error } = await sb.from('clients').update({ patch_test_on: on }).eq('id', clientId);
  return error ? { error: friendly(error.message) } : { ok: true, on };
}

export async function saveFormula(clientId: string, formula: string): Promise<R> {
  const { sb } = await requireCtx();
  const { error } = await sb.from('clients').update({ colour_formula: formula.trim() || null }).eq('id', clientId);
  return error ? { error: friendly(error.message) } : { ok: true };
}

export async function setPreference(clientId: string, key: 'reminders' | 'marketing', value: boolean): Promise<R> {
  const { sb } = await requireCtx();
  const { error } = await sb.from('clients').update({ [key]: value }).eq('id', clientId);
  return error ? { error: friendly(error.message) } : { ok: true };
}
