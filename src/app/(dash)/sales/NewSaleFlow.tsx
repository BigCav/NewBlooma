'use client';
import { decimalInput } from '@/lib/numeric';
import { S } from '../calendar/pickers';
import { ClientCard, ClientStep, DetailRows, ICONS, ROW, StepShell, TICK, Tiles, useSteps } from '../calendar/wizardUi';
import { DISC_PCTS, NO_DISC, TIP_OPTS, discountCents, fmt } from './shared';
import type { SalesCtl } from './SalesView';

const FIELD_IN = { ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), minHeight: 0, borderRadius: 0 } as const;
const I_CARD = <><rect x="3.5" y="6" width="17" height="12" rx="2.5" /><path d="M3.5 10.5h17" /></>;

function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} style={S('display:block;box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{label}</span>{children}</label>;
}

/** The phone's new sale as steps: client, service, payment, discount and tip when switched on, then a summary. */
export function NewSaleFlow({ c }: { c: SalesCtl }) {
  const nw = c.nw;
  const kinds = ['client', 'service', 'payment', ...(c.canDiscount ? ['discount'] : []), ...(c.askTip ? ['tip'] : []), 'summary'] as const;
  const last = kinds.length - 1;
  const { step, jump, forward, back } = useSteps(last, () => c.setError(''));
  const kind = kinds[step];
  const at = (k: string) => (kinds as readonly string[]).indexOf(k);
  const titles: Record<string, string> = { client: 'Select client', service: 'Select service', payment: 'Payment method', discount: 'Discount', tip: 'Tip', summary: 'Summary' };
  const svc = c.services.find((x) => x.id === nw.service) ?? null;
  const tipPct = c.askTip ? parseInt(nw.tip, 10) || 0 : 0;
  const tipAmt = svc ? Math.round(svc.priceCents * tipPct / 100) : 0;
  const disc = svc && c.canDiscount ? discountCents(svc.priceCents, nw.disc) : 0;
  const total = svc ? svc.priceCents - disc + tipAmt : 0;
  const methodLabel = c.methods.find((m) => m.id === nw.method)?.label ?? '';
  const ready = () => (kind === 'client' && !nw.client.trim() ? "Add the client's name." : kind === 'service' && !nw.service ? 'Choose a service.' : '');
  const next = () => { const e = ready(); if (e) { c.setError(e); return; } forward(); };
  const dv = nw.disc.kind === 'none' ? 'none' : nw.disc.kind === 'amount' ? 'amount' : nw.disc.value;
  const discText = nw.disc.kind === 'none' || !disc ? 'No discount' : (nw.disc.kind === 'percent' ? nw.disc.value + '% off' : fmt(disc) + ' off') + (nw.disc.note ? ' (' + nw.disc.note + ')' : '');

  return (
    <StepShell step={step} titles={kinds.map((k) => titles[k])} onBack={back} onClose={c.cancel} error={c.error}
      actions={kind === 'summary' ? [] : [{ label: 'Continue', onClick: next }]}
      bar={kind === 'summary' ? <button type="button" onClick={c.createSale} disabled={c.busy} style={S('width:100%;height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;cursor:pointer')}>Record sale</button> : undefined}>
      {kind === 'client' && <ClientStep name={nw.client} clientId={nw.clientId} recent={[]} onChange={(name, id) => { c.setNw({ ...nw, client: name, clientId: id }); c.setError(''); }} />}

      {kind === 'service' && (
        <div role="group" aria-label="Service" style={S('display:flex;flex-direction:column')}>
          {c.services.map((x) => { const on = nw.service === x.id; return (
            <button key={x.id} onClick={() => { c.setNw({ ...nw, service: on ? null : x.id }); c.setError(''); }} aria-pressed={on} style={S(ROW(on))}>
              <span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{x.name}</span>
              <span style={S('flex:0 0 auto;font-size:14px;color:#5E6673')}>{fmt(x.priceCents)}</span>
              {on && TICK}
            </button>
          ); })}
        </div>
      )}

      {kind === 'payment' && (<>
        <Tiles label="Payment method" options={c.methods.map((m) => [m.id, m.label] as const)} value={nw.method} onPick={(v) => c.setNw({ ...nw, method: v })} />
        {nw.method === 'gift_card' && <Field label="Gift card code" htmlFor="ns-code"><input id="ns-code" type="text" value={nw.code} onChange={(e) => c.setNw({ ...nw, code: e.target.value })} placeholder="Gift card code" style={FIELD_IN} /></Field>}
      </>)}

      {kind === 'discount' && (<>
        <Tiles label="Discount" options={[['none', 'None'], ...DISC_PCTS.map((v) => [v, v + '% off'] as const), ['amount', '$ off']] as readonly (readonly [string, string])[]} value={dv}
          onPick={(v) => c.setNw({ ...nw, disc: v === 'none' ? NO_DISC : v === 'amount' ? { ...nw.disc, kind: 'amount', value: nw.disc.kind === 'amount' ? nw.disc.value : '' } : { ...nw.disc, kind: 'percent', value: v } })} />
        {nw.disc.kind === 'amount' && <Field label="Amount off in dollars" htmlFor="ns-amt"><input id="ns-amt" inputMode="decimal" value={nw.disc.value} onChange={(e) => c.setNw({ ...nw, disc: { ...nw.disc, value: decimalInput(e.target.value) } })} placeholder="Like 10 or 7.50" style={FIELD_IN} /></Field>}
        {nw.disc.kind !== 'none' && <Field label="Reason (optional)" htmlFor="ns-note"><input id="ns-note" maxLength={60} value={nw.disc.note} onChange={(e) => c.setNw({ ...nw, disc: { ...nw.disc, note: e.target.value } })} placeholder="For example, staff discount" style={FIELD_IN} /></Field>}
      </>)}

      {kind === 'tip' && <Tiles label="Tip" options={TIP_OPTS} value={nw.tip} onPick={(v) => c.setNw({ ...nw, tip: v })} />}

      {kind === 'summary' && (<>
        <ClientCard name={nw.client} existing={!!nw.clientId} onChange={() => jump(0)} />
        <DetailRows go={jump} rows={[
          { icon: ICONS.scissors, text: svc ? svc.name + ', ' + fmt(svc.priceCents) : 'No service', step: at('service') },
          { icon: I_CARD, text: methodLabel, step: at('payment') },
          ...(c.canDiscount ? [{ icon: ICONS.tag, text: discText, step: at('discount') }] : []),
          ...(c.askTip ? [{ icon: ICONS.time, text: tipAmt ? fmt(tipAmt) + ' tip' : 'No tip', step: at('tip') }] : []),
        ]} />
        <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:4px 4px 0')}><span style={S('font-size:15px;font-weight:600')}>Total</span><span style={S('font-size:24px;font-weight:600;letter-spacing:-0.02em')}>{fmt(total)}</span></div>
      </>)}
    </StepShell>
  );
}
