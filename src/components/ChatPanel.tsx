'use client';
// Messaging a client: who it is, the conversation (newest at the bottom) and a box to reply. One panel for the calendar, the Clients list,
// the client's profile and the inbox (on desktop and on the phone), so writing to a client looks the same everywhere.
import { BACK, RING, SEND } from '@/components/ui';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { clientThread } from '@/app/(dash)/clients/actions';
import type { ChatMsg } from '@/app/(dash)/clients/thread';
import { S } from '@/app/(dash)/calendar/pickers';


/** The conversation as bubbles, with the day shown when it changes. */
export function ChatBubbles({ thread, empty = 'No messages yet. Say hello below.' }: { thread: ChatMsg[]; empty?: string }) {
  return (<>
    {thread.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>{empty}</p>}
    {thread.filter((m) => m.text.trim()).map((m, i, all) => {
      const newDay = !!m.day && (i === 0 || all[i - 1].day !== m.day);
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
      <button onClick={onSend} disabled={off} aria-label="Send" style={S('flex:0 0 48px;width:48px;height:48px;border:0;border-radius:999px;background:#0E1116;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:' + (off ? 0.45 : 1))}>{SEND}</button>
    </div>
  );
}

/**
 * Message a client. The conversation is loaded here (unless the caller already has it) and a sent message is added to it.
 * fill: take the whole height of a full-page panel; otherwise it sits in a sheet at a fixed height.
 */
export function ChatPanel({ clientId, name, first, context, top, menu, initial, send, onBack, onSent, fill, bare }: {
  /** Without one (an inbox item with no client on file) nothing is loaded: the conversation is only what is passed in. */
  clientId: string | null; name: string; first: string; context?: ReactNode;
  /** Pinned under the header, above the conversation (the booking a message is about). */
  top?: ReactNode;
  /** At the right of the header (a three-dots button). */
  menu?: ReactNode;
  initial?: ChatMsg[]; onSent?: (m: ChatMsg) => void; bare?: boolean;
  send: (text: string) => Promise<{ error?: string }>; onBack: () => void; fill?: boolean;
}) {
  const [thread, setThread] = useState<ChatMsg[]>(initial ?? []);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(!initial && !!clientId);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const [sending, startSend] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!clientId) return;
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
  const ini = name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2);
  return (
    <div style={S('display:flex;flex-direction:column;min-height:0;' + (fill ? 'flex:1 1 auto;height:100%;background:#F4F5F7' : 'height:min(72dvh,620px)'))}>
      {!bare && <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:' + (fill ? '20px 20px 12px;border-bottom:1px solid #E6E8EC' : '0 0 12px'))}>
        <button onClick={onBack} aria-label="Back" style={S(RING)}>{BACK}</button>
        <div aria-hidden="true" style={S('flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600')}>{ini}</div>
        <div style={S('flex:1 1 auto;min-width:0')}>
          <div style={S('font-size:18px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{name}</div>
          {!!context && <div style={S('margin-top:1px;color:#5E6673;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{context}</div>}
        </div>
        {menu}
      </header>}
      {!!top && <div style={S('flex:0 0 auto;padding:12px ' + pad + ' 0')}>{top}</div>}
      <div className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:12px ' + pad + ' 16px;display:flex;flex-direction:column;gap:14px')}>
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
