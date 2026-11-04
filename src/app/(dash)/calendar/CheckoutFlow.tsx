'use client';
import { useState } from 'react';
import { decimalInput } from '@/lib/numeric';
import type { CalService } from '@/lib/cal';
import { S } from './s';
import { ServicePicker } from './pickers';
import { TIP_OPTS } from './calUi';
import { dollars, toCents } from '@/lib/format';
import { plural } from '@/lib/display';
import { TONE } from '@/lib/tones';
import { Field, INPUT, dim } from '@/components/ui';
import { FIELD_IN } from '@/components/ui';
import { DISC_PCTS, NO_DISC, discountCents, type CoPackage, type CoProduct, type DiscPick } from '../sales/shared';
import { TerminalStatus, type TermView } from './TerminalStatus';
import { StepShell, useSteps, Tiles, DetailRows, ICONS, ROW, TICK } from './wizardUi';

export type CoState = { method: string; tip: number; code: string; disc: DiscPick };
export type CoPacks = { list: CoPackage[]; chosen: string[]; onToggle: (id: string) => void };
export type CoRetail = { products: CoProduct[]; qty: Record<string, number>; onQty: (id: string, n: number) => void };
export type CoLine = { key: string; name: string; sub?: string; cents: number };
export type CoCfg = { canDiscount: boolean; askTip: boolean; taxInclusive: boolean; taxRate: number };


/**
 * Checkout as steps, shared by the calendar and the Sales page: payment method, discount and tip when switched on,
 * a summary, and for cash one more step to confirm what was handed over. The caller decides what charging does.
 */
