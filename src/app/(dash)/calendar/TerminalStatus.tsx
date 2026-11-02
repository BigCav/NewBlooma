'use client';
// The last step of a card payment: waiting on the EFTPOS terminal, then a tick or a cross.
import { S } from './pickers';
import type { TermBtn, TermPhase } from '../sales/useTerminal';

export type TermView = {
  phase: TermPhase; text: string; btns: TermBtn[]; cancelling: boolean; hasTxn: boolean;
  onCancel: () => void; onPress: (b: TermBtn) => void;
  /** Approved: finish up. */
  onDone: () => void;
  /** Not approved: send it to the terminal again. */
  onRetry: () => void;
  /** Not approved: go back to the checkout, for example to pick another way to pay. */
  onBack: () => void;
};

const BTN = 'flex:0 0 auto;width:100%;height:52px;border-radius:999px;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer';
const PRIMARY = BTN + ';border:0;background:#0E1116;color:#FFFFFF';
const SECOND = BTN + ';border:1px solid #E1E4E9;background:#FFFFFF;color:#0E1116';

function Mark({ phase }: { phase: Exclude<TermPhase, 'idle'> }) {
  if (phase === 'pending') return (
    <svg className="tp-spin" width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <circle cx="48" cy="48" r="40" stroke="#E6E8EC" strokeWidth="7" />
      <path d="M48 8a40 40 0 0 1 40 40" stroke="#0E1116" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
  const ok = phase === 'approved';
  return (
    <svg className="tp-pop" width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <circle cx="48" cy="48" r="44" fill={ok ? '#1E9E6A' : '#D92D20'} />
      {ok
        ? <path className="tp-draw" d="M28 50l14 14 27-30" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        : <g className="tp-draw" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round"><path d="M32 32l32 32" /><path d="M64 32L32 64" /></g>}
    </svg>
  );
}

export function TerminalStatus({ t, amount, refund }: { t: TermView; amount: string; refund?: boolean }) {
  const phase = t.phase === 'idle' ? 'pending' : t.phase;
  const what = refund ? 'refund' : 'payment';
  const title = phase === 'pending' ? 'Pending ' + what : phase === 'approved' ? (refund ? 'Refund approved' : 'Payment approved') : (refund ? 'Refund not completed' : 'Payment not taken');
  const sub = phase === 'approved' ? (refund ? 'The sale has been refunded to the card.' : 'The visit is paid.') : '';
  return (
    <div data-pay-lock={phase === 'pending' ? '' : undefined} style={S('display:flex;flex-direction:column;flex:1 1 auto;min-height:0;margin:0 -20px -40px')}>
      <div role="status" aria-live="polite" style={S('flex:1 1 0;min-height:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px 28px;text-align:center')}>
        <Mark phase={phase} />
        <h2 style={S('margin:6px 0 0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>{title}</h2>
        <div style={S('font-size:34px;font-weight:600;letter-spacing:-0.03em')}>{amount}</div>
        {!!sub && <p style={S('margin:0;max-width:320px;color:#5E6673;font-size:14.5px;line-height:1.45')}>{sub}</p>}
        {!!t.text && phase === 'failed' && <p style={S('margin:0;max-width:340px;font-size:14.5px;font-weight:500;line-height:1.45;color:' + (phase === 'failed' ? '#B42318' : '#0E1116'))}>{t.text}</p>}
        {phase === 'pending' && !!t.btns.length && (
          <div style={S('display:flex;gap:10px;width:100%;max-width:340px')}>
            {t.btns.map((b) => <button key={b.name} onClick={() => t.onPress(b)} style={S(SECOND + ';flex:1 1 0;width:auto')}>{b.label}</button>)}
          </div>
        )}
      </div>
      <div style={S('flex:0 0 auto;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px')}>
        {phase === 'pending' && <button onClick={t.onCancel} disabled={!t.hasTxn || t.cancelling} style={S(SECOND + ';opacity:' + (!t.hasTxn || t.cancelling ? 0.45 : 1))}>{t.cancelling ? 'Cancelling' : 'Cancel ' + what}</button>}
        {phase === 'approved' && <button onClick={t.onDone} style={S(PRIMARY)}>Done</button>}
        {phase === 'failed' && <>
          <button onClick={t.onRetry} style={S(PRIMARY)}>Try again</button>
          <button onClick={t.onBack} style={S(SECOND)}>Back to checkout</button>
        </>}
      </div>
    </div>
  );
}
