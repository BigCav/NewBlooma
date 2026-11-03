'use client';
import { useEffect } from 'react';

const PAGE = { minHeight: '100dvh', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#F4F5F7', color: '#0E1116' } as const;
const CARD = { width: '100%', maxWidth: 420, boxSizing: 'border-box', padding: 28, background: '#FFFFFF', border: '1px solid #E6E8EC', borderRadius: 24, display: 'flex', flexDirection: 'column', gap: 12 } as const;
const BLACK = { height: 52, border: 0, borderRadius: 999, background: '#0E1116', color: '#FFFFFF', font: 'inherit', fontSize: 14.5, fontWeight: 500, cursor: 'pointer', marginTop: 8 } as const;

/** What anyone sees when a page fails to load: a plain message and a way to try again. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main style={PAGE}>
      <div role="alert" style={CARD}>
        <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.15, fontWeight: 600, letterSpacing: '-0.03em' }}>Something went wrong</h1>
        <p style={{ margin: 0, color: '#5E6673', fontSize: 15 }}>Something went wrong. Please try again.</p>
        <button type="button" onClick={() => reset()} style={BLACK}>Try again</button>
      </div>
    </main>
  );
}
