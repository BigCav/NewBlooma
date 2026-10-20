'use client';
import { S } from './pickers';
import { DISC_PCTS, NO_DISC, type DiscPick } from '../sales/shared';

/** Discount chooser for checkout: none, a percentage, or dollars off, with an optional reason. Same options as the Sales page. */
export function DiscountPick({ value, onChange, mobile }: { value: DiscPick; onChange: (d: DiscPick) => void; mobile?: boolean }) {
  const h = mobile ? 44 : 40;
  const chip = (on: boolean) => `flex:0 0 auto;height:${h}px;padding:0 16px;border-radius:999px;font-size:${mobile ? 14 : 13.5}px;font-weight:500;border:1px solid ` + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
  const field = `box-sizing:border-box;width:100%;height:${mobile ? 48 : 44}px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF`;
  const lbl = mobile ? 'font-size:14px;font-weight:600' : 'font-size:14px;font-weight:600';
  return (
    <div style={S('display:flex;flex-direction:column;gap:8px')}>
      <span id="co-disc-label" style={S(lbl)}>Discount</span>
      <div role="group" className="hscroll" aria-labelledby="co-disc-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
        <button onClick={() => onChange(NO_DISC)} aria-pressed={value.kind === 'none'} style={S(chip(value.kind === 'none'))}>None</button>
        {DISC_PCTS.map((v) => <button key={v} onClick={() => onChange({ ...value, kind: 'percent', value: v })} aria-pressed={value.kind === 'percent' && value.value === v} style={S(chip(value.kind === 'percent' && value.value === v))}>{v}%</button>)}
        <button onClick={() => onChange({ ...value, kind: 'amount', value: value.kind === 'amount' ? value.value : '' })} aria-pressed={value.kind === 'amount'} style={S(chip(value.kind === 'amount'))}>$ off</button>
      </div>
      {value.kind === 'amount' && <input aria-label="Discount amount in dollars" inputMode="decimal" value={value.value} onChange={(e) => onChange({ ...value, value: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="Amount off, like 10 or 7.50" style={{ ...S(field), minHeight: 0 }} />}
      {value.kind !== 'none' && <input aria-label="Discount reason" maxLength={60} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} placeholder="Reason (optional), e.g. Staff discount" style={{ ...S(field), minHeight: 0 }} />}
    </div>
  );
}
