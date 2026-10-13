import { requireCtx } from '@/lib/session';
import ActionForm from '@/components/ActionForm';
import { money, dateLong } from '@/lib/format';
import { saveProduct, adjustStock, setProductActive, issueGiftCard } from './actions';

export const metadata = { title: 'Products' };

export default async function Products() {
  const { sb, salon, staff } = await requireCtx();
  const owner = staff.app_role === 'owner';
  const [{ data: products }, { data: cards }] = await Promise.all([
    sb.from('products').select('*').order('active', { ascending: false }).order('name'),
    sb.from('gift_cards').select('id,code,balance_cents,issued_at').order('issued_at', { ascending: false }).limit(50),
  ]);
  const Form = ({ p }: { p?: any }) => (
    <ActionForm action={saveProduct} submit={p ? 'Save' : 'Add product'} resetOnOk={!p}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid g3">
        <div className="field"><label>Name</label><input name="name" defaultValue={p?.name} required /></div>
        <div className="field"><label>Brand</label><input name="brand" defaultValue={p?.brand ?? ''} /></div>
        <div className="field"><label>Category</label><input name="category" defaultValue={p?.category ?? ''} /></div>
        <div className="field"><label>SKU</label><input name="sku" defaultValue={p?.sku ?? ''} /></div>
        <div className="field"><label>Price ({salon.currency})</label><input name="price" inputMode="decimal" defaultValue={p ? (p.price_cents / 100).toFixed(2) : ''} required /></div>
        <div className="grid g2"><div className="field"><label>In stock</label><input name="stock" type="number" defaultValue={p?.stock ?? 0} /></div><div className="field"><label>Reorder at</label><input name="reorder_level" type="number" min="0" defaultValue={p?.reorder_level ?? 0} /></div></div>
      </div>
    </ActionForm>
  );
  return (
    <>
      <div className="page-head"><div><h1>Products</h1><div className="muted">{products?.filter((p) => p.active).length ?? 0} active</div></div></div>
      {owner && <div className="card"><h2 style={{ marginBottom: 12 }}>Add a product</h2><Form /></div>}
      <div className="card">
        {!products?.length ? <div className="empty">No products yet.</div> : products.map((p) => (
          <details key={p.id} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
            <summary className="row between" style={{ cursor: 'pointer', listStyle: 'none' }}>
              <span><b>{p.name}</b> {!p.active && <span className="pill">Archived</span>} {p.active && p.stock <= p.reorder_level && <span className="pill warn">Low stock</span>}<div className="muted small">{[p.brand, p.category, p.sku].filter(Boolean).join(' · ')}</div></span>
              <span className="right"><b>{money(p.price_cents, salon.currency)}</b><div className="muted small">{p.stock} in stock</div></span></summary>
            <div style={{ paddingTop: 12 }}>
              <div className="row wrap" style={{ marginBottom: 12 }}>{[-1, 1, 5].map((d) => <form action={adjustStock} key={d}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="delta" value={d} /><button className="btn sm">{d > 0 ? `+${d}` : d} stock</button></form>)}</div>
              {owner && <><Form p={p} /><form action={setProductActive} style={{ marginTop: 8 }}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={String(!p.active)} /><button className="btn sm">{p.active ? 'Archive' : 'Restore'}</button></form></>}
            </div></details>))}
      </div>
      <div className="card"><h2 style={{ marginBottom: 12 }}>Gift cards</h2>
        {owner && <ActionForm action={issueGiftCard} submit="Issue gift card" resetOnOk><div className="grid g2"><div className="field"><label>Code</label><input name="code" required minLength={4} style={{ textTransform: 'uppercase' }} /></div><div className="field"><label>Amount ({salon.currency})</label><input name="amount" inputMode="decimal" required /></div></div></ActionForm>}
        {!cards?.length ? <div className="empty">No gift cards issued.</div> : cards.map((g) => <div className="row between" key={g.id} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}><span><b>{g.code}</b> <span className="muted small">issued {dateLong(g.issued_at, salon.timezone)}</span></span><b>{money(g.balance_cents, salon.currency)}</b></div>)}
      </div>
    </>
  );
}
