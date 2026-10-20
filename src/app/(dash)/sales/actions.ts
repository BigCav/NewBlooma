'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCtx, friendly } from '@/lib/session';
import { releaseOnline, startOnline,startTerminal, pollTerminal, cancelTerminal, refundCard } from '@/lib/windcave';
import { sendCustomMessage } from '@/lib/notify';
import { dateLong } from '@/lib/format';
import { fmt } from './shared';

type Res = { error?: string; notice?: string };
async function origin() { const h = await headers(); return process.env.NEXT_PUBLIC_APP_URL || h.get('origin') || `https://${h.get('host')}`; }

export async function createRetailSale(_: unknown, fd: FormData) {
  const { sb } = await requireCtx();
  const items = [...fd.entries()].filter(([k, v]) => k.startsWith('qty_') && Number(v) > 0).map(([k, v]) => ({ product_id: k.slice(4), qty: Number(v) }));
  if (!items.length) return { error: 'Choose at least one product.' };
  const { data, error } = await sb.rpc('create_sale', { p_booking: null, p_client: String(fd.get('client_id') || '') || null, p_items: items, p_tip_pct: 0, p_description: String(fd.get('description') ?? '').trim() || null });
  if (error) return { error: friendly(error.message) };
  redirect(`/sales?sale=${data}&pay=1`);
}

/** Create a walk-in service sale. Payment is taken next with payFlow. */
export async function createWalkin(client: string, serviceId: string, tipPct: number): Promise<Res & { saleId?: string }> {
  const { sb } = await requireCtx();
  const { data, error } = await sb.rpc('create_walkin_sale', { p_client_name: client, p_service: serviceId, p_tip_pct: tipPct });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/sales');
  return { saleId: data as string };
}

/**
 * Take payment for an open sale. Cash and gift card settle at once; the terminal returns a transaction to poll;
 * on-screen card returns the hosted payment page to go to.
 */
export async function payFlow(saleId: string, method: 'terminal' | 'online' | 'cash' | 'gift_card', tipPct: number, code: string, disc?: { kind: string; value: string; note: string }): Promise<Res & { txn?: string; url?: string }> {
  const { sb } = await requireCtx();
  // A hosted payment page that was closed without paying would otherwise lock the sale.
  await releaseOnline(saleId);
  if (disc) {
    const v = Number(String(disc.value).replace(/[^0-9.]/g, ''));
    const d = await sb.rpc('set_sale_discount', { p_sale: saleId, p_kind: disc.kind, p_value: disc.kind === 'amount' ? Math.round(v * 100) : v || 0, p_note: disc.note });
    if (d.error) return { error: friendly(d.error.message) };
  }
  const t = await sb.rpc('set_sale_tip', { p_sale: saleId, p_pct: tipPct });
  if (t.error) return { error: friendly(t.error.message) };
  if (method === 'cash' || method === 'gift_card') {
    if (method === 'gift_card' && !code.trim()) return { error: 'Enter the gift card code.' };
    const { error } = await sb.rpc('complete_sale', { p_sale: saleId, p_method: method, p_gift_code: method === 'gift_card' ? code.trim() : null });
    if (error) return { error: friendly(error.message) };
    revalidatePath('/sales'); revalidatePath('/calendar');
    return { notice: 'Payment taken' };
  }
  if (method === 'terminal') { const r = await startTerminal(saleId); return r.error ? { error: r.error } : { txn: r.txn }; }
  const r = await startOnline(saleId, await origin());
  return r.error ? { error: r.error } : { url: r.url };
}

export async function terminalPoll(txn: string) { await requireCtx(); return pollTerminal(txn); }
export async function terminalCancel(txn: string) { await requireCtx(); await cancelTerminal(txn); }

