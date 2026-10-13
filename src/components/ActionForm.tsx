'use client';
import { useActionState, useEffect, useRef, useState } from 'react';

type S = { error?: string; ok?: string } | undefined;

/** Form wrapper that shows an error or a success notice that clears itself. */
export default function ActionForm({ action, children, submit = 'Save', resetOnOk = false, className }: {
  action: (s: S, fd: FormData) => Promise<S>; children: React.ReactNode; submit?: string; resetOnOk?: boolean; className?: string;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  const [shown, setShown] = useState<S>();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    setShown(state);
    if (state?.ok && resetOnOk) ref.current?.reset();
    if (state?.ok) { const t = setTimeout(() => setShown(undefined), 4000); return () => clearTimeout(t); }
  }, [state, resetOnOk]);
  return (
    <form action={run} ref={ref} className={className}>
      {shown?.error && <div className="notice err" role="alert">{shown.error}</div>}
      {shown?.ok && <div className="notice ok" role="status">{shown.ok}</div>}
      {children}
      {submit && <button className="btn dark" disabled={pending}>{pending ? 'Saving…' : submit}</button>}
    </form>
  );
}
