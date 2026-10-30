'use client';
import { useState } from 'react';
import { decimalInput } from '@/lib/numeric';
import { S } from '../calendar/pickers';
import { DetailRows, ICONS, StepShell, Tiles, useSteps } from '../calendar/wizardUi';
import type { GiftCtl } from './GiftCardsView';

const PRESETS = [2500, 5000, 10000, 15000];
const FIELD_IN = { ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), minHeight: 0, borderRadius: 0 } as const;
const MONO = "'Geist Mono',ui-monospace,monospace";
const I_DOLLAR = <><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9.2c-.4-.8-1.3-1.2-2.5-1.2-1.4 0-2.4.7-2.4 1.8 0 2.5 5 1.2 5 3.7 0 1.1-1.1 1.8-2.6 1.8-1.2 0-2.2-.5-2.6-1.4M12 6.5v1.5M12 16v1.5" /></>;
const I_CODE = <><rect x="3.5" y="6" width="17" height="12" rx="2.5" /><path d="M8 10.5h3M8 14h8" /></>;
const money = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });

function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} style={S('display:block;box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{label}</span>{children}</label>;
}

/** Issue a gift card on the phone as steps: amount, who it is for, the code, then a summary. */
export function IssueFlow({ c, genCode }: { c: GiftCtl; genCode: () => string }) {
  const { nf, setNf } = c;
  const kinds = ['amount', 'for', 'code', 'summary'] as const;
  const last = kinds.length - 1;
  const { step, jump, forward, back } = useSteps(last, () => c.setError(''));
  const kind = kinds[step];
  const titles: Record<string, string> = { amount: 'Amount', for: 'Who is it for?', code: 'Code', summary: 'Summary' };
  const cents = Math.round(parseFloat(String(nf.amount).replace(/[^0-9.]/g, '')) * 100);
  const valid = Number.isFinite(cents) && cents > 0;
  const [custom, setCustom] = useState(() => valid && !PRESETS.includes(cents));
  const isCustom = custom || (nf.amount !== '' && !PRESETS.includes(cents));
  const ready = () => (kind === 'amount' && !valid ? 'Choose or enter an amount.' : kind === 'code' && !nf.code.trim() ? 'Add a code.' : '');
  const next = () => { const e = ready(); if (e) { c.setError(e); return; } forward(); };

  return (
    <StepShell step={step} titles={kinds.map((k) => titles[k])} onBack={back} onClose={c.closeNew} error={c.error}
      actions={kind === 'summary' ? [] : [{ label: 'Continue', onClick: next }]}
      bar={kind === 'summary' ? <button type="button" onClick={c.issue} disabled={c.busy} style={S('width:100%;height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;cursor:pointer')}>Issue gift card</button> : undefined}>
      {kind === 'amount' && (<>
        <Tiles label="Amount" options={[...PRESETS.map((p) => [String(p), money(p)] as const), ['custom', 'Custom'] as const]} value={isCustom ? 'custom' : valid ? String(cents) : null}
          onPick={(v) => { c.setError(''); if (v === 'custom') { setCustom(true); if (PRESETS.includes(cents)) setNf({ ...nf, amount: '' }); } else { setCustom(false); setNf({ ...nf, amount: String(Number(v) / 100) }); } }} />
        {isCustom && <Field label="Amount in dollars" htmlFor="gc-amt"><input id="gc-amt" type="text" inputMode="decimal" value={nf.amount} onChange={(e) => { setCustom(true); setNf({ ...nf, amount: decimalInput(e.target.value) }); c.setError(''); }} placeholder="For example, 75" style={FIELD_IN} /></Field>}
      </>)}

      {kind === 'for' && (<>
        <p style={S('margin:0;font-size:13px;color:#5E6673')}>A name helps you find the card later. You can leave it empty.</p>
        <Field label="For (optional)" htmlFor="gc-for"><input id="gc-for" type="text" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="Name" style={FIELD_IN} /></Field>
      </>)}

      {kind === 'code' && (<>
        <p style={S('margin:0;font-size:13px;color:#5E6673')}>Clients give this code at the counter. Gift cards do not expire.</p>
        <Field label="Code" htmlFor="gc-code"><input id="gc-code" type="text" value={nf.code} onChange={(e) => { setNf({ ...nf, code: e.target.value.toUpperCase() }); c.setError(''); }} autoCapitalize="characters" style={{ ...FIELD_IN, fontFamily: MONO, letterSpacing: '0.02em' }} /></Field>
        <button type="button" className="ghost" onClick={() => { setNf({ ...nf, code: genCode() }); c.setError(''); }} style={S('height:52px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer')}>New code</button>
      </>)}

      {kind === 'summary' && (<>
        <div style={S('display:flex;flex-direction:column;gap:4px;padding:18px 20px;border:1px solid #E6E8EC;border-radius:22px;background:#FAFAFB')}>
          <span style={S('font-size:13px;color:#5E6673')}>Gift card</span>
          <span style={S('font-size:34px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{valid ? money(cents) : '$0'}</span>
        </div>
        <DetailRows go={jump} rows={[
          { icon: I_DOLLAR, text: valid ? money(cents) : 'No amount', step: 0 },
          { icon: ICONS.person, text: nf.name.trim() || 'No name', step: 1 },
          { icon: I_CODE, text: nf.code || 'No code', step: 2 },
        ]} />
      </>)}
    </StepShell>
  );
}
