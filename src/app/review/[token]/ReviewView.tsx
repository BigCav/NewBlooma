'use client';
// 1:1 conversion of the prototype's Review.dc.html (the public review page).
import Link from 'next/link';
import { useState } from 'react';
import { S } from '../../(dash)/calendar/pickers';
import { submitReview } from './actions';
import { BLACK, FieldError, Icon, LabelledField, TEXTAREA, dim } from '@/components/ui';
import { TONE } from '@/lib/tones';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export function ReviewView({ token, salon, slug }: { token: string; salon: string; slug: string; name: string }) {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    if (!stars) { setError('Choose a star rating.'); return; }
    setBusy(true);
    try { const r = await submitReview(token, { stars, text }); if (r.error) setError(r.error); else { setDone(true); setError(''); } }
    catch { setError('Something went wrong. Please try again.'); } finally { setBusy(false); }
  };
  return (
    <div className="bk-flow cal-root" style={S("min-height:100vh;box-sizing:border-box;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;display:flex;flex-direction:column;align-items:center;padding:56px 24px;gap:20px")}>
      <div style={S('width:100%;max-width:560px;box-sizing:border-box;display:flex;flex-direction:column;gap:20px;flex:0 0 auto')}>
        <div><Link href={'/b/' + slug} style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em;color:#0E1116;text-decoration:none')}>{salon}</Link></div>
        {!done && (
          <section style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:32px;display:flex;flex-direction:column;gap:20px')}>
            <div><h1 style={S('margin:0;font-size:30px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>How was your visit?</h1><p style={S('margin:6px 0 0;color:#5E6673;font-size:15px')}>Your review helps other clients and helps us improve.</p></div>
            <div style={S('display:flex;flex-direction:column;gap:6px')}>
              <div role="group" aria-label="Rating" style={S('display:flex;gap:2px;margin-left:-8px')}>
                {[1, 2, 3, 4, 5].map((k) => <button key={k} onClick={() => { setStars(k); setError(''); }} aria-label={k + (k === 1 ? ' star' : ' stars')} aria-pressed={stars === k} style={S('width:52px;height:52px;padding:0;border-radius:999px;border:0;background:transparent;font-size:36px;line-height:1;color:' + (k <= stars ? '#E8A317' : '#D5D9E0'))}>★</button>)}
              </div>
              <span style={S('font-size:14px;color:#5E6673')}>{LABELS[stars] || 'Tap a star'}</span>
            </div>
            <LabelledField id="rv-t" label="Tell us more (optional)"><textarea id="rv-t" className="bkf" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="What went well? What could be better?" style={S(TEXTAREA + ';resize:vertical')} /></LabelledField>
            {!!error && <FieldError>{error}</FieldError>}
            <button onClick={submit} disabled={busy} style={S(BLACK + ';flex:0 0 auto;padding:0 20px' + dim(busy))}>{busy ? 'Sending…' : 'Submit review'}</button>
          </section>
        )}
        {done && (
          <section role="status" style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:32px;display:flex;flex-direction:column;gap:16px')}>
            <div style={S('width:48px;height:48px;border-radius:999px;background:' + TONE.green.bg + ';display:flex;align-items:center;justify-content:center')}><Icon name="tick" size={22} color={TONE.green.fg} w={2.2} /></div>
            <h1 style={S('margin:0;font-size:30px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>Thank you</h1>
            <p style={S('margin:0;color:#5E6673;font-size:15px')}>Your review has been sent to the team at {salon}.</p>
          </section>
        )}
      </div>
    </div>
  );
}
