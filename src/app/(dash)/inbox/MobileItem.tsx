'use client';
import { Avatar, BACK, BAR, BLACK, CARD, CLOSE, Chip, DANGER, DOTS, FieldError, MENU_ROW, Notice, OUTLINE, PAGE, ScreenHeader, RING, dim } from '@/components/ui';
import { firstName } from '@/lib/people';
import { ChatPanel } from '@/components/ChatPanel';
import { BottomSheet } from '@/components/BottomSheet';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { S } from '../calendar/pickers';
import { ROW, TICK } from '../calendar/wizardUi';
import { replyToItem } from './actions';
import { BookingCard, BookingQuickView } from './BookingQuickView';
import { REASONS, STATUS, TYPES, needsAction } from './shared';
import type { InboxCtl } from './InboxView';

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <BottomSheet label={title} onClose={onClose} z={7} gap={0} handleGap={12}>
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}>
          <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={S(RING)}>{CLOSE}</button>
        </div>
        {children}
      </BottomSheet>
  );
}

/** One inbox item as its own page on the phone: a conversation for messages, a summary with actions for everything else. */
export function MobileItem({ c, onClose }: { c: InboxCtl; onClose: () => void }) {
  const sel = c.sel!;
  const [qa, setQa] = useState(false);
  const [bq, setBq] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const first = firstName(sel.client);
  const isMsg = sel.type === 'message', isCancel = sel.type === 'cancellation', isResched = sel.type === 'reschedule';
  const actionable = needsAction(sel);
  const clientHref = sel.clientId ? `/clients/${sel.clientId}` : null;
  const calHref = sel.bookingId && sel.calendarDay ? `/calendar?d=${sel.calendarDay}&b=${sel.bookingId}` : null;
  const rebookHref = sel.clientId ? `/calendar/new?client=${sel.clientId}` : '/calendar?new=1';
  const canDone = (isResched || isMsg) && sel.status === 'new';
  const status = sel.cancelled ? { t: 'Booking cancelled', tone: 'red' as const } : isMsg || isCancel || sel.type === 'booking' || sel.type === 'rescheduled' || sel.status === 'new' ? null : STATUS[sel.status];
  const t = TYPES[sel.type];
  const hasMore = !!clientHref || !!calHref || !!sel.booking || isCancel || canDone || (!isMsg && c.mode === 'view');

  useEffect(() => { const el = mainRef.current; if (el) el.scrollTo({ top: 0 }); }, [sel.id, c.mode]);

  const err = c.error ? <FieldError>{c.error}</FieldError> : null;
  const bar = (children: React.ReactNode) => <div style={S(BAR)}>{err}{children}</div>;
  const back = () => { if (c.mode !== 'view') { c.cancel(); return; } onClose(); };

  // What the bottom bar offers.
  let foot: React.ReactNode;
  if (c.mode === 'decline') {
    foot = bar(<div style={S('display:flex;gap:10px')}>
      <button className="ghost" onClick={c.cancel} style={S(OUTLINE)}>Back</button>
      <button onClick={c.sendDecline} disabled={c.busy} style={S(DANGER + dim(c.busy))}>{c.busy ? 'Sending…' : 'Send decline'}</button>
    </div>);
  } else if (actionable) {
    foot = bar(<div style={S('display:flex;gap:10px')}>
      <button className="ghost" onClick={() => { c.setMode('decline'); c.setReason(null); c.setError(''); c.setNotice(''); }} style={S(OUTLINE)}>Decline</button>
      <button onClick={c.accept} disabled={c.busy} style={S(BLACK + dim(c.busy))}>{c.busy ? 'Approving…' : 'Approve'}</button>
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

  const title = c.mode === 'decline' ? 'Decline request' : t.label;

  // A message (or writing to the client from any other item) is the shared conversation panel, the same as everywhere else.
  const chat = isMsg || c.mode === 'compose';
  const sheets = (<>
      {bq && sel.booking && <BookingQuickView b={sel.booking} client={sel.client} onClose={() => setBq(false)} />}
      {qa && (
        <Sheet title="More actions" onClose={() => setQa(false)}>
          <div style={S('display:flex;flex-direction:column')}>
            {!isMsg && <button onClick={() => { setQa(false); c.compose(); }} style={S(MENU_ROW)}>Message {first}</button>}
            {clientHref && <Link href={clientHref} style={S(MENU_ROW)}>Open profile</Link>}
            {sel.booking && <button onClick={() => { setQa(false); setBq(true); }} style={S(MENU_ROW)}>Quick view booking</button>}
            {calHref && <Link href={calHref} style={S(MENU_ROW)}>View in calendar</Link>}
            {isCancel && <Link href={rebookHref} style={S(MENU_ROW)}>Book again</Link>}
            {canDone && <button onClick={() => { setQa(false); c.finish(); }} disabled={c.busy} style={S(MENU_ROW)}>Mark as done</button>}
          </div>
        </Sheet>
      )}
  </>);

  return (
    <div role="dialog" aria-label="Inbox item" style={S(PAGE)}>
      {chat ? (<>
        <ChatPanel fill key={sel.id + c.mode} clientId={sel.clientId} name={sel.client} first={first}
          initial={isMsg ? sel.thread.map((m, i) => ({ id: String(i), mine: m.mine, text: m.text, day: '', time: m.at })) : undefined}
          top={isMsg && sel.booking ? <BookingCard b={sel.booking} onOpen={() => setBq(true)} /> : undefined}
          menu={isMsg ? <button onClick={() => setQa(true)} aria-label="More actions" aria-haspopup="dialog" style={S(RING)}>{DOTS}</button> : undefined}
          send={(t) => replyToItem(sel.id, t)} onSent={(m) => c.replied(m.text)} onBack={back} />
        {sheets}
      </>) : (<>
      <ScreenHeader title={sel.client} avatar={sel.client} onBack={back}>
        {hasMore && <button onClick={() => setQa(true)} aria-label="More actions" aria-haspopup="dialog" style={S(RING)}>{DOTS}</button>}
      </ScreenHeader>
      <main ref={mainRef} className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 20px;display:flex;flex-direction:column;gap:16px')}>
        {c.mode === 'decline' && actionable && (<>
          <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>{title}</h2>
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>{first} will be told by email. Choose a reason.</p>
          <div role="group" aria-label="Reason">
            {REASONS.map((r) => <button key={r} onClick={() => { c.setReason(r); c.setError(''); }} aria-pressed={c.reason === r} style={S(ROW(c.reason === r))}><span style={S('flex:1 1 auto;min-width:0;font-size:15px')}>{r}</span>{c.reason === r && TICK}</button>)}
          </div>
        </>)}

        {c.mode === 'view' && (<>
          <div>
            <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>{title}</h2>
            <p style={S('margin:6px 0 0;font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{sel.summary}</p>
          </div>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px')}>
            {status && <Chip tone={status.tone}>{status.t}</Chip>}
            <span style={S('font-size:13px;color:#5E6673')}>{sel.time}</span>
            {!!c.notice && <Notice>{c.notice}</Notice>}
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
      {sheets}
      </>)}
    </div>
  );
}
