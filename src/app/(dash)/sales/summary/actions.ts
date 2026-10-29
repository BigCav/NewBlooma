'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx } from '@/lib/session';

/** Record the cash counted in the drawer for a day. The expected amount is worked out on the server, never taken from the page. */
export async function closeTill(day: string, dollars: string, note: string): Promise<{ error?: string; expected?: number; counted?: number }> {
  const { sb, staff } = await requireCtx();
  if (staff.app_role === 'stylist') return { error: 'Only the owner or reception can close the till.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: 'Choose a day.' };
  const n = Number(String(dollars).replace(/[^0-9.]/g, ''));
  if (!String(dollars).trim() || !Number.isFinite(n) || n < 0 || n > 1000000) return { error: 'Enter the cash you counted, like 250 or 250.50.' };
  const counted = Math.round(n * 100);
  const { data, error } = await sb.rpc('close_till', { p_day: day, p_counted: counted, p_note: note.trim().slice(0, 300) || null });
  if (error) return { error: error.message.includes('invalid_day') ? 'You can only close the till for today or an earlier day.' : 'Could not save the cash count.' };
  revalidatePath('/sales/summary');
  const r = data as { expected: number; counted: number };
  return { expected: r.expected, counted: r.counted };
}
