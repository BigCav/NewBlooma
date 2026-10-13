'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx, friendly } from '@/lib/session';

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
