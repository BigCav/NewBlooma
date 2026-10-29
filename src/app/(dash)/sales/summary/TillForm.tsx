'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { decimalInput } from '@/lib/numeric';
import { S } from '../../calendar/pickers';
import { fmt } from '../shared';
import { closeTill } from './actions';

export type Till = { counted_cents: number; expected_cents: number; note: string | null; closed_at: string } | null;

const verdict = (diff: number) => diff === 0 ? 'The count matches.' : diff < 0 ? `Short by ${fmt(-diff)}.` : `Over by ${fmt(diff)}.`;

/** Count the cash in the drawer against what the sales say should be there, and keep a record of it for the day. */
export function TillForm({ day, expected, till, mobile }: { day: string; expected: number; till: Till; mobile: boolean }) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [amount, setAmount] = useState(till ? String(till.counted_cents / 100) : '');
  const [note, setNote] = useState(till?.note ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const h = mobile ? 48 : 44;
  const save = () => startT(async () => {
    const r = await closeTill(day, amount, note);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setMsg({ ok: true, text: `Saved. Counted ${fmt(r.counted!)}, expected ${fmt(r.expected!)}. ${verdict(r.counted! - r.expected!)}` });
    router.refresh();
  });
  const input = 'box-sizing:border-box;width:100%;height:' + h + 'px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF';
  return (
    <div style={S('display:flex;flex-direction:column;gap:12px')}>
      {till && <p style={S('margin:0;font-size:13.5px;color:#5E6673')}>Closed with {fmt(till.counted_cents)} counted against {fmt(till.expected_cents)} expected. {verdict(till.counted_cents - till.expected_cents)} Count again to update it.</p>}
      <label style={S('display:flex;flex-direction:column;gap:6px;font-size:13.5px;font-weight:600')}>Cash counted in the drawer
        <input inputMode="decimal" value={amount} onChange={(e) => { setAmount(decimalInput(e.target.value)); setMsg(null); }} placeholder={String(expected / 100)} style={{ ...S(input), minHeight: 0 }} /></label>
      <label style={S('display:flex;flex-direction:column;gap:6px;font-size:13.5px;font-weight:600')}>Note (optional)
        <input type="text" maxLength={300} value={note} onChange={(e) => { setNote(e.target.value); setMsg(null); }} placeholder="For example, paid the florist from the till" style={{ ...S(input), minHeight: 0 }} /></label>
      {msg && <p role={msg.ok ? 'status' : 'alert'} style={S('margin:0;font-size:13.5px;font-weight:500;color:' + (msg.ok ? '#14624A' : '#B42318'))}>{msg.text}</p>}
      <button onClick={save} disabled={busy || !amount} style={S('align-self:flex-start;height:' + h + 'px;padding:0 22px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500;cursor:pointer;opacity:' + (busy || !amount ? 0.5 : 1))}>{till ? 'Update the count' : 'Close the till'}</button>
    </div>
  );
}
