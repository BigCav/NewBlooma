'use client';
// Messaging a client: the whole conversation with them, newest at the bottom, and a box to reply. One panel for the calendar,
// the Clients list and the client's profile (on desktop and on the phone), so writing to a client looks the same everywhere.
import { RING } from '@/components/ui';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { clientThread } from '@/app/(dash)/clients/actions';
import type { ChatMsg } from '@/app/(dash)/clients/thread';
import { S } from '@/app/(dash)/calendar/pickers';


/** The conversation as bubbles, with the day shown when it changes. */
export function ChatBubbles({ thread, empty = 'No messages yet. Say hello below.' }: { thread: ChatMsg[]; empty?: string }) {
  return (<>
    {thread.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>{empty}</p>}
    {thread.map((m, i) => {
      const newDay = !!m.day && (i === 0 || thread[i - 1].day !== m.day);
      return (
        <div key={m.id} style={S('display:flex;flex-direction:column;gap:6px')}>
          {newDay && <div style={S('align-self:center;margin:8px 0 2px;font-size:12.5px;color:#5E6673')}>{m.day}</div>}
          <div style={S('display:flex;flex-direction:column;align-items:' + (m.mine ? 'flex-end' : 'flex-start') + ';gap:3px')}>
            <div style={S('max-width:82%;box-sizing:border-box;padding:11px 15px;border-radius:20px;font-size:15px;line-height:1.35;overflow-wrap:anywhere;white-space:pre-wrap;' + (m.mine ? 'background:#0E1116;color:#FFFFFF;border-bottom-right-radius:6px' : 'background:#FFFFFF;color:#0E1116;border:1px solid #E6E8EC;border-bottom-left-radius:6px'))}>{m.text}</div>
            <div style={S('font-size:11.5px;color:#8A93A0')}>{(m.mine ? 'You, ' : '') + m.time}</div>
          </div>
        </div>
      );
    })}
  </>);
}

/** The reply box: a rounded field and a round send button. */
export function ChatComposer({ first, draft, onDraft, onSend, busy }: { first: string; draft: string; onDraft: (v: string) => void; onSend: () => void; busy: boolean }) {
  const off = busy || !draft.trim();
  return (
    <div style={S('display:flex;align-items:flex-end;gap:10px')}>
      <textarea value={draft} onChange={(e) => onDraft(e.target.value)} placeholder={'Message ' + first} rows={1} aria-label={'Message ' + first} style={{ ...S('flex:1 1 auto;min-width:0;box-sizing:border-box;max-height:120px;resize:none;padding:13px 16px;border:1px solid #E1E4E9;border-radius:24px;background:#FFFFFF;font:inherit;font-size:15px;color:#0E1116'), minHeight: 48 }} />
      <button onClick={onSend} disabled={off} aria-label="Send" style={S('flex:0 0 48px;width:48px;height:48px;border:0;border-radius:999px;background:#0E1116;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:' + (off ? 0.45 : 1))}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
    </div>
  );
}

/**
 * Message a client. The conversation is loaded here (unless the caller already has it) and a sent message is added to it.
 * fill: take the whole height of a full-page panel; otherwise it sits in a sheet at a fixed height.
 */
export function ChatPanel({ clientId, first, context, initial, send, onBack, onSent, fill, bare }: {
  clientId: string; first: string; context?: ReactNode; initial?: ChatMsg[]; onSent?: (m: ChatMsg) => void; bare?: boolean;
  send: (text: string) => Promise<{ error?: string }>; onBack: () => void; fill?: boolean;
}) {
  const [thread, setThread] = useState<ChatMsg[]>(initial ?? []);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(!initial);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const [sending, startSend] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    clientThread(clientId).then((r) => { if (!live) return; if (!initial) setThread(r.messages); setNote(r.note); setLoading(false); }).catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [thread.length, loading]);
  const go = () => {
    const t = draft.trim();
    if (!t) return;
    startSend(async () => {
      const r = await send(t);
      if (r.error) { setErr(r.error); return; }
      setErr(''); setDraft('');
      const sent: ChatMsg = { id: 'me-' + Date.now(), mine: true, text: t, day: 'Today', time: new Date().toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(/\s+/g, '') };
      setThread((m) => [...m, sent]); onSent?.(sent);
    });
  };
  const pad = fill ? '20px' : '0';
  return (
    <div style={S('display:flex;flex-direction:column;min-height:0;' + (fill ? 'flex:1 1 auto;height:100%' : 'height:min(72dvh,620px)'))}>
      {!bare && <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:' + (fill ? '20px 20px 12px' : '0 0 12px'))}>
        <button onClick={onBack} aria-label="Back" style={S(RING)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6l-6 6 6 6" /></svg></button>
        <div style={S('min-width:0')}>
          <h2 style={S('margin:0;font-size:22px;font-weight:600;letter-spacing:-0.025em;overflow-wrap:anywhere')}>{'Message ' + first}</h2>
          {!!context && <p style={S('margin:2px 0 0;color:#5E6673;font-size:13.5px;overflow-wrap:anywhere')}>{context}</p>}
        </div>
      </header>}
      <div className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:8px ' + pad + ' 16px;display:flex;flex-direction:column;gap:14px')}>
        {loading ? <p style={S('margin:0;color:#5E6673;font-size:14px')}>Loading the conversation</p> : <ChatBubbles thread={thread} />}
        <div ref={end} />
      </div>
      <div style={S('flex:0 0 auto;padding:' + (fill ? '14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3' : '12px 0 0;border-top:1px solid #EEF0F3') + ';display:flex;flex-direction:column;gap:10px')}>
        {!!err && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{err}</p>}
        <ChatComposer first={first} draft={draft} onDraft={(v) => { setDraft(v); setErr(''); }} onSend={go} busy={sending} />
        {!!note && <p style={S('margin:0;font-size:12.5px;color:#5E6673')}>{note}</p>}
      </div>
    </div>
  );
}
