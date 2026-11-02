'use client';
import { useEffect, useRef, useState } from 'react';
import { terminalCancel, terminalPoll, terminalPress } from './actions';

export type TermPhase = 'idle' | 'pending' | 'approved' | 'failed';
export type TermBtn = { name: string; label: string };

/**
 * One card payment on the EFTPOS terminal, from pressing Charge to the result.
 * It polls the server until Windcave reports the end, and keeps the screen locked while the terminal is working.
 */
export function useTerminal(onSettled?: (approved: boolean) => void) {
  const [txn, setTxn] = useState('');
  const [phase, setPhase] = useState<TermPhase>('idle');
  const [text, setText] = useState('');
  const [btns, setBtns] = useState<TermBtn[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seen = useRef(new Set<string>());
  const wantCancel = useRef(false);
  const done = useRef(onSettled);
  done.current = onSettled;

  useEffect(() => {
    if (!txn) return;
    let stop = false;
    const tick = async () => {
      let r: Awaited<ReturnType<typeof terminalPoll>>;
      try { r = await terminalPoll(txn); } catch { if (!stop) timer.current = setTimeout(tick, 3000); return; }
      if (stop) return;
      // Cancel was pressed but the terminal is still going: ask again until it ends.
      if (r.state === 'pending') { if (wantCancel.current) terminalCancel(txn); setText(r.text || 'Waiting for the customer'); setBtns(r.buttons ?? []); timer.current = setTimeout(tick, 2000); return; }
      wantCancel.current = false; setTxn(''); setBtns([]); setCancelling(false);
      if (r.state === 'approved') { setPhase('approved'); setText(''); }
      else { setPhase('failed'); setText(r.state === 'declined' ? (r.text ? 'Not approved: ' + r.text : 'The payment was not approved.') : r.text || 'Something went wrong. Check the terminal.'); }
      done.current?.(r.state === 'approved');
    };
    tick();
    return () => { stop = true; clearTimeout(timer.current); };
  }, [txn]);

  // A reload or closed tab does not stop the terminal; at least say so.
  useEffect(() => {
    if (phase !== 'pending') return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [phase]);

  return {
    txn, phase,
    /** The moment Charge is pressed, before the server has answered. */
    begin: () => { wantCancel.current = false; setPhase('pending'); setText('Sending to the terminal'); setBtns([]); setCancelling(false); },
    start: (t: string) => { seen.current.add(t); setTxn(t); setPhase('pending'); setText('Sent to the terminal'); setBtns([]); setCancelling(false); },
    /** Pick up a payment that was already running when the page opened. Each one is only picked up once. */
    resume: (t: string) => { if (seen.current.has(t) || phase !== 'idle') return; seen.current.add(t); setTxn(t); setPhase('pending'); setText('Payment in progress on the terminal'); },
    fail: (msg: string) => { setTxn(''); setBtns([]); setCancelling(false); setPhase('failed'); setText(msg); },
    reset: () => { setTxn(''); setPhase('idle'); setText(''); setBtns([]); setCancelling(false); },
    view: {
      phase, text, btns, cancelling, hasTxn: !!txn,
      onCancel: () => { if (!txn) return; wantCancel.current = true; setCancelling(true); terminalCancel(txn); },
      onPress: (b: TermBtn) => { if (txn) terminalPress(txn, b.name, b.label); },
    },
  };
}
