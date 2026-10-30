'use client';
// 1:1 conversion of the prototype's Inbox.dc.html and MobileInbox.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { ActiveFilter, FilterButton, FilterSheet } from '@/components/FilterBits';
import { S } from '../calendar/pickers';
import { MobileItem } from './MobileItem';
import { acceptRequest, declineRequest, markDone, markRead, replyToItem } from './actions';
import { FILTERS, REASONS, STATUS, TYPES, initialsOf, isAction, isInfo, type InboxItem } from './shared';

const PER_PAGE = 15;

type Mode = 'view' | 'decline' | 'compose';
const typeStyle = (t: InboxItem['type']) => 'flex:0 0 auto;display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;white-space:nowrap;background:' + TYPES[t].bg + ';color:' + TYPES[t].fg;
const statusStyle = (k: Exclude<InboxItem['status'], 'new'>) => 'flex:0 0 auto;display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;white-space:nowrap;background:' + STATUS[k].bg + ';color:' + STATUS[k].fg;
const statusText = (i: InboxItem) => (i.cancelled ? 'Booking cancelled' : i.status === 'new' ? '' : STATUS[i.status].t);
const hasChip = (i: InboxItem) => i.cancelled || (!isInfo(i.type) && i.status !== 'new');
const chipStyle = (i: InboxItem) => statusStyle(i.cancelled || i.status === 'new' ? 'declined' : i.status);

function useInbox(props: { items: InboxItem[] }) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [over, setOver] = useState<Record<string, Partial<InboxItem> & { thread?: InboxItem['thread'] }>>({});
  const items = props.items.map((i) => ({ ...i, ...(over[i.id] ?? {}) }));
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('view');
  const [reason, setReason] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const patch = (id: string, p: Partial<InboxItem>) => setOver((o) => ({ ...o, [id]: { ...(o[id] ?? {}), ...p } }));

  const select = (id: string) => {
    setSelectedId(id); setMode('view'); setReason(null); setDraft(''); setNotice(''); setError(''); setOpen(true);
    if (items.find((i) => i.id === id)?.unread) { patch(id, { unread: false }); markRead(id).then(() => router.refresh()); }
  };
  const done = (fn: () => Promise<{ error?: string; notice?: string }>, ok: (n?: string) => void) => startT(async () => { const r = await fn(); if (r.error) { setError(r.error); return; } setError(''); ok(r.notice); router.refresh(); });
  const accept = () => sel && done(() => acceptRequest(sel.id), (n) => { patch(sel.id, { status: 'accepted', unread: false }); setNotice(n ?? 'Accepted'); });
  const sendDecline = () => {
    if (!sel) return;
    if (!reason) { setError('Choose a reason so we can tell ' + sel.client.split(' ')[0] + '.'); return; }
    done(() => declineRequest(sel.id, reason), (n) => { patch(sel.id, { status: 'declined', unread: false }); setMode('view'); setReason(null); setNotice(n ?? 'Declined'); });
  };
  const sendReply = () => {
    if (!sel) return;
    const text = draft.trim();
    if (!text) { setError('Write a reply first.'); return; }
    done(() => replyToItem(sel.id, text), (n) => {
      if (sel.type === 'message') patch(sel.id, { thread: [...sel.thread, { mine: true, text, at: 'Now' }], unread: false });
      setDraft(''); setMode('view'); setNotice(n ?? 'Sent');
    });
  };
  const finish = () => sel && done(() => markDone(sel.id), () => { patch(sel.id, { status: 'done', unread: false }); setMode('view'); setNotice(''); });
  const cancel = () => { setMode('view'); setError(''); setReason(null); };

  const q = query.trim().toLowerCase();
  const rows = items.filter((i) =>
    (filter === 'all' || (filter === 'action' && isAction(i.type) && i.status === 'new' && !i.cancelled) || (filter === 'message' && i.type === 'message') || (filter === 'cancellation' && i.type === 'cancellation'))
    && (!q || (i.client + ' ' + i.summary + ' ' + TYPES[i.type].label).toLowerCase().includes(q)));
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE)), pageNo = Math.min(page, pages - 1);
  const pageRows = rows.slice(pageNo * PER_PAGE, (pageNo + 1) * PER_PAGE);
  const sel = items.find((i) => i.id === selectedId) ?? (narrow === false ? pageRows[0] ?? null : null);
  const goPage = (n: number) => { setPage(Math.max(0, Math.min(pages - 1, n))); window.scrollTo({ top: 0, behavior: 'smooth' }); document.querySelector('.m-cal .page')?.scrollTo({ top: 0 }); };
  const setFilterP = (f: string) => { setFilter(f); setPage(0); };
  const setQueryP = (v: string) => { setQuery(v); setPage(0); };
  const compose = () => { setMode('compose'); setDraft(''); setError(''); setNotice(''); };
  const needs = items.filter((i) => isAction(i.type) && i.status === 'new' && !i.cancelled).length;
  const unread = items.filter((i) => i.unread).length;
  const handled = items.filter((i) => hasChip(i)).length;
  return { items, narrow, selectedId, filter, setFilter: setFilterP, query, setQuery: setQueryP, pageRows, pageNo, pages, goPage, compose, mode, setMode, reason, setReason, draft, setDraft, notice, setNotice, error, setError, open, setOpen, sel, rows, needs, unread, handled, select, accept, sendDecline, sendReply, finish, cancel, busy };
}
type C = ReturnType<typeof useInbox>;
export type InboxCtl = C;

