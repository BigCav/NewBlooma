import { requireCtx } from '@/lib/session';
import ActionForm from '@/components/ActionForm';
import { money } from '@/lib/format';
import { createRetailSale } from '../actions';

export const metadata = { title: 'New retail sale' };

export default async function NewSale() {
  const { sb, salon } = await requireCtx();
  const [{ data: products }, { data: clients }] = await Promise.all([
    sb.from('products').select('id,name,brand,price_cents,stock').eq('active', true).order('name'),
    sb.from('clients').select('id,name').order('name').limit(500),
  ]);
  return (
    <>
      <div className="page-head"><h1>New retail sale</h1></div>
      <div className="card" style={{ maxWidth: 720 }}>
        {!products?.length ? <div className="empty">No products yet. Add some in Products.</div> : (
          <ActionForm action={createRetailSale} submit="Continue to payment">
            <div className="field"><label>Client (optional)</label><select name="client_id"><option value="">Walk-in</option>{(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            {products.map((p) => <div className="row between" key={p.id} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <span><b>{p.name}</b> <span className="muted small">{p.brand} · {p.stock} in stock</span></span>
              <span className="row"><b>{money(p.price_cents, salon.currency)}</b><input name={`qty_${p.id}`} type="number" min="0" max={Math.max(p.stock, 0)} defaultValue={0} style={{ width: 80 }} aria-label={`Quantity of ${p.name}`} /></span></div>)}
            <div style={{ height: 14 }} />
          </ActionForm>)}
      </div>
    </>
  );
}
