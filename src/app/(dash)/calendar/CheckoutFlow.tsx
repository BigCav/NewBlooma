'use client';
import { useState } from 'react';
import { decimalInput } from '@/lib/numeric';
import type { CalService } from '@/lib/cal';
import { S, ServicePicker } from './pickers';
import { m2, TIP_OPTS } from './calUi';
import { DISC_PCTS, NO_DISC, discountCents, type DiscPick } from '../sales/shared';
import { StepShell, useSteps, Tiles, DetailRows, ICONS } from './wizardUi';

export type CoState = { method: string; tip: number; code: string; disc: DiscPick };
export type CoLine = { key: string; name: string; sub?: string; cents: number };
export type CoCfg = { canDiscount: boolean; askTip: boolean; taxInclusive: boolean; taxRate: number };

const FIELD = 'box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF';

/**
 * Checkout as steps, shared by the calendar and the Sales page: payment method, discount and tip when switched on,
 * a summary, and for cash one more step to confirm what was handed over. The caller decides what charging does.
 */
export function CheckoutFlow({ who, methods, co, setCo, cfg, lines, gross, onCharge, busy, error, setError, wait, onClose, edit }: {
  who: string; methods: readonly (readonly [string, string])[]; co: CoState; setCo: (s: CoState) => void; cfg: CoCfg; lines: CoLine[]; gross: number;
  onCharge: () => void; busy: boolean; error: string; setError: (e: string) => void; wait?: string; onClose: () => void;
  edit?: { services: CalService[]; selected: string[]; lock: (x: CalService) => string; initialCat?: string; onPick: (id: string) => void };
}) {
  const cash = co.method === 'cash';
  const kinds = ['method', ...(cfg.canDiscount ? ['discount'] : []), ...(cfg.askTip ? ['tip'] : []), 'summary', ...(cash ? ['cash'] : [])] as string[];
  const summaryAt = kinds.indexOf('summary');
  const { step, go, jump, forward, back } = useSteps(summaryAt, () => setError(''));
  const [editing, setEditing] = useState(false);
  const [got, setGot] = useState('');
  const kind = kinds[step];

  const disc = cfg.canDiscount ? discountCents(gross, co.disc) : 0, net = gross - disc;
  const tip = cfg.askTip ? Math.round(gross * co.tip / 100) : 0;
  const taxAmt = cfg.taxInclusive ? Math.round(net * cfg.taxRate / (100 + cfg.taxRate)) : Math.round(net * cfg.taxRate / 100);
  const total = net + tip + (cfg.taxInclusive ? 0 : taxAmt);
  const gst = cfg.taxInclusive ? 'Includes ' + cfg.taxRate + '% GST' : 'GST ' + cfg.taxRate + '%';

  const methodLabel = methods.find((m) => m[0] === co.method)?.[1] ?? '';
  const discKey = co.disc.kind === 'none' ? 'none' : co.disc.kind === 'amount' ? 'amt' : 'p' + co.disc.value;
  const discLabel = co.disc.kind === 'none' ? 'No discount' : co.disc.kind === 'amount' ? (co.disc.value ? '$' + co.disc.value + ' off' : '$ off') : co.disc.value + '% off';
  const titles: Record<string, string> = { method: 'Payment method', discount: 'Discount', tip: 'Tip', summary: 'Checkout', cash: 'Cash received' };
  const stepOf = (k: string) => kinds.indexOf(k);
  const canNext = kind === 'method' ? (co.method !== 'gift_card' || !!co.code.trim()) : true;

  // Cash: what was handed over, and the change to give back.
  const gotCents = got.trim() === '' ? total : Math.round((Number(got) || 0) * 100);
  const nextUps = Array.from(new Set([50, 100, 200, 500, 1000, 2000, 5000, 10000].map((u) => Math.ceil(total / u) * u).filter((v) => v > total))).slice(0, 3);
  const cashOpts: [number, string][] = [[total, 'Exact'], ...nextUps.map((v) => [v, m2(v)] as [number, string])];

  if (editing && edit) return (
    <StepShell plain step={0} titles={['Edit services']} onBack={() => { setError(''); setEditing(false); }} onClose={onClose} error={error}
      summary={<div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px')}><span style={S('color:#5E6673;font-size:14px')}>{lines.length + (lines.length === 1 ? ' service' : ' services')}</span><span style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{m2(gross)}</span></div>}
      actions={[{ label: 'Done', onClick: () => { setError(''); setEditing(false); } }]}>
      <p style={S('margin:0;color:#5E6673;font-size:14px')}>This only changes what is charged. The booking and its time stay as they were.</p>
      <ServicePicker lock={edit.lock} services={edit.services} selected={edit.selected} initialCat={edit.initialCat} chipHeight={44} onPick={edit.onPick} />
    </StepShell>
  );

  return (
    <StepShell step={step} titles={kinds.map((k) => titles[k])} onBack={back} onClose={onClose} error={error}
      actions={[
        kind === 'summary' ? { label: cash ? 'Charge ' + m2(total) : 'Charge ' + m2(total), onClick: cash ? forward : onCharge, disabled: busy || !!wait }
        : kind === 'cash' ? { label: 'Confirm sale', onClick: onCharge, disabled: busy || gotCents < total }
        : { label: 'Continue', onClick: () => { if (!canNext) { setError('Enter the gift card code.'); return; } forward(); }, disabled: !canNext },
      ]}>
      <p style={S('margin:0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{who}</p>
      {kind === 'method' && (<>
        <Tiles label="Payment method" options={methods} value={co.method} onPick={(m) => setCo({ ...co, method: m })} />
        {co.method === 'gift_card' && <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="co-code" style={S('font-size:14px;font-weight:600')}>Gift card code</label><input id="co-code" type="text" value={co.code} onChange={(e) => setCo({ ...co, code: e.target.value })} placeholder="Code" style={{ ...S(FIELD), minHeight: 0 }} /></div>}
      </>)}
      {kind === 'discount' && (<>
        <Tiles label="Discount" value={discKey} options={[['none', 'None'], ...DISC_PCTS.map((v) => ['p' + v, v + '%'] as const), ['amt', '$ off']] as const}
          onPick={(k) => setCo({ ...co, disc: k === 'none' ? NO_DISC : k === 'amt' ? { ...co.disc, kind: 'amount', value: co.disc.kind === 'amount' ? co.disc.value : '' } : { ...co.disc, kind: 'percent', value: k.slice(1) } })} />
        {co.disc.kind === 'amount' && <input aria-label="Discount amount in dollars" inputMode="decimal" value={co.disc.value} onChange={(e) => setCo({ ...co, disc: { ...co.disc, value: decimalInput(e.target.value) } })} placeholder="Amount off, like 10 or 7.50" style={{ ...S(FIELD), minHeight: 0 }} />}
        {co.disc.kind !== 'none' && <input aria-label="Discount reason" maxLength={60} value={co.disc.note} onChange={(e) => setCo({ ...co, disc: { ...co.disc, note: e.target.value } })} placeholder="Reason (optional), e.g. Staff discount" style={{ ...S(FIELD), minHeight: 0 }} />}
      </>)}
      {kind === 'tip' && <Tiles label="Tip" options={TIP_OPTS} value={co.tip} onPick={(p) => setCo({ ...co, tip: p })} />}
      {kind === 'summary' && (<>
        <DetailRows go={jump} rows={[
          { icon: ICONS.tag, text: methodLabel + (co.method === 'gift_card' && co.code ? ', ' + co.code : ''), step: 0 },
          ...(cfg.canDiscount ? [{ icon: ICONS.tag, text: discLabel, step: stepOf('discount') }] : []),
          ...(cfg.askTip ? [{ icon: ICONS.tag, text: tip ? 'Tip ' + m2(tip) : 'No tip', step: stepOf('tip') }] : []),
        ]} />
        <div style={S('display:flex;flex-direction:column;gap:10px')}>
          <div style={S('display:flex;align-items:center;justify-content:space-between')}><h3 style={S('margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Services</h3>{edit && <button onClick={() => { setError(''); setEditing(true); }} style={S('border:0;background:transparent;font:inherit;font-size:14px;font-weight:500;text-decoration:underline;cursor:pointer;color:#0E1116')}>Edit</button>}</div>
          {lines.map((v) => (
            <div key={v.key} style={S('display:flex;align-items:center;gap:12px')}>
              <span style={S('flex:0 0 4px;align-self:stretch;border-radius:999px;background:#B9AEFB')} />
              <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{v.name}</span>{!!v.sub && <span style={S('display:block;font-size:13px;color:#5E6673')}>{v.sub}</span>}</span>
              <span style={S('flex:0 0 auto;font-size:14.5px;font-weight:500')}>{m2(v.cents)}</span>
            </div>
          ))}
        </div>
        <div className="sum-rows" style={S('padding:2px 16px;border:1px solid #E6E8EC;border-radius:22px')}>
          {([...(disc > 0 ? [['Discount', '-' + m2(disc)]] : []), ...(tip ? [['Tip', m2(tip)]] : []), [gst, m2(taxAmt)]] as [string, string][]).map(([l, v]) => (
            <div key={l} style={S('display:flex;justify-content:space-between;gap:12px;padding:13px 0;font-size:15px')}><span style={S('color:#5E6673')}>{l}</span><span style={S('font-weight:500;white-space:nowrap')}>{v}</span></div>
          ))}
          <div style={S('display:flex;justify-content:space-between;gap:12px;padding:15px 0;font-size:18px;font-weight:600')}><span>Total</span><span>{m2(total)}</span></div>
        </div>
        {!!wait && <p role="status" style={S('margin:0;color:#5E6673;font-size:13.5px')}>{wait}</p>}
      </>)}
      {kind === 'cash' && (<>
        <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:16px;border:1px solid #E6E8EC;border-radius:22px')}><span style={S('color:#5E6673;font-size:14px')}>To pay</span><span style={S('font-size:24px;font-weight:600;letter-spacing:-0.02em')}>{m2(total)}</span></div>
        <Tiles label="Cash received" options={cashOpts} value={gotCents} onPick={(v) => setGot(v === total ? '' : String(v / 100))} />
        <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="co-got" style={S('font-size:14px;font-weight:600')}>Other amount</label><input id="co-got" inputMode="decimal" value={got} onChange={(e) => setGot(decimalInput(e.target.value))} placeholder={'Cash received, ' + (total / 100).toFixed(2)} style={{ ...S(FIELD), minHeight: 0 }} /></div>
        <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:16px;border-radius:22px;background:' + (gotCents >= total ? '#DDF3EA' : '#FDECEA') + ';color:' + (gotCents >= total ? '#14624A' : '#B42318'))}><span style={S('font-size:14px;font-weight:500')}>{gotCents >= total ? 'Change to give back' : 'Still to receive'}</span><span style={S('font-size:22px;font-weight:600')}>{m2(Math.abs(gotCents - total))}</span></div>
      </>)}
    </StepShell>
  );
}
