'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { decimalInput } from '@/lib/numeric';
import { dollars } from '@/lib/format';
import { BLACK, FIELD_IN, FieldError, Notice, dim } from '@/components/ui';
import { Field } from '../../settings/forms/FormPage';
import { S } from '../../calendar/pickers';
import { closeTill } from './actions';

export type Till = { counted_cents: number; expected_cents: number; note: string | null; closed_at: string } | null;

const verdict = (diff: number) => diff === 0 ? 'The count matches.' : diff < 0 ? `Short by ${dollars(-diff)}.` : `Over by ${dollars(diff)}.`;

/** Count the cash in the drawer against what the sales say should be there, and keep a record of it for the day. */
export function TillForm({ day, expected, till, mobile }: { day: string; expected: number; till: Till; mobile: boolean }) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [amount, setAmount] = useState(till ? String(till.counted_cents / 100) : '');
  const [note, setNote] = useState(till?.note ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = () => startT(async () => {
    const r = await closeTill(day, amount, note);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setMsg({ ok: true, text: `Saved. Counted ${dollars(r.counted!)}, expected ${dollars(r.expected!)}. ${verdict(r.counted! - r.expected!)}` });
    router.refresh();
  });
  const off = busy || !amount;
  return (
    <div style={S('display:flex;flex-direction:column;gap:12px')}>
      {till && <p style={S('margin:0;font-size:13.5px;color:#5E6673')}>Closed with {dollars(till.counted_cents)} counted against {dollars(till.expected_cents)} expected. {verdict(till.counted_cents - till.expected_cents)} Count again to update it.</p>}
      <Field label="Cash counted in the drawer"><input inputMode="decimal" value={amount} onChange={(e) => { setAmount(decimalInput(e.target.value)); setMsg(null); }} placeholder={dollars(expected)} style={FIELD_IN} /></Field>
      <Field label="Note (optional)"><input type="text" maxLength={300} value={note} onChange={(e) => { setNote(e.target.value); setMsg(null); }} placeholder="For example, paid the florist from the till" style={FIELD_IN} /></Field>
      {msg && (msg.ok ? <Notice>{msg.text}</Notice> : <FieldError>{msg.text}</FieldError>)}
      <button onClick={save} disabled={off} style={S(BLACK + ';flex:0 0 auto' + (mobile ? ';width:100%' : ';align-self:flex-start;width:auto;padding:0 28px') + dim(off))}>{busy ? 'Saving…' : till ? 'Update the count' : 'Close the till'}</button>
    </div>
  );
}
