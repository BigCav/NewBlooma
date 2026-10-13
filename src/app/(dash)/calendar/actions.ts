'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCtx, friendly } from '@/lib/session';
import { zonedToUtc, minutesOfDay, ymd as ymdOf, time12 } from '@/lib/format';

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function createAppointment(_: unknown, fd: FormData) {
  const { sb, salon } = await requireCtx();
  let clientId = s(fd, 'client_id');
  if (!clientId) {
    const name = s(fd, 'new_name'); if (!name) return { error: 'Choose a client or enter a new one.' };
    const email = s(fd, 'new_email') || null;
    const { data, error } = await sb.from('clients').insert({ salon_id: salon.id, name, email, phone: s(fd, 'new_phone') || null }).select('id').single();
    if (error) return { error: error.code === '23505' ? 'A client with that email already exists. Pick them from the list.' : friendly(error.message) };
    clientId = data.id;
  }
  const services = fd.getAll('service').map(String);
  if (!services.length) return { error: 'Choose at least one service.' };
  const slot = s(fd, 'slot'); if (!slot) return { error: 'Choose a time.' };
  const [staffId, startsAt] = slot.split('|');
  const { data, error } = await sb.rpc('create_booking', { p_salon: salon.id, p_client: clientId, p_staff: staffId, p_starts_at: startsAt, p_service_ids: services, p_source: 'staff', p_notes: s(fd, 'notes') || null, p_mode: 'staff' });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/calendar');
  redirect(`/calendar/${data}`);
}

export async function setStatus(fd: FormData) {
  const { sb } = await requireCtx();
  const id = String(fd.get('id')), status = String(fd.get('status'));
  if (status === 'confirmed' && fd.get('approve')) await sb.rpc('confirm_booking', { p_booking: id });
  else await sb.from('bookings').update({ status, ...(status === 'cancelled' ? { cancelled_at: new Date().toISOString() } : {}) }).eq('id', id);
  revalidatePath('/calendar'); revalidatePath(`/calendar/${id}`);
}

export async function startCheckout(fd: FormData) {
  const { sb } = await requireCtx();
  const id = String(fd.get('id'));
  const { data: existing } = await sb.from('sales').select('id').eq('booking_id', id).neq('status', 'refunded').maybeSingle();
  if (existing) redirect(`/sales/${existing.id}`);
  const { data, error } = await sb.rpc('create_sale', { p_booking: id, p_client: null, p_items: [], p_tip_pct: 0, p_description: null });
  if (error) redirect(`/calendar/${id}?err=${encodeURIComponent(friendly(error.message))}`);
  redirect(`/sales/${data}`);
}

/* ---------- Calendar panel actions (return values, no redirects) ---------- */

type R = { error?: string; ok?: true; id?: string; note?: string };

