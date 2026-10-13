'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx, requireOwner, friendly } from '@/lib/session';

export async function clock(fd: FormData) {
  const { sb, salon, staff } = await requireCtx();
  if (fd.get('act') === 'in') await sb.from('timesheets').insert({ salon_id: salon.id, staff_id: staff.id, clock_in: new Date().toISOString() });
  else await sb.from('timesheets').update({ clock_out: new Date().toISOString() }).eq('staff_id', staff.id).is('clock_out', null);
  revalidatePath('/payroll');
}
export async function markPaid(fd: FormData) {
  const { sb } = await requireOwner();
  const { error } = await sb.rpc('mark_payout_paid', { p_staff: String(fd.get('staff')), p_from: String(fd.get('from')), p_to: String(fd.get('to')) });
  revalidatePath('/payroll');
  if (error) console.error(friendly(error.message));
}
