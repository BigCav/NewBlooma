'use client';
// 1:1 conversion of the prototype's SignIn.dc.html (sign in, create account and password reset share one screen).
// "new" is the one extra mode: choosing a new password after following the reset email.
import { useState } from 'react';
import { S } from '@/app/(dash)/calendar/pickers';
import { requestReset, setNewPassword, signIn, signUp } from '@/app/auth-actions';

type Mode = 'in' | 'up' | 'reset' | 'new';
const FIELD = 'box-sizing:border-box;width:100%;min-height:0;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF';
const COPY: Record<Mode, { title: string; sub: string; cta: string }> = {
  in: { title: 'Welcome back', sub: 'Sign in to manage your salon.', cta: 'Sign in' },
  up: { title: 'Create your account', sub: 'Set up Aster in a few minutes. No card needed.', cta: 'Create account' },
  reset: { title: 'Reset your password', sub: 'We will email you a link to choose a new one.', cta: 'Send reset link' },
  new: { title: 'Choose a new password', sub: 'Use at least 8 characters.', cta: 'Save password' },
};
const BULLET = <span aria-hidden="true" style={S('width:8px;height:8px;border-radius:999px;background:#8F7CFF;flex:0 0 8px')}></span>;

export function AuthView({ mode: initial }: { mode: Mode }) {
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [name, setName] = useState('');
  const [show, setShow] = useState(false); const [error, setError] = useState('');
  const [done, setDone] = useState<null | 'created' | 'confirm' | 'sent'>(null);
  const [busy, setBusy] = useState(false);
  const goMode = (m: Mode) => { setMode(m); setError(''); setDone(null); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    if (mode === 'up' && !name.trim()) { setError('Add your name.'); return; }
    if (mode !== 'new' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (mode === 'in' && !pw) { setError('Enter your password.'); return; }
    if ((mode === 'up' || mode === 'new') && pw.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    setBusy(true);
    try {
      const r = mode === 'in' ? await signIn({ email, password: pw }) : mode === 'up' ? await signUp({ name, email, password: pw }) : mode === 'reset' ? await requestReset({ email }) : await setNewPassword({ password: pw });
      if (r?.error) setError(r.error); else if (r?.status) { setDone(r.status); setError(''); }
    } catch (err: any) { if (err?.digest?.startsWith?.('NEXT_REDIRECT')) throw err; setError('Something went wrong. Please try again.'); } finally { setBusy(false); }
  };
  const c = COPY[mode];
  const alts: [string, Mode][] = mode === 'in' ? [['Forgot password?', 'reset'], ['New to Aster? Create an account', 'up']] : mode === 'up' ? [['Already have an account? Sign in', 'in']] : [['Back to sign in', 'in']];
  const first = name.trim().split(' ')[0];
  const dc = done === 'created' ? { t: 'Account created', p: 'Welcome, ' + first + '. Next, tell us about your salon.', href: '/setup', label: 'Set up your salon' }
    : done === 'confirm' ? { t: 'Check your email', p: 'We sent a confirmation link to ' + email.trim() + '. Open it to finish creating your account.', href: '', label: '' }
    : { t: 'Check your email', p: 'If ' + email.trim() + ' has an account, a reset link is on its way.', href: '', label: '' };
  return (
    <div className="cal-root" style={S("display:flex;width:100%;min-height:100vh;box-sizing:border-box;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <aside className="si-aside" style={S('flex:0 0 44%;max-width:640px;box-sizing:border-box;background:#0E1116;color:#FFFFFF;padding:56px;display:flex;flex-direction:column;justify-content:space-between;gap:40px')}>
        <div style={S('display:flex;align-items:center;gap:10px')}><span aria-hidden="true" style={S('width:36px;height:36px;border-radius:12px;background:#FFFFFF;color:#0E1116;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600')}>A</span><span style={S('font-size:18px;font-weight:600;letter-spacing:-0.02em')}>Aster</span></div>
        <div style={S('display:flex;flex-direction:column;gap:28px;max-width:440px')}>
          <h2 style={S('margin:0;font-size:44px;line-height:1.08;font-weight:600;letter-spacing:-0.03em')}>Run your salon, calmly.</h2>
          <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:14px;color:#C9CDD5;font-size:16px')}>
            {['One calendar for the whole team', 'Online booking that fills gaps for you', 'Checkout, receipts and reports in one place'].map((t) => <li key={t} style={S('display:flex;gap:12px;align-items:center')}>{BULLET}{t}</li>)}
          </ul>
        </div>
        <div aria-hidden="true" style={S('color:#8A93A0;font-size:13px')}>{'\u00a0'}</div>
      </aside>
      <main style={S('flex:1 1 auto;min-width:0;display:flex;align-items:center;justify-content:center;padding:56px 32px;box-sizing:border-box')}>
        <div style={S('display:flex;flex-direction:column;gap:24px;width:100%;max-width:420px')}>
          <div style={S('display:flex;flex-direction:column;gap:8px')}>
            <h1 style={S('margin:0;font-size:30px;line-height:1.15;font-weight:600;letter-spacing:-0.025em')}>{c.title}</h1>
            <p style={S('margin:0;color:#5E6673;font-size:15px')}>{c.sub}</p>
          </div>
          {!done && <>
            <form onSubmit={submit} noValidate style={S('display:flex;flex-direction:column;gap:16px')}>
              {mode === 'up' && <div style={S('display:flex;flex-direction:column;gap:6px')}><label htmlFor="si-name" style={S('font-size:14px;font-weight:600')}>Your name</label><input id="si-name" className="bkf" type="text" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} placeholder="Full name" autoComplete="name" style={S(FIELD)} /></div>}
              {mode !== 'new' && <div style={S('display:flex;flex-direction:column;gap:6px')}><label htmlFor="si-email" style={S('font-size:14px;font-weight:600')}>Email</label><input id="si-email" className="bkf" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} placeholder="you@salon.com" autoComplete="email" style={S(FIELD)} /></div>}
              {mode !== 'reset' && (
                <div style={S('display:flex;flex-direction:column;gap:6px')}>
                  <label htmlFor="si-pw" style={S('font-size:14px;font-weight:600')}>{mode === 'new' ? 'New password' : 'Password'}</label>
                  <div style={S('position:relative')}>
                    <input id="si-pw" className="bkf" type={show ? 'text' : 'password'} value={pw} onChange={(e) => { setPw(e.target.value); setError(''); }} placeholder="Password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} style={S(FIELD + ';padding-right:76px')} />
                    <button type="button" onClick={() => setShow(!show)} style={S('position:absolute;right:6px;top:4px;height:40px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:#5B3DF5;font-size:13.5px;font-weight:600')}>{show ? 'Hide' : 'Show'}</button>
                  </div>
                </div>
              )}
              {!!error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{error}</p>}
              <button type="submit" disabled={busy} style={S('height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:15px;font-weight:500;padding:0 24px')}>{busy ? 'Please wait…' : c.cta}</button>
            </form>
            <div style={S('display:flex;flex-direction:column;align-items:flex-start;gap:2px')}>
              {alts.map(([l, m]) => <button key={l} onClick={() => goMode(m)} style={S('min-height:44px;padding:0;border:0;background:transparent;color:#0E1116;font-size:14px;font-weight:500;text-decoration:underline;text-underline-offset:3px;text-align:left')}>{l}</button>)}
            </div>
          </>}
          {done && (
            <div role="status" style={S('display:flex;flex-direction:column;gap:16px;padding:20px;border-radius:20px;background:#FFFFFF;border:1px solid #E6E8EC')}>
              <div style={S('display:flex;align-items:center;gap:12px')}>
                <span aria-hidden="true" style={S('flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#DDF3EA;display:flex;align-items:center;justify-content:center')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#14624A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19 7.5" /></svg></span>
                <div style={S('font-size:16px;font-weight:600')}>{dc.t}</div>
              </div>
              <p style={S('margin:0;color:#5E6673;font-size:14.5px;overflow-wrap:anywhere')}>{dc.p}</p>
              {!!dc.href && <a href={dc.href} style={S('height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:15px;font-weight:500;padding:0 24px;display:flex;align-items:center;justify-content:center;text-decoration:none;box-sizing:border-box')}>{dc.label}</a>}
              <button onClick={() => goMode('in')} style={S('height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:15px;font-weight:500;padding:0 24px')}>Back to sign in</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