export async function checkInBooking(id: string): Promise<R> {
  const { sb } = await requireCtx();
  const { error } = await sb.from('bookings').update({ status: 'checked_in' }).eq('id', id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/calendar'); return { ok: true };
}
export async function approveBooking(id: string): Promise<R> {
  const { sb } = await requireCtx();
  const { error } = await sb.rpc('confirm_booking', { p_booking: id });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/calendar'); return { ok: true };
}
export async function cancelBooking(id: string): Promise<R> {
  const { sb } = await requireCtx();
  const { error } = await sb.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/calendar'); return { ok: true };
}
export async function noShowBooking(id: string): Promise<R> {
  const { sb } = await requireCtx();
  const { error } = await sb.from('bookings').update({ status: 'no_show' }).eq('id', id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/calendar'); return { ok: true };
}

/** Busy intervals (minutes) and opening hours for one staff member on one day. */
export async function dayAvailability(dayYmd: string, staffId: string, ignoreBooking?: string) {
  const { sb, salon } = await requireCtx();
  const a = zonedToUtc(dayYmd, '00:00', salon.timezone), b = zonedToUtc(dayYmd, '23:59:59', salon.timezone);
  const wd = (new Date(`${dayYmd}T00:00:00Z`).getUTCDay() + 6) % 7;
  const [{ data: bk }, { data: bl }, { data: oh }, { data: sh }] = await Promise.all([
    sb.from('bookings').select('id,starts_at,ends_at').eq('staff_id', staffId).lt('starts_at', b.toISOString()).gt('ends_at', a.toISOString()).not('status', 'in', '(cancelled,no_show)'),
    sb.from('staff_blocks').select('starts_at,ends_at').eq('staff_id', staffId).lt('starts_at', b.toISOString()).gt('ends_at', a.toISOString()),
    sb.from('opening_hours').select('*').eq('weekday', wd).maybeSingle(),
    sb.from('staff_shifts').select('start_time,end_time').eq('staff_id', staffId).eq('weekday', wd).maybeSingle(),
  ]);
  const mm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const busy = [...(bk ?? []).filter((x: any) => x.id !== ignoreBooking), ...(bl ?? [])].map((x) => ({ s: minutesOfDay(x.starts_at, salon.timezone), e: minutesOfDay(x.ends_at, salon.timezone) }));
  const open = !!oh?.is_open && !!sh;
  let from = oh?.is_open ? mm(oh.open_time) : 0, to = oh?.is_open ? mm(oh.close_time) : 0;
  if (sh) { from = Math.max(from, mm(sh.start_time)); to = Math.min(to, mm(sh.end_time)); }
  return { busy, open, from, to };
}

export async function rescheduleBooking(id: string, dayYmd: string, startMin: number): Promise<R> {
  const { sb, salon } = await requireCtx();
  const { data: b } = await sb.from('bookings').select('starts_at,ends_at').eq('id', id).single();
  if (!b) return { error: 'Booking not found.' };
  const dur = Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000);
  const hh = String(Math.floor(startMin / 60)).padStart(2, '0'), mi = String(startMin % 60).padStart(2, '0');
  const s = zonedToUtc(dayYmd, `${hh}:${mi}`, salon.timezone);
  const e = new Date(s.getTime() + dur * 60000);
  const { error } = await sb.from('bookings').update({ starts_at: s.toISOString(), ends_at: e.toISOString() }).eq('id', id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/calendar'); return { ok: true };
}

export async function createBlock(staffId: string, dayYmd: string, startMin: number, durMin: number, kind: string): Promise<R> {
  const { sb, salon } = await requireCtx();
  const hh = String(Math.floor(startMin / 60)).padStart(2, '0'), mi = String(startMin % 60).padStart(2, '0');
  const s = zonedToUtc(dayYmd, `${hh}:${mi}`, salon.timezone);
  const e = new Date(s.getTime() + durMin * 60000);
  const { error } = await sb.from('staff_blocks').insert({ salon_id: salon.id, staff_id: staffId, kind, starts_at: s.toISOString(), ends_at: e.toISOString() });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/calendar'); return { ok: true };
}
export async function deleteBlock(id: string): Promise<R> {
  const { sb } = await requireCtx();
  const { error } = await sb.from('staff_blocks').delete().eq('id', id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/calendar'); return { ok: true };
}

/** First free time today for a service (optionally with one team member). */
export async function walkinPlan(serviceId: string, staffId: string) {
  const { sb, salon } = await requireCtx();
  const today = ymdOf(new Date(), salon.timezone);
  const { data, error } = await sb.rpc('available_slots', { p_salon: salon.id, p_service_ids: [serviceId], p_staff: staffId === 'any' ? null : staffId, p_from: today, p_to: today, p_mode: 'staff' });
  if (error) return { error: friendly(error.message) };
  const now = Date.now();
  const rows = ((data ?? []) as any[]).filter((r) => new Date(r.starts_at).getTime() >= now - 5 * 60000).sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  if (!rows.length) return { none: true as const };
  const { data: st } = await sb.from('staff').select('id,name').eq('id', rows[0].staff_id).single();
  return { staffId: rows[0].staff_id as string, staff: st?.name ?? '', startsAt: rows[0].starts_at as string, label: time12(rows[0].starts_at, salon.timezone), nowish: new Date(rows[0].starts_at).getTime() - now <= 15 * 60000 };
}
export async function addWalkIn(name: string, serviceId: string, staffId: string): Promise<R> {
  const { sb, salon } = await requireCtx();
  name = name.trim(); if (!name) return { error: "Add the client's name." };
  if (!serviceId) return { error: 'Choose a service.' };
  const plan = await walkinPlan(serviceId, staffId);
  if ('error' in plan && plan.error) return { error: plan.error };
  if (!('startsAt' in plan)) return { error: 'No free time today for that service. Try another team member or book it for another day.' };
  const { data: c, error: ce } = await sb.from('clients').insert({ salon_id: salon.id, name }).select('id').single();
  if (ce) return { error: friendly(ce.message) };
  const { data, error } = await sb.rpc('create_booking', { p_salon: salon.id, p_client: c.id, p_staff: plan.staffId, p_starts_at: plan.startsAt, p_service_ids: [serviceId], p_source: 'staff', p_notes: 'Walk-in', p_mode: 'staff' });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/calendar');
  return { ok: true, id: data as string, note: `${name.split(' ')[0]} added with ${plan.staff.split(' ')[0]} at ${plan.label}` };
}
