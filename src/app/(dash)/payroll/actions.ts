'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx, friendly } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { zonedToUtc } from '@/lib/format';
import { addDaysYmd } from '@/lib/cal';

type Res = { error?: string; notice?: string };
const hm = (iso: Date, tz: string) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: 'numeric', minute: '2-digit' }).formatToParts(iso); return `${p.find((x) => x.type === 'hour')!.value}:${p.find((x) => x.type === 'minute')!.value}`; };

export async function clockToggle(staffId: string): Promise<Res> {
  const { sb, salon, staff } = await requireCtx();
  if (staff.app_role !== 'owner' && staff.id !== staffId) return { error: 'You can only clock yourself in and out.' };
  const now = new Date();
  const { data: open } = await sb.from('timesheets').select('id').eq('staff_id', staffId).is('clock_out', null).maybeSingle();
  if (open) {
    const { error } = await sb.from('timesheets').update({ clock_out: now.toISOString() }).eq('id', open.id);
    if (error) return { error: friendly(error.message) };
    revalidatePath('/payroll'); return { notice: 'Clocked out' };
  }
  const { error } = await sb.from('timesheets').insert({ salon_id: salon.id, staff_id: staffId, clock_in: now.toISOString() });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/payroll'); return { notice: 'Clocked in at ' + hm(now, salon.timezone) };
}

export async function setRate(staffId: string, pct: number, from: string, to: string): Promise<Res> {
  const { sb, staff } = await requireCtx();
  if (staff.app_role !== 'owner') return { error: 'Only the owner can change commission rates.' };
  if (!(pct >= 0 && pct <= 100)) return { error: 'Rate must be between 0 and 100.' };
  const { data: paid } = await sb.from('payouts').select('id').eq('staff_id', staffId).eq('period_start', from).eq('period_end', to).maybeSingle();
  if (paid) return { error: 'That week is already paid, so its rate is locked.' };
  const { error } = await sb.from('staff').update({ commission_pct: pct }).eq('id', staffId);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/payroll'); return {};
}

export async function markPaid(staffId: string, from: string, to: string): Promise<Res> {
  const { sb, staff } = await requireCtx();
  if (staff.app_role !== 'owner') return { error: 'Only the owner can mark payouts as paid.' };
  const { error } = await sb.rpc('mark_payout_paid', { p_staff: staffId, p_from: from, p_to: to });
  if (error) return { error: error.message.includes('period_open') ? 'That week is not over yet.' : error.message.includes('already_paid') ? 'Already marked as paid.' : friendly(error.message) };
  revalidatePath('/payroll'); return { notice: 'Marked as paid' };
}

export type SheetRow = { id: string; inAt: string; outAt: string };
const LOCAL = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;
const localOf = (iso: string, tz: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)).replace(' ', 'T');

/** The clock-in and clock-out entries for one person in a pay week, in the salon's own time. */
export async function loadTimesheets(staffId: string, from: string, to: string): Promise<{ error?: string; rows?: SheetRow[] }> {
  const { sb, salon, staff } = await requireCtx();
  if (staff.app_role !== 'owner') return { error: 'Only the owner can edit timesheets.' };
  const a = zonedToUtc(from, '00:00', salon.timezone).toISOString(), b = zonedToUtc(addDaysYmd(to, 1), '00:00', salon.timezone).toISOString();
  const { data, error } = await sb.from('timesheets').select('id,clock_in,clock_out').eq('staff_id', staffId).eq('salon_id', salon.id).gte('clock_in', a).lt('clock_in', b).order('clock_in');
  if (error) return { error: friendly(error.message) };
  return { rows: (data ?? []).map((r) => ({ id: r.id, inAt: localOf(r.clock_in, salon.timezone), outAt: r.clock_out ? localOf(r.clock_out, salon.timezone) : '' })) };
}

async function weekPaid(sb: any, staffId: string, dayYmd: string) {
  const { data } = await sb.from('payouts').select('id').eq('staff_id', staffId).lte('period_start', dayYmd).gte('period_end', dayYmd).maybeSingle();
  return !!data;
}

/** Owner fixes a missed or wrong clock-in or clock-out, or adds a shift that was never clocked. */
export async function saveTimesheet(id: string | null, staffId: string, inAt: string, outAt: string): Promise<Res> {
  const { sb, salon, staff } = await requireCtx();
  if (staff.app_role !== 'owner') return { error: 'Only the owner can edit timesheets.' };
  if (!LOCAL.test(inAt) || (outAt && !LOCAL.test(outAt))) return { error: 'Enter the date and time for each entry.' };
  const { data: who } = await sb.from('staff').select('id').eq('id', staffId).eq('salon_id', salon.id).maybeSingle();
  if (!who) return { error: 'Team member not found.' };
  const tin = zonedToUtc(inAt.slice(0, 10), inAt.slice(11), salon.timezone);
  const tout = outAt ? zonedToUtc(outAt.slice(0, 10), outAt.slice(11), salon.timezone) : null;
  const now = Date.now();
  if (tin.getTime() > now + 60e3) return { error: 'Clock-in cannot be in the future.' };
  if (tout && tout.getTime() > now + 60e3) return { error: 'Clock-out cannot be in the future.' };
  if (tout && tout <= tin) return { error: 'Clock-out must be after clock-in.' };
  if (tout && tout.getTime() - tin.getTime() > 20 * 3600e3) return { error: 'That shift is over 20 hours. Check the times.' };
  if (await weekPaid(sb, staffId, inAt.slice(0, 10))) return { error: 'That week is already paid, so its hours are locked.' };
  const { data: others } = await sb.from('timesheets').select('id,clock_in,clock_out').eq('staff_id', staffId).neq('id', id ?? '00000000-0000-0000-0000-000000000000');
  const s = tin.getTime(), e = tout ? tout.getTime() : Infinity;
  if ((others ?? []).some((o) => s < (o.clock_out ? new Date(o.clock_out).getTime() : Infinity) && new Date(o.clock_in).getTime() < e)) return { error: 'That overlaps another entry for this person.' };
  const row = { clock_in: tin.toISOString(), clock_out: tout ? tout.toISOString() : null };
  const { error } = id
    ? await sb.from('timesheets').update(row).eq('id', id).eq('salon_id', salon.id).eq('staff_id', staffId)
    : await sb.from('timesheets').insert({ ...row, salon_id: salon.id, staff_id: staffId });
  if (error) return { error: error.code === '23505' ? 'This person is already clocked in. Give that entry a clock-out first.' : friendly(error.message) };
  revalidatePath('/payroll'); return { notice: id ? 'Entry saved' : 'Entry added' };
}

export async function deleteTimesheet(id: string): Promise<Res> {
  const { sb, salon, staff } = await requireCtx();
  if (staff.app_role !== 'owner') return { error: 'Only the owner can edit timesheets.' };
  const { data: t } = await sb.from('timesheets').select('id,staff_id,clock_in').eq('id', id).eq('salon_id', salon.id).maybeSingle();
  if (!t) return { error: 'That entry no longer exists.' };
  if (await weekPaid(sb, t.staff_id, localOf(t.clock_in, salon.timezone).slice(0, 10))) return { error: 'That week is already paid, so its hours are locked.' };
  const { error } = await supabaseAdmin().from('timesheets').delete().eq('id', id).eq('salon_id', salon.id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/payroll'); return { notice: 'Entry deleted' };
}
