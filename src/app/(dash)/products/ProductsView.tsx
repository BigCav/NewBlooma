'use client';
// 1:1 conversion of the prototype's Products.dc.html and MobileProducts.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { BottomSheet } from '@/components/BottomSheet';
import { rootCls } from '@/components/drawer';
import { useNewParam } from '@/components/useNewParam';
import { dollars } from '@/lib/format';
import { plural } from '@/lib/display';
import { initialsOf } from '@/lib/people';
import { BLACK, Chip, FilterChip, Notice, Stat } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { ActiveFilter, FilterButton, FilterSheet } from '@/components/FilterBits';
import { adjustStock, createProduct, removeProduct, saveProduct } from './actions';
import { ProductBody } from './ProductFlow';
import { FILTERS, STATUS, toneOf, type ProductRow } from './shared';

type Props = { rows: ProductRow[]; cats: string[] };
type Mode = 'view' | 'restock' | 'edit' | 'new';

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
  const mobile = true; // desktop edits in the same drawer
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
  const restock = () => { if (!sel) return; startT(async () => { const r = await adjustStock(sel.id, qty, `Added ${plural(qty, 'unit')}`); if (r.error) { setError(r.error); return; } setMode('view'); setError(''); setNotice(r.notice ?? ''); router.refresh(); }); };
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
export type ProductsCtl = C;

const tile = (c: C, cat: string, size: number, r: number, fs: number) => { const t = toneOf(c.cats, cat); return `flex:0 0 ${size}px;width:${size}px;height:${size}px;border-radius:${r}px;display:flex;align-items:center;justify-content:center;font-size:${fs}px;font-weight:600;background:${t.bg};color:${t.fg}`; };


