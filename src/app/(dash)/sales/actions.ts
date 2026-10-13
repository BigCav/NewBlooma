'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireCtx, requireOwner, friendly } from '@/lib/session';
import { startOnline, startTerminal, pollTerminal, cancelTerminal, refundCard } from '@/lib/windcave';

async function origin() { const h = await headers(); return process.env.NEXT_PUBLIC_APP_URL || h.get('origin') || `https://${h.get('host')}`; }
const back = (id: string, err?: string) => redirect(`/sales/${id}${err ? `?err=${encodeURIComponent(err)}` : ''}`);

export async function createRetailSale(_: unknown, fd: FormData) {
  const { sb } = await requireCtx();
  const items = [...fd.entries()].filter(([k, v]) => k.startsWith('qty_') && Number(v) > 0).map(([k, v]) => ({ product_id: k.slice(4), qty: Number(v) }));
  if (!items.length) return { error: 'Choose at least one product.' };
  const { data, error } = await sb.rpc('create_sale', { p_booking: null, p_client: String(fd.get('client_id') || '') || null, p_items: items, p_tip_pct: 0, p_description: String(fd.get('description') ?? '').trim() || null });
  if (error) return { error: friendly(error.message) };
  redirect(`/sales/${data}`);
}

export async function setTip(fd: FormData) {
  const { sb } = await requireCtx();
  const id = String(fd.get('id')), pct = Number(fd.get('pct'));
  const { data: s } = await sb.from('sales').select('booking_id,client_id,description,status,sale_items(product_id,qty)').eq('id', id).single();
  if (!s || s.status !== 'pending') return back(id);
  const items = (s.sale_items as any[]).filter((i) => i.product_id).map((i) => ({ product_id: i.product_id, qty: i.qty }));
  const v = await sb.rpc('void_pending_sale', { p_sale: id });
  if (v.error) return back(id, friendly(v.error.message));
  const { data, error } = await sb.rpc('create_sale', { p_booking: s.booking_id, p_client: s.client_id, p_items: items, p_tip_pct: pct, p_description: s.description });
  if (error) return back(id, friendly(error.message));
  redirect(`/sales/${data}`);
}

export async function payManual(fd: FormData) {
  const { sb } = await requireCtx();
  const id = String(fd.get('id')), method = String(fd.get('method'));
  const { error } = await sb.rpc('complete_sale', { p_sale: id, p_method: method, p_gift_code: String(fd.get('code') ?? '') || null });
  if (error) return back(id, friendly(error.message));
  revalidatePath('/sales'); back(id);
}

export async function payOnline(fd: FormData) {
  const { sb } = await requireCtx();
  const id = String(fd.get('id'));
  const { data: s } = await sb.from('sales').select('id').eq('id', id).single(); if (!s) return back(id);
  const r = await startOnline(id, await origin());
  if (r.error) return back(id, r.error);
  redirect(r.url!);
}

export async function terminalStart(id: string) { await requireCtx(); return startTerminal(id); }
export async function terminalPoll(txn: string) { await requireCtx(); return pollTerminal(txn); }
export async function terminalCancel(txn: string) { await requireCtx(); await cancelTerminal(txn); }

export async function voidSale(fd: FormData) {
  const { sb } = await requireCtx();
  const { error } = await sb.rpc('void_pending_sale', { p_sale: String(fd.get('id')) });
  if (error) return back(String(fd.get('id')), friendly(error.message));
  redirect('/sales');
}

export async function refund(fd: FormData) {
  const { sb } = await requireOwner();
  const id = String(fd.get('id'));
  const { data: s } = await sb.from('sales').select('method').eq('id', id).single();
  if (s?.method === 'card') { const r = await refundCard(id); if (r.error) return back(id, r.error); }
  else { const { error } = await sb.rpc('refund_sale', { p_sale: id }); if (error) return back(id, friendly(error.message)); }
  revalidatePath('/sales'); back(id);
}
