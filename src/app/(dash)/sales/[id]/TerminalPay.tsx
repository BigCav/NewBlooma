'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { terminalStart, terminalPoll, terminalCancel } from '../actions';

export default function TerminalPay({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [txn, setTxn] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!txn) return;
    let stop = false;
    const tick = async () => {
      const r = await terminalPoll(txn);
      if (stop) return;
      if (r.state === 'pending') { setMsg(r.text || 'Waiting for the customer…'); timer.current = setTimeout(tick, 2000); return; }
      setTxn('');
      if (r.state === 'approved') router.refresh();
      else { setMsg(r.state === 'declined' ? `Not approved${r.text ? `: ${r.text}` : ''}` : r.text || 'Something went wrong. Check the terminal.'); router.refresh(); }
    };
    tick();
    return () => { stop = true; clearTimeout(timer.current); };
  }, [txn, router]);

  return (
    <div>
      <button className="btn primary" style={{ width: '100%' }} disabled={busy || !!txn} onClick={async () => {
        setBusy(true); setMsg('');
        const r = await terminalStart(saleId);
        setBusy(false);
        if (r.error) setMsg(r.error); else { setTxn(r.txn!); setMsg('Sent to the terminal…'); }
      }}>{txn ? 'Waiting on terminal…' : 'Pay on card terminal'}</button>
      {msg && <div className="small muted" style={{ marginTop: 8 }} role="status">{msg}</div>}
      {txn && <button className="btn sm danger" style={{ marginTop: 8 }} onClick={async () => { await terminalCancel(txn); }}>Cancel on terminal</button>}
    </div>
  );
}
