'use client';
// 1:1 conversion of the prototype's Products.dc.html and MobileProducts.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { adjustStock, createProduct, removeProduct, saveProduct } from './actions';
import { FILTERS, STATUS, initialsOf, money, toneOf, type ProductRow } from './shared';

type Props = { rows: ProductRow[]; cats: string[] };
type Mode = 'view' | 'restock' | 'edit' | 'new';
const QTYS = [6, 12, 24, 48];

function useProducts(props: Props) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const mobile = narrow === true;
  const [stock, setStock] = useState<Record<string, number>>({});
  useEffect(() => { setStock({}); }, [props.rows]);
  const rows = props.rows.map((p) => {
    const n = stock[p.id] ?? p.stock;
    const status = n === 0 ? 'Out of stock' : n <= p.reorder ? 'Low stock' : 'In stock';
    return { ...p, stock: n, status } as ProductRow;
  });
  const blankNew = () => ({ name: '', brand: '', cat: props.cats[0] ?? '', price: '', stock: '', reorder: '6' });
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('view');
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [qty, setQty] = useState(12);
  const [ef, setEf] = useState({ name: '', brand: '', price: '', reorder: '' });
  const [nf, setNf] = useState(blankNew());
  const [confirmDel, setConfirmDel] = useState(false);
  const sel = rows.find((p) => p.id === selectedId) ?? rows[0] ?? null;

  const pick = (id: string) => { setSelectedId(id); setMode('view'); setNotice(''); setError(''); setOpen(true); };
  const nudge = (p: ProductRow, d: number) => {
    const next = Math.max(0, p.stock + d); if (next === p.stock) return;
    setStock((s) => ({ ...s, [p.id]: next }));
    startT(async () => { const r = await adjustStock(p.id, d); if (r.error) { setError(r.error); setStock((s) => { const y = { ...s }; delete y[p.id]; return y; }); } else router.refresh(); });
  };
  const restock = () => { if (!sel) return; startT(async () => { const r = await adjustStock(sel.id, qty, `Added ${qty} units`); if (r.error) { setError(r.error); return; } setMode('view'); setError(''); setNotice(r.notice ?? ''); router.refresh(); }); };
  const saveEdit = () => { if (!sel) return; startT(async () => { const r = await saveProduct(sel.id, ef); if (r.error) { setError(r.error); return; } setMode('view'); setError(''); setNotice(r.notice ?? ''); router.refresh(); }); };
  const create = () => startT(async () => {
    const r = await createProduct(nf);
    if (r.error) { setError(r.error); return; }
    setSelectedId(r.id ?? null); setFilter('all'); setMode('view'); setNf(blankNew()); setError(''); setNotice(r.notice ?? ''); setOpen(mobile); router.refresh();
  });
  const cancel = () => { setMode('view'); setError(''); setConfirmDel(false); setOpen(mobile ? mode !== 'new' : false); };
  const remove = () => { if (!sel) return; startT(async () => { const r = await removeProduct(sel.id); if (r.error) { setError(r.error); return; } setConfirmDel(false); setSelectedId(null); setMode('view'); setError(''); setNotice(r.notice ?? ''); setOpen(false); router.refresh(); }); };
  const sq = query.trim().toLowerCase();
  const list = rows.filter((p) => (filter === 'all' || p.status === filter) && (!sq || (p.name + ' ' + p.brand + ' ' + p.cat + ' ' + p.sku).toLowerCase().includes(sq)));
  return { ...props, busy, narrow, rows, list, sel, filter, setFilter, query, setQuery, mode, setMode, open, notice, setNotice, error, setError, qty, setQty, ef, setEf, nf, setNf,
    pick, nudge, restock, saveEdit, create, cancel, remove, confirmDel, setConfirmDel, close: () => { setOpen(false); setMode('view'); setError(''); },
    openNew: () => { setMode('new'); setNf(blankNew()); setError(''); setNotice(''); setOpen(true); },
    openRestock: () => { setMode('restock'); setQty(12); setError(''); setNotice(''); },
    openEdit: () => { if (!sel) return; setConfirmDel(false); setMode('edit'); setEf({ name: sel.name, brand: sel.brand, price: String(sel.priceCents / 100), reorder: String(sel.reorder) }); setError(''); setNotice(''); },
    low: rows.filter((p) => p.status === 'Low stock').length, out: rows.filter((p) => p.status === 'Out of stock').length };
}
type C = ReturnType<typeof useProducts>;

