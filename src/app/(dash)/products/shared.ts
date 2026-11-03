import { toneFor } from '@/lib/cal';
import { TONE, type ToneName } from '@/lib/tones';

export type ProductRow = { id: string; name: string; brand: string; cat: string; sku: string; priceCents: number; stock: number; reorder: number; sold: number; status: 'In stock' | 'Low stock' | 'Out of stock' };
/** The chip tone of each stock state, and the colour of the stock bar. */
export const STATUS: Record<ProductRow['status'], { tone: ToneName; bar: string }> = {
  'In stock': { tone: 'green', bar: '#2FB985' },
  'Low stock': { tone: 'amber', bar: '#F0A044' },
  'Out of stock': { tone: 'red', bar: '#E5484D' },
};
export const FILTERS = [{ id: 'all', label: 'All products' }, { id: 'In stock', label: 'In stock' }, { id: 'Low stock', label: 'Low stock' }, { id: 'Out of stock', label: 'Out of stock' }];
/** The colour of a category tile (a square, not a person): the same source as the calendar blocks, so a category is one colour everywhere. Services and products both use this. */
export const categoryTone = (name: string | null | undefined, index = 0): { bg: string; fg: string } => { const t = toneFor(name, Math.max(0, index)); return { bg: t.bg, fg: t.fg }; };
export const toneOf = (cats: string[], cat: string) => { const i = cats.indexOf(cat); return i < 0 ? TONE.grey : categoryTone(cat, i); };
export const statusOf = (stock: number, reorder: number) => (stock === 0 ? 'Out of stock' : stock <= reorder ? 'Low stock' : 'In stock') as ProductRow['status'];