export function CheckoutFlow({ who, methods, co, setCo, cfg, lines, gross, onCharge, busy, error, setError, term, onClose, edit, retail, packs, tipBase }: {
  who: string; methods: readonly (readonly [string, string])[]; co: CoState; setCo: (s: CoState) => void; cfg: CoCfg; lines: CoLine[]; gross: number;
  onCharge: () => void; busy: boolean; error: string; setError: (e: string) => void; term?: TermView; onClose: () => void;
  edit?: { services: CalService[]; selected: string[]; lock: (x: CalService) => string; initialCat?: string; onPick: (id: string) => void };
  /** Retail products that can be added to the visit, with how many of each are on the sale. */
  retail?: CoRetail;
  /** Packages the client has with visits left that cover a service on this sale. */
  packs?: CoPacks;
  /** What the tip is worked out on (the services only). Defaults to the whole amount. */
  tipBase?: number;
}) {
  const prodLines = retail ? retail.products.filter((p) => (retail.qty[p.id] ?? 0) > 0).map((p) => ({ p, n: retail.qty[p.id], cents: p.priceCents * retail.qty[p.id] })) : [];
  const prodTotal = prodLines.reduce((a, l) => a + l.cents, 0);
  const packLines = packs ? packs.list.filter((x) => packs.chosen.includes(x.id)).map((x) => lines.find((l) => l.key === x.serviceId)).filter((l): l is CoLine => !!l) : [];
  const packOff = packLines.reduce((acc, l) => acc + l.cents, 0);
  const all = gross - packOff + prodTotal;
  const disc = cfg.canDiscount ? discountCents(all, co.disc) : 0, net = all - disc;
  const tip = cfg.askTip ? Math.round(((tipBase ?? gross) - packOff) * co.tip / 100) : 0;
  const taxAmt = cfg.taxInclusive ? Math.round(net * cfg.taxRate / (100 + cfg.taxRate)) : Math.round(net * cfg.taxRate / 100);
  const total = net + tip + (cfg.taxInclusive ? 0 : taxAmt);
  const gst = cfg.taxInclusive ? 'Includes ' + cfg.taxRate + '% GST' : 'GST ' + cfg.taxRate + '%';
  const cash = co.method === 'cash' && total > 0;
  const kinds = ['method', ...(cfg.canDiscount ? ['discount'] : []), ...(cfg.askTip ? ['tip'] : []), 'summary', ...(cash ? ['cash'] : [])] as string[];
  const summaryAt = kinds.indexOf('summary');
  const { step, go, jump, forward, back } = useSteps(summaryAt, () => setError(''));
  const [editing, setEditing] = useState(false);
  const [shopping, setShopping] = useState(false);
  /** What was in the basket when the product screen opened, so Back can put it back. */
  const [before, setBefore] = useState<Record<string, number>>({});
  const [find, setFind] = useState('');
  const [got, setGot] = useState('');
  const [cashHow, setCashHow] = useState<'partial' | 'exact' | null>(null);
  const kind = kinds[step];


  const methodLabel = methods.find((m) => m[0] === co.method)?.[1] ?? '';
  const discKey = co.disc.kind === 'none' ? 'none' : co.disc.kind === 'amount' ? 'amt' : 'p' + co.disc.value;
  const discLabel = co.disc.kind === 'none' ? 'No discount' : co.disc.kind === 'amount' ? (co.disc.value ? '$' + co.disc.value + ' off' : '$ off') : co.disc.value + '% off';
  const titles: Record<string, string> = { method: 'Payment method', discount: 'Discount', tip: 'Tip', summary: 'Checkout', cash: 'Cash received' };
  const stepOf = (k: string) => kinds.indexOf(k);
  const canNext = kind === 'method' ? (co.method !== 'gift_card' || !!co.code.trim()) : true;

  // Cash: exact, or a different amount handed over with the change to give back.
  const gotCents = cashHow === 'exact' ? total : toCents(got);
  const cashReady = cashHow === 'exact' || (cashHow === 'partial' && gotCents >= total);

  // The last step of a card payment: pending on the terminal, then a tick or a cross.
  if (term && term.phase !== 'idle') return <TerminalStatus t={term} amount={dollars(total)} />;

  if (editing && edit) return (
    <StepShell plain step={0} titles={['Edit services']} onBack={() => { setError(''); setEditing(false); }} onClose={onClose} error={error}
      summary={<div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px')}><span style={S('color:#5E6673;font-size:14px')}>{plural(lines.length, 'service')}</span><span style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{dollars(gross)}</span></div>}
      actions={[{ label: 'Done', onClick: () => { setError(''); setEditing(false); } }]}>
      <p style={S('margin:0;color:#5E6673;font-size:14px')}>This only changes what is charged. The booking and its time stay as they were.</p>
      <ServicePicker lock={edit.lock} services={edit.services} selected={edit.selected} initialCat={edit.initialCat} chipHeight={44} onPick={edit.onPick} />
    </StepShell>
  );

  if (shopping && retail) {
    const q = find.trim().toLowerCase();
    const shown = retail.products.filter((p) => !q || (p.name + ' ' + p.brand).toLowerCase().includes(q));
    const count = prodLines.reduce((a, l) => a + l.n, 0);
    const close = () => { setError(''); setShopping(false); setFind(''); };
    const discard = () => {
      for (const p of retail.products) { const was = before[p.id] ?? 0; if ((retail.qty[p.id] ?? 0) !== was) retail.onQty(p.id, was); }
      close();
    };
    const stepBtn = (dis: boolean) => 'flex:0 0 auto;width:40px;height:40px;padding:0;border-radius:999px;border:1px solid #E1E4E9;background:#FFFFFF;font:inherit;font-size:20px;line-height:1;color:#0E1116;cursor:pointer' + dim(dis);
    return (
      <StepShell plain step={0} titles={['Add products']} onBack={discard} onClose={onClose} error={error}
        summary={<div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px')}><span style={S('color:#5E6673;font-size:14px')}>{plural(count, 'product')}</span><span style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{dollars(prodTotal)}</span></div>}
        actions={[{ label: 'Done', onClick: close }]}>
        <p style={S('margin:0;color:#5E6673;font-size:14px')}>Products are charged with the visit and come off your stock when it is paid.</p>
        <input aria-label="Search products" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search products" style={S(INPUT)} />
        {!retail.products.length && <p style={S('margin:0;color:#5E6673;font-size:14px')}>No products yet. Add some on the Products page.</p>}
        {!!retail.products.length && !shown.length && <p style={S('margin:0;color:#5E6673;font-size:14px')}>No products match that search.</p>}
        {shown.map((p) => {
          const n = retail.qty[p.id] ?? 0, out = p.stock < 1;
          return (
            <div key={p.id} style={S('display:flex;align-items:center;gap:12px;box-sizing:border-box;min-height:56px;padding:10px 16px;border-radius:16px;opacity:' + (out ? 0.55 : 1) + ';border:1px solid ' + (n > 0 ? '#0E1116' : '#E1E4E9') + ';background:' + (n > 0 ? '#F4F5F7' : '#FFFFFF') + (n > 0 ? ';box-shadow:inset 0 0 0 1px #0E1116' : ''))}>
              <span style={S('flex:1 1 auto;min-width:0')}>
                <span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{p.name}</span>
                <span style={S('display:block;font-size:13px;color:#5E6673')}>{(p.brand ? p.brand + ', ' : '') + dollars(p.priceCents) + ', ' + (out ? 'out of stock' : p.stock + ' in stock')}</span>
              </span>
              {n > 0 ? (
                <span style={S('flex:0 0 auto;display:flex;align-items:center;gap:10px')}>
                  <button onClick={() => retail.onQty(p.id, n - 1)} aria-label={'Remove one ' + p.name} style={S(stepBtn(false))}>-</button>
                  <span aria-live="polite" style={S('min-width:18px;text-align:center;font-size:15px;font-weight:600')}>{n}</span>
                  <button onClick={() => retail.onQty(p.id, n + 1)} disabled={n >= p.stock} aria-label={'Add one ' + p.name} style={S(stepBtn(n >= p.stock))}>+</button>
                </span>
              ) : (
                <button onClick={() => retail.onQty(p.id, 1)} disabled={out} style={S('flex:0 0 auto;height:40px;padding:0 18px;border-radius:999px;border:1px solid #E1E4E9;background:#FFFFFF;font:inherit;font-size:14px;font-weight:500;color:#0E1116;cursor:pointer' + dim(out))}>Add</button>
              )}
            </div>
          );
        })}
      </StepShell>
    );
  }

  return (
    <StepShell step={step} titles={kinds.map((k) => titles[k])} onBack={back} onClose={onClose} error={error}
      actions={[
        kind === 'summary' ? { label: busy ? 'Charging…' : total === 0 ? 'Complete visit' : 'Charge ' + dollars(total), onClick: cash ? forward : onCharge, disabled: busy }
        : kind === 'cash' ? { label: busy ? 'Saving…' : 'Confirm sale', onClick: onCharge, disabled: busy || !cashReady }
        : { label: 'Continue', onClick: () => { if (!canNext) { setError('Enter the gift card code.'); return; } forward(); }, disabled: !canNext },
      ]}>
      <p style={S('margin:0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{who}</p>
      {kind === 'method' && (<>
        <Tiles label="Payment method" options={methods} value={co.method} onPick={(m) => setCo({ ...co, method: m })} />
        {co.method === 'gift_card' && <Field label="Gift card code" htmlFor="co-code"><input id="co-code" type="text" value={co.code} onChange={(e) => setCo({ ...co, code: e.target.value })} placeholder="Code" style={FIELD_IN} /></Field>}
      </>)}
      {kind === 'discount' && (<>
        <Tiles label="Discount" value={discKey} options={[['none', 'None'], ...DISC_PCTS.map((v) => ['p' + v, v + '%'] as const), ['amt', '$ off']] as const}
          onPick={(k) => setCo({ ...co, disc: k === 'none' ? NO_DISC : k === 'amt' ? { ...co.disc, kind: 'amount', value: co.disc.kind === 'amount' ? co.disc.value : '' } : { ...co.disc, kind: 'percent', value: k.slice(1) } })} />
        {co.disc.kind === 'amount' && <Field label="Amount off"><input aria-label="Discount amount in dollars" inputMode="decimal" value={co.disc.value} onChange={(e) => setCo({ ...co, disc: { ...co.disc, value: decimalInput(e.target.value) } })} placeholder="Amount off, like 10 or 7.50" style={FIELD_IN} /></Field>}
        {co.disc.kind !== 'none' && <Field label="Reason (optional)"><input aria-label="Discount reason" maxLength={60} value={co.disc.note} onChange={(e) => setCo({ ...co, disc: { ...co.disc, note: e.target.value } })} placeholder="e.g. Staff discount" style={FIELD_IN} /></Field>}
      </>)}
      {kind === 'tip' && <Tiles label="Tip" options={TIP_OPTS} value={co.tip} onPick={(p) => setCo({ ...co, tip: p })} />}
      {kind === 'summary' && (<>
        <DetailRows go={jump} rows={[
          { icon: ICONS.tag, text: methodLabel + (co.method === 'gift_card' && co.code ? ', ' + co.code : ''), step: 0 },
          ...(cfg.canDiscount ? [{ icon: ICONS.tag, text: discLabel, step: stepOf('discount') }] : []),
          ...(cfg.askTip ? [{ icon: ICONS.tag, text: tip ? 'Tip ' + dollars(tip) : 'No tip', step: stepOf('tip') }] : []),
        ]} />
        <div style={S('display:flex;flex-direction:column;gap:10px')}>
          <div style={S('display:flex;align-items:center;justify-content:space-between')}><h3 style={S('margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Services</h3>{edit && <button onClick={() => { setError(''); setEditing(true); }} style={S('border:0;background:transparent;font:inherit;font-size:14px;font-weight:500;text-decoration:underline;cursor:pointer;color:#0E1116')}>Edit</button>}</div>
          {lines.map((v) => (
            <div key={v.key} style={S('display:flex;align-items:center;gap:12px')}>
              <span style={S('flex:0 0 4px;align-self:stretch;border-radius:999px;background:#B9AEFB')} />
              <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{v.name}</span>{!!v.sub && <span style={S('display:block;font-size:13px;color:#5E6673')}>{v.sub}</span>}</span>
              <span style={S('flex:0 0 auto;font-size:14.5px;font-weight:500')}>{packLines.includes(v) ? 'Package' : dollars(v.cents)}</span>
            </div>
          ))}
        </div>
        {!!packs?.list.length && (
          <div style={S('display:flex;flex-direction:column;gap:10px')}>
            <h3 style={S('margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Packages</h3>
            <div role="group" aria-label="Packages" style={S('display:flex;flex-direction:column')}>
              {packs.list.map((x) => { const on = packs.chosen.includes(x.id); return (
                <button key={x.id} onClick={() => packs.onToggle(x.id)} aria-pressed={on} style={S(ROW(on))}>
                  <span style={S('flex:1 1 auto;min-width:0;text-align:left')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{x.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{plural(x.left, 'visit') + ' left'}</span></span>
                  <span style={S('flex:0 0 auto;font-size:14px;color:#5E6673')}>{on ? 'Using' : 'Use'}</span>
                  {on && TICK}
                </button>
              ); })}
            </div>
          </div>
        )}
        {retail && (
          <div style={S('display:flex;flex-direction:column;gap:10px')}>
            <div style={S('display:flex;align-items:center;justify-content:space-between')}><h3 style={S('margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Products</h3><button onClick={() => { setError(''); setBefore(retail ? { ...retail.qty } : {}); setShopping(true); }} style={S('border:0;background:transparent;font:inherit;font-size:14px;font-weight:500;text-decoration:underline;cursor:pointer;color:#0E1116')}>{prodLines.length ? 'Edit' : 'Add'}</button></div>
            {!prodLines.length && <span style={S('font-size:13.5px;color:#5E6673')}>Sell retail items with this visit.</span>}
            {prodLines.map((l) => (
              <div key={l.p.id} style={S('display:flex;align-items:center;gap:12px')}>
                <span style={S('flex:0 0 4px;align-self:stretch;border-radius:999px;background:#9ED9C0')} />
                <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{l.p.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{l.n > 1 ? l.n + ' x ' + dollars(l.p.priceCents) : (l.p.brand || 'Retail')}</span></span>
                <span style={S('flex:0 0 auto;font-size:14.5px;font-weight:500')}>{dollars(l.cents)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="sum-rows" style={S('padding:2px 16px;border:1px solid #E6E8EC;border-radius:22px')}>
          {([...(disc > 0 ? [['Discount', '-' + dollars(disc)]] : []), ...(tip ? [['Tip', dollars(tip)]] : []), [gst, dollars(taxAmt)]] as [string, string][]).map(([l, v]) => (
            <div key={l} style={S('display:flex;justify-content:space-between;gap:12px;padding:13px 0;font-size:15px')}><span style={S('color:#5E6673')}>{l}</span><span style={S('font-weight:500;white-space:nowrap')}>{v}</span></div>
          ))}
          <div style={S('display:flex;justify-content:space-between;gap:12px;padding:15px 0;font-size:18px;font-weight:600')}><span>Total</span><span>{dollars(total)}</span></div>
        </div>
      </>)}
      {kind === 'cash' && (<>
        <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:16px;border:1px solid #E6E8EC;border-radius:22px')}><span style={S('color:#5E6673;font-size:14px')}>To pay</span><span style={S('font-size:24px;font-weight:600;letter-spacing:-0.02em')}>{dollars(total)}</span></div>
        <Tiles label="Cash received" options={[['exact', 'Exact'], ['partial', 'Partial']] as const} value={cashHow} onPick={(v) => setCashHow(v)} />
        {cashHow === 'partial' && (<>
          <Field label="Amount received" htmlFor="co-got"><input id="co-got" inputMode="decimal" value={got} onChange={(e) => setGot(decimalInput(e.target.value))} placeholder={'Cash received, ' + dollars(total)} style={FIELD_IN} /></Field>
          <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:16px;border-radius:22px;background:' + (gotCents >= total ? TONE.green.bg : TONE.red.bg) + ';color:' + (gotCents >= total ? TONE.green.fg : TONE.red.fg))}><span style={S('font-size:14px;font-weight:500')}>{gotCents >= total ? 'Change to give back' : 'Still to receive'}</span><span style={S('font-size:22px;font-weight:600')}>{dollars(Math.abs(gotCents - total))}</span></div>
        </>)}
      </>)}
    </StepShell>
  );
}
