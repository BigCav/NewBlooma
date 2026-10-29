'use server';
import { flushOutbox, sendCustomMessage } from '@/lib/notify';
import { releaseOnline, startOnline } from '@/lib/windcave';
import { headers } from 'next/headers';
import { dropEmptyThread, ensureThread, logStaffMessage, replyUrl } from '@/lib/conversation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCtx, friendly } from '@/lib/session';
import { CANCEL_REASONS } from '@/lib/cal';
import { zonedToUtc, minutesOfDay, ymd as ymdOf, time12 } from '@/lib/format';
import { buildCfg, buildClosed, buildHours, buildOffers, buildRecent, buildServices } from './base';

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
  if (status === 'cancelled') await flushOutbox();
  revalidatePath('/calendar'); revalidatePath(`/calendar/${id}`);
}

export async function startCheckout(fd: FormData) {
  const { sb } = await requireCtx();
  const id = String(fd.get('id'));
  const { data: existing } = await sb.from('sales').select('id').eq('booking_id', id).neq('status', 'refunded').maybeSingle();
  if (existing) redirect(`/sales?sale=${existing.id}&pay=1`);
  const { data, error } = await sb.rpc('create_sale', { p_booking: id, p_client: null, p_items: [], p_tip_pct: 0, p_description: null });
  if (error) redirect(`/calendar/${id}?err=${encodeURIComponent(friendly(error.message))}`);
  redirect(`/sales?sale=${data}&pay=1`);
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
export async function cancelBooking(id: string, reason: string): Promise<R> {
  const { sb } = await requireCtx();
  if (!(CANCEL_REASONS as readonly string[]).includes(reason)) return { error: 'Choose why it is being cancelled.' };
  const { error } = await sb.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: reason }).eq('id', id);
  if (error) return { error: friendly(error.message) };
  await flushOutbox();
  revalidatePath('/calendar'); return { ok: true };
}
export async function noShowBooking(id: string): Promise<R> {
  const { sb } = await requireCtx();
  const { data: b } = await sb.from('bookings').select('status,starts_at').eq('id', id).maybeSingle();
  if (!b) return { error: 'That booking no longer exists.' };
  if (!['pending', 'confirmed'].includes(b.status)) return { error: 'Only a booking that has not been checked in can be marked as a no-show.' };
  if (new Date(b.starts_at) > new Date()) return { error: 'You can mark a no-show once the appointment time has passed.' };
  const { error } = await sb.from('bookings').update({ status: 'no_show' }).eq('id', id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/calendar'); return { ok: true };
}

/** Move a booking between confirmed, checked in and started. A booking that still needs approval is approved first. */
export async function setBookingStatus(id: string, target: 'confirmed' | 'checked_in' | 'in_progress'): Promise<R> {
  const { sb } = await requireCtx();
  if (!['confirmed', 'checked_in', 'in_progress'].includes(target)) return { error: 'Choose a status.' };
  const { data: b } = await sb.from('bookings').select('status,starts_at').eq('id', id).maybeSingle();
  if (!b) return { error: 'That booking no longer exists.' };
  if (!['pending', 'confirmed', 'checked_in', 'in_progress'].includes(b.status)) return { error: 'This booking can no longer change status.' };
  if (b.status === target) return { ok: true };
  if (target !== 'confirmed' && new Date(b.starts_at).getTime() - Date.now() > 24 * 3600e3) return { error: 'You can check someone in on the day of their appointment.' };
  if (b.status === 'pending') {
    const r = await sb.rpc('confirm_booking', { p_booking: id });
    if (r.error) return { error: friendly(r.error.message) };
    if (target === 'confirmed') { revalidatePath('/calendar'); return { ok: true }; }
  }
  const { error } = await sb.from('bookings').update({ status: target }).eq('id', id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/calendar'); return { ok: true };
}

/** Busy intervals (minutes) and opening hours for one staff member on one day. */
/** Everything the new-appointment sheet needs, for opening it from pages other than the calendar. */
export async function loadNewAppt() {
  const { sb, salon, settings, staff } = await requireCtx();
  const [{ data: team }, { data: oh }, { data: svc }, { data: ss }, { data: sa }, { data: rc }, { data: cp }] = await Promise.all([
    sb.from('staff').select('id,name,role_title').eq('active', true).order('name'),
    sb.from('opening_hours').select('*'),
    sb.from('services').select('id,name,duration_min,price_cents,is_addon,service_categories(name)').eq('active', true).order('name'),
    sb.from('service_staff').select('service_id,staff_id'),
    sb.from('service_addons').select('addon_id,service_id'),
    sb.from('bookings').select('client_id,clients(name)').not('client_id', 'is', null).order('starts_at', { ascending: false }).limit(80),
    sb.from('closed_periods').select('starts_on,ends_on,reason').gte('ends_on', ymdOf(new Date(Date.now() - 2 * 86400000), salon.timezone)),
  ]);
  return {
    today: ymdOf(new Date(), salon.timezone), nowMin: minutesOfDay(new Date(), salon.timezone), tz: salon.timezone, slug: salon.slug,
    team: (team ?? []).map((t) => ({ id: t.id, name: t.name, role: t.role_title ?? '' })),
    hours: buildHours(oh), closed: buildClosed(cp, ymdOf(new Date(), salon.timezone)), services: buildServices(svc, sa), offers: buildOffers(ss), cfg: buildCfg(settings, staff.app_role), recent: buildRecent(rc),
  };
}

/** Text or email the client of a booking from the calendar. */
export async function messageBookingClient(bookingId: string, text: string): Promise<R> {
  const { sb, salon } = await requireCtx();
  text = text.trim();
  if (!text) return { error: 'Write a message first.' };
  if (text.length > 600) return { error: 'Keep the message under 600 characters.' };
  const { data: b } = await sb.from('bookings').select('client_id,clients(name,email,phone)').eq('id', bookingId).maybeSingle();
  const c = (b as any)?.clients;
  if (!c || !(b as any).client_id) return { error: 'That booking no longer exists.' };
  const th = await ensureThread(salon.id, (b as any).client_id, bookingId);
  const r = await sendCustomMessage(salon.id, c, text, undefined, replyUrl(th.token));
  if (!r.ok) { if (th.created) await dropEmptyThread(th.id); return { error: r.error }; }
  await logStaffMessage(salon.id, th.id, text);
  return { ok: true, note: `Message sent to ${String(c.name ?? 'the client').split(' ')[0]}` };
}

export async function dayAvailability(dayYmd: string, staffId: string, ignoreBooking?: string) {
  const { sb, salon } = await requireCtx();
  const a = zonedToUtc(dayYmd, '00:00', salon.timezone), b = zonedToUtc(dayYmd, '23:59:59', salon.timezone);
  const wd = (new Date(`${dayYmd}T00:00:00Z`).getUTCDay() + 6) % 7;
  const [{ data: bk }, { data: bl }, { data: oh }, { data: sh }, { data: cl }] = await Promise.all([
    sb.from('bookings').select('id,starts_at,ends_at').eq('staff_id', staffId).lt('starts_at', b.toISOString()).gt('ends_at', a.toISOString()).not('status', 'in', '(cancelled,no_show)'),
    sb.from('staff_blocks').select('starts_at,ends_at').eq('staff_id', staffId).lt('starts_at', b.toISOString()).gt('ends_at', a.toISOString()),
    sb.from('opening_hours').select('*').eq('weekday', wd).maybeSingle(),
    sb.from('staff_shifts').select('start_time,end_time').eq('staff_id', staffId).eq('weekday', wd).maybeSingle(),
    sb.from('closed_periods').select('reason').lte('starts_on', dayYmd).gte('ends_on', dayYmd).limit(1),
  ]);
  const mm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const busy = [...(bk ?? []).filter((x: any) => x.id !== ignoreBooking), ...(bl ?? [])].map((x) => ({ s: minutesOfDay(x.starts_at, salon.timezone), e: minutesOfDay(x.ends_at, salon.timezone) }));
  const closedWhy = cl?.length ? (cl[0].reason ?? '') : undefined;
  const open = !!oh?.is_open && !!sh && closedWhy === undefined;
  let from = oh?.is_open ? mm(oh.open_time) : 0, to = oh?.is_open ? mm(oh.close_time) : 0;
  if (sh) { from = Math.max(from, mm(sh.start_time)); to = Math.min(to, mm(sh.end_time)); }
  return { busy, open, from, to, closedWhy };
}

/** Why a staff member cannot take [startMin, startMin + dur) on a day, or '' if they can. */
async function slotProblem(dayYmd: string, staffId: string, startMin: number, dur: number, ignoreBooking?: string) {
  const a = await dayAvailability(dayYmd, staffId, ignoreBooking);
  if (a.closedWhy !== undefined) return 'The salon is closed that day' + (a.closedWhy ? ` (${a.closedWhy})` : '') + '.';
  if (!a.open) return 'That team member is not working that day.';
  if (startMin < a.from || startMin + dur > a.to) return 'That would run past closing time. Pick an earlier time.';
  if (a.busy.some((x) => startMin < x.e && x.s < startMin + dur)) return 'That time is already booked. Pick another time.';
  return '';
}

export async function rescheduleBooking(id: string, dayYmd: string, startMin: number): Promise<R> {
  const { sb, salon } = await requireCtx();
  const { data: b } = await sb.from('bookings').select('starts_at,ends_at,staff_id').eq('id', id).single();
  if (!b) return { error: 'Booking not found.' };
  const dur = Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000);
  const why = await slotProblem(dayYmd, b.staff_id, startMin, dur, id); if (why) return { error: why };
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
  // Blocking time over booked clients would leave them there with no warning.
  const { data: under } = await sb.from('bookings').select('clients(name)').eq('staff_id', staffId).in('status', ['pending', 'confirmed', 'checked_in', 'in_progress']).lt('starts_at', e.toISOString()).gt('ends_at', s.toISOString());
  if (under?.length) return { error: `${under.length === 1 ? 'There is an appointment' : 'There are ' + under.length + ' appointments'} in that time (${under.slice(0, 3).map((u: any) => String(u.clients?.name ?? 'Client').split(' ')[0]).join(', ')}${under.length > 3 ? ' and more' : ''}). Move or cancel ${under.length === 1 ? 'it' : 'them'} first, or use Running late.` };
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
export async function addWalkIn(name: string, clientId: string | null, serviceId: string, staffId: string): Promise<R> {
  const { sb, salon } = await requireCtx();
  name = name.trim(); if (!name) return { error: "Add the client's name." };
  if (!serviceId) return { error: 'Choose a service.' };
  const plan = await walkinPlan(serviceId, staffId);
  if ('error' in plan && plan.error) return { error: plan.error };
  if (!('startsAt' in plan)) return { error: 'No free time today for that service. Try another team member or book it for another day.' };
  // An existing client is only used when picked from the list; a typed name always makes a new one.
  let cid = clientId;
  if (cid) { const { data: ex } = await sb.from('clients').select('id').eq('id', cid).eq('salon_id', salon.id).maybeSingle(); if (!ex) return { error: 'That client no longer exists.' }; }
  else { const { data: c, error: ce } = await sb.from('clients').insert({ salon_id: salon.id, name }).select('id').single(); if (ce) return { error: friendly(ce.message) }; cid = c.id; }
  const { data, error } = await sb.rpc('create_booking', { p_salon: salon.id, p_client: cid, p_staff: plan.staffId, p_starts_at: plan.startsAt, p_service_ids: [serviceId], p_source: 'staff', p_notes: 'Walk-in', p_mode: 'staff' });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/calendar');
  return { ok: true, id: data as string, note: `${name.split(' ')[0]} added with ${plan.staff.split(' ')[0]} at ${plan.label}` };
}


/** Create (or recreate with a new tip) the sale for a booking and take payment. Card returns the sale id for the payment screen. */
export async function checkoutBooking(bookingId: string, method: 'card' | 'cash' | 'gift_card', tipPct: number, giftCode?: string, disc?: { kind: string; value: string; note: string }, services?: string[]): Promise<R & { saleId?: string; total?: number }> {
  const { sb } = await requireCtx();
  const { data: ex } = await sb.from('sales').select('id,status').eq('booking_id', bookingId).neq('status', 'refunded').maybeSingle();
  if (ex?.status === 'paid') return { error: 'This appointment is already paid.' };
  // A card page that was opened and closed without paying would otherwise keep the old sale locked.
  if (ex) await releaseOnline(ex.id);
  if (ex) { const v = await sb.rpc('void_pending_sale', { p_sale: ex.id }); if (v.error) return { error: friendly(v.error.message) }; }
  const { data: id, error } = await sb.rpc('create_sale', { p_booking: bookingId, p_client: null, p_items: [], p_tip_pct: tipPct, p_description: null });
  if (error) return { error: friendly(error.message) };
  // Services changed at the till: only the sale's lines change, never the booking.
  if (services?.length) {
    const sv = await sb.rpc('set_sale_services', { p_sale: id, p_services: services });
    if (sv.error) { await sb.rpc('void_pending_sale', { p_sale: id }); return { error: friendly(sv.error.message) }; }
    const t = await sb.rpc('set_sale_tip', { p_sale: id, p_pct: tipPct });
    if (t.error) { await sb.rpc('void_pending_sale', { p_sale: id }); return { error: friendly(t.error.message) }; }
  }
  if (disc && disc.kind !== 'none') {
    const v = Number(String(disc.value).replace(/[^0-9.]/g, ''));
    const d = await sb.rpc('set_sale_discount', { p_sale: id, p_kind: disc.kind, p_value: disc.kind === 'amount' ? Math.round(v * 100) : v || 0, p_note: disc.note });
    if (d.error) { await sb.rpc('void_pending_sale', { p_sale: id }); return { error: friendly(d.error.message) }; }
    const t = await sb.rpc('set_sale_tip', { p_sale: id, p_pct: tipPct });
    if (t.error) { await sb.rpc('void_pending_sale', { p_sale: id }); return { error: friendly(t.error.message) }; }
  }
  if (method === 'card') return { ok: true, saleId: id as string };
  if (method === 'gift_card' && !String(giftCode ?? '').trim()) { await sb.rpc('void_pending_sale', { p_sale: id }); return { error: 'Enter the gift card code.' }; }
  const done = await sb.rpc('complete_sale', { p_sale: id, p_method: method, p_gift_code: method === 'gift_card' ? String(giftCode).trim().toUpperCase() : null });
  if (done.error) { await sb.rpc('void_pending_sale', { p_sale: id }); return { error: friendly(done.error.message) }; }
  revalidatePath('/calendar'); revalidatePath('/sales');
  return { ok: true, saleId: id as string };
}

/** Express checkout: card, no tip, no discount, straight to the on-screen Windcave payment page. With only a terminal switched on it returns the sale so the Sales page can send it there. */
export async function payNowBooking(bookingId: string): Promise<R & { saleId?: string; url?: string }> {
  const r = await checkoutBooking(bookingId, 'card', 0);
  if (r.error || !r.saleId) return r;
  const { sb, salon } = await requireCtx();
  const { data: pay } = await sb.from('salon_payment_settings').select('online_cards_enabled').eq('salon_id', salon.id).maybeSingle();
  if (!pay?.online_cards_enabled) return { ok: true, saleId: r.saleId };
  const h = await headers();
  const o = await startOnline(r.saleId, process.env.NEXT_PUBLIC_APP_URL || `https://${h.get('x-forwarded-host') ?? h.get('host')}`);
  return o.error ? { error: o.error, saleId: r.saleId } : { ok: true, saleId: r.saleId, url: o.url };
}

/** Change the services on a booking (and optionally its start), and book services another team member performs as separate appointments. */
export async function editBooking(id: string, dayYmd: string, startMin: number, remove: string[], add: string[], extras: { serviceId: string; staffId: string; startMin: number }[]): Promise<R> {
  const { sb, salon } = await requireCtx();
  const { data: b } = await sb.from('bookings').select('id,client_id,staff_id,starts_at,ends_at').eq('id', id).single();
  if (!b) return { error: 'Booking not found.' };
  const { data: lines } = await sb.from('booking_services').select('service_id,duration_min,price_cents').eq('booking_id', id);
  const keep = (lines ?? []).filter((l) => !remove.includes(l.service_id));
  const { data: adds } = add.length ? await sb.from('services').select('id,duration_min,price_cents').in('id', add) : { data: [] as any[] };
  const dur = keep.reduce((a, l) => a + l.duration_min, 0) + (adds ?? []).reduce((a: number, l: any) => a + l.duration_min, 0);
  if (!keep.length && !(adds ?? []).length && !extras.length) return { error: 'Keep at least one service on the booking.' };
  // The database only stops two bookings overlapping, so opening hours, shifts and blocked time are checked here.
  if (dur > 0) { const why = await slotProblem(dayYmd, b.staff_id, startMin, dur, id); if (why) return { error: why }; }
  if (extras.length) {
    const { data: xs } = await sb.from('services').select('id,duration_min').in('id', extras.map((x) => x.serviceId));
    for (const x of extras) { const why = await slotProblem(dayYmd, x.staffId, x.startMin, (xs ?? []).find((s: any) => s.id === x.serviceId)?.duration_min ?? 0); if (why) return { error: why }; }
  }
  if (dur > 0) {
    const hh = String(Math.floor(startMin / 60)).padStart(2, '0'), mi = String(startMin % 60).padStart(2, '0');
    const s0 = zonedToUtc(dayYmd, `${hh}:${mi}`, salon.timezone);
    const up = await sb.rpc('edit_booking', { p_booking: id, p_starts_at: s0.toISOString(), p_remove: remove, p_add: add });
    if (up.error) return { error: friendly(up.error.message) };
  }
  for (const x of extras) {
    const hh = String(Math.floor(x.startMin / 60)).padStart(2, '0'), mi = String(x.startMin % 60).padStart(2, '0');
    const r = await sb.rpc('create_booking', { p_salon: salon.id, p_client: b.client_id, p_staff: x.staffId, p_starts_at: zonedToUtc(dayYmd, `${hh}:${mi}`, salon.timezone).toISOString(), p_service_ids: [x.serviceId], p_source: 'staff', p_notes: null, p_mode: 'staff' });
    if (r.error) return { error: friendly(r.error.message) };
  }
  if (dur === 0) { const c = await sb.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id); if (c.error) return { error: friendly(c.error.message) }; await flushOutbox(); }
  revalidatePath('/calendar'); return { ok: true };
}

/** Book the same services again with the same team member. */
export async function rebookBooking(id: string, dayYmd: string, startMin: number): Promise<R> {
  const { sb, salon } = await requireCtx();
  const { data: b } = await sb.from('bookings').select('client_id,staff_id').eq('id', id).single();
  const { data: lines } = await sb.from('booking_services').select('service_id,duration_min').eq('booking_id', id);
  if (!b || !lines?.length) return { error: 'Booking not found.' };
  const why = await slotProblem(dayYmd, b.staff_id, startMin, lines.reduce((a, l) => a + l.duration_min, 0)); if (why) return { error: why };
  const hh = String(Math.floor(startMin / 60)).padStart(2, '0'), mi = String(startMin % 60).padStart(2, '0');
  const { error } = await sb.rpc('create_booking', { p_salon: salon.id, p_client: b.client_id, p_staff: b.staff_id, p_starts_at: zonedToUtc(dayYmd, `${hh}:${mi}`, salon.timezone).toISOString(), p_service_ids: lines.map((l) => l.service_id), p_source: 'staff', p_notes: null, p_mode: 'staff' });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/calendar'); return { ok: true };
}


export type ClientHit = { id: string; name: string; sub: string };
/** Existing clients whose name, email or phone contains what was typed. */
export async function findClients(q: string): Promise<ClientHit[]> {
  const { sb } = await requireCtx();
  const needle = q.trim().replace(/[%,()*\\]/g, ' ').trim(); if (!needle) return [];
  const digits = needle.replace(/\D/g, '');
  const ors = [`name.ilike.%${needle}%`, `email.ilike.%${needle}%`, ...(digits.length >= 3 ? [`phone.ilike.%${digits}%`] : [])];
  const { data } = await sb.from('clients').select('id,name,email,phone').or(ors.join(',')).order('name').limit(6);
  return ((data ?? []) as any[]).map((c) => ({ id: c.id, name: c.name, sub: c.phone || c.email || '' }));
}

export type SearchHit = { id: string; dayYmd: string; start: number; client: string; services: string; staff: string; cat: string };
/** Find bookings by client, service or team member (past 30 days to next 90). */
export async function searchBookings(q: string): Promise<SearchHit[]> {
  const { sb, salon } = await requireCtx();
  const needle = q.trim().toLowerCase(); if (!needle) return [];
  const a = new Date(Date.now() - 180 * 86400000), b = new Date(Date.now() + 180 * 86400000);
  const digits = needle.replace(/\D/g, '');
  const { data } = await sb.from('bookings').select('id,ref_no,starts_at,staff(name),clients(name,phone),booking_services(services(name,service_categories(name)))')
    .gte('starts_at', a.toISOString()).lt('starts_at', b.toISOString()).not('status', 'in', '(cancelled,no_show)').order('starts_at').limit(1000);
  const hits: SearchHit[] = [];
  for (const x of (data ?? []) as any[]) {
    const lines = (x.booking_services ?? []) as any[];
    const services = lines.map((l) => l.services?.name).filter(Boolean).join(' + ');
    const staff = x.staff?.name ?? '', client = x.clients?.name ?? 'Client';
    const phone = String(x.clients?.phone ?? '').replace(/\D/g, '');
    if (!(client + ' ' + services + ' ' + (x.ref_no ?? '')).toLowerCase().includes(needle) && !(digits.length >= 3 && phone.includes(digits))) continue;
    hits.push({ id: x.id, dayYmd: ymdOf(x.starts_at, salon.timezone), start: minutesOfDay(x.starts_at, salon.timezone), client, services, staff, cat: lines[0]?.services?.service_categories?.name ?? '' });
    if (hits.length >= 12) break;
  }
  return hits;
}

/** New appointment: finds or creates the client, books the main services with one team member, and any other services as separate bookings. */
export async function createNewAppointment(name: string, clientId: string | null, staffId: string, dayYmd: string, startMin: number, serviceIds: string[], extras: { serviceId: string; staffId: string }[]): Promise<R> {
  const { sb, salon } = await requireCtx();
  name = name.trim(); if (!name) return { error: "Add the client's name." };
  if (!serviceIds.length) return { error: 'Choose a service.' };
  const durOf = async (ids: string[]) => ((await sb.from('services').select('duration_min').in('id', ids)).data ?? []).reduce((t: number, x: any) => t + x.duration_min, 0);
  for (const [sid, ids] of [[staffId, serviceIds], ...extras.map((x) => [x.staffId, [x.serviceId]] as const)] as const) {
    const why = await slotProblem(dayYmd, sid, startMin, await durOf([...ids])); if (why) return { error: why };
  }
  let cid = clientId;
  if (!cid) {
    // Never merge on name alone: two people can share one. An existing client is only used when picked from the list.
    const { data, error } = await sb.from('clients').insert({ salon_id: salon.id, name }).select('id').single(); if (error) return { error: friendly(error.message) }; cid = data.id;
  }
  const hh = String(Math.floor(startMin / 60)).padStart(2, '0'), mi = String(startMin % 60).padStart(2, '0');
  const at = zonedToUtc(dayYmd, `${hh}:${mi}`, salon.timezone).toISOString();
  const main = await sb.rpc('create_booking', { p_salon: salon.id, p_client: cid, p_staff: staffId, p_starts_at: at, p_service_ids: serviceIds, p_source: 'staff', p_notes: null, p_mode: 'staff' });
  if (main.error) return { error: friendly(main.error.message) };
  for (const x of extras) {
    const r = await sb.rpc('create_booking', { p_salon: salon.id, p_client: cid, p_staff: x.staffId, p_starts_at: at, p_service_ids: [x.serviceId], p_source: 'staff', p_notes: null, p_mode: 'staff' });
    if (r.error) return { error: 'The main appointment was added, but one extra service could not be booked: ' + friendly(r.error.message), id: main.data as string };
  }
  revalidatePath('/calendar');
  return { ok: true, id: main.data as string };
}


/**
 * A team member is running late: push everything that has not started on a day back by some minutes.
 * Checked first (closing time, shift end, blocked time, anyone already in the chair), then moved newest first so nothing overlaps on the way.
 */
export async function delayStaffDay(staffId: string, dayYmd: string, minutes: number, tell: boolean): Promise<R> {
  const { sb, salon } = await requireCtx();
  const tz = salon.timezone;
  if (![10, 15, 20, 30, 45, 60, 90, 120].includes(minutes)) return { error: 'Choose how late they are running.' };
  const a = zonedToUtc(dayYmd, '00:00', tz), z = zonedToUtc(dayYmd, '23:59:59', tz);
  const [{ data: all }, { data: blocks }, { data: st }, av] = await Promise.all([
    sb.from('bookings').select('id,client_id,starts_at,ends_at,status,clients(name,email,phone),booking_services(services(name))').eq('staff_id', staffId).not('status', 'in', '(cancelled,no_show)').gte('starts_at', a.toISOString()).lt('starts_at', z.toISOString()).order('starts_at', { ascending: false }),
    sb.from('staff_blocks').select('starts_at,ends_at').eq('staff_id', staffId).lt('starts_at', z.toISOString()).gt('ends_at', a.toISOString()),
    sb.from('staff').select('name').eq('id', staffId).maybeSingle(),
    dayAvailability(dayYmd, staffId),
  ]);
  const move = ((all ?? []) as any[]).filter((b) => b.status === 'pending' || b.status === 'confirmed');
  const stay = ((all ?? []) as any[]).filter((b) => !(b.status === 'pending' || b.status === 'confirmed'));
  if (!move.length) return { error: 'There is nothing left to move for that team member on that day.' };
  if (move.length > 40) return { error: 'That is too many appointments to move at once.' };
  if (!av.open) return { error: 'That team member is not working that day.' };
  const ms = minutes * 60000;
  const mm = (iso: string) => minutesOfDay(iso, tz);
  for (const b of move) {
    const ns = new Date(new Date(b.starts_at).getTime() + ms), ne = new Date(new Date(b.ends_at).getTime() + ms);
    const who = String(b.clients?.name ?? 'A client').split(' ')[0];
    if (mm(ne.toISOString()) > av.to || ymdOf(ne.toISOString(), tz) !== dayYmd) return { error: `${who}'s appointment would finish after closing (${time12(ne.toISOString(), tz)}). Move or cancel it first, or choose a shorter delay.` };
    if ((blocks ?? []).some((k: any) => ns < new Date(k.ends_at) && new Date(k.starts_at) < ne)) return { error: `${who}'s new time would land on blocked time. Remove the block first or choose a different delay.` };
    if (stay.some((o) => ns < new Date(o.ends_at) && new Date(o.starts_at) < ne)) return { error: `${who}'s new time would clash with an appointment that is already under way.` };
  }
  const done: any[] = [];
  for (const b of move) {
    const { error } = await sb.from('bookings').update({ starts_at: new Date(new Date(b.starts_at).getTime() + ms).toISOString(), ends_at: new Date(new Date(b.ends_at).getTime() + ms).toISOString() }).eq('id', b.id);
    if (error) {
      for (const d of done.reverse()) await sb.from('bookings').update({ starts_at: d.starts_at, ends_at: d.ends_at }).eq('id', d.id);
      return { error: friendly(error.message) };
    }
    done.push(b);
  }
  let told = 0, noContact = 0, failed = 0;
  if (tell) {
    const stylist = String(st?.name ?? 'Your stylist').split(' ')[0];
    for (const b of [...move].reverse()) {
      const c = b.clients;
      if (!c || (!c.email && !c.phone)) { noContact++; continue; }
      const svc = ((b.booking_services ?? []) as any[]).map((l) => l.services?.name).filter(Boolean).join(' + ') || 'appointment';
      const text = `Hi ${String(c.name ?? 'there').split(' ')[0]}, ${stylist} is running about ${minutes} minutes late today. Your ${svc} is now at ${time12(new Date(new Date(b.starts_at).getTime() + ms).toISOString(), tz)} instead of ${time12(b.starts_at, tz)}. Sorry about that, and thank you for your patience.`;
      try {
        const th = await ensureThread(salon.id, b.client_id, b.id);
        const r = await sendCustomMessage(salon.id, c, text, undefined, replyUrl(th.token));
        if (!r.ok) { if (th.created) await dropEmptyThread(th.id); failed++; continue; }
        await logStaffMessage(salon.id, th.id, text); told++;
      } catch { failed++; }
    }
  }
  revalidatePath('/calendar'); revalidatePath('/inbox');
  const parts = [`${move.length} appointment${move.length === 1 ? '' : 's'} moved ${minutes} minutes later`];
  if (tell) parts.push(`${told} client${told === 1 ? '' : 's'} told`);
  if (noContact) parts.push(`${noContact} with no email or phone`);
  if (failed) parts.push(`${failed} could not be messaged`);
  return { ok: true, note: parts.join(', ') };
}
