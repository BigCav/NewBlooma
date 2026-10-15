'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clientSignIn, clientSignOut } from '../book/actions';

export type BookingRow = { id: string; when: string; services: string; staff: string; total: string; status: string; manage: string | null; again: string | null };
type Props = { slug: string; salon: string; account: { name: string; email: string } | null; upcoming: BookingRow[]; past: BookingRow[] };

const page: React.CSSProperties = { minHeight: '100dvh', background: '#F4F5F7', color: '#0E1116', fontFamily: "'Geist', system-ui, sans-serif", fontSize: 14, lineHeight: 1.4 };
const wrap: React.CSSProperties = { maxWidth: 640, margin: '0 auto', padding: '24px 20px 48px', display: 'flex', flexDirection: 'column', gap: 20, boxSizing: 'border-box' };
const card: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E6E8EC', borderRadius: 24, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 };
const btn: React.CSSProperties = { height: 44, padding: '0 20px', borderRadius: 999, border: 0, background: '#0E1116', color: '#FFFFFF', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', cursor: 'pointer', fontFamily: 'inherit' };
const ghost: React.CSSProperties = { ...btn, background: '#FFFFFF', color: '#0E1116', border: '1px solid #E1E4E9' };
const input: React.CSSProperties = { boxSizing: 'border-box', width: '100%', height: 48, padding: '0 14px', border: '1px solid #E1E4E9', borderRadius: 14, font: 'inherit', color: '#0E1116', background: '#FFFFFF' };

function Item({ b, slug }: { b: BookingRow; slug: string }) {
  return (
    <li style={{ listStyle: 'none', border: '1px solid #E6E8EC', borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{b.when}</span>
        <span style={{ fontSize: 12.5, fontWeight: 500, padding: '3px 10px', borderRadius: 999, background: '#EEF0F3', whiteSpace: 'nowrap', height: 'fit-content' }}>{b.status}</span>
      </div>
      <div style={{ color: '#5E6673', overflowWrap: 'anywhere' }}>{b.services}{b.staff ? ` with ${b.staff}` : ''}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600 }}>{b.total}</span>
        {b.manage ? <Link href={b.manage} style={{ ...ghost, height: 40 }}>Change or cancel</Link>
          : b.again ? <Link href={`/b/${slug}/book?service=${b.again}`} style={{ ...ghost, height: 40 }}>Book again</Link> : null}
      </div>
    </li>
  );
}

export function AccountView({ slug, salon, account, upcoming, past }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const signIn = async () => {
    setBusy(true); setErr('');
    try { const r = await clientSignIn({ slug, email, password: pw }); if (r.error) setErr(r.error); else router.refresh(); } catch { setErr('Something went wrong. Please try again.'); }
    setBusy(false);
  };
  const signOut = async () => { try { await clientSignOut(); } catch { /* cleared on next load */ } router.refresh(); };

  return (
    <div style={page}>
      <div style={wrap}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Link href={`/b/${slug}`} style={{ fontSize: 17, fontWeight: 600, color: '#0E1116', textDecoration: 'none' }}>{salon}</Link>
          {account && <button onClick={signOut} style={{ border: 0, background: 'transparent', color: '#5B3DF5', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>}
        </header>
        {!account ? (
          <form onSubmit={(e) => { e.preventDefault(); signIn(); }} style={card}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>My bookings</h1>
            <p style={{ margin: 0, color: '#5E6673' }}>Sign in to see and manage your appointments.</p>
            <input aria-label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={input} />
            <input aria-label="Password" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" style={input} />
            {!!err && <p role="alert" style={{ margin: 0, color: '#B42318', fontWeight: 500 }}>{err}</p>}
            <button type="submit" disabled={busy} style={btn}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <p style={{ margin: 0, color: '#5E6673', fontSize: 13 }}>No account yet? Book an appointment and choose “Save my details for next time”.</p>
            <Link href={`/b/${slug}/book`} style={ghost}>Book an appointment</Link>
          </form>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div><h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>My bookings</h1><div style={{ color: '#5E6673' }}>{account.name || account.email}</div></div>
              <Link href={`/b/${slug}/book`} style={btn}>Book now</Link>
            </div>
            <section style={card} aria-label="Upcoming">
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Upcoming</h2>
              {upcoming.length ? <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{upcoming.map((b) => <Item key={b.id} b={b} slug={slug} />)}</ul>
                : <p style={{ margin: 0, color: '#5E6673' }}>No upcoming appointments.</p>}
            </section>
            {past.length > 0 && (
              <section style={card} aria-label="Past">
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Past</h2>
                <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{past.map((b) => <Item key={b.id} b={b} slug={slug} />)}</ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
