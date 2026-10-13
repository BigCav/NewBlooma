'use client';
import { useActionState } from 'react';
import Link from 'next/link';

type State = { error?: string; notice?: string } | undefined;

export default function AuthForm({ action, mode }: { action: (s: State, fd: FormData) => Promise<State>; mode: 'in' | 'up' }) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <div className="auth">
      <div className="brand" style={{ paddingLeft: 0 }}>Aster &amp; Co</div>
      <div className="card">
        <h1 style={{ marginBottom: 6 }}>{mode === 'in' ? 'Sign in' : 'Create your account'}</h1>
        <p className="muted" style={{ marginTop: 0 }}>{mode === 'in' ? 'Welcome back.' : 'Then set up your salon in a minute.'}</p>
        {state?.error && <div className="notice err" role="alert">{state.error}</div>}
        {state?.notice && <div className="notice ok" role="status">{state.notice}</div>}
        <form action={run}>
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={mode === 'up' ? 10 : undefined} /></div>
          <button className="btn primary" style={{ width: '100%' }} disabled={pending}>{pending ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
        </form>
        <p className="small muted" style={{ marginBottom: 0, textAlign: 'center' }}>
          {mode === 'in' ? <>New here? <Link href="/sign-up"><b>Create an account</b></Link></> : <>Have an account? <Link href="/sign-in"><b>Sign in</b></Link></>}
        </p>
      </div>
    </div>
  );
}
