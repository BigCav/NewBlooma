'use server';
import { revalidatePath } from 'next/cache';
import { requireOwner, friendly } from '@/lib/session';
import { toCents } from '@/lib/format';

export async function issueGiftCard(_: unknown, fd: FormData) {
  const { sb, salon } = await requireOwner();
  const code = String(fd.get('code') ?? '').trim().toUpperCase(), amount = toCents(fd.get('amount'));
  if (code.length < 4 || amount <= 0) return { error: 'Enter a code (4+ characters) and an amount.' };
  const { error } = await sb.from('gift_cards').insert({ salon_id: salon.id, code, balance_cents: amount });
  if (error) return { error: error.code === '23505' ? 'That code already exists.' : friendly(error.message) };
  revalidatePath('/gift-cards'); return { ok: 'Gift card issued.' };
}
