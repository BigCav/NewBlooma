export type SaleRow = {
  id: string; ref: string; client: string; service: string; staffName: string; firstName: string; time: string; method: string;
  status: 'Paid' | 'Pending' | 'Refunded'; initials: string; amount: number; tip: number; tax: number; total: number; canEdit: boolean; discount: number; discountNote: string; taxRate: number; taxIncl: boolean;
};
export type PayMethod = { id: 'terminal' | 'online' | 'cash' | 'gift_card'; label: string };
export type SvcOpt = { id: string; name: string; priceCents: number };
export const STATUS = { Paid: ['#DDF3EA', '#14624A'], Pending: ['#FFEBD0', '#7A4204'], Refunded: ['#FCE3E3', '#9B1C1C'] } as const;
export const FILTERS = [{ id: 'all', label: 'All sales' }, { id: 'Paid', label: 'Paid' }, { id: 'Pending', label: 'Pending' }, { id: 'Refunded', label: 'Refunded' }];
export const TIP_OPTS: [string, string][] = [['0', 'No tip'], ['10', '10%'], ['15', '15%'], ['20', '20%']];
export const fmt = (cents: number) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
export const initialsOf = (n: string) => n.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'W';
export type DiscPick = { kind: 'none' | 'percent' | 'amount'; value: string; note: string };
export const NO_DISC: DiscPick = { kind: 'none', value: '', note: '' };
export const DISC_PCTS = ['5', '10', '15', '20'];
/** Cents taken off for a pick, never more than the gross (the server applies the same rule). */
export const discountCents = (gross: number, d: DiscPick) => {
  const v = Number(String(d.value).replace(/[^0-9.]/g, ''));
  if (d.kind === 'none' || !Number.isFinite(v) || v <= 0) return 0;
  return Math.min(d.kind === 'percent' ? Math.round(gross * Math.min(v, 100) / 100) : Math.round(v * 100), gross);
};
export const discOf = (r?: { discount: number; discountNote: string }): DiscPick => r && r.discount > 0 ? { kind: 'amount', value: String(r.discount / 100), note: r.discountNote } : NO_DISC;
