import { toCents } from '@/lib/format';
import { PAYMENT_STATUS } from '@/lib/status';
import type { ToneName } from '@/lib/tones';
export type SaleRow = {
  id: string; ref: string; staffId: string | null; clientId: string | null; bookingId: string; bookingDay: string; client: string; service: string; staffName: string; staffPhoto: string | null; firstName: string; time: string; method: string;
  status: 'Paid' | 'Pending' | 'Refunded'; amount: number; tip: number; tax: number; total: number; canEdit: boolean; txn?: string /* a card payment still open on the terminal */; discount: number; discountNote: string; taxRate: number; taxIncl: boolean;
  dayShort: string; gst: number; range: string; lines: { label: string; qty: number; cents: number; dur: number | null; svc: boolean; productId: string | null; serviceId: string | null }[];
};
export type PayMethod = { id: 'terminal' | 'online' | 'cash' | 'gift_card'; label: string };
export type SvcOpt = { id: string; name: string; priceCents: number };
/** The chip colour of each sale status, from the one payment-status table. */
export const STATUS: Record<SaleRow['status'], ToneName> = { Paid: PAYMENT_STATUS.paid.tone, Pending: PAYMENT_STATUS.pending.tone, Refunded: PAYMENT_STATUS.refunded.tone };
export const FILTERS = [{ id: 'all', label: 'All sales' }, { id: 'Paid', label: 'Paid' }, { id: 'Pending', label: 'Pending' }, { id: 'Refunded', label: 'Refunded' }];
export const TIP_OPTS: [string, string][] = [['0', 'No tip'], ['10', '10%'], ['15', '15%'], ['20', '20%']];
export type DiscPick = { kind: 'none' | 'percent' | 'amount'; value: string; note: string };
export const NO_DISC: DiscPick = { kind: 'none', value: '', note: '' };
export const DISC_PCTS = ['5', '10', '15', '20'];
/** Cents taken off for a pick, never more than the gross (the server applies the same rule). */
export const discountCents = (gross: number, d: DiscPick) => {
  const v = Number(String(d.value).replace(/[^0-9.]/g, ''));
  if (d.kind === 'none' || !Number.isFinite(v) || v <= 0) return 0;
  return Math.min(d.kind === 'percent' ? Math.round(gross * Math.min(v, 100) / 100) : toCents(d.value), gross);
};
export const discOf = (r?: { discount: number; discountNote: string }): DiscPick => r && r.discount > 0 ? { kind: 'amount', value: String(r.discount / 100), note: r.discountNote } : NO_DISC;

/** A retail product that can be added to an appointment at checkout. */
export type CoProduct = { id: string; name: string; brand: string; priceCents: number; stock: number };

/** A client's package with visits left, offered at checkout when the visit has the service it covers. */
export type CoPackage = { id: string; serviceId: string; name: string; left: number };
