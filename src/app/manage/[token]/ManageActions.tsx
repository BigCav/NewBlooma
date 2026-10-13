'use client';
import { useActionState, useState, useTransition } from 'react';
import { cancelBooking, requestReschedule } from './actions';

export default function ManageActions({ token, policy }: { token: string; policy: string }) {
  const [state, run, pending] = useActionState(requestReschedule.bind(null, token), undefined as { error?: string; ok?: string } | undefined);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <details><summary className="btn" style={{ listStyle: 'none' }}>Ask to reschedule</summary>
        <form action={run} style={{ marginTop: 12 }}>
          <div className="field"><label htmlFor="body">What time would suit you?</label><textarea id="body" name="body" rows={3} required /></div>
          {state?.error && <div className="notice err">{state.error}</div>}{state?.ok && <div className="notice ok">{state.ok}</div>}
          <button className="btn dark" disabled={pending}>Send request</button>
        </form></details>
      {!confirm ? <button className="btn danger" onClick={() => setConfirm(true)}>Cancel appointment</button> : (
        <div><p className="small muted">Free cancellation is available until {policy} before your appointment. Later cancellations may be charged by the salon.</p>
          {msg && <div className="notice err">{msg}</div>}
          <div className="row"><button className="btn danger" disabled={busy} onClick={() => start(async () => { const r = await cancelBooking(token); if ('error' in r && r.error) setMsg(r.error); })}>Yes, cancel it</button><button className="btn" onClick={() => setConfirm(false)}>Keep it</button></div></div>
      )}
    </div>
  );
}
