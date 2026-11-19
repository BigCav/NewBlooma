'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCtx, friendly, ownsTxn } from '@/lib/session';
import { getCreds, releaseOnline, startOnline, startTerminal, terminalInFlight, refundByCard, pollTerminal, pressTerminalButton, cancelTerminal, storedReceipts, terminalMerchantReceipt } from '@/lib/windcave';
import { latestReceipt, receiptLines, type HitReceipt } from '@/lib/hit-receipt';
import { sendCustomMessage } from '@/lib/notify';
import { mailP } from '@/lib/email-layout';
import { cardReceiptBody, itemisedEmail } from '@/lib/receipt-email';
import { cardReceiptPdf } from '@/lib/receipt-pdf';
import { dateLong, dollars, toCents } from '@/lib/format';
import { bookingRef } from '@/lib/display';
import { firstName } from '@/lib/people';

type Res = { error?: string; notice?: string };
async function origin() { const h = await headers(); return process.env.NEXT_PUBLIC_APP_URL || `https://${h.get('x-forwarded-host') ?? h.get('host')}`; }

export async function createRetailSale(_: unknown, fd: FormData) {
  const { sb } = await requireCtx();
  const items = [...fd.entries()].filter(([k, v]) => k.startsWith('qty_') && Number(v) > 0).map(([k, v]) => ({ product_id: k.slice(4), qty: Number(v) }));
  if (!items.length) return { error: 'Choose at least one product.' };
  const { data, error } = await sb.rpc('create_sale', { p_booking: null, p_client: String(fd.get('client_id') || '') || null, p_items: items, p_tip_pct: 0, p_description: String(fd.get('description') ?? '').trim() || null });
  if (error) return { error: friendly(error.message) };
  redirect(`/sales?sale=${data}&pay=1`);
}

/** Create a walk-in service sale. Payment is taken next with payFlow. */
export async function createWalkin(client: string, clientId: string | null, serviceId: string, tipPct: number): Promise<Res & { saleId?: string }> {
  const { sb } = await requireCtx();
  const { data, error } = await sb.rpc('create_walkin_sale', { p_client_name: client, p_service: serviceId, p_tip_pct: tipPct, p_client: clientId });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/sales');
  return { saleId: data as string };
}

/**
 * Take payment for an open sale. Cash and gift card settle at once; the terminal returns a transaction to poll;
 * on-screen card returns the hosted payment page to go to.
 */
export async function payFlow(saleId: string, method: 'terminal' | 'online' | 'cash' | 'gift_card', tipPct: number, code: string, disc?: { kind: string; value: string; note: string }, products?: { productId: string; qty: number }[], services?: string[], packs?: { clientPackageId: string; serviceId: string }[]): Promise<Res & { txn?: string; url?: string }> {
  const { sb, salon } = await requireCtx();
  // With a card terminal switched on, every card payment goes to it, never to the on-screen page.
  if (method === 'online' && (await getCreds(salon.id)).terminalEnabled) method = 'terminal';
  // A card payment already on the terminal: watch that one. Starting another, or taking cash, could charge the customer twice.
  const open = await terminalInFlight(saleId);
  if (open) return { txn: open };
  // A hosted payment page that was closed without paying would otherwise lock the sale.
  await releaseOnline(saleId);
  // Services changed at the till: only the sale's lines change, never the booking.
  if (services?.length) {
    const sv = await sb.rpc('set_sale_services', { p_sale: saleId, p_services: services });
    if (sv.error) return { error: friendly(sv.error.message) };
  }
  // Products changed at the till: only the sale's product lines change, before the discount and tip are worked out.
  if (products) {
    const p = await sb.rpc('set_sale_products', { p_sale: saleId, p_items: products.filter((x) => x.qty > 0).map((x) => ({ product_id: x.productId, qty: Math.floor(x.qty) })) });
    if (p.error) return { error: friendly(p.error.message) };
  }
  // Visits covered by a package: those service lines become nothing to pay. A sale with nothing left to pay is closed on the spot.
  if (packs?.length) {
    // A package already used on this sale (an earlier attempt that did not finish) is not used a second time.
    const { data: used } = await sb.from('package_uses').select('client_package_id').eq('sale_id', saleId);
    const todo = packs.filter((x) => !(used ?? []).some((u: any) => u.client_package_id === x.clientPackageId));
    if (todo.length) {
      const ap = await sb.rpc('apply_packages_to_sale', { p_sale: saleId, p_uses: todo.map((x) => ({ client_package_id: x.clientPackageId, service_id: x.serviceId })) });
      if (ap.error) return { error: friendly(ap.error.message) };
    }
    const { data: left } = await sb.from('sales').select('total_cents').eq('id', saleId).single();
    if (left && left.total_cents === 0) {
      const done = await sb.rpc('complete_sale', { p_sale: saleId, p_method: 'package', p_gift_code: null });
      if (done.error) return { error: friendly(done.error.message) };
      revalidatePath('/sales'); revalidatePath('/calendar'); revalidatePath('/packages');
      return { notice: 'Payment taken' };
    }
  }
  if (disc) {
    const v = Number(String(disc.value).replace(/[^0-9.]/g, ''));
    const d = await sb.rpc('set_sale_discount', { p_sale: saleId, p_kind: disc.kind, p_value: disc.kind === 'amount' ? toCents(disc.value) : v || 0, p_note: disc.note });
    if (d.error) return { error: friendly(d.error.message) };
  }
  const t = await sb.rpc('set_sale_tip', { p_sale: saleId, p_pct: tipPct });
  if (t.error) return { error: friendly(t.error.message) };
  if (method === 'cash' || method === 'gift_card') {
    if (method === 'gift_card' && !code.trim()) return { error: 'Enter the gift card code.' };
    const { error } = await sb.rpc('complete_sale', { p_sale: saleId, p_method: method, p_gift_code: method === 'gift_card' ? code.trim().toUpperCase() : null });
    if (error) return { error: friendly(error.message) };
    revalidatePath('/sales'); revalidatePath('/calendar');
    return { notice: 'Payment taken' };
  }
  if (method === 'terminal') { const r = await startTerminal(saleId, await origin()); return r.error ? { error: r.error } : { txn: r.txn }; }
  const r = await startOnline(saleId, await origin());
  return r.error ? { error: r.error } : { url: r.url };
}

