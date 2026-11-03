'use client';

/** The last resort: shown when even the app's own layout fails, so it carries its own <html> and <body>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  void error;
  return (
    <html lang="en">
      <head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" /><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet" /></head>
      <body style={{ margin: 0, background: '#F4F5F7', color: '#0E1116', font: "15px/1.45 'Geist',ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif" }}>
        <main style={{ minHeight: '100dvh', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div role="alert" style={{ width: '100%', maxWidth: 420, boxSizing: 'border-box', padding: 28, background: '#FFFFFF', border: '1px solid #E6E8EC', borderRadius: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.15, fontWeight: 600, letterSpacing: '-0.03em' }}>Something went wrong</h1>
            <p style={{ margin: 0, color: '#5E6673', fontSize: 15 }}>Something went wrong. Please try again.</p>
            <button type="button" onClick={() => reset()} style={{ height: 52, border: 0, borderRadius: 999, background: '#0E1116', color: '#FFFFFF', font: 'inherit', fontSize: 14.5, fontWeight: 500, cursor: 'pointer', marginTop: 8 }}>Try again</button>
          </div>
        </main>
      </body>
    </html>
  );
}
