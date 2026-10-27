'use client';
// Converted from the prototype's ClientAccount.dc.html and MobileClientAccount.dc.html. Markup and style strings follow the prototype;
// data comes from the server and the handlers are real server actions. The same flex layout wraps to one column on phones.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { phoneInput } from '@/lib/phone';
import { clientSignIn, clientSignOut } from '../book/actions';
import { AcctChip } from '../AcctChip';
import { changePassword, saveDetails } from './actions';

export type BookingRow = { id: string; date: string; when: string; what: string; who: string; meta: string; price: string; status: string; manage: string | null; again: string | null };
type Acct = { name: string; email: string; phone: string };
type Props = { slug: string; salon: string; account: Acct | null; upcoming: BookingRow[]; past: BookingRow[] };

const initialsOf = (n: string) => n.split(' ').filter(Boolean).map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase() || 'C';
const page: React.CSSProperties = { minHeight: '100dvh', background: '#F4F5F7', color: '#0E1116', fontFamily: "'Geist', system-ui, sans-serif", fontSize: 14, lineHeight: 1.4 };
const wrap: React.CSSProperties = { maxWidth: 1180, margin: '0 auto', padding: '24px 20px 56px', display: 'flex', flexDirection: 'column', gap: 28, boxSizing: 'border-box' };
const card: React.CSSProperties = { boxSizing: 'border-box', background: '#FFFFFF', border: '1px solid #E6E8EC', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 };
const dark: React.CSSProperties = { height: 44, padding: '0 22px', boxSizing: 'border-box', borderRadius: 999, border: 0, background: '#0E1116', color: '#FFFFFF', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', cursor: 'pointer', fontFamily: 'inherit' };
const light: React.CSSProperties = { ...dark, background: '#FFFFFF', color: '#0E1116', border: '1px solid #E1E4E9' };
const input: React.CSSProperties = { boxSizing: 'border-box', width: '100%', height: 48, padding: '0 14px', border: '1px solid #E1E4E9', borderRadius: 14, font: 'inherit', color: '#0E1116', background: '#FFFFFF' };
const label: React.CSSProperties = { fontSize: 14, fontWeight: 600 };
const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
const notice: React.CSSProperties = { padding: '6px 14px', borderRadius: 999, background: '#DDF3EA', color: '#14624A', fontSize: 13, fontWeight: 500 };
const err: React.CSSProperties = { margin: 0, color: '#B42318', fontSize: 13.5, fontWeight: 500 };

function SignIn({ slug, salon }: { slug: string; salon: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setError('');
    try { const r = await clientSignIn({ slug, email, password: pw }); if (r.error) setError(r.error); else router.refresh(); } catch { setError('Something went wrong. Please try again.'); }
    setBusy(false);
  };
  return (
    <div style={{ ...page, display: 'flex', alignItems: 'center' }}><div style={{ ...wrap, maxWidth: 1000, width: '100%', gap: 20 }}>
      <Link href={`/b/${slug}`} className="only-m" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: '#0E1116', textDecoration: 'none' }}>{salon}</Link>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 20 }}>
        <aside className="only-d" style={{ display: 'flex', flex: '1 1 0', minWidth: 0, boxSizing: 'border-box', borderRadius: 28, background: '#0E1116', color: '#FFFFFF', padding: 40, flexDirection: 'column', justifyContent: 'space-between', gap: 40 }}>
          <Link href={`/b/${slug}`} style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: '#FFFFFF', textDecoration: 'none' }}>{salon}</Link>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ margin: 0, fontSize: 32, lineHeight: 1.15, fontWeight: 600, letterSpacing: '-0.03em' }}>Your appointments, all in one place.</h2>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['See your upcoming visits', 'Change or cancel in a tap', 'Rebook your favourites faster', 'Your details saved for next time'].map((t) => (
                <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, color: '#D5D9E0' }}>
                  <span aria-hidden style={{ flex: '0 0 auto', width: 22, height: 22, borderRadius: 999, background: '#ECE8FF', color: '#3B2BB5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>✓</span>{t}
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <form onSubmit={(e) => { e.preventDefault(); go(); }} style={{ ...card, flex: '1 1 0', minWidth: 0, padding: 32 }}>
          <div><h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em' }}>Your account</h1>
            <p style={{ margin: '6px 0 0', color: '#5E6673' }}>Sign in to see and manage your appointments.</p></div>
          <input aria-label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={input} />
          <input aria-label="Password" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" style={input} />
          {!!error && <p role="alert" style={err}>{error}</p>}
          <button type="submit" disabled={busy} style={{ ...dark, height: 48 }}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 16, background: '#F4F5F7', fontSize: 13.5, color: '#5E6673', lineHeight: 1.45 }}>
            <span aria-hidden style={{ flex: '0 0 auto', width: 22, height: 22, borderRadius: 999, background: '#ECE8FF', color: '#3B2BB5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>+</span>
            <span><strong style={{ color: '#0E1116', fontWeight: 600 }}>New here?</strong> <Link href={`/b/${slug}/book`} style={{ color: '#5B3DF5', fontWeight: 600, textDecoration: 'none' }}>Book an appointment</Link> and tick “Save my details for next time” to create your account.</span>
          </div>
        </form>
      </div>
    </div></div>
  );
}

