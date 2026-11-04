'use client';
// 1:1 conversion of the prototype's Inbox.dc.html and MobileInbox.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { rootCls } from '@/components/drawer';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { ActiveFilter, FilterButton, FilterSheet } from '@/components/FilterBits';
import { Avatar, Chip, DESK_LIST, Note, FilterChip, Stat, StatCard, filterChipCss, dim } from '@/components/ui';
import { TONE } from '@/lib/tones';
import { firstName } from '@/lib/people';
import { S } from '../calendar/pickers';
import { MobileItem } from './MobileItem';
import { acceptRequest, declineRequest, markAllRead, markDone, markRead } from './actions';
import { FILTERS, REASONS, STATUS, TYPES, isInfo, needsAction, type InboxItem } from './shared';

const PER_PAGE = 15;

type Mode = 'view' | 'decline' | 'compose';
const hasChip = (i: InboxItem) => i.cancelled || (!isInfo(i.type) && i.status !== 'new');
/** The two chips under an item: what it is, and (once handled) what happened to it. */
function Chips({ i }: { i: InboxItem }) {
  const st = i.cancelled ? { t: 'Booking cancelled', tone: 'red' as const } : i.status === 'new' ? null : STATUS[i.status];
  return <span style={S('display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap')}><Chip tone={TYPES[i.type].tone}>{TYPES[i.type].label}</Chip>{hasChip(i) && st && <Chip tone={st.tone}>{st.t}</Chip>}</span>;
}

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
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const patch = (id: string, p: Partial<InboxItem>) => setOver((o) => ({ ...o, [id]: { ...(o[id] ?? {}), ...p } }));

  const select = (id: string) => {
    setSelectedId(id); setMode('view'); setReason(null); setNotice(''); setError(''); setOpen(true);
    if (items.find((i) => i.id === id)?.unread) { patch(id, { unread: false }); markRead(id).then(() => router.refresh()); }
  };
  const markAll = () => {
    setOver((o) => { const n = { ...o }; for (const i of items) if (i.unread) n[i.id] = { ...(n[i.id] ?? {}), unread: false }; return n; });
    markAllRead().then((r) => { if (r.error) setError(r.error); router.refresh(); });
  };
  const done = (fn: () => Promise<{ error?: string; notice?: string }>, ok: (n?: string) => void) => startT(async () => { const r = await fn(); if (r.error) { setError(r.error); return; } setError(''); ok(r.notice); router.refresh(); });
  const accept = () => sel && done(() => acceptRequest(sel.id), (n) => { patch(sel.id, { status: 'accepted', unread: false }); setNotice(n ?? 'Approved'); });
  const sendDecline = () => {
    if (!sel) return;
    if (!reason) { setError('Choose a reason so we can tell ' + firstName(sel.client) + '.'); return; }
    done(() => declineRequest(sel.id, reason), (n) => { patch(sel.id, { status: 'declined', unread: false }); setMode('view'); setReason(null); setNotice(n ?? 'Declined'); });
  };
  /** The conversation panel sent a reply: keep the list in step. */
  const replied = (text: string) => {
    if (!sel) return;
    if (sel.type === 'message') patch(sel.id, { thread: [...sel.thread, { mine: true, text, at: 'Now' }], unread: false });
    router.refresh();
  };
  const finish = () => sel && done(() => markDone(sel.id), () => { patch(sel.id, { status: 'done', unread: false }); setMode('view'); setNotice(''); });
  const cancel = () => { setMode('view'); setError(''); setReason(null); };

  const q = query.trim().toLowerCase();
  const rows = items.filter((i) =>
    (filter === 'all' || (filter === 'action' && needsAction(i)) || (filter === 'message' && i.type === 'message') || (filter === 'cancellation' && i.type === 'cancellation'))
    && (!q || (i.client + ' ' + i.summary + ' ' + TYPES[i.type].label).toLowerCase().includes(q)));
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE)), pageNo = Math.min(page, pages - 1);
  const pageRows = rows.slice(pageNo * PER_PAGE, (pageNo + 1) * PER_PAGE);
  const sel = items.find((i) => i.id === selectedId) ?? null;
  const goPage = (n: number) => { setPage(Math.max(0, Math.min(pages - 1, n))); window.scrollTo({ top: 0, behavior: 'smooth' }); document.querySelector('.m-cal .page')?.scrollTo({ top: 0 }); };
  const setFilterP = (f: string) => { setFilter(f); setPage(0); };
  const setQueryP = (v: string) => { setQuery(v); setPage(0); };
  const compose = () => { setMode('compose'); setError(''); setNotice(''); };
  const needs = items.filter(needsAction).length;
  const unread = items.filter((i) => i.unread).length;
  const handled = items.filter((i) => hasChip(i)).length;
  return { items, narrow, selectedId, filter, setFilter: setFilterP, query, setQuery: setQueryP, pageRows, pageNo, pages, goPage, compose, mode, setMode, reason, setReason, notice, setNotice, error, setError, open, setOpen, sel, rows, needs, unread, handled, markAll, select, accept, sendDecline, replied, finish, cancel, busy };
}
type C = ReturnType<typeof useInbox>;
export type InboxCtl = C;


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
      <Avatar name={i.client} size="md" />
      <span style={S('flex:1 1 auto;min-width:0')}>
        <span style={S('display:flex;align-items:center;gap:8px;min-width:0')}><span style={S('min-width:0;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{i.client}</span>{i.unread && <span aria-hidden="true" style={S('flex:0 0 8px;width:8px;height:8px;border-radius:999px;background:#5B3DF5')} />}</span>
        <span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{i.summary}</span>
        <Chips i={i} />
      </span>
      <span style={S('flex:0 0 auto;align-self:flex-start;margin-top:4px;font-size:12.5px;color:#5E6673')}>{i.time}</span>
    </button>
  );
}