export async function terminalPoll(txn: string) { if (!(await ownsTxn(txn))) return { state: 'error' as const }; return pollTerminal(txn); }
/** The receipts the terminal sent for a payment or refund, as saved (exactly as received). */
export async function cardReceipts(txn: string): Promise<{ receipts: HitReceipt[] }> { return (await ownsTxn(txn)) ? { receipts: await storedReceipts(txn) } : { receipts: [] }; }
/** The merchant copy of a payment's receipt, asked for from the terminal. */
export async function cardMerchantReceipt(txn: string): Promise<{ receipt?: HitReceipt; error?: string }> { return (await ownsTxn(txn)) ? terminalMerchantReceipt(txn) : { error: 'Payment not found.' }; }
/** Emails the receipt exactly as the terminal sent it (the customer's copy, or the merchant copy). */
export async function emailCardReceipt(txn: string, which: 'customer' | 'merchant', to = ''): Promise<Res & { needsEmail?: boolean }> {
  const { sb, salon } = await requireCtx();
  if (!(await ownsTxn(txn))) return { error: 'Payment not found.' };
  let addr = to.trim();
  // No address typed: it goes to the email on the sale's client. A walk-in with none on file is asked for one.
  if (!addr) {
    const { data: own } = await sb.from('card_payments').select('sales(clients(email))').eq('txn_ref', txn).maybeSingle();
    addr = String((own as any)?.sales?.clients?.email ?? '').trim();
    if (!addr) return { needsEmail: true };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr) || addr.length > 254) return { error: 'Enter a valid email address.' };
  let r: HitReceipt | undefined;
  if (which === 'merchant') { const m = await terminalMerchantReceipt(txn); if (m.error) return { error: m.error }; r = m.receipt; }
  else r = latestReceipt(await storedReceipts(txn));
  if (!r) return { error: 'There is no receipt for this payment.' };
  const slipLines = receiptLines(r.text, r.width);
  const eftpos = slipLines.join('\n');
  // A payment's email lists what was bought first (the same itemised receipt as Send receipt), then the card slip exactly as the terminal sent it.
  const { data: own } = txn.startsWith('TM') && which === 'customer' ? await sb.from('card_payments').select('sale_id').eq('txn_ref', txn).maybeSingle() : { data: null };
  const it = own?.sale_id ? await itemisedReceipt(sb, own.sale_id, salon.timezone) : null;
  const refund = txn.startsWith('RF');
  const attached = refund ? 'Your card refund receipt is attached as a PDF.' : which === 'merchant' ? 'The merchant copy of the card receipt is attached as a PDF.' : 'Your card receipt is attached as a PDF.';
  // The plain-text version of the email carries the slip too, for mail apps that show no attachments.
  const text = `${it ? it.text + '\n\n' : ''}${attached}\n\n${eftpos}`;
  const html = it ? cardReceiptBody(it) : mailP(attached);
  // The card receipt itself is a PDF attachment: the terminal's lines exactly as sent, on one receipt-sized page.
  const pdf = Buffer.from(await cardReceiptPdf(slipLines, r.width, refund ? 'Card refund receipt' : which === 'merchant' ? 'Merchant copy' : 'Card receipt')).toString('base64');
  const filename = refund ? 'refund-receipt.pdf' : which === 'merchant' ? 'merchant-copy.pdf' : 'card-receipt.pdf';
  const sent = await sendCustomMessage(salon.id, { email: addr }, text, { subject: it ? `Your receipt from ${salon.name}` : `Your card receipt from ${salon.name}`, heading: it ? 'Your receipt' : 'Your card receipt', html, footer: it?.refNo ? `${salon.name} · Booking ${bookingRef(it.refNo)}` : undefined, attachments: [{ filename, content: pdf }] });
  return sent.ok ? { notice: 'Receipt sent to ' + addr } : { error: sent.error };
}
export async function terminalCancel(txn: string) { if (await ownsTxn(txn)) await cancelTerminal(txn); }
export async function terminalPress(txn: string, name: string, label: string) { if (await ownsTxn(txn)) await pressTerminalButton(txn, name, label); }