const GHOST = (h: number) => `flex:1 1 0;height:${h}px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500`;
const DARK = (h: number) => `flex:1 1 0;height:${h}px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500`;
const statusStyle = (s: ProductRow['status']) => 'display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;white-space:nowrap;background:' + STATUS[s].bg + ';color:' + STATUS[s].fg;
const pill = (on: boolean, m: boolean) => `flex:0 0 auto;height:${m ? 44 : 40}px;padding:0 16px;border-radius:999px;font-size:${m ? 14 : 13.5}px;font-weight:500;border:1px solid ` + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
const inputS: React.CSSProperties = { ...S('box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF'), padding: '0 14px', minHeight: 0 };
const bareInput: React.CSSProperties = { ...S('flex:1 1 auto;min-width:0;border:0;outline:none;background:transparent;font:inherit;color:#0E1116'), padding: 0, minHeight: 0, width: 'auto', borderRadius: 0 };
const tile = (c: C, cat: string, size: number, r: number, fs: number) => { const t = toneOf(c.cats, cat); return `flex:0 0 ${size}px;width:${size}px;height:${size}px;border-radius:${r}px;display:flex;align-items:center;justify-content:center;font-size:${fs}px;font-weight:600;background:${t.bg};color:${t.fg}`; };
const Field = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor={id} style={S('font-size:14px;font-weight:600')}>{label}</label>{children}</div>;
const Dollar = ({ id, v, on }: { id: string; v: string; on: (v: string) => void }) => <div style={S('display:flex;align-items:center;gap:6px;box-sizing:border-box;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;background:#FFFFFF')}><span style={S('color:#5E6673')}>$</span><input id={id} type="text" inputMode="decimal" value={v} onChange={(e) => on(e.target.value)} placeholder="0" style={bareInput} /></div>;