export function AccountView(props: Props) {
  return <AccountInner key={props.account?.email ?? 'signed-out'} {...props} />;
}

function AccountInner({ slug, salon, account, upcoming, past }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState<Acct>(account ?? { name: '', email: '', phone: '' });
  const [f, setF] = useState<Acct>(saved);
  const [error, setError] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [show, setShow] = useState(false);
  const [pwError, setPwError] = useState(''); const [pwNote, setPwNote] = useState('');
  const t1 = useRef<ReturnType<typeof setTimeout>>(undefined); const t2 = useRef<ReturnType<typeof setTimeout>>(undefined);
  if (!account) return <SignIn slug={slug} salon={salon} />;

  const dirty = f.name !== saved.name || f.email !== saved.email || f.phone !== saved.phone;
  const setField = (k: keyof Acct, v: string) => { setF({ ...f, [k]: k === 'phone' ? phoneInput(v) : v }); setError(''); setNote(''); };
  const signOut = async () => { try { await clientSignOut(); } catch { /* cleared on the next load */ } window.location.assign('/b/' + slug); };
  const save = async () => {
    setBusy(true); setError('');
    const r = await saveDetails(slug, f).catch(() => ({ error: 'Something went wrong. Please try again.' } as { error?: string; notice?: string }));
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    const v = { name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone.trim() };
    setSaved(v); setF(v); setNote(r.notice ?? 'Details saved'); clearTimeout(t1.current); t1.current = setTimeout(() => setNote(''), 3000); router.refresh();
  };
  const savePw = async () => {
    if (pw.length < 8) { setPwError('Use at least 8 characters.'); return; }
    if (pw !== pw2) { setPwError('The two passwords do not match.'); return; }
    setBusy(true);
    const r = await changePassword(slug, pw).catch(() => ({ error: 'Something went wrong. Please try again.' } as { error?: string; notice?: string }));
    setBusy(false);
    if (r.error) { setPwError(r.error); return; }
    setPwOpen(false); setPw(''); setPw2(''); setShow(false); setPwError(''); setPwNote(r.notice ?? 'Password updated'); clearTimeout(t2.current); t2.current = setTimeout(() => setPwNote(''), 3000);
  };
  const pwInput = (id: string, lab: string, val: string, on: (v: string) => void, ph: string) => (
    <div style={field}><label htmlFor={id} style={label}>{lab}</label>
      <div style={{ position: 'relative' }}>
        <input id={id} type={show ? 'text' : 'password'} autoComplete="new-password" value={val} onChange={(e) => { on(e.target.value); setPwError(''); }} placeholder={ph} style={{ ...input, padding: '0 76px 0 14px' }} />
        <button type="button" onClick={() => setShow(!show)} style={{ position: 'absolute', right: 6, top: 4, height: 40, padding: '0 12px', border: 0, borderRadius: 999, background: 'transparent', color: '#5B3DF5', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{show ? 'Hide' : 'Show'}</button>
      </div>
    </div>
  );

  return (
    <div style={page}>
      <div className="acct-wrap">
        <header className="only-d" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Link href={`/b/${slug}`} style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: '#0E1116', textDecoration: 'none' }}>{salon}</Link>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <AcctChip slug={slug} name={saved.name || saved.email} />
            <Link href={`/b/${slug}/book`} style={{ ...dark, padding: '0 22px' }}>Book now</Link>
          </div>
        </header>
        <header className="only-m" style={{ flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Link href={`/b/${slug}`} style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: '#0E1116', textDecoration: 'none' }}>{salon}</Link>
            <Link href={`/b/${slug}/book`} style={{ ...dark, padding: '0 22px' }}>Book now</Link>
          </div>
          <AcctChip slug={slug} name={saved.name || saved.email} wide />
        </header>
        <div><h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.1, fontWeight: 600, letterSpacing: '-0.03em' }}>Your account</h1><p style={{ margin: '6px 0 0', color: '#5E6673', fontSize: 15, overflowWrap: 'anywhere' }}>{saved.name}, {saved.email}</p></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <section aria-label="Upcoming appointments" style={card}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Upcoming appointments</h2>
              {upcoming.length ? (
                <ul className="hscroll" style={{ margin: '0 -24px', padding: '0 24px 4px', listStyle: 'none', display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x proximity' }}>
                  {upcoming.map((u) => (
                    <li key={u.id} style={{ flex: '0 0 min(320px, 84%)', minWidth: 0, scrollSnapAlign: 'start', boxSizing: 'border-box', borderRadius: 20, background: '#F4F5F7', padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>{u.when}</span>
                        <span style={{ display: 'block', marginTop: 4, fontSize: 14.5, overflowWrap: 'anywhere' }}>{u.what}{u.who ? ` with ${u.who}` : ''}</span>
                        <span style={{ display: 'block', marginTop: 2, color: '#5E6673', fontSize: 13 }}>{u.meta}, pay at the salon{u.status === 'Awaiting confirmation' ? ', awaiting confirmation' : ''}</span>
                      </span>
                      {u.manage
                        ? <Link href={u.manage} aria-label={`Change or cancel ${u.what} on ${u.when}`} style={{ ...dark, width: '100%', padding: '0 20px' }}>Change or cancel</Link>
                        : <span style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 999, background: '#ECE8FF', color: '#3B2BB5', fontSize: 13, fontWeight: 500 }}>{u.status === 'In progress' ? 'Checked in' : u.status}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                  <p style={{ margin: 0, color: '#5E6673', fontSize: 15 }}>You have nothing booked right now.</p>
                  <Link href={`/b/${slug}/book`} style={dark}>Book now</Link>
                </div>
              )}
            </section>
            <section aria-label="Past visits" style={card}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Past visits</h2>
              {past.length ? (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {past.map((p) => (
                    <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderTop: '1px solid #EEF0F3' }}>
                      <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, overflowWrap: 'anywhere' }}>{p.what}</span>
                        <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: '#5E6673', overflowWrap: 'anywhere' }}>{p.date}{p.who ? ` with ${p.who}` : ''}</span>
                      </span>
                      <span style={{ flex: '0 0 auto', fontSize: 14, fontWeight: 600, color: '#5E6673' }}>{p.price}</span>
                      <Link href={`/b/${slug}/book${p.again ? `?service=${p.again}` : ''}`} aria-label={`Book ${p.what} again`} style={{ ...light, flex: '0 0 auto', padding: '0 18px' }}>Book again</Link>
                    </li>
                  ))}
                </ul>
              ) : <p style={{ margin: 0, color: '#5E6673', fontSize: 15 }}>Your past visits will show here.</p>}
            </section>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 24 }}>
            <section aria-label="Your details" style={{ ...card, flex: '1 1 360px', minWidth: 0 }}>
              <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Your details</h2><p style={{ margin: '4px 0 0', color: '#5E6673', fontSize: 14 }}>We fill these in when you book.</p></div>
              <div style={field}><label htmlFor="ca-name" style={label}>Full name</label><input id="ca-name" type="text" autoComplete="name" value={f.name} onChange={(e) => setField('name', e.target.value)} placeholder="Your name" style={input} /></div>
              <div style={field}><label htmlFor="ca-email" style={label}>Email</label><input id="ca-email" type="email" autoComplete="email" value={f.email} onChange={(e) => setField('email', e.target.value)} placeholder="you@example.com" style={input} /></div>
              <div style={field}><label htmlFor="ca-phone" style={label}>Phone</label><input id="ca-phone" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="Required" style={input} /></div>
              {!!error && <p role="alert" style={err}>{error}</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                <button onClick={save} disabled={!dirty || busy} style={{ height: 48, border: 0, borderRadius: 999, padding: '0 24px', fontSize: 14.5, fontWeight: 500, fontFamily: 'inherit', cursor: dirty ? 'pointer' : 'default', background: dirty ? '#0E1116' : '#D5D9E0', color: dirty ? '#FFFFFF' : '#5E6673' }}>Save changes</button>
                {!!note && <span role="status" style={notice}>{note}</span>}
              </div>
            </section>
            <section aria-label="Password" style={{ ...card, flex: '1 1 360px', minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Password</h2><p style={{ margin: '4px 0 0', color: '#5E6673', fontSize: 14 }}>Use at least 8 characters.</p></div>
                {!pwOpen && <button onClick={() => { setPwOpen(true); setPwNote(''); }} style={{ ...light, padding: '0 20px' }}>Change password</button>}
              </div>
              {pwOpen && (<>
                {pwInput('ca-pw', 'New password', pw, setPw, 'At least 8 characters')}
                {pwInput('ca-pw2', 'Confirm new password', pw2, setPw2, 'Type it again')}
                {!!pwError && <p role="alert" style={err}>{pwError}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={savePw} disabled={busy} style={{ ...dark, flex: '1 1 0', height: 48, fontSize: 14.5 }}>Update</button>
                  <button onClick={() => { setPwOpen(false); setPw(''); setPw2(''); setPwError(''); }} style={{ ...light, flex: '1 1 0', height: 48, fontSize: 14.5 }}>Cancel</button>
                </div>
              </>)}
              {!!pwNote && <span role="status" style={{ ...notice, alignSelf: 'flex-start' }}>{pwNote}</span>}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
