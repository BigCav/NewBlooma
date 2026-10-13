'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx, friendly } from '@/lib/session';

type Res = { error?: string; notice?: string; id?: string; stock?: number };
const price = (v: string) => { const n = Number(String(v).replace(/[^0-9.]/g, '')); return Number.isFinite(n) && String(v).trim() !== '' ? Math.round(n * 100) : NaN; };
const whole = (v: string) => (String(v).trim() === '' ? NaN : Math.trunc(Number(v)));

export async function adjustStock(id: string, delta: number, notice?: string): Promise<Res> {
  const { sb } = await requireCtx();
  const { data, error } = await sb.rpc('adjust_product_stock', { p_product: id, p_delta: delta });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/products'); return { stock: data as number, notice };
}

export async function saveProduct(id: string, f: { name: string; brand: string; price: string; reorder: string }): Promise<Res> {
  const { sb, staff } = await requireCtx();
  if (staff.app_role !== 'owner') return { error: 'Only the owner can edit products.' };
  const cents = price(f.price), reorder = whole(f.reorder);
  if (!f.name.trim()) return { error: 'Add a product name.' };
  if (isNaN(cents) || cents < 0) return { error: 'Enter a price, like 24 or 24.50.' };
  if (isNaN(reorder) || reorder < 0) return { error: 'Enter a reorder level of 0 or more.' };
  const { error } = await sb.from('products').update({ name: f.name.trim(), brand: f.brand.trim() || null, price_cents: cents, reorder_level: reorder }).eq('id', id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/products'); return { notice: 'Product updated' };
}

export async function createProduct(f: { name: string; brand: string; cat: string; price: string; stock: string; reorder: string }): Promise<Res> {
  const { sb, salon, staff } = await requireCtx();
  if (staff.app_role !== 'owner') return { error: 'Only the owner can add products.' };
  const cents = price(f.price), stock = whole(f.stock), reorder = whole(f.reorder);
  if (!f.name.trim()) return { error: 'Add a product name.' };
  if (isNaN(cents) || cents < 0) return { error: 'Enter a price, like 24 or 24.50.' };
  if (isNaN(stock) || stock < 0) return { error: 'Enter the starting stock, 0 or more.' };
  if (isNaN(reorder) || reorder < 0) return { error: 'Enter a reorder level of 0 or more.' };
  const { data: skus } = await sb.from('products').select('sku').like('sku', 'NP-%');
  let n = Math.max(1000, ...(skus ?? []).map((r) => Number(String(r.sku).slice(3)) || 0));
  for (let i = 0; i < 5; i++) {
    n += 1;
    const { data, error } = await sb.from('products').insert({ salon_id: salon.id, name: f.name.trim(), brand: f.brand.trim() || null, category: f.cat || null, sku: `NP-${n}`, price_cents: cents, stock, reorder_level: reorder }).select('id').single();
    if (!error) { revalidatePath('/products'); return { id: data.id, notice: 'Product added' }; }
    if (error.code !== '23505') return { error: friendly(error.message) };
  }
  return { error: 'Could not pick a free SKU. Try again.' };
}
