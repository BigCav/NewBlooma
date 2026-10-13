export type ProductRow = { id: string; name: string; brand: string; cat: string; sku: string; priceCents: number; stock: number; reorder: number; sold: number; status: 'In stock' | 'Low stock' | 'Out of stock' };
export const STATUS = { 'In stock': { bg: '#DDF3EA', fg: '#14624A', bar: '#2FB985' }, 'Low stock': { bg: '#FFEBD0', fg: '#7A4204', bar: '#F0A044' }, 'Out of stock': { bg: '#FCE3E3', fg: '#9B1C1C', bar: '#E5484D' } } as const;
export const FILTERS = [{ id: 'all', label: 'All products' }, { id: 'In stock', label: 'In stock' }, { id: 'Low stock', label: 'Low stock' }, { id: 'Out of stock', label: 'Out of stock' }];
const TONES = [{ bg: '#ECE8FF', fg: '#3B2BB5' }, { bg: '#FFEBD0', fg: '#7A4204' }, { bg: '#DDF3EA', fg: '#14624A' }, { bg: '#DFEEFF', fg: '#1B4A8A' }];
export const toneOf = (cats: string[], cat: string) => { const i = cats.indexOf(cat); return i < 0 ? { bg: '#EEF0F3', fg: '#0E1116' } : TONES[i % TONES.length]; };
export const statusOf = (stock: number, reorder: number) => (stock === 0 ? 'Out of stock' : stock <= reorder ? 'Low stock' : 'In stock') as ProductRow['status'];
export const money = (cents: number) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
export const initialsOf = (n: string) => n.split(' ').slice(0, 2).map((w) => w[0]).join('');
