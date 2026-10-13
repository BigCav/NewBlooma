'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx } from '@/lib/session';

export async function handleItem(fd: FormData) {
  const { sb } = await requireCtx();
  const id = String(fd.get('id')), act = String(fd.get('act'));
  const bookingId = String(fd.get('booking') ?? '');
  if (act === 'approve' && bookingId) await sb.rpc('confirm_booking', { p_booking: bookingId });
  else if (act === 'decline' && bookingId) await sb.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', bookingId);
  await sb.from('inbox_items').update({ unread: false, status: act === 'decline' ? 'declined' : 'handled' }).eq('id', id);
  revalidatePath('/inbox'); revalidatePath('/', 'layout');
}
export async function markRead(fd: FormData) {
  const { sb } = await requireCtx();
  await sb.from('inbox_items').update({ unread: false }).eq('id', String(fd.get('id')));
  revalidatePath('/inbox'); revalidatePath('/', 'layout');
}
