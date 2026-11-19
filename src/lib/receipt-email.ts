// The receipt emails: the itemised receipt (what was bought) and, for a card payment, the card slip the terminal sent, under it.
import { dateLong, dollars } from '@/lib/format';
import { esc, mailP } from '@/lib/email-layout';
import { firstName } from '@/lib/people';

export type SaleForReceipt = {
  method: string | null; discount_cents: number; discount_note: string | null; tip_cents: number; tax_cents: number; tax_inclusive: boolean; total_cents: number; paid_at: string | null;
  sale_items: { label: string; qty: number; price_cents: number }[]; clientName?: string | null;
};

/** A sale's itemised receipt (services, discount, tip, GST, total) as plain text and as email html. */
export function itemisedEmail(s: SaleForReceipt, tz: string) {
  const first = firstName(s.clientName, 'there');
  const lines = s.sale_items.map((i) => `${i.label}${i.qty > 1 ? ` x${i.qty}` : ''} ${dollars(i.price_cents * i.qty)}`);
  if (s.discount_cents) lines.push(`Discount${s.discount_note ? ` (${s.discount_note})` : ''} -${dollars(s.discount_cents)}`);
  if (s.tip_cents) lines.push(`Tip ${dollars(s.tip_cents)}`);
  if (!s.tax_inclusive && s.tax_cents) lines.push(`GST ${dollars(s.tax_cents)}`);
  const how = s.method === 'gift_card' ? 'gift card' : s.method ?? '';
  const when = s.paid_at ? dateLong(s.paid_at, tz) : '';
  const text = `${lines.join('\n')}\nTotal ${dollars(s.total_cents)}${how ? `, paid by ${how}` : ''}.`;
  const row = (l: string, v: string, bold = false, top = false) => `<tr><td style="padding:${top ? '12px' : '6px'} 0 6px;${top ? 'border-top:1px solid #E6E8EC;' : ''}font-size:${bold ? 16 : 14.5}px;font-weight:${bold ? 600 : 400};color:${bold ? '#0E1116' : '#3A414B'}">${esc(l)}</td><td style="padding:${top ? '12px' : '6px'} 0 6px;${top ? 'border-top:1px solid #E6E8EC;' : ''}text-align:right;white-space:nowrap;font-size:${bold ? 16 : 14.5}px;font-weight:${bold ? 600 : 400}">${esc(v)}</td></tr>`;
  const rows = [
    ...s.sale_items.map((i) => row(`${i.label}${i.qty > 1 ? ` × ${i.qty}` : ''}`, dollars(i.price_cents * i.qty))),
    ...(s.discount_cents ? [row(`Discount${s.discount_note ? ` (${s.discount_note})` : ''}`, '-' + dollars(s.discount_cents))] : []),
    ...(s.tip_cents ? [row('Tip', dollars(s.tip_cents))] : []),
    ...(!s.tax_inclusive && s.tax_cents ? [row('GST', dollars(s.tax_cents))] : []),
    row('Total', dollars(s.total_cents), true, true),
    ...(s.tax_inclusive && s.tax_cents ? [`<tr><td colspan="2" style="padding:0 0 4px;font-size:12.5px;color:#5E6673">Includes ${esc(dollars(s.tax_cents))} GST</td></tr>`] : []),
  ].join('');
  const meta = `<div style="font-size:13px;color:#5E6673;margin:-6px 0 14px">${[when, how ? 'Paid by ' + esc(how) : ''].filter(Boolean).join(' · ')}</div>`;
  const table = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows}</table>`;
  return { first, text, when, how, meta, table };
}

/** The body of the card receipt email: what was bought, and a line saying the card receipt (exactly as the terminal sent it) is attached as a PDF. */
export const cardReceiptBody = (it: ReturnType<typeof itemisedEmail>) =>
  mailP(`Hi ${it.first}, thanks for visiting. Here is your receipt.`) + it.meta + it.table
  + `<p style="margin:18px 0 0;font-size:13.5px;color:#5E6673">Your card receipt is attached as a PDF.</p>`;
