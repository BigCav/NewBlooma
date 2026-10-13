'use client';
import { useActionState, useState } from 'react';
import { submitReview } from './actions';

export default function ReviewForm({ token, salon }: { token: string; salon: string }) {
  const [state, run, pending] = useActionState(submitReview.bind(null, token), undefined as { error?: string; ok?: boolean } | undefined);
  const [stars, setStars] = useState(0);
  if (state?.ok) return <div className="auth"><div className="card"><h1>Thank you</h1><p className="muted">Your review helps {salon} and other clients.</p></div></div>;
  return (
    <div className="auth"><form action={run} className="card">
      <div className="brand" style={{ paddingLeft: 0 }}>{salon}</div>
      <h1 style={{ marginBottom: 12 }}>How was your visit?</h1>
      <input type="hidden" name="stars" value={stars} />
      <div className="row" role="radiogroup" aria-label="Rating" style={{ gap: 6, marginBottom: 14 }}>
        {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setStars(n)} style={{ fontSize: 34, background: 'none', border: 0, cursor: 'pointer', color: n <= stars ? '#F5A623' : 'var(--line2)' }}>★</button>)}
      </div>
      <div className="field"><label htmlFor="body">Tell us more</label><textarea id="body" name="body" rows={4} required /></div>
      {state?.error && <div className="notice err">{state.error}</div>}
      <button className="btn primary" disabled={pending || !stars}>Submit review</button>
    </form></div>
  );
}
