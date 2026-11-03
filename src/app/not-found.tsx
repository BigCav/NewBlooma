import Link from 'next/link';

/** A page that does not exist (or a link that no longer works). */
export default function NotFound() {
  return (
    <main style={{ minHeight: '100dvh', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#F4F5F7', color: '#0E1116' }}>
      <div style={{ width: '100%', maxWidth: 420, boxSizing: 'border-box', padding: 28, background: '#FFFFFF', border: '1px solid #E6E8EC', borderRadius: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.15, fontWeight: 600, letterSpacing: '-0.03em' }}>We couldn&apos;t find that page</h1>
        <p style={{ margin: 0, color: '#5E6673', fontSize: 15 }}>The link may be out of date, or the page may have moved.</p>
        <Link href="/" style={{ height: 52, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: '#0E1116', color: '#FFFFFF', fontSize: 14.5, fontWeight: 500 }}>Go back home</Link>
      </div>
    </main>
  );
}
