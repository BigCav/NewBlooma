'use client';
// The EFTPOS receipt Windcave's terminal sends back, shown exactly as sent (the terminal has no printer), with Print, Email and the merchant copy.
import { useEffect, useState } from 'react';
import { S } from '@/app/(dash)/calendar/pickers';
import { FIELD_IN, FieldError, Notice, OUTLINE, dim } from '@/components/ui';
import { latestReceipt, receiptLines, type HitReceipt } from '@/lib/hit-receipt';
import { printReceipt } from '@/lib/print-receipt';
import { cardMerchantReceipt, cardReceipts, emailCardReceipt } from '@/app/(dash)/sales/actions';

const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace";
const SMALL = OUTLINE + ';flex:0 0 auto;height:44px;padding:0 18px;width:auto';

/** One receipt. `signing`: the copy to sign, while the terminal waits for YES / NO (it can be printed, not emailed). */
export function ReceiptBox({ txn, receipt, signing = false }: { txn: string; receipt: HitReceipt; signing?: boolean }) {
  const [merchant, setMerchant] = useState<HitReceipt | null>(null);
  const [to, setTo] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setMerchant(null); setAsking(false); setNote(''); setHint(''); setError(''); }, [txn]);
  const r = merchant ?? receipt;
  const lines = receiptLines(r.text, r.width);
  const title = merchant ? 'Merchant copy' : signing || r.stage === 'signature' ? 'Receipt to sign' : 'Customer receipt';
  const getMerchant = async () => {
    setBusy(true); setError(''); setNote('');
    try { const x = await cardMerchantReceipt(txn); if (x.error || !x.receipt) setError(x.error ?? 'No merchant copy.'); else setMerchant(x.receipt); }
    catch { setError('Could not reach the terminal. Try again.'); }
    finally { setBusy(false); }
  };
  // Email goes straight to the customer's email on file; with none on file (a walk-in) an address is asked for.
  const send = async (typed = false) => {
    setBusy(true); setError(''); setNote(''); setHint('');
    try {
      const x = await emailCardReceipt(txn, merchant ? 'merchant' : 'customer', typed ? to : '');
      if (x.needsEmail) { setAsking(true); setHint('There is no email on file for this customer. Enter one to send the receipt.'); }
      else if (x.error) setError(x.error);
      else { setNote(x.notice ?? 'Receipt sent'); setAsking(false); }
    }
    catch { setError('Could not send. Try again.'); }
    finally { setBusy(false); }
  };
  return (
    <section aria-label={title} style={S('width:100%;max-width:360px;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;text-align:center')}>
      <div style={S('font-size:13px;font-weight:600;color:#5E6673')}>{title}</div>
      {/* The receipt keeps its own spacing; the block as a whole sits in the middle of the box. */}
      <div style={S('padding:14px;border:1px solid #E6E8EC;border-radius:14px;background:#FFFFFF;overflow:auto;max-height:280px')}>
        <pre style={S(`margin:0 auto;width:max-content;max-width:none;text-align:left;color:#0E1116;font:12.5px/1.3 ${MONO};white-space:pre`)}>{lines.join('\n')}</pre>
      </div>
      <div style={S('display:flex;flex-wrap:wrap;justify-content:center;gap:8px')}>
        <button type="button" className="ghost" onClick={() => printReceipt(lines, r.width)} style={S(SMALL)}>Print</button>
        {!signing && r.stage !== 'signature' && !asking && <button type="button" className="ghost" onClick={() => send()} disabled={busy} style={S(SMALL + dim(busy))}>{busy && !asking ? 'Sending…' : 'Email'}</button>}
        {!signing && r.stage !== 'signature' && !merchant && <button type="button" className="ghost" onClick={getMerchant} disabled={busy} style={S(SMALL + dim(busy))}>Merchant copy</button>}
        {!!merchant && <button type="button" className="ghost" onClick={() => setMerchant(null)} style={S(SMALL)}>Customer copy</button>}
      </div>
      {asking && (
        <div style={S('display:flex;gap:8px;text-align:left')}>
          <input type="email" inputMode="email" autoComplete="email" aria-label="Email address for the receipt" value={to} onChange={(e) => { setTo(e.target.value); setError(''); }} placeholder="Email address" style={S(FIELD_IN + ';flex:1 1 auto;min-width:0')} />
          <button type="button" onClick={() => send(true)} disabled={busy} style={S(SMALL + ';background:#0E1116;color:#FFFFFF;border-color:#0E1116' + dim(busy))}>{busy ? 'Sending…' : 'Send'}</button>
        </div>
      )}
      {!!hint && <p style={S('margin:0;font-size:13px;color:#5E6673')}>{hint}</p>}
      {!!note && <Notice>{note}</Notice>}
      {!!error && <FieldError>{error}</FieldError>}
    </section>
  );
}

/** A receipt kept earlier, loaded from the saved copy. */
export function StoredReceipt({ txn, empty }: { txn: string; empty: string }) {
  const [r, setR] = useState<HitReceipt | null | undefined>(undefined);
  useEffect(() => { let live = true; setR(undefined); cardReceipts(txn).then((x) => { if (live) setR(latestReceipt(x.receipts) ?? null); }).catch(() => { if (live) setR(null); }); return () => { live = false; }; }, [txn]);
  if (r === undefined) return <p style={S('margin:0;color:#5E6673;font-size:14px')}>Loading…</p>;
  if (r === null) return <p style={S('margin:0;color:#5E6673;font-size:14px')}>{empty}</p>;
  return <ReceiptBox txn={txn} receipt={r} />;
}

/** The card receipts of a paid sale: the payment's and, if it was refunded on the terminal, the refund's. */
export function CardReceiptPage({ txn, refundTxn, onBack }: { txn: string; refundTxn?: string; onBack: () => void }) {
  return (
    <div style={S('display:flex;flex-direction:column;gap:18px')}>
      <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
        <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Card receipt</h2>
        <button type="button" className="ghost" onClick={onBack} style={S(SMALL)}>Back</button>
      </div>
      <StoredReceipt txn={txn} empty="No receipt was kept for this payment (it was taken before receipts were saved)." />
      {!!refundTxn && <><h3 style={S('margin:6px 0 0;font-size:16px;font-weight:600')}>Refund</h3><StoredReceipt txn={refundTxn} empty="No receipt was kept for this refund." /></>}
    </div>
  );
}