export async function setPrice(saleId: string, amount: string): Promise<Res> {
  const { sb } = await requireCtx();
  if (await terminalInFlight(saleId)) return { error: 'A card payment is in progress on the terminal for this sale. Wait for it to finish first.' };
  const cents = toCents(amount);
  if (cents < 1) return { error: 'Enter a price above zero, like 45 or 45.50.' };
  await releaseOnline(saleId);
  const { error } = await sb.rpc('set_sale_service_price', { p_sale: saleId, p_cents: cents });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/sales'); return { notice: 'Sale saved' };
}

/** `unmatched`: refund to a different card than the one that paid (the terminal asks for it). Owner only, and only for a payment taken on the terminal. */
export async function refundSale(saleId: string, unmatched = false): Promise<Res & { txn?: string }> {
  const { sb, staff } = await requireCtx();
  if (staff.app_role !== 'owner') return { error: 'Only the owner can refund a sale.' };
  const { data: s } = await sb.from('sales').select('method').eq('id', saleId).single();
  // A terminal refund runs on the terminal: hand back the reference to watch instead of waiting here.
  if (unmatched && s?.method !== 'card') return { error: 'Only a card payment can be refunded to a different card.' };
  if (s?.method === 'card') { const r = await refundByCard(saleId, await origin(), unmatched); if (r.error) return { error: r.error }; if (r.txn) return { txn: r.txn }; }
  else { const { error } = await sb.rpc('refund_sale', { p_sale: saleId }); if (error) return { error: friendly(error.message) }; }
  revalidatePath('/sales'); return { notice: 'Refund issued' };
}

/** A sale with its itemised receipt made up for an email (see lib/receipt-email), or null if there is no such sale. */
async function itemisedReceipt(sb: any, saleId: string, tz: string) {
  const { data: s } = await sb.from('sales').select('bookings(ref_no),status,method,subtotal_cents,discount_cents,discount_note,tip_cents,tax_cents,tax_inclusive,total_cents,paid_at,clients(name,phone,email),sale_items(label,qty,price_cents)').eq('id', saleId).single();
  if (!s) return null;
  const c: any = s.clients;
  return { c, refNo: (s.bookings?.ref_no as number | undefined) ?? null, ...itemisedEmail({ ...s, clientName: c?.name }, tz) };
}

export async function sendReceipt(saleId: string): Promise<Res> {
  const { sb, salon } = await requireCtx();
  const it = await itemisedReceipt(sb, saleId, salon.timezone);
  if (!it) return { error: 'Sale not found.' };
  if (!it.c) return { error: 'This sale has no client to send a receipt to.' };
  const text = `Hi ${it.first}, here is your receipt${it.when ? ` from ${it.when}` : ''}.\n${it.text} Thank you!`;
  // A sale paid on the terminal: the card receipt the terminal sent goes along as a PDF.
  const { data: cp } = await sb.from('card_payments').select('txn_ref').eq('sale_id', saleId).eq('kind', 'terminal').eq('status', 'approved').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const slip = cp?.txn_ref ? latestReceipt(await storedReceipts(cp.txn_ref)) : undefined;
  const attachments = slip ? [{ filename: 'card-receipt.pdf', content: Buffer.from(await cardReceiptPdf(receiptLines(slip.text, slip.width), slip.width)).toString('base64') }] : undefined;
  const html = mailP(`Hi ${it.first}, thanks for visiting. Here is your receipt.`) + it.meta + it.table
    + (slip ? `<p style="margin:18px 0 0;font-size:13.5px;color:#5E6673">Your card receipt is attached as a PDF.</p>` : '');
  const r = await sendCustomMessage(salon.id, { phone: it.c.phone, email: it.c.email }, text, { subject: `Your receipt from ${salon.name}`, heading: 'Your receipt', html, footer: it.refNo ? `${salon.name} · Booking ${bookingRef(it.refNo)}` : undefined, attachments });
  return r.ok ? { notice: `Receipt sent to ${it.first}` } : { error: r.error };
}
