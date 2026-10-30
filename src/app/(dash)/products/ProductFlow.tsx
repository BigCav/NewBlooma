'use client';
import { useState } from 'react';
import { decimalInput, digitsInput } from '@/lib/numeric';
import { S } from '../calendar/pickers';
import { CLOSE_BTN as RING_BTN, CloseX } from '../calendar/calUi';
import { ROW, TICK, ICONS, StepShell, useSteps, Tiles, DetailRows } from '../calendar/wizardUi';
import { STATUS, initialsOf, money, toneOf } from './shared';
import type { ProductsCtl } from './ProductsView';

const FIELD_IN = { ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), minHeight: 0, borderRadius: 0 } as const;
const BARE = { ...S('flex:1 1 auto;min-width:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), padding: 0, minHeight: 0, width: 'auto', borderRadius: 0 } as const;
const QTYS = [6, 12, 24, 48];

const I_BOX = <><path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8" /></>;
const I_HASH = <path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" />;
const I_BARS = <path d="M5 19V9M12 19V5M19 19v-7" />;

function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} style={S('display:block;box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{label}</span>{children}</label>;
}

const tile = (c: ProductsCtl, cat: string, size: number, r: number, fs: number) => { const t = toneOf(c.cats, cat); return `flex:0 0 ${size}px;width:${size}px;height:${size}px;border-radius:${r}px;display:flex;align-items:center;justify-content:center;font-size:${fs}px;font-weight:600;background:${t.bg};color:${t.fg}`; };
const dots = <svg width="20" height="20" viewBox="0 0 24 24" fill="#0E1116"><circle cx="12" cy="5.5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="18.5" r="1.6" /></svg>;
const PRIMARY = 'flex:1 1 0;height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;cursor:pointer';
const SECOND = 'flex:1 1 0;height:52px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500;cursor:pointer';

/** What the phone shows in the product sheet: the product, a restock page, or the new/edit step flow. */
export function ProductBody({ c }: { c: ProductsCtl }) {
  const s = c.sel;
  if (c.mode === 'new') return <ProductForm c={c} />;
  if (!s) return <p style={S('margin:0;color:#5E6673;font-size:14px')}>No products yet. Add one with New product.</p>;
  if (c.mode === 'restock') return <Restock c={c} />;
  if (c.mode === 'edit') return <ProductForm c={c} />;
  return <ProductView c={c} />;
}

function ProductView({ c }: { c: ProductsCtl }) {
  const s = c.sel!;
  const fill = Math.min(100, s.reorder ? Math.round(s.stock / (s.reorder * 3) * 100) : s.stock ? 100 : 0);
  const pill = 'display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;white-space:nowrap;background:' + STATUS[s.status].bg + ';color:' + STATUS[s.status].fg;
  const round = 'flex:0 0 48px;width:48px;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer';
  return (
    <div style={S('display:flex;flex-direction:column;flex:1 1 auto;min-height:0;margin:0 -20px -40px')}>
      <div style={S('flex:0 0 auto;padding:0 20px 14px')}>
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px')}>
          <span style={S(pill)}>{s.status}</span>
          <button onClick={c.close} aria-label="Close" style={S(RING_BTN)}><CloseX /></button>
        </div>
        <div style={S('display:flex;align-items:center;gap:14px;margin-top:16px')}>
          <div style={S(tile(c, s.cat, 56, 16, 17))}>{initialsOf(s.name)}</div>
          <div style={S('min-width:0')}>
            <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;overflow-wrap:anywhere')}>{s.name}</h2>
            {!!s.brand && <div style={S('margin-top:2px;font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{s.brand}</div>}
          </div>
        </div>
      </div>
      <div style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:4px 20px 16px;display:flex;flex-direction:column;gap:14px')}>
        <div style={S('display:flex;flex-direction:column;gap:12px;box-sizing:border-box;padding:16px;border:1px solid #E6E8EC;border-radius:20px;background:#FAFAFB')}>
          <div style={S('display:flex;align-items:baseline;justify-content:space-between;gap:12px')}><span style={S('color:#5E6673')}>In stock</span><span style={S('font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{s.stock}</span></div>
          <div style={S('height:8px;border-radius:999px;background:#EEF0F3;overflow:hidden')}><div style={S('height:100%;border-radius:999px;background:' + STATUS[s.status].bar + ';width:' + fill + '%')} /></div>
          <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
            <span style={S('font-size:14px;font-weight:500')}>Adjust stock</span>
            <div style={S('display:flex;align-items:center;gap:10px')}>
              <button onClick={() => c.nudge(s, -1)} aria-label="Remove one from stock" style={S(round)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /></svg></button>
              <button onClick={() => c.nudge(s, 1)} aria-label="Add one to stock" style={S(round)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
            </div>
          </div>
        </div>
        <DetailRows go={() => {}} rows={[
          { icon: I_HASH, text: 'SKU ' + s.sku },
          { icon: ICONS.tag, text: s.cat || 'No category' },
          { icon: ICONS.tag, text: money(s.priceCents) },
          { icon: I_BOX, text: 'Reorder at ' + s.reorder + (s.reorder === 1 ? ' unit' : ' units') },
          { icon: I_BARS, text: s.sold + ' sold this week' },
        ]} />
        {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
      </div>
      <div style={S('flex:0 0 auto;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;gap:10px')}>
        <button onClick={c.openEdit} style={S(SECOND)}>Edit product</button>
        <button onClick={c.openRestock} style={S(PRIMARY)}>Restock</button>
      </div>
    </div>
  );
}

function Restock({ c }: { c: ProductsCtl }) {
  const s = c.sel!;
  return (
    <StepShell step={0} plain titles={['Restock']} onBack={c.cancel} onClose={c.cancel} error={c.error}
      actions={[{ label: 'Add stock', onClick: c.restock, disabled: c.busy }]}>
      <p style={S('margin:0;font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{s.name}{s.brand ? ', ' + s.brand : ''}</p>
      <Tiles label="Units to add" options={QTYS.map((q) => [q, '+' + q] as const)} value={c.qty} onPick={c.setQty} />
      <p style={S('margin:0;color:#5E6673;font-size:14px')}>{`In stock now ${s.stock}, ${s.stock + c.qty} after adding ${c.qty}.`}</p>
    </StepShell>
  );
}

/**
 * New product: details, category, price, stock, then a summary. An existing product opens on the summary,
 * and a row there jumps to the step that changes it.
 */
function ProductForm({ c }: { c: ProductsCtl }) {
  const isNew = c.mode === 'new';
  const s = c.sel;
  const d = isNew ? c.nf : { ...c.ef, cat: s?.cat ?? '', stock: '' };
  const set = (k: 'name' | 'brand' | 'price' | 'reorder' | 'stock' | 'cat', v: string) => { c.setError(''); if (isNew) c.setNf({ ...c.nf, [k]: v }); else c.setEf({ ...c.ef, [k]: v }); };
  const kinds = [...['details'], ...(isNew && c.cats.length ? ['category'] : []), 'price', isNew ? 'stock' : 'reorder', 'summary'];
  const last = kinds.length - 1;
  const { step, jump, forward, back } = useSteps(last, () => c.setError(''), isNew ? 0 : last);
  const [menu, setMenu] = useState(false);
  const kind = kinds[Math.min(step, last)];
  const at = (k: string) => kinds.indexOf(k);
  const titles: Record<string, string> = { details: 'Details', category: 'Category', price: 'Price', stock: 'Stock', reorder: 'Reorder level', summary: isNew ? 'Summary' : 'Edit product' };
  const price = parseFloat(d.price);
  const reorderN = parseInt(d.reorder, 10);

  const ready = () => {
    if (kind === 'details') return d.name.trim() ? '' : 'Add a product name.';
    if (kind === 'price') return !isNaN(price) && price > 0 ? '' : 'Enter a price above zero, like 24 or 24.50.';
    if (kind === 'reorder' || kind === 'stock') return !isNaN(reorderN) && reorderN >= 0 ? '' : 'Enter the reorder level as a whole number, 0 or more.';
    return '';
  };
  const next = () => { const e = ready(); if (e) { c.setError(e); return; } forward(); };
  const priceText = isNaN(price) ? '$0' : money(Math.round(price * 100));
  const stockN = parseInt(d.stock, 10) || 0;

  const summaryBar = (
    <div style={S('display:flex;gap:10px')}>
      {!isNew && <button type="button" onClick={() => setMenu(true)} aria-label="More actions" aria-haspopup="dialog" style={S(RING_BTN + ';flex:0 0 52px;width:52px;height:52px')}>{dots}</button>}
      <button type="button" onClick={isNew ? c.create : c.saveEdit} disabled={c.busy} style={S(PRIMARY)}>{isNew ? 'Add product' : 'Save changes'}</button>
    </div>
  );
  const closeMenu = () => { setMenu(false); c.setConfirmDel(false); };

  return (<>
    <StepShell step={step} titles={kinds.map((k) => titles[k])} onBack={back} onClose={c.cancel} error={c.error}
      actions={kind === 'summary' ? [] : [{ label: 'Continue', onClick: next }]}
      bar={kind === 'summary' ? summaryBar : undefined}>
      <div style={S('display:flex;flex-direction:column;gap:14px')}>
        {kind === 'details' && (<>
          {!isNew && !!s && <p style={S('margin:0;font-size:13px;color:#5E6673')}>SKU {s.sku}</p>}
          <Field label="Name" htmlFor="pr-name"><input id="pr-name" type="text" value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="Product name" style={FIELD_IN} /></Field>
          <Field label="Brand (optional)" htmlFor="pr-brand"><input id="pr-brand" type="text" value={d.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Brand" style={FIELD_IN} /></Field>
        </>)}

        {kind === 'category' && (
          <div role="group" aria-label="Category" style={S('display:flex;flex-direction:column')}>
            {c.cats.map((x) => { const on = d.cat === x; return (
              <button key={x} type="button" onClick={() => set('cat', x)} aria-pressed={on} style={S(ROW(on))}>
                <span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{x}</span>{on && TICK}
              </button>
            ); })}
          </div>
        )}

        {kind === 'price' && (
          <Field label="Price" htmlFor="pr-price">
            <span style={S('display:flex;align-items:center;gap:6px;margin-top:2px;font-size:16px')}><span style={S('color:#5E6673')}>$</span><input id="pr-price" type="text" inputMode="decimal" value={d.price} onChange={(e) => set('price', decimalInput(e.target.value))} placeholder="0" style={BARE} /></span>
          </Field>
        )}

        {kind === 'stock' && (<>
          <Field label="Starting stock (units)" htmlFor="pr-stock"><input id="pr-stock" type="text" inputMode="numeric" value={d.stock} onChange={(e) => set('stock', digitsInput(e.target.value))} placeholder="0" style={FIELD_IN} /></Field>
          <Field label="Reorder at (units)" htmlFor="pr-reorder"><input id="pr-reorder" type="text" inputMode="numeric" value={d.reorder} onChange={(e) => set('reorder', digitsInput(e.target.value))} placeholder="6" style={FIELD_IN} /></Field>
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>It shows as low stock once the count reaches the reorder level.</p>
        </>)}

        {kind === 'reorder' && (<>
          <Field label="Reorder at (units)" htmlFor="pr-reorder"><input id="pr-reorder" type="text" inputMode="numeric" value={d.reorder} onChange={(e) => set('reorder', digitsInput(e.target.value))} placeholder="0" style={FIELD_IN} /></Field>
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>It shows as low stock once the count reaches the reorder level.</p>
        </>)}

        {kind === 'summary' && (<>
          <div style={S('display:flex;align-items:center;gap:14px;box-sizing:border-box;padding:14px 16px;border:1px solid #E6E8EC;border-radius:20px;background:#FAFAFB')}>
            <div style={S(tile(c, d.cat, 48, 14, 15))}>{initialsOf(d.name.trim() || '?')}</div>
            <div style={S('flex:1 1 auto;min-width:0')}>
              <div style={S('font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{d.name.trim() || 'Product name'}</div>
              <div style={S('font-size:12.5px;color:#5E6673;overflow-wrap:anywhere')}>{d.brand.trim() || 'No brand'}</div>
            </div>
            <div style={S('flex:0 0 auto;font-size:15px;font-weight:600')}>{priceText}</div>
          </div>
          <DetailRows go={jump} rows={[
            { icon: ICONS.tag, text: (d.name.trim() || 'No name') + (d.brand.trim() ? ', ' + d.brand.trim() : ''), step: at('details') },
            ...(isNew && c.cats.length ? [{ icon: ICONS.scissors, text: d.cat || 'No category', step: at('category') }] : []),
            { icon: ICONS.tag, text: priceText, step: at('price') },
            isNew
              ? { icon: I_BOX, text: stockN + ' in stock, reorder at ' + (isNaN(reorderN) ? 0 : reorderN), step: at('stock') }
              : { icon: I_BOX, text: 'Reorder at ' + (isNaN(reorderN) ? 0 : reorderN) + (reorderN === 1 ? ' unit' : ' units'), step: at('reorder') },
          ]} />
        </>)}
      </div>
    </StepShell>
    {menu && (
      <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:6')}>
        <button onClick={closeMenu} aria-label="Close" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
        <div className="sheet" role="dialog" aria-label="More actions" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column')}>
          <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0;margin-bottom:12px')} />
          <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>More actions</h2><button onClick={closeMenu} aria-label="Close" style={S(RING_BTN)}><CloseX /></button></div>
          {!c.confirmDel ? (
            <div style={S('display:flex;flex-direction:column;padding:4px 0;border-top:1px solid #EEF0F3')}>
              <button type="button" onClick={() => c.setConfirmDel(true)} style={S('display:flex;align-items:center;width:100%;min-height:54px;box-sizing:border-box;padding:0;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;color:#B42318;cursor:pointer')}>Delete product</button>
            </div>
          ) : (
            <div role="alertdialog" aria-label="Confirm delete" style={S('display:flex;flex-direction:column;gap:12px;box-sizing:border-box;padding:16px;border:1px solid #F3C6C3;border-radius:20px;background:#FEF3F2')}>
              <div><div style={S('font-size:14.5px;font-weight:600')}>Delete this product?</div><div style={S('margin-top:2px;font-size:13px;color:#5E6673')}>It will disappear from your product list. Past sales are not affected.</div></div>
              {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
              <div style={S('display:flex;gap:10px')}>
                <button type="button" className="ghost" onClick={closeMenu} style={S('flex:1 1 0;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500')}>Keep</button>
                <button type="button" onClick={c.remove} disabled={c.busy} style={S('flex:1 1 0;height:48px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font-size:14px;font-weight:500')}>Delete product</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  </>);
}