/** A phone list row: its own card, so each request or message reads on its own. Needs-action items are tinted. */
function MRow({ c, i }: { c: C; i: InboxItem }) {
  const need = needsAction(i);
  return (
    <button className="s-row" onClick={() => c.select(i.id)} aria-label={`${i.client}, ${TYPES[i.type].label}, ${i.summary}${i.unread ? ', unread' : ''}`} style={S('display:flex;align-items:flex-start;gap:14px;width:100%;box-sizing:border-box;padding:16px;border-radius:22px;text-align:left;font:inherit;color:#0E1116;cursor:pointer;' + (need ? 'background:' + TONE.amber.bg + ';border:1px solid #F6D9A8' : 'background:#FFFFFF;border:1px solid #E6E8EC'))}>
      <Avatar name={i.client} size="lg" />
      <span style={S('flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px')}>
        <span style={S('display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0')}>
          <span style={S('display:flex;align-items:center;gap:8px;min-width:0')}><span style={S('min-width:0;font-size:16px;font-weight:600;letter-spacing:-0.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{i.client}</span>{i.unread && <span aria-hidden="true" style={S('flex:0 0 9px;width:9px;height:9px;border-radius:999px;background:#5B3DF5')} />}</span>
          <span style={S('flex:0 0 auto;font-size:12.5px;color:#5E6673')}>{i.time}</span>
        </span>
        <span style={S('display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;font-size:14px;color:#4A525E;font-weight:' + (i.unread ? 500 : 400))}>{i.summary}</span>
        <Chips i={i} />
      </span>
    </button>
  );
}

function Desktop({ c }: { c: C }) {
  const big = (l: string, v: number) => <Stat key={l} label={l} value={String(v)} />;
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 32px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Inbox" subtitle="Requests, cancellations and messages" query={c.query} onQuery={c.setQuery} placeholder="Search inbox" showAction={false} />
      <section aria-label="Inbox at a glance" style={S('display:flex;flex-wrap:wrap;gap:20px 64px')}>{big('Needs action', c.needs)}{big('Unread', c.unread)}{big('Handled', c.handled)}</section>
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <section aria-label="Inbox list" style={S(DESK_LIST)}>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E6E8EC')}>
            <div role="group" aria-label="Filter inbox" style={S('display:flex;flex-wrap:wrap;gap:8px')}>
              {FILTERS.map((f) => <FilterChip key={f.id} on={c.filter === f.id} onClick={() => c.setFilter(f.id)}>{f.label}</FilterChip>)}
            </div>
            <span style={S('display:flex;align-items:center;gap:16px;color:#5E6673;font-size:13.5px')}>
              {c.rows.length === c.items.length ? `${c.items.length} in total` : `${c.rows.length} of ${c.items.length}`}
              <button onClick={c.markAll} disabled={c.unread === 0} style={S(filterChipCss(false) + dim(c.unread === 0))}>Mark all as read</button>
            </span>
          </div>
          {c.pageRows.map((i) => <Row key={i.id} c={c} i={i} m={false} />)}
          {c.rows.length === 0 && <Note inList>{c.query.trim() ? `Nothing matches "${c.query.trim()}".` : 'Nothing here right now.'}</Note>}
          <Pager c={c} m={false} />
        </section>
      </div>
      {c.open && <Mobile c={c} drawer />}
    </div>
  );
}

function Mobile({ c, drawer }: { c: C; drawer?: boolean }) {
  const [fopen, setFopen] = useState(false);
  const card = (l: string, v: number, tint?: string) => <StatCard key={l} label={l} value={String(v)} tint={!!tint} />;
  const close = () => { c.setOpen(false); c.setMode('view'); c.setError(''); };
  const fl = FILTERS.find((f) => f.id === c.filter)?.label ?? 'All';
  return (
    <div className={rootCls(drawer)} style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Inbox" subtitle="Requests, cancellations and messages" query={c.query} onQuery={c.setQuery} placeholder="Search inbox" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:14px')}>
        <section aria-label="Inbox at a glance" style={S('display:flex;gap:12px')}>{card('Needs action', c.needs, c.needs > 0 ? TONE.amber.bg : undefined)}{card('Unread', c.unread)}</section>
        <div style={S('display:flex;align-items:center;gap:12px')}>
          <FilterButton onClick={() => setFopen(true)} active={c.filter !== 'all'} label="Filter inbox" />
          <span style={S('flex:1 1 auto;min-width:0;color:#5E6673;font-size:14px')}>{c.rows.length === c.items.length ? `${c.items.length} in total` : `${c.rows.length} of ${c.items.length}`}</span>
          <button onClick={c.markAll} disabled={c.unread === 0} style={S(filterChipCss(false, true) + dim(c.unread === 0))}>Mark all as read</button>
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