function Desktop({ c }: { c: C }) {
  const stat = (label: string, v: number) => <Stat label={label} value={v} />;
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 32px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Products" subtitle="Retail and backbar stock" query={c.query} onQuery={c.setQuery} placeholder="Search products" actionLabel="New product" onAction={c.openNew} />
      <section aria-label="Stock at a glance" style={S('display:flex;flex-wrap:wrap;gap:20px 64px')}>{stat('Products', c.rows.length)}{stat('Low stock', c.low)}{stat('Out of stock', c.out)}</section>
      {!!c.notice && !c.open && <Notice>{c.notice}</Notice>}
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <section aria-label="Product list" style={S('flex:999 1 620px;min-width:0;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E6E8EC')}>
            <div role="group" aria-label="Filter products" style={S('display:flex;flex-wrap:wrap;gap:8px')}>{FILTERS.map((f) => <FilterChip key={f.id} on={c.filter === f.id} onClick={() => c.setFilter(f.id)}>{f.label}</FilterChip>)}</div>
            <span style={S('color:#5E6673;font-size:13.5px')}>{`Showing ${c.list.length} of ${c.rows.length}`}</span>
          </div>
          <div style={S('overflow-x:auto')}><div style={S('min-width:780px')}>
            <div style={S('display:flex;align-items:center;gap:16px;padding:12px 20px;border-bottom:1px solid #EEF0F3;color:#5E6673;font-size:12.5px;font-weight:500')}>
              {([['2.6', 'Product'], ['1', 'Category'], ['0.8', 'Price'], ['0.8', 'In stock'], ['1', 'Sold this week'], ['1.1', 'Status']] as const).map(([f, l]) => <div key={l} style={S(`flex:${f} 1 0;min-width:0`)}>{l}</div>)}
            </div>
            {c.list.map((p) => (
              <button key={p.id} className="s-row" onClick={() => c.pick(p.id)} aria-label={`${p.name}, ${p.brand}, ${p.stock} in stock, ${p.status}`}
                style={S('display:flex;align-items:center;gap:16px;width:100%;box-sizing:border-box;min-height:64px;padding:8px 20px;border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;font-size:14px;color:#0E1116;background:' + (c.open && c.sel?.id === p.id ? '#F4F5F7' : 'transparent'))}>
                <span style={S('flex:2.6 1 0;min-width:0;display:flex;align-items:center;gap:12px')}>
                  <span style={S(tile(c, p.cat, 40, 12, 13))}>{initialsOf(p.name)}</span>
                  <span style={S('min-width:0')}><span style={S('display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.name}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.brand}</span></span>
                </span>
                <span style={S('flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.cat}</span>
                <span style={S('flex:0.8 1 0;min-width:0')}>{dollars(p.priceCents)}</span>
                <span style={S('flex:0.8 1 0;min-width:0;font-weight:500')}>{p.stock}</span>
                <span style={S('flex:1 1 0;min-width:0')}>{p.sold}</span>
                <span style={S('flex:1.1 1 0;min-width:0')}><Chip tone={STATUS[p.status].tone}>{p.status}</Chip></span>
              </button>
            ))}
          </div></div>
          {c.list.length === 0 && <p style={S('margin:0;padding:24px 20px;color:#5E6673;font-size:14px;border-top:1px solid #EEF0F3')}>{c.query.trim() ? `Nothing matches "${c.query.trim()}".` : 'No products yet.'}</p>}
        </section>
      </div>
      {c.open && <Mobile c={c} drawer />}
    </div>
  );
}

function Mobile({ c, drawer }: { c: C; drawer?: boolean }) {
  const [fopen, setFopen] = useState(false);
  const stat = (label: string, v: number) => <Stat label={label} value={v} small />;
  return (
    <div className={rootCls(drawer)} style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Products" subtitle="Retail and backbar stock" query={c.query} onQuery={c.setQuery} placeholder="Search products" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <section aria-label="Stock at a glance" style={S('display:flex;gap:40px')}>{stat('Products', c.rows.length)}{stat('Low stock', c.low)}{stat('Out of stock', c.out)}</section>
        {!!c.notice && !c.open && <Notice>{c.notice}</Notice>}
        <div style={S('display:flex;gap:10px')}>
          <FilterButton onClick={() => setFopen(true)} active={c.filter !== 'all'} label="Filter products" />
          <button onClick={c.openNew} style={S(BLACK + ';gap:8px')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            New product
          </button>
        </div>
        {c.filter !== 'all' && <ActiveFilter label={FILTERS.find((f) => f.id === c.filter)?.label ?? ''} onClear={() => c.setFilter('all')} />}
        {c.list.length > 0 && (
          <ul style={S('margin:0;padding:4px 0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px')}>
            {c.list.map((p) => (
              <li key={p.id}>
                <button onClick={() => c.pick(p.id)} aria-label={`${p.name}, ${p.brand}, ${p.stock} in stock, ${p.status}`} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 16px;border:0;border-bottom:1px solid #EEF0F3;background:transparent;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
                  <span style={S(tile(c, p.cat, 40, 12, 13))}>{initialsOf(p.name)}</span>
                  <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.name}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.brand}, {dollars(p.priceCents)}</span></span>
                  <span style={S('flex:0 0 auto;text-align:right')}><span style={S('display:block;font-size:14.5px;font-weight:600')}>{p.stock}</span><span style={S('display:block;margin-top:2px')}><Chip tone={STATUS[p.status].tone}>{p.status}</Chip></span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {c.list.length === 0 && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:14px')}>{c.query.trim() ? `Nothing matches "${c.query.trim()}".` : c.filter !== 'all' ? `No products are ${c.filter.toLowerCase()}.` : 'No products yet.'}</p>}
      </main>
      <MobileTabs active="more" />
      {fopen && <FilterSheet title="Filter products" options={FILTERS} value={c.filter} onPick={c.setFilter} onClose={() => setFopen(false)} />}
      {c.open && (
        <BottomSheet label="Product details" onClose={c.close} backdropLabel="Close details" gap={18} handle={false}>
            <ProductBody key={c.mode + (c.sel?.id ?? 'new')} c={c} />
          </BottomSheet>
      )}
    </div>
  );
}

export function ProductsView(props: Props) {
  const c = useProducts(props);
  useNewParam(() => c.openNew());
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
