'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx, requireOwner, friendly } from '@/lib/session';
import { toCents } from '@/lib/format';

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function saveProduct(_: unknown, fd: FormData) {
  const { sb, salon } = await requireOwner();
  const id = s(fd, 'id');
  const row = { salon_id: salon.id, name: s(fd, 'name'), brand: s(fd, 'brand') || null, category: s(fd, 'category') || null, sku: s(fd, 'sku') || null,
    price_cents: toCents(fd.get('price')), stock: Math.trunc(Number(fd.get('stock') || 0)), reorder_level: Math.trunc(Number(fd.get('reorder_level') || 0)) };
  if (!row.name) return { error: 'Enter a product name.' };
  const { error } = id ? await sb.from('products').update(row).eq('id', id) : await sb.from('products').insert(row);
  if (error) return { error: error.code === '23505' ? 'That SKU is already used.' : friendly(error.message) };
  revalidatePath('/products'); return { ok: id ? 'Saved.' : 'Product added.' };
}
export async function adjustStock(fd: FormData) {
  const { sb } = await requireCtx();
  const id = s(fd, 'id'), delta = Number(fd.get('delta'));
  const { data: p } = await sb.from('products').select('stock').eq('id', id).single();
  if (p && Number.isFinite(delta)) await sb.from('products').update({ stock: p.stock + delta }).eq('id', id);
  revalidatePath('/products');
}
export async function setProductActive(fd: FormData) {
  const { sb } = await requireOwner();
  await sb.from('products').update({ active: fd.get('active') === 'true' }).eq('id', s(fd, 'id'));
  revalidatePath('/products');
}
export async function issueGiftCard(_: unknown, fd: FormData) {
  const { sb, salon } = await requireOwner();
  const code = s(fd, 'code').toUpperCase(), amount = toCents(fd.get('amount'));
  if (code.length < 4 || amount <= 0) return { error: 'Enter a code (4+ characters) and an amount.' };
  const { error } = await sb.from('gift_cards').insert({ salon_id: salon.id, code, balance_cents: amount });
  if (error) return { error: error.code === '23505' ? 'That code already exists.' : friendly(error.message) };
  revalidatePath('/products'); return { ok: 'Gift card issued.' };
}
