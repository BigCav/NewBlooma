'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { S } from '../calendar/pickers';
import { ROW, TICK } from '../calendar/wizardUi';
import { REASONS, STATUS, TYPES, initialsOf } from './shared';
import type { InboxCtl } from './InboxView';

const RING = 'flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;padding:0';
const BACK = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6l-6 6 6 6" /></svg>;
const DOTS = <svg width="20" height="20" viewBox="0 0 24 24" fill="#0E1116"><circle cx="12" cy="5.5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="18.5" r="1.6" /></svg>;
const CLOSE = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;
const SEND = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const BLACK = 'flex:1 1 0;height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none';
const OUTLINE = 'flex:1 1 0;height:52px;box-sizing:border-box;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none';
const CARD = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:6px 20px';
const MENU_ROW = 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:58px;padding:0 4px;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;color:#0E1116;cursor:pointer;text-decoration:none';

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:7')}>
      <button onClick={onClose} aria-label="Close" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
      <div className="sheet" role="dialog" aria-label={title} style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column')}>
        <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0;margin-bottom:12px')} />
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}>
          <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={S(RING)}>{CLOSE}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** One inbox item as its own page on the phone: a conversation for messages, a summary with actions for everything else. */
export function MobileItem({ c, onClose }: { c: InboxCtl; onClose: () => void }) {
  const sel = c.sel!;
  const [qa, setQa] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const first = sel.client.split(' ')[0];
  const isMsg = sel.type === 'message', isCancel = sel.type === 'cancellation', isResched = sel.type === 'reschedule';
  const actionable = sel.type === 'request' && sel.status === 'new' && !sel.cancelled;
  const clientHref = sel.clientId ? `/clients/${sel.clientId}` : null;
  const calHref = sel.bookingId && sel.calendarDay ? `/calendar?d=${sel.calendarDay}&b=${sel.bookingId}` : null;
  const rebookHref = sel.clientId ? `/calendar/new?client=${sel.clientId}` : '/calendar?new=1';
  const canDone = (isResched || isMsg) && sel.status === 'new';
  const status = sel.cancelled ? { t: 'Booking cancelled', bg: '#FCE3E3', fg: '#9B1C1C' } : isMsg || isCancel || sel.type === 'booking' || sel.type === 'rescheduled' || sel.status === 'new' ? null : STATUS[sel.status];
  const t = TYPES[sel.type];
  const hasMore = !!clientHref || !!calHref || isCancel || canDone || (!isMsg && c.mode === 'view');

  useEffect(() => { const el = mainRef.current; if (el) el.scrollTo({ top: isMsg ? el.scrollHeight : 0 }); }, [sel.id, sel.thread.length, c.mode, isMsg]);

  const err = c.error ? <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p> : null;
  const bar = (children: React.ReactNode) => (
    <div style={S('flex:0 0 auto;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px')}>{err}{children}</div>
  );
  const back = () => { if (c.mode !== 'view') { c.cancel(); return; } onClose(); };

  // What the bottom bar offers.
  let foot: React.ReactNode;
  if (c.mode === 'decline') {
    foot = bar(<div style={S('display:flex;gap:10px')}>
      <button className="ghost" onClick={c.cancel} style={S(OUTLINE)}>Back</button>
      <button onClick={c.sendDecline} disabled={c.busy} style={S(BLACK + ';background:#C0261B')}>Send decline</button>
    </div>);
  } else if (c.mode === 'compose') {
    foot = bar(<button onClick={c.sendReply} disabled={c.busy} style={S(BLACK + ';flex:0 0 auto;width:100%')}>Send</button>);
  } else if (isMsg) {
    foot = bar(<div style={S('display:flex;align-items:flex-end;gap:10px')}>
      <textarea value={c.draft} onChange={(e) => { c.setDraft(e.target.value); c.setError(''); }} placeholder={'Reply to ' + first} rows={1} aria-label={'Reply to ' + first} style={{ ...S('flex:1 1 auto;min-width:0;box-sizing:border-box;max-height:120px;resize:none;padding:13px 16px;border:1px solid #E1E4E9;border-radius:24px;background:#FFFFFF;font:inherit;font-size:15px;color:#0E1116'), minHeight: 48 }} />
      <button onClick={c.sendReply} disabled={c.busy || !c.draft.trim()} aria-label="Send" style={S('flex:0 0 48px;width:48px;height:48px;border:0;border-radius:999px;background:#0E1116;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:' + (c.busy || !c.draft.trim() ? 0.45 : 1))}>{SEND}</button>
    </div>);
  } else if (actionable) {
    foot = bar(<div style={S('display:flex;gap:10px')}>
      <button className="ghost" onClick={() => { c.setMode('decline'); c.setReason(null); c.setError(''); c.setNotice(''); }} style={S(OUTLINE)}>Decline</button>
      <button onClick={c.accept} disabled={c.busy} style={S(BLACK)}>Accept</button>
    </div>);
  } else if (isCancel) {
    foot = bar(<div style={S('display:flex;gap:10px')}>
      <button className="ghost" onClick={c.compose} style={S(OUTLINE)}>Message {first}</button>
      <Link href={rebookHref} style={S(BLACK)}>Book again</Link>
    </div>);
  } else {
    foot = bar(<div style={S('display:flex;gap:10px')}>
      {calHref && <Link href={calHref} className="ghost" style={S(OUTLINE)}>View in calendar</Link>}
      <button onClick={c.compose} style={S(BLACK)}>Message {first}</button>
    </div>);
  }

  const title = c.mode === 'decline' ? 'Decline request' : c.mode === 'compose' ? 'Message ' + first : isMsg ? 'Messages' : t.label;

  return (
    <div role="dialog" aria-label="Inbox item" style={S("position:absolute;left:0;right:0;top:0;bottom:0;z-index:5;display:flex;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px;border-bottom:1px solid #E6E8EC')}>
        <button onClick={back} aria-label="Back" style={S(RING)}>{BACK}</button>
        <div style={S('flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600')}>{initialsOf(sel.client)}</div>
        <div style={S('flex:1 1 auto;min-width:0;font-size:18px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{sel.client}</div>
        {hasMore && c.mode === 'view' && <button onClick={() => setQa(true)} aria-label="More actions" aria-haspopup="dialog" style={S(RING)}>{DOTS}</button>}
      </header>
      <main ref={mainRef} className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 20px;display:flex;flex-direction:column;gap:16px')}>
        {c.mode === 'decline' && actionable && (<>
          <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>{title}</h2>
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>{first} will be told by email. Choose a reason.</p>
          <div role="group" aria-label="Reason">
            {REASONS.map((r) => <button key={r} onClick={() => { c.setReason(r); c.setError(''); }} aria-pressed={c.reason === r} style={S(ROW(c.reason === r))}><span style={S('flex:1 1 auto;min-width:0;font-size:15px')}>{r}</span>{c.reason === r && TICK}</button>)}
          </div>
        </>)}

        {c.mode === 'compose' && (<>
          <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>{title}</h2>
          <label style={S('display:block;box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}>
            <span style={S('display:block;font-size:12.5px;color:#5E6673')}>Message</span>
            <textarea value={c.draft} onChange={(e) => { c.setDraft(e.target.value); c.setError(''); }} placeholder="Write a message" rows={7} style={{ ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116;resize:none'), minHeight: 0, borderRadius: 0 }} />
          </label>
        </>)}

        {c.mode === 'view' && isMsg && (<>
          {sel.thread.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>No messages yet.</p>}
          {sel.thread.map((m, i) => (
            <div key={i} style={S('display:flex;flex-direction:column;align-items:' + (m.mine ? 'flex-end' : 'flex-start') + ';gap:3px')}>
              <div style={S('max-width:82%;box-sizing:border-box;padding:11px 15px;border-radius:20px;font-size:15px;line-height:1.35;overflow-wrap:anywhere;white-space:pre-wrap;' + (m.mine ? 'background:#0E1116;color:#FFFFFF;border-bottom-right-radius:6px' : 'background:#FFFFFF;color:#0E1116;border:1px solid #E6E8EC;border-bottom-left-radius:6px'))}>{m.text}</div>
              <div style={S('font-size:11.5px;color:#8A93A0')}>{(m.mine ? 'You, ' : '') + m.at}</div>
            </div>
          ))}
          {!!c.notice && <p role="status" style={S('margin:0;align-self:center;padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.notice}</p>}
        </>)}

        {c.mode === 'view' && !isMsg && (<>
          <div>
            <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>{title}</h2>
            <p style={S('margin:6px 0 0;font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{sel.summary}</p>
          </div>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px')}>
            {status && <span style={S('display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + status.bg + ';color:' + status.fg)}>{status.t}</span>}
            <span style={S('font-size:13px;color:#5E6673')}>{sel.time}</span>
            {!!c.notice && <span role="status" style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.notice}</span>}
          </div>
          {sel.rows.length > 0 && (
            <dl style={S(CARD + ';margin:0;display:flex;flex-direction:column')} className="sum-rows">
              {sel.rows.map(([l, v]) => <div key={l} style={S('display:flex;justify-content:space-between;gap:12px;padding:14px 0;font-size:15px')}><dt style={S('color:#5E6673')}>{l}</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{v}</dd></div>)}
            </dl>
          )}
          {!!sel.note && <p style={S('margin:0;padding:14px 16px;border-radius:16px;background:#FFFFFF;border:1px solid #E6E8EC;font-size:14.5px;overflow-wrap:anywhere')}>{sel.note}</p>}
          <div style={S(CARD + ';display:flex;flex-direction:column')} className="sum-rows">
            <div style={S('display:flex;justify-content:space-between;gap:12px;padding:14px 0;font-size:15px')}><span style={S('color:#5E6673')}>Email</span><span style={S('font-weight:500;text-align:right;overflow-wrap:anywhere')}>{sel.email || 'No email'}</span></div>
          </div>
        </>)}
      </main>
      {foot}
      {qa && (
        <Sheet title="More actions" onClose={() => setQa(false)}>
          <div style={S('display:flex;flex-direction:column')}>
            {!isMsg && <button onClick={() => { setQa(false); c.compose(); }} style={S(MENU_ROW)}>Message {first}</button>}
            {clientHref && <Link href={clientHref} style={S(MENU_ROW)}>Open {first}&apos;s profile</Link>}
            {calHref && <Link href={calHref} style={S(MENU_ROW)}>View in calendar</Link>}
            {isCancel && <Link href={rebookHref} style={S(MENU_ROW)}>Book again</Link>}
            {canDone && <button onClick={() => { setQa(false); c.finish(); }} disabled={c.busy} style={S(MENU_ROW)}>Mark as done</button>}
          </div>
        </Sheet>
      )}
    </div>
  );
}
