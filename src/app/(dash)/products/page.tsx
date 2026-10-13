import { requireCtx } from '@/lib/session';
import { statusOf, type ProductRow } from './shared';
import { ProductsView } from './ProductsView';

export const metadata = { title: 'Products' };
export const dynamic = 'force-dynamic';

export default async function Products() {
  const { sb } = await requireCtx();
  const since = new Date(Date.now() - 7 * 86400e3).toISOString();
  const [{ data: prods }, { data: cats }, { data: sold }] = await Promise.all([
    sb.from('products').select('id,name,brand,category,sku,price_cents,stock,reorder_level').eq('active', true).order('name'),
    sb.from('service_categories').select('name').order('sort').order('name'),
    sb.from('sale_items').select('product_id,qty,sales!inner(status,paid_at)').not('product_id', 'is', null).eq('sales.status', 'paid').gte('sales.paid_at', since),
  ]);
  const soldBy = new Map<string, number>();
  for (const r of (sold ?? []) as any[]) soldBy.set(r.product_id, (soldBy.get(r.product_id) ?? 0) + r.qty);
  const catList = [...new Set([...(cats ?? []).map((c) => c.name), ...(prods ?? []).map((p) => p.category).filter(Boolean) as string[]])];
  const rank = (c: string | null) => { const i = catList.indexOf(c ?? ''); return i < 0 ? 99 : i; };
  const rows: ProductRow[] = (prods ?? []).slice().sort((a, b) => rank(a.category) - rank(b.category) || (a.brand ?? '').localeCompare(b.brand ?? '') || a.name.localeCompare(b.name)).map((p) => ({
    id: p.id, name: p.name, brand: p.brand ?? '', cat: p.category ?? 'Other', sku: p.sku ?? 'None', priceCents: p.price_cents, stock: p.stock, reorder: p.reorder_level,
    sold: soldBy.get(p.id) ?? 0, status: statusOf(p.stock, p.reorder_level),
  }));
  return <ProductsView rows={rows} cats={catList} />;
}