function Panel({ c, m }: { c: C; m: boolean }) {
  const sel = c.sel;
  if (!sel) return <p style={S('margin:0;color:#5E6673;font-size:14px')}>Nothing selected.</p>;
  const first = sel.client.split(' ')[0];
  const bh = m ? 48 : 44;
  const BTN = 'flex:1 1 0;height:' + bh + 'px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500';
  const BTN2 = 'flex:1 1 0;height:' + bh + 'px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500';
  const LNK = 'flex:1 1 0;height:' + bh + 'px;box-sizing:border-box;border-radius:999px;font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:center;text-decoration:none;white-space:nowrap;border:1px solid #E1E4E9;background:#FFFFFF;color:#0E1116';
  const pill = (on: boolean) => 'flex:0 0 auto;height:' + (m ? 44 : 40) + 'px;padding:0 16px;border-radius:999px;font-size:13.5px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
  const err = c.error ? <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p> : null;
  const isMsg = sel.type === 'message', isCancel = sel.type === 'cancellation', isResched = sel.type === 'reschedule';
  const actionable = sel.type === 'request' && sel.status === 'new' && !sel.cancelled;
  const calHref = sel.bookingId && sel.calendarDay ? `/calendar?d=${sel.calendarDay}&b=${sel.bookingId}` : null;
  const clientHref = sel.clientId ? `/clients/${sel.clientId}` : null;
  const who = (<>
    <div style={S('flex:0 0 56px;width:56px;height:56px;border-radius:999px;background:#EEF0F3;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600')}>{initialsOf(sel.client)}</div>
    <div style={S('min-width:0')}><div style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{sel.client}</div><div style={S('font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{sel.email || 'No email'}</div></div>
  </>);
  const rebookHref = sel.clientId ? `/calendar/new?client=${sel.clientId}` : '/calendar?new=1';
  const composer = c.mode === 'compose' || isMsg;
  const showRow = c.mode === 'view' && !isMsg;
  return (<>
    {clientHref
      ? <Link href={clientHref} aria-label={`Open ${sel.client} profile`} style={S('display:flex;align-items:center;gap:14px;color:inherit;text-decoration:none')}>{who}</Link>
      : <div style={S('display:flex;align-items:center;gap:14px')}>{who}</div>}
    <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px')}>
      <span style={S(typeStyle(sel.type))}>{TYPES[sel.type].label}</span>
      {hasChip(sel) && <span style={S(chipStyle(sel))}>{statusText(sel)}</span>}
      {!!c.notice && <span role="status" style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.notice}</span>}
    </div>
    {sel.rows.length > 0 && (
      <dl style={S('margin:0;display:flex;flex-direction:column')}>
        {sel.rows.map(([l, v]) => <div key={l} style={S('display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>{l}</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{v}</dd></div>)}
      </dl>
    )}
    {!!sel.note && <p style={S('margin:0;padding:14px 16px;border-radius:16px;background:#F4F5F7;font-size:14px;overflow-wrap:anywhere')}>{sel.note}</p>}
    {isMsg && <Thread key={sel.id} thread={sel.thread} first={first} />}
    {actionable && c.mode === 'view' && (
      <div style={S('display:flex;gap:10px')}>
        <button onClick={c.accept} disabled={c.busy} style={S(BTN)}>Accept</button>
        <button className="ghost" onClick={() => { c.setMode('decline'); c.setReason(null); c.setError(''); c.setNotice(''); }} style={S(BTN2)}>Decline</button>
      </div>
    )}
    {showRow && (
      <div style={S('display:flex;gap:10px')}>
        <button className={actionable ? 'ghost' : undefined} onClick={c.compose} style={S(actionable ? BTN2 : BTN)}>Message {first}</button>
        {isCancel
          ? <Link href={rebookHref} className="ghost" style={S(LNK)}>Book again</Link>
          : calHref ? <Link href={calHref} className="ghost" style={S(LNK)}>View in calendar</Link>
          : null}
      </div>
    )}
    {showRow && isResched && sel.status === 'new' && <button className="ghost" onClick={c.finish} disabled={c.busy} style={S(BTN2 + ';flex:0 0 auto')}>Mark as done</button>}
    {c.mode === 'decline' && actionable && (
      <div style={S('display:flex;flex-direction:column;gap:14px;box-sizing:border-box;padding:16px;border:1px solid #F3C6C3;border-radius:18px;background:#FEF3F2')}>
        <div style={S('font-size:14.5px;font-weight:600')}>Why are you declining?</div>
        <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="dc-reason-label" style={S('font-size:14px;font-weight:600')}>Reason</span>
          <div role="group" className="hscroll" aria-labelledby="dc-reason-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
            {REASONS.map((r) => <button key={r} onClick={() => { c.setReason(r); c.setError(''); }} aria-pressed={c.reason === r} style={S(pill(c.reason === r))}>{r}</button>)}
          </div></div>
        {err}
        <div style={S('display:flex;gap:10px')}>
          <button className="ghost" onClick={c.cancel} style={S(BTN2)}>Back</button>
          <button onClick={c.sendDecline} disabled={c.busy} style={S('flex:1 1 0;height:' + bh + 'px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font-size:14px;font-weight:500')}>Send decline</button>
        </div>
      </div>
    )}
    {composer && (
      <div style={S('display:flex;flex-direction:column;gap:14px')}>
        <div style={S('font-size:15px;font-weight:600')}>{isMsg ? 'Reply to ' + first : 'Message ' + first}</div>
        <textarea aria-label="Your message" value={c.draft} onChange={(e) => { c.setDraft(e.target.value); c.setError(''); }} placeholder="Write a message" style={S('box-sizing:border-box;width:100%;min-height:96px;resize:vertical;padding:12px 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF')} />
        {err}
        <div style={S('display:flex;gap:10px')}>
          <button onClick={c.sendReply} disabled={c.busy} style={S(BTN)}>Send</button>
          {!isMsg && <button className="ghost" onClick={c.cancel} style={S(BTN2)}>Cancel</button>}
        </div>
      </div>
    )}
  </>);
}

function Pager({ c, m }: { c: C; m: boolean }) {
  if (c.pages <= 1) return null;
  const from = c.pageNo * PER_PAGE + 1, to = Math.min(c.rows.length, (c.pageNo + 1) * PER_PAGE);
  const B = (label: string, target: number, off: boolean) => <button className="ghost" onClick={() => c.goPage(target)} disabled={off} aria-label={label + ' page'} style={S('flex:0 0 auto;height:' + (m ? 44 : 40) + 'px;padding:0 18px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:13.5px;font-weight:500')}>{label}</button>;
  return (
    <nav aria-label="Inbox pages" style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;padding:' + (m ? '12px 8px 0' : '14px 20px') + ';' + (m ? '' : 'border-top:1px solid #E6E8EC'))}>
      {B('Previous', c.pageNo - 1, c.pageNo === 0)}
      <span style={S('color:#5E6673;font-size:13.5px;text-align:center')}>{`${from}–${to} of ${c.rows.length}`}<br />{`Page ${c.pageNo + 1} of ${c.pages}`}</span>
      {B('Next', c.pageNo + 1, c.pageNo >= c.pages - 1)}
    </nav>
  );
}

function Row({ c, i, m }: { c: C; i: InboxItem; m: boolean }) {
  const on = i.id === c.sel?.id && !m;
  const st = m
    ? 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:76px;padding:12px 16px;border:0;background:transparent;text-align:left;font:inherit;color:#0E1116;cursor:pointer'
    : 'display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;min-height:76px;padding:12px 20px;border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;color:#0E1116;background:' + (on ? '#F4F5F7' : 'transparent');
  return (
    <button className="s-row" onClick={() => c.select(i.id)} aria-label={`${i.client}, ${TYPES[i.type].label}, ${i.summary}${i.unread ? ', unread' : ''}`} style={S(st)}>
      <span style={S('flex:0 0 44px;width:44px;height:44px;border-radius:999px;background:#EEF0F3;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600')}>{initialsOf(i.client)}</span>
      <span style={S('flex:1 1 auto;min-width:0')}>
        <span style={S('display:flex;align-items:center;gap:8px;min-width:0')}><span style={S('min-width:0;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{i.client}</span>{i.unread && <span aria-hidden="true" style={S('flex:0 0 8px;width:8px;height:8px;border-radius:999px;background:#5B3DF5')} />}</span>
        <span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{i.summary}</span>
        <span style={S('display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap')}><span style={S(typeStyle(i.type))}>{TYPES[i.type].label}</span>{hasChip(i) && <span style={S(chipStyle(i))}>{statusText(i)}</span>}</span>
      </span>
      <span style={S('flex:0 0 auto;align-self:flex-start;margin-top:4px;font-size:12.5px;color:#5E6673')}>{i.time}</span>
    </button>
  );
}

/** A phone list row: its own card, so each request or message reads on its own. Needs-action items are tinted. */
function MRow({ c, i }: { c: C; i: InboxItem }) {
  const need = isAction(i.type) && i.status === 'new' && !i.cancelled;
  return (
    <button className="s-row" onClick={() => c.select(i.id)} aria-label={`${i.client}, ${TYPES[i.type].label}, ${i.summary}${i.unread ? ', unread' : ''}`} style={S('display:flex;align-items:flex-start;gap:14px;width:100%;box-sizing:border-box;padding:16px;border-radius:22px;text-align:left;font:inherit;color:#0E1116;cursor:pointer;' + (need ? 'background:#FFF4E5;border:1px solid #F6D9A8' : 'background:#FFFFFF;border:1px solid #E6E8EC'))}>
      <span style={S('flex:0 0 48px;width:48px;height:48px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600')}>{initialsOf(i.client)}</span>
      <span style={S('flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px')}>
        <span style={S('display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0')}>
          <span style={S('display:flex;align-items:center;gap:8px;min-width:0')}><span style={S('min-width:0;font-size:16px;font-weight:600;letter-spacing:-0.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{i.client}</span>{i.unread && <span aria-hidden="true" style={S('flex:0 0 9px;width:9px;height:9px;border-radius:999px;background:#5B3DF5')} />}</span>
          <span style={S('flex:0 0 auto;font-size:12.5px;color:#5E6673')}>{i.time}</span>
        </span>
        <span style={S('display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;font-size:14px;color:#4A525E;font-weight:' + (i.unread ? 500 : 400))}>{i.summary}</span>
        <span style={S('display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap')}><span style={S(typeStyle(i.type))}>{TYPES[i.type].label}</span>{hasChip(i) && <span style={S(chipStyle(i))}>{statusText(i)}</span>}</span>
      </span>
    </button>
  );
}

function Desktop({ c }: { c: C }) {
  const chipS = (on: boolean) => 'height:40px;padding:0 16px;border-radius:999px;font-size:13.5px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
  const big = (l: string, v: number) => <div key={l}><div style={S('color:#5E6673;font-size:13.5px')}>{l}</div><div style={S('margin-top:4px;font-size:38px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{String(v)}</div></div>;
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Inbox" subtitle="Requests, cancellations and messages" query={c.query} onQuery={c.setQuery} placeholder="Search inbox" showAction={false} />
      <section aria-label="Inbox at a glance" style={S('display:flex;flex-wrap:wrap;gap:20px 64px')}>{big('Needs action', c.needs)}{big('Unread', c.unread)}{big('Handled', c.handled)}</section>
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <section aria-label="Inbox list" style={S('flex:999 1 620px;min-width:0;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E6E8EC')}>
            <div role="group" aria-label="Filter inbox" style={S('display:flex;flex-wrap:wrap;gap:8px')}>
              {FILTERS.map((f) => <button key={f.id} onClick={() => c.setFilter(f.id)} aria-pressed={c.filter === f.id} style={S(chipS(c.filter === f.id))}>{f.label}</button>)}
            </div>
            <span style={S('color:#5E6673;font-size:13.5px')}>{c.rows.length === c.items.length ? `${c.items.length} in total` : `${c.rows.length} of ${c.items.length}`}</span>
          </div>
          {c.pageRows.map((i) => <Row key={i.id} c={c} i={i} m={false} />)}
          {c.rows.length === 0 && <p style={S('margin:0;padding:24px 20px;color:#5E6673;font-size:14px')}>{c.query.trim() ? `Nothing matches "${c.query.trim()}".` : 'Nothing here right now.'}</p>}
          <Pager c={c} m={false} />
        </section>
        <aside aria-label="Details" style={S('flex:1 1 440px;max-width:520px;min-width:0;box-sizing:border-box;position:sticky;top:20px;max-height:calc(100dvh - 40px);overflow-y:auto;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:18px')}>
          <Panel c={c} m={false} />
        </aside>
      </div>
    </div>
  );
}

function Mobile({ c }: { c: C }) {
  const [fopen, setFopen] = useState(false);
  const card = (l: string, v: number, tint?: string) => <div key={l} style={S('flex:1 1 0;min-width:0;box-sizing:border-box;padding:16px;border-radius:20px;border:1px solid ' + (tint ? '#F6D9A8' : '#E6E8EC') + ';background:' + (tint ?? '#FFFFFF'))}><div style={S('color:#5E6673;font-size:13px')}>{l}</div><div style={S('margin-top:2px;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{String(v)}</div></div>;
  const close = () => { c.setOpen(false); c.setMode('view'); c.setError(''); };
  const fl = FILTERS.find((f) => f.id === c.filter)?.label ?? 'All';
  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Inbox" subtitle="Requests, cancellations and messages" query={c.query} onQuery={c.setQuery} placeholder="Search inbox" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:14px')}>
        <section aria-label="Inbox at a glance" style={S('display:flex;gap:12px')}>{card('Needs action', c.needs, c.needs > 0 ? '#FFF4E5' : undefined)}{card('Unread', c.unread)}</section>
        <div style={S('display:flex;align-items:center;gap:12px')}>
          <FilterButton onClick={() => setFopen(true)} active={c.filter !== 'all'} label="Filter inbox" />
          <span style={S('flex:1 1 auto;min-width:0;color:#5E6673;font-size:14px')}>{c.rows.length === c.items.length ? `${c.items.length} in total` : `${c.rows.length} of ${c.items.length}`}</span>
        </div>
        {c.filter !== 'all' && <ActiveFilter label={fl} onClear={() => c.setFilter('all')} />}
        {c.pageRows.map((i) => <MRow key={i.id} c={c} i={i} />)}
        {c.rows.length === 0 && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:14px')}>{c.query.trim() ? `Nothing matches "${c.query.trim()}".` : c.filter !== 'all' ? `Nothing under ${fl.toLowerCase()}.` : 'Nothing here right now.'}</p>}
        <Pager c={c} m={true} />
      </main>
      <MobileTabs active="more" />
      {fopen && <FilterSheet title="Filter inbox" options={FILTERS} value={c.filter} onPick={c.setFilter} onClose={() => setFopen(false)} />}
      {c.open && c.sel && <MobileItem key={c.sel.id} c={c} onClose={close} />}
    </div>
  );
}

export function InboxView({ items }: { items: InboxItem[] }) {
  const c = useInbox({ items });
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}


/** The conversation: fixed height, scrolls inside itself and opens at the newest message. */
function Thread({ thread, first }: { thread: InboxItem['thread']; first: string }) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [thread.length]);
  return (
    <ul ref={ref} aria-label="Conversation" style={S('margin:0;padding:2px 4px 2px 0;list-style:none;display:flex;flex-direction:column;gap:10px;max-height:min(44dvh,360px);overflow-y:auto;overscroll-behavior:contain')}>
      {thread.map((t, k) => (
        <li key={k} style={S('display:flex;justify-content:' + (t.mine ? 'flex-end' : 'flex-start'))}><span style={S('display:block;max-width:86%;flex:0 0 auto')}>
          <span style={S('box-sizing:border-box;padding:10px 14px;border-radius:18px;font-size:14px;overflow-wrap:break-word;white-space:pre-wrap;background:' + (t.mine ? '#0E1116' : '#F4F5F7') + ';color:' + (t.mine ? '#FFFFFF' : '#0E1116') + ';display:block')}>{t.text}</span>
          <span style={S('display:block;margin-top:4px;font-size:12px;color:#5E6673;text-align:' + (t.mine ? 'right' : 'left'))}>{t.mine ? 'You' : first}, {t.at}</span></span></li>
      ))}
    </ul>
  );
}