export async function setPrice(saleId: string, dollars: string): Promise<Res> {
  const { sb } = await requireCtx();
  const n = Number(String(dollars).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return { error: 'Enter a price above zero, like 45 or 45.50.' };
  const { error } = await sb.rpc('set_sale_service_price', { p_sale: saleId, p_cents: Math.round(n * 100) });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/sales'); return { notice: 'Sale updated' };
}

export async function refundSale(saleId: string): Promise<Res> {
  const { sb, staff } = await requireCtx();
  if (staff.app_role !== 'owner') return { error: 'Only the owner can refund a sale.' };
  const { data: s } = await sb.from('sales').select('method').eq('id', saleId).single();
  if (s?.method === 'card') { const r = await refundCard(saleId); if (r.error) return { error: r.error }; }
  else { const { error } = await sb.rpc('refund_sale', { p_sale: saleId }); if (error) return { error: friendly(error.message) }; }
  revalidatePath('/sales'); return { notice: 'Refund issued' };
}

export async function sendReceipt(saleId: string): Promise<Res> {
  const { sb, salon } = await requireCtx();
  const { data: s } = await sb.from('sales').select('bookings(ref_no),status,method,subtotal_cents,discount_cents,discount_note,tip_cents,tax_cents,tax_inclusive,total_cents,paid_at,clients(name,phone,email),sale_items(label,qty,price_cents)').eq('id', saleId).single();
  if (!s) return { error: 'Sale not found.' };
  const c: any = s.clients;
  if (!c) return { error: 'This sale has no client to send a receipt to.' };
  const first = String(c.name).split(' ')[0];
  const lines = (s.sale_items as any[]).map((i) => `${i.label}${i.qty > 1 ? ` x${i.qty}` : ''} ${fmt(i.price_cents * i.qty)}`);
  if (s.discount_cents) lines.push(`Discount${s.discount_note ? ` (${s.discount_note})` : ''} -${fmt(s.discount_cents)}`);
  if (s.tip_cents) lines.push(`Tip ${fmt(s.tip_cents)}`);
  if (!s.tax_inclusive && s.tax_cents) lines.push(`Tax ${fmt(s.tax_cents)}`);
  const how = s.method === 'gift_card' ? 'gift card' : s.method;
  const text = `Hi ${first}, here is your receipt${s.paid_at ? ` from ${dateLong(s.paid_at, salon.timezone)}` : ''}.\n${lines.join('\n')}\nTotal ${fmt(s.total_cents)}${how ? `, paid by ${how}` : ''}. Thank you!`;
  const e = (x: string) => x.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
  const row = (l: string, v: string, bold = false, top = false) => `<tr><td style="padding:${top ? '12px' : '6px'} 0 6px;${top ? 'border-top:1px solid #E6E8EC;' : ''}font-size:${bold ? 16 : 14.5}px;font-weight:${bold ? 600 : 400};color:${bold ? '#0E1116' : '#3A414B'}">${e(l)}</td><td style="padding:${top ? '12px' : '6px'} 0 6px;${top ? 'border-top:1px solid #E6E8EC;' : ''}text-align:right;white-space:nowrap;font-size:${bold ? 16 : 14.5}px;font-weight:${bold ? 600 : 400}">${e(v)}</td></tr>`;
  const rows = [
    ...(s.sale_items as any[]).map((i) => row(`${i.label}${i.qty > 1 ? ` × ${i.qty}` : ''}`, fmt(i.price_cents * i.qty))),
    ...(s.discount_cents ? [row(`Discount${s.discount_note ? ` (${s.discount_note})` : ''}`, '-' + fmt(s.discount_cents))] : []),
    ...(s.tip_cents ? [row('Tip', fmt(s.tip_cents))] : []),
    ...(!s.tax_inclusive && s.tax_cents ? [row('Tax', fmt(s.tax_cents))] : []),
    row('Total', fmt(s.total_cents), true, true),
    ...(s.tax_inclusive && s.tax_cents ? [`<tr><td colspan="2" style="padding:0 0 4px;font-size:12.5px;color:#5E6673">Includes ${e(fmt(s.tax_cents))} tax</td></tr>`] : []),
  ].join('');
  const when = s.paid_at ? dateLong(s.paid_at, salon.timezone) : '';
  const html = `<div style="font-size:15px;line-height:1.5;margin-bottom:4px">Hi ${e(first)}, thanks for visiting. Here is your receipt.</div><div style="font-size:13px;color:#5E6673;margin-bottom:16px">${[when, how ? 'Paid by ' + e(how) : ''].filter(Boolean).join(' · ')}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows}</table>`;
  const r = await sendCustomMessage(salon.id, { phone: c.phone, email: c.email }, text, { subject: `Your receipt from ${salon.name}`, html, footer: (s as any).bookings?.ref_no ? `Booking B-${(s as any).bookings.ref_no}` : undefined });
  return r.ok ? { notice: `Receipt sent to ${first}` } : { error: r.error };
}