function Body({ c, m }: { c: C; m: boolean }) {
  const s = c.sel, h = m ? 48 : 44;
  const err = !!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>;
  if (c.mode === 'new') return (
    <div style={S('display:flex;flex-direction:column;gap:18px')}>
      <div><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>New product</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>It joins the list straight away.</p></div>
      <Field id="nf-name" label="Name"><input id="nf-name" type="text" value={c.nf.name} onChange={(e) => { c.setNf({ ...c.nf, name: e.target.value }); c.setError(''); }} placeholder="Product name" style={inputS} /></Field>
      <Field id="nf-brand" label="Brand"><input id="nf-brand" type="text" value={c.nf.brand} onChange={(e) => { c.setNf({ ...c.nf, brand: e.target.value }); c.setError(''); }} placeholder="Brand (optional)" style={inputS} /></Field>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="nf-cat-label" style={S('font-size:14px;font-weight:600')}>Category</span><div role="group" className="hscroll" aria-labelledby="nf-cat-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>{c.cats.map((x) => <button key={x} onClick={() => c.setNf({ ...c.nf, cat: x })} aria-pressed={c.nf.cat === x} style={S(pill(c.nf.cat === x, m))}>{x}</button>)}</div></div>
      <Field id="nf-price" label="Price"><Dollar id="nf-price" v={c.nf.price} on={(v) => { c.setNf({ ...c.nf, price: v }); c.setError(''); }} /></Field>
      <Field id="nf-stock" label="Starting stock (units)"><input id="nf-stock" type="text" inputMode="numeric" value={c.nf.stock} onChange={(e) => { c.setNf({ ...c.nf, stock: e.target.value.replace(/\D/g, '') }); c.setError(''); }} placeholder="0" style={inputS} /></Field>
      <Field id="nf-reorder" label="Reorder at (units)"><input id="nf-reorder" type="text" inputMode="numeric" value={c.nf.reorder} onChange={(e) => { c.setNf({ ...c.nf, reorder: e.target.value.replace(/\D/g, '') }); c.setError(''); }} placeholder="6" style={inputS} /></Field>
      {err}
      <div style={S('display:flex;gap:10px')}><button onClick={c.create} disabled={c.busy} style={S(DARK(h))}>Add product</button><button className="ghost" onClick={c.cancel} style={S(GHOST(h))}>Cancel</button></div>
    </div>
  );
  if (!s) return <p style={S('margin:0;color:#5E6673;font-size:14px')}>No products yet. Add one with New product.</p>;
  if (c.mode === 'restock') return (
    <div style={S('display:flex;flex-direction:column;gap:18px')}>
      <div><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Restock</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{s.name}, {s.brand}</p></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="rs-qty-label" style={S('font-size:14px;font-weight:600')}>Units to add</span><div role="group" className="hscroll" aria-labelledby="rs-qty-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>{QTYS.map((q) => <button key={q} onClick={() => c.setQty(q)} aria-pressed={c.qty === q} style={S(pill(c.qty === q, m))}>{'+' + q}</button>)}</div></div>
      <p style={S('margin:0;color:#5E6673;font-size:14px')}>{`In stock now ${s.stock}, ${s.stock + c.qty} after adding ${c.qty}.`}</p>
      {err}
      <div style={S('display:flex;gap:10px')}><button onClick={c.restock} disabled={c.busy} style={S(DARK(h))}>Add stock</button><button className="ghost" onClick={c.cancel} style={S(GHOST(h))}>Cancel</button></div>
    </div>
  );
  if (c.mode === 'edit') return (
    <div style={S('display:flex;flex-direction:column;gap:18px')}>
      <div><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Edit product</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>SKU {s.sku}</p></div>
      <Field id="ef-name" label="Name"><input id="ef-name" type="text" value={c.ef.name} onChange={(e) => { c.setEf({ ...c.ef, name: e.target.value }); c.setError(''); }} placeholder="Product name" style={inputS} /></Field>
      <Field id="ef-brand" label="Brand"><input id="ef-brand" type="text" value={c.ef.brand} onChange={(e) => { c.setEf({ ...c.ef, brand: e.target.value }); c.setError(''); }} placeholder="Brand" style={inputS} /></Field>
      <Field id="ef-price" label="Price"><Dollar id="ef-price" v={c.ef.price} on={(v) => { c.setEf({ ...c.ef, price: v }); c.setError(''); }} /></Field>
      <Field id="ef-reorder" label="Reorder at (units)"><input id="ef-reorder" type="text" inputMode="numeric" value={c.ef.reorder} onChange={(e) => { c.setEf({ ...c.ef, reorder: e.target.value.replace(/\D/g, '') }); c.setError(''); }} placeholder="0" style={inputS} /></Field>
      {err}
      {!c.confirmDel && <div style={S('display:flex;gap:10px')}><button onClick={c.saveEdit} disabled={c.busy} style={S(DARK(h))}>Save product</button><button className="ghost" onClick={c.cancel} style={S(GHOST(h))}>Cancel</button><button className="ghost" onClick={() => c.setConfirmDel(true)} style={S(GHOST(h))}>Delete</button></div>}
      {c.confirmDel && (
        <div role="alert" style={S('display:flex;flex-direction:column;gap:12px;border-radius:16px;background:#FDECEA;padding:14px 16px')}>
          <div style={S('font-size:14.5px;font-weight:600')}>Delete this product?</div>
          <div style={S('font-size:13.5px;color:#5E6673')}>It will disappear from your product list. Past sales are not affected.</div>
          <div style={S('display:flex;gap:10px')}>
            <button onClick={c.remove} disabled={c.busy} style={S('flex:1 1 0;height:' + h + 'px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font-size:14px;font-weight:500')}>Delete product</button>
            <button className="ghost" onClick={() => c.setConfirmDel(false)} style={S(GHOST(h))}>Keep it</button>
          </div>
        </div>
      )}
    </div>
  );
  const fill = Math.min(100, s.reorder ? Math.round(s.stock / (s.reorder * 3) * 100) : s.stock ? 100 : 0);
  const circ = m ? 48 : 44;
  const dl = (label: string, value: string, o: { last?: boolean; wrap?: boolean } = {}) => <div key={label} style={S('display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3;' + (o.last ? 'border-bottom:1px solid #EEF0F3' : ''))}><dt style={S('color:#5E6673')}>{label}</dt><dd style={S('margin:0;text-align:right;font-weight:500;' + (o.wrap ? 'overflow-wrap:anywhere' : 'white-space:nowrap'))}>{value}</dd></div>;
  return (<>
    {!m && <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><span style={S(statusStyle(s.status))}>{s.status}</span>{!!c.notice && <span role="status" style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.notice}</span>}</div>}
    <div style={S('display:flex;align-items:center;gap:14px')}>
      <div style={S(tile(c, s.cat, 56, 16, 17))}>{initialsOf(s.name)}</div>
      <div style={S('min-width:0')}><div style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{s.name}</div><div style={S('font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{s.brand}</div></div>
    </div>
    <div style={S('display:flex;flex-direction:column;gap:12px')}>
      <div style={S('display:flex;align-items:baseline;justify-content:space-between;gap:12px')}><span style={S('color:#5E6673')}>In stock</span><span style={S('font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{s.stock}</span></div>
      <div style={S('height:8px;border-radius:999px;background:#EEF0F3;overflow:hidden')}><div style={S('height:100%;border-radius:999px;background:' + STATUS[s.status].bar + ';width:' + fill + '%')} /></div>
      <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
        <span style={S('font-size:14px;font-weight:500')}>Adjust stock</span>
        <div style={S('display:flex;align-items:center;gap:10px')}>
          <button onClick={() => c.nudge(s, -1)} aria-label="Remove one from stock" style={S(`width:${circ}px;height:${circ}px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center`)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /></svg></button>
          <button onClick={() => c.nudge(s, 1)} aria-label="Add one to stock" style={S(`width:${circ}px;height:${circ}px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center`)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
        </div>
      </div>
    </div>
    {err}
    <dl style={S('margin:0;display:flex;flex-direction:column')}>{dl('SKU', s.sku)}{dl('Category', s.cat, { wrap: true })}{dl('Price', money(s.priceCents))}{dl('Reorder at', s.reorder + ' units')}{dl('Sold this week', String(s.sold), { last: true })}</dl>
    <div style={S('display:flex;gap:10px')}>
      <button onClick={c.openRestock} style={S(m ? 'flex:1 1 0;height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500' : DARK(44))}>Restock</button>
      <button className={m ? undefined : 'ghost'} onClick={c.openEdit} style={S(m ? 'flex:1 1 0;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500' : GHOST(44))}>Edit product</button>
    </div>
    {!m && (
      <div style={S('display:flex;flex-direction:column;gap:6px')}>
        <h2 style={S('margin:0 0 6px;font-size:16px;font-weight:600')}>Needs restocking</h2>
        {c.rows.filter((p) => p.status !== 'In stock').slice(0, 4).map((n) => (
          <button key={n.id} className="ghost" onClick={() => c.pick(n.id)} aria-label={`${n.name}, ${n.stock} left`} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:52px;padding:8px 10px;border:0;border-radius:14px;background:transparent;text-align:left;color:#0E1116')}>
            <span style={S(tile(c, n.cat, 40, 12, 13))}>{initialsOf(n.name)}</span>
            <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{n.name}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{n.brand}</span></span>
            <span style={S('flex:0 0 auto;font-size:13px;color:#5E6673')}>{n.stock} left</span>
          </button>
        ))}
      </div>
    )}
  </>);
}

function Desktop({ c }: { c: C }) {
  const stat = (label: string, v: number) => <div><div style={S('color:#5E6673;font-size:13.5px')}>{label}</div><div style={S('margin-top:4px;font-size:38px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div></div>;
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Products" subtitle="Retail and backbar stock" query={c.query} onQuery={c.setQuery} placeholder="Search products" actionLabel="New product" onAction={c.openNew} />
      <section aria-label="Stock at a glance" style={S('display:flex;flex-wrap:wrap;gap:20px 64px')}>{stat('Products', c.rows.length)}{stat('Low stock', c.low)}{stat('Out of stock', c.out)}</section>
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <section aria-label="Product list" style={S('flex:999 1 620px;min-width:0;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E6E8EC')}>
            <div role="group" aria-label="Filter products" style={S('display:flex;flex-wrap:wrap;gap:8px')}>{FILTERS.map((f) => <button key={f.id} onClick={() => c.setFilter(f.id)} aria-pressed={c.filter === f.id} style={S('height:40px;padding:0 16px;border-radius:999px;font-size:13.5px;font-weight:500;border:1px solid ' + (c.filter === f.id ? '#0E1116' : '#E1E4E9') + ';background:' + (c.filter === f.id ? '#0E1116' : '#FFFFFF') + ';color:' + (c.filter === f.id ? '#FFFFFF' : '#0E1116'))}>{f.label}</button>)}</div>
            <span style={S('color:#5E6673;font-size:13.5px')}>{`Showing ${c.list.length} of ${c.rows.length}`}</span>
          </div>
          <div style={S('overflow-x:auto')}><div style={S('min-width:780px')}>
            <div style={S('display:flex;align-items:center;gap:16px;padding:12px 20px;border-bottom:1px solid #EEF0F3;color:#5E6673;font-size:12.5px;font-weight:500')}>
              {([['2.6', 'Product'], ['1', 'Category'], ['0.8', 'Price'], ['0.8', 'In stock'], ['1', 'Sold this week'], ['1.1', 'Status']] as const).map(([f, l]) => <div key={l} style={S(`flex:${f} 1 0;min-width:0`)}>{l}</div>)}
            </div>
            {c.list.map((p) => (
              <button key={p.id} className="s-row" onClick={() => c.pick(p.id)} aria-label={`${p.name}, ${p.brand}, ${p.stock} in stock, ${p.status}`}
                style={S('display:flex;align-items:center;gap:16px;width:100%;box-sizing:border-box;min-height:64px;padding:8px 20px;border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;font-size:14px;color:#0E1116;background:' + (c.sel?.id === p.id ? '#F4F5F7' : 'transparent'))}>
                <span style={S('flex:2.6 1 0;min-width:0;display:flex;align-items:center;gap:12px')}>
                  <span style={S(tile(c, p.cat, 40, 12, 13))}>{initialsOf(p.name)}</span>
                  <span style={S('min-width:0')}><span style={S('display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.name}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.brand}</span></span>
                </span>
                <span style={S('flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.cat}</span>
                <span style={S('flex:0.8 1 0;min-width:0')}>{money(p.priceCents)}</span>
                <span style={S('flex:0.8 1 0;min-width:0;font-weight:500')}>{p.stock}</span>
                <span style={S('flex:1 1 0;min-width:0')}>{p.sold}</span>
                <span style={S('flex:1.1 1 0;min-width:0')}><span style={S(statusStyle(p.status))}>{p.status}</span></span>
              </button>
            ))}
          </div></div>
          {c.list.length === 0 && <p style={S('margin:0;padding:24px 20px;color:#5E6673;font-size:14px;border-top:1px solid #EEF0F3')}>{c.query.trim() ? `Nothing matches "${c.query.trim()}".` : 'No products yet.'}</p>}
        </section>
        <aside aria-label="Product details" style={S('flex:1 1 440px;max-width:520px;min-width:0;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:20px')}><Body c={c} m={false} /></aside>
      </div>
    </div>
  );
}

function Mobile({ c }: { c: C }) {
  const stat = (label: string, v: number) => <div><div style={S('color:#5E6673;font-size:13px')}>{label}</div><div style={S('margin-top:2px;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div></div>;
  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Products" subtitle="Retail and backbar stock" query={c.query} onQuery={c.setQuery} placeholder="Search products" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <section aria-label="Stock at a glance" style={S('display:flex;gap:40px')}>{stat('Products', c.rows.length)}{stat('Low stock', c.low)}{stat('Out of stock', c.out)}</section>
        <button onClick={c.openNew} style={S('display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New product
        </button>
        <div role="group" className="hscroll" aria-label="Filter products" style={S('display:flex;gap:8px;overflow-x:auto')}>{FILTERS.map((f) => <button key={f.id} onClick={() => c.setFilter(f.id)} aria-pressed={c.filter === f.id} style={S('flex:0 0 auto;height:44px;padding:0 18px;border-radius:999px;font-size:14px;font-weight:500;border:1px solid ' + (c.filter === f.id ? '#0E1116' : '#E1E4E9') + ';background:' + (c.filter === f.id ? '#0E1116' : '#FFFFFF') + ';color:' + (c.filter === f.id ? '#FFFFFF' : '#0E1116'))}>{f.label}</button>)}</div>
        <ul style={S('margin:0;padding:4px 0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px')}>
          {c.list.map((p) => (
            <li key={p.id}>
              <button onClick={() => c.pick(p.id)} aria-label={`${p.name}, ${p.brand}, ${p.stock} in stock, ${p.status}`} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 16px;border:0;border-bottom:1px solid #EEF0F3;background:transparent;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
                <span style={S(tile(c, p.cat, 40, 12, 13))}>{initialsOf(p.name)}</span>
                <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.name}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.brand}, {money(p.priceCents)}</span></span>
                <span style={S('flex:0 0 auto;text-align:right')}><span style={S('display:block;font-size:14.5px;font-weight:600')}>{p.stock}</span><span style={S('display:block;margin-top:2px')}><span style={S(statusStyle(p.status))}>{p.status}</span></span></span>
              </button>
            </li>
          ))}
        </ul>
        {c.list.length === 0 && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:14px')}>{c.query.trim() ? `Nothing matches "${c.query.trim()}".` : 'No products yet.'}</p>}
      </main>
      <MobileTabs active="more" />
      {c.open && (
        <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:5')}>
          <button onClick={c.close} aria-label="Close details" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
          <div className="sheet" role="dialog" aria-label="Product details" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:88%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:18px')}>
            <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0')} />
            <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
              {c.sel && <span style={S(statusStyle(c.sel.status))}>{c.sel.status}</span>}
              {!!c.notice && <span role="status" style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.notice}</span>}
              <button onClick={c.close} aria-label="Close" style={S('flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
            </div>
            <Body c={c} m={true} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ProductsView(props: Props) {
  const c = useProducts(props);
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
