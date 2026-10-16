'use server';
import { revalidatePath } from 'next/cache';
import { requireOwner, friendly } from '@/lib/session';

type Res = { error?: string; id?: string; notice?: string };

export async function issueGiftCard(i: { amount: string; name: string; code: string }): Promise<Res> {
  const { sb, salon } = await requireOwner();
  const n = Number(String(i.amount).replace(/[^0-9.]/g, ''));
  const code = i.code.trim().toUpperCase();
  if (!Number.isFinite(n) || n <= 0) return { error: 'Choose or enter an amount.' };
  if (n > 10000) return { error: 'That amount is too large.' };
  if (code.length < 4) return { error: 'Codes need at least 4 characters.' };
  if (!/^[A-Z0-9-]+$/.test(code)) return { error: 'Codes can only use letters, numbers and dashes.' };
  const cents = Math.round(n * 100);
  const { data, error } = await sb.from('gift_cards').insert({ salon_id: salon.id, code, balance_cents: cents, original_cents: cents, for_name: i.name.trim().slice(0, 80) || null }).select('id').single();
  if (error) return { error: error.code === '23505' ? 'That code is already in use. Try a new one.' : friendly(error.message) };
  revalidatePath('/gift-cards');
  return { id: data.id, notice: 'Gift card issued' };
}

export async function voidGiftCard(id: string): Promise<Res> {
  const { sb, salon } = await requireOwner();
  const { data: g } = await sb.from('gift_cards').select('id,balance_cents,voided_at').eq('id', id).eq('salon_id', salon.id).maybeSingle();
  if (!g) return { error: 'Gift card not found.' };
  if (g.voided_at) return { error: 'This card is already voided.' };
  const { error } = await sb.from('gift_cards').update({ voided_cents: g.balance_cents, balance_cents: 0, voided_at: new Date().toISOString() }).eq('id', id).eq('balance_cents', g.balance_cents);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/gift-cards');
  return { notice: 'Gift card voided' };
}
