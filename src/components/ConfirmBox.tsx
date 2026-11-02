'use client';
// Asking before something is removed or undone. One look and one button order everywhere: Keep on the left, the red action on the right.
import { S } from '@/app/(dash)/calendar/pickers';

const BTN = 'flex:1 1 0;height:48px;border-radius:999px;font:inherit;font-size:14px;font-weight:500;cursor:pointer';

export function ConfirmBox({ label, title, body, error, action, keep = 'Keep', onAction, onKeep, busy }: {
  /** Read out by a screen reader when the box appears. */
  label: string; title: string; body?: string; error?: string;
  /** The red button, for example "Remove product". */
  action: string; keep?: string; onAction: () => void; onKeep: () => void; busy?: boolean;
}) {
  return (
    <div role="alertdialog" aria-label={label} style={S('display:flex;flex-direction:column;gap:12px;box-sizing:border-box;padding:16px;border:1px solid #F3C6C3;border-radius:20px;background:#FDECEA')}>
      <div>
        <div style={S('font-size:14.5px;font-weight:600;overflow-wrap:anywhere')}>{title}</div>
        {!!body && <div style={S('margin-top:2px;font-size:13px;color:#5E6673')}>{body}</div>}
      </div>
      {!!error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{error}</p>}
      <div style={S('display:flex;gap:10px')}>
        <button type="button" className="ghost" onClick={onKeep} style={S(BTN + ';border:1px solid #E1E4E9;background:#FFFFFF;color:#0E1116')}>{keep}</button>
        <button type="button" onClick={onAction} disabled={busy} style={S(BTN + ';border:0;background:#C0261B;color:#FFFFFF')}>{action}</button>
      </div>
    </div>
  );
}
