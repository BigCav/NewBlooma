export type SaleRow = {
  id: string; client: string; service: string; staffName: string; firstName: string; time: string; method: string;
  status: 'Paid' | 'Pending' | 'Refunded'; initials: string; amount: number; tip: number; tax: number; total: number; canEdit: boolean;
};
export type PayMethod = { id: 'terminal' | 'online' | 'cash' | 'gift_card'; label: string };
export type SvcOpt = { id: string; name: string; priceCents: number };
export const STATUS = { Paid: ['#DDF3EA', '#14624A'], Pending: ['#FFEBD0', '#7A4204'], Refunded: ['#FCE3E3', '#9B1C1C'] } as const;
export const FILTERS = [{ id: 'all', label: 'All sales' }, { id: 'Paid', label: 'Paid' }, { id: 'Pending', label: 'Pending' }, { id: 'Refunded', label: 'Refunded' }];
export const TIP_OPTS: [string, string][] = [['0', 'No tip'], ['10', '10%'], ['15', '15%'], ['20', '20%']];
export const fmt = (cents: number) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
export const initialsOf = (n: string) => n.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'W';
