'use client';
import { useEffect, useRef, useState } from 'react';
import { sendClientReply } from './actions';

type Msg = { mine: boolean; text: string; at: string };
const card: React.CSSProperties = { boxSizing: 'border-box', background: '#FFFFFF', border: '1px solid #E6E8EC', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 };

export function ReplyView({ token, salon, first, context, thread }: { token: string; salon: string; first: string; context: string; thread: Msg[] }) {
  const [msgs, setMsgs] = useState(thread); const [text, setText] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length]);
  const send = async () => {
    const t = text.trim(); if (!t) { setError('Write your reply first.'); return; }
    setBusy(true); setError('');
    const r = await sendClientReply(token, t).catch(() => ({ error: 'Something went wrong. Please try again.' } as { error?: string; ok?: boolean }));
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    setMsgs([...msgs, { mine: false, text: t, at: 'Just now' }]); setText('');
  };
  return (
    <div style={{ minHeight: '100dvh', background: '#F4F5F7', color: '#0E1116', fontFamily: "'Geist', system-ui, sans-serif", fontSize: 14, lineHeight: 1.4, padding: '24px 16px 48px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>{salon}</div>
        <section style={card} aria-label="Conversation">
          <div><h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em' }}>Hi {first}</h1>{!!context && <p style={{ margin: '6px 0 0', color: '#5E6673' }}>{context}</p>}</div>
          <ul ref={listRef} aria-label="Messages" style={{ margin: 0, padding: '2px 4px 2px 0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'min(44dvh, 360px)', overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {msgs.map((m, k) => (
              <li key={k} style={{ display: 'flex', justifyContent: m.mine ? 'flex-start' : 'flex-end' }}>
                <span style={{ display: 'block', maxWidth: '86%', flex: '0 0 auto' }}>
                  <span style={{ display: 'block', padding: '10px 14px', borderRadius: 18, overflowWrap: 'break-word', whiteSpace: 'pre-wrap', background: m.mine ? '#F4F5F7' : '#0E1116', color: m.mine ? '#0E1116' : '#FFFFFF' }}>{m.text}</span>
                  <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#5E6673', textAlign: m.mine ? 'left' : 'right' }}>{m.mine ? salon : 'You'}, {m.at}</span>
                </span>
              </li>
            ))}
          </ul>
          <label htmlFor="reply" style={{ fontSize: 14, fontWeight: 600 }}>Your reply</label>
          <textarea id="reply" value={text} onChange={(e) => { setText(e.target.value); setError(''); }} rows={4} maxLength={600} placeholder="Write a reply" style={{ boxSizing: 'border-box', width: '100%', padding: '12px 14px', border: '1px solid #E1E4E9', borderRadius: 14, font: 'inherit', resize: 'vertical' }} />
          {!!error && <p role="alert" style={{ margin: 0, color: '#B42318', fontSize: 13.5, fontWeight: 500 }}>{error}</p>}
          <button onClick={send} disabled={busy} style={{ height: 48, border: 0, borderRadius: 999, background: '#0E1116', color: '#FFFFFF', fontSize: 14.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>{busy ? 'Sending…' : 'Send reply'}</button>
          <p style={{ margin: 0, color: '#5E6673', fontSize: 13 }}>{salon} will see this in their inbox and may reply by email or text.</p>
        </section>
      </div>
    </div>
  );
}
