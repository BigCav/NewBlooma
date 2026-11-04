'use client';
// 1:1 conversion of the prototype's Waitlist.dc.html and MobileWaitlist.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { rootCls } from '@/components/drawer';
import { useNewParam } from '@/components/useNewParam';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { CalService, CalStaff } from '@/lib/cal';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { ActiveFilter, FilterButton, FilterSheet } from '@/components/FilterBits';
import { Avatar, BLACK, Chip, Note, FieldError, FilterChip, Notice } from '@/components/ui';
import { S } from '../calendar/pickers';
import { plural } from '@/lib/display';
import { addToWaitlist, bookEntry, findTimes, offerTime, removeEntry } from './actions';
import { STATUS, type WlRow, type WlSlot } from './shared';
import { AddFlow, EntryPage } from './WaitlistFlow';

type Props = { rows: WlRow[]; services: CalService[]; offers: Record<string, string[]>; team: CalStaff[] };
const blank = () => ({ name: '', clientId: null as string | null, svc: null as string | null, pro: 'any', dayPref: 'any', win: 'any' });

function useWaitlist(props: Props) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [gone, setGone] = useState<string[]>([]);
  const [over, setOver] = useState<Record<string, Partial<WlRow>>>({});
  const rowsAll = props.rows.filter((r) => !gone.includes(r.id)).map((r) => ({ ...r, ...(over[r.id] ?? {}) }));
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [add, setAdd] = useState(blank());
  const [picked, setPicked] = useState<Record<string, WlSlot | null>>({});
  const [slots, setSlots] = useState<Record<string, WlSlot[] | 'loading'>>({});

  const sq = query.trim().toLowerCase();
  const rows = rowsAll.filter((r) => !sq || (r.name + ' ' + r.service).toLowerCase().includes(sq));
  const waiting = rowsAll.filter((r) => r.status === 'Waiting').length;
  const waitingText = plural(waiting, 'client') + (waiting === 1 ? ' is' : ' are') + ' waiting';

  const toggle = (r: WlRow) => {
    const open = openId === r.id;
    setOpenId(open ? null : r.id); setNotice('');
    if (!open) {
      setSlots((s) => ({ ...s, [r.id]: 'loading' }));
      findTimes(r.id).then((x) => { if (x.error) { setError(x.error); setSlots((s) => ({ ...s, [r.id]: [] })); } else setSlots((s) => ({ ...s, [r.id]: x.slots ?? [] })); });
    }
  };
  const run = (fn: () => Promise<{ error?: string; notice?: string }>, ok: (n?: string) => void) => startT(async () => { const r = await fn(); if (r.error) { setError(r.error); return; } setError(''); ok(r.notice); router.refresh(); });
  const offerNow = (r: WlRow) => { const p = picked[r.id]; if (!p) return; run(() => offerTime(r.id, p.staffId, p.startsAt), (n) => { setOver((o) => ({ ...o, [r.id]: { status: 'Offered', offer: 'Offered ' + p.label } })); setNotice(n ?? ''); setOpenId(null); setPicked((x) => ({ ...x, [r.id]: null })); }); };
  const bookNow = (r: WlRow) => { const p = picked[r.id]; run(() => bookEntry(r.id, p ? { staffId: p.staffId, startsAt: p.startsAt } : undefined), (n) => { setOver((o) => ({ ...o, [r.id]: { status: 'Booked', offer: '' } })); setNotice(n ?? ''); setOpenId(null); }); };
  const remove = (r: WlRow) => run(() => removeEntry(r.id), (n) => { setGone((g) => [...g, r.id]); setOpenId(null); setNotice(n ?? ''); });
  const submitAdd = () => {
    if (!add.name.trim()) { setError("Add the client's name."); return; }
    if (!add.svc) { setError('Choose a service.'); return; }
    run(() => addToWaitlist(add.name, add.clientId, add.svc, add.pro === 'any' ? null : add.pro, add.dayPref, add.win), (n) => { setMode('list'); setAdd(blank()); setNotice(n ?? ''); });
  };
  const pickSvc = (id: string) => {
    const sv = props.services.find((x) => x.id === id);
    const keep = add.pro === 'any' || (props.offers[id] ?? []).includes(add.pro);
    setAdd(add.svc === id ? { ...add, svc: null } : { ...add, svc: id, pro: sv && keep ? add.pro : 'any' }); setError('');
  };
  return { ...props, busy, rows, waiting, waitingText, narrow, openId, mode, setMode, query, setQuery, notice, setNotice, error, setError, add, setAdd, picked, setPicked, slots, toggle, offerNow, bookNow, remove, submitAdd, pickSvc };
}
type C = ReturnType<typeof useWaitlist>;
export type WaitlistCtl = C;

function WlCard({ r, onOpen }: { r: WlRow; onOpen: () => void }) {
  return (
    <button onClick={onOpen} aria-label={`${r.name}, ${r.service.split(',')[0]}, ${r.status}`} style={S('display:flex;align-items:flex-start;gap:14px;width:100%;box-sizing:border-box;padding:16px;border-radius:22px;border:1px solid #E6E8EC;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
              <Avatar name={r.name} size="lg" />
              <span style={S('flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px')}>
                <span style={S('display:flex;align-items:center;justify-content:space-between;gap:10px')}><span style={S('min-width:0;font-size:16px;font-weight:600;letter-spacing:-0.01em;overflow-wrap:anywhere')}>{r.name}</span><Chip tone={STATUS[r.status]}>{r.status}</Chip></span>
                <span style={S('font-size:14px;color:#4A525E;overflow-wrap:anywhere')}>{r.service}</span>
                <span style={S('font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{r.prefs}</span>
                <span style={S('font-size:12.5px;color:#8A93A0')}>{r.meta}</span>
              </span>
    </button>
  );
}

const WL_FILTERS = [{ id: 'all', label: 'All' }, { id: 'Waiting', label: 'Waiting' }, { id: 'Offered', label: 'Offered' }, { id: 'Booked', label: 'Booked' }];

function Desktop({ c }: { c: C }) {
  const [filter, setFilter] = useState('all');
  const list = c.rows.filter((r) => filter === 'all' || r.status === filter);
  const fl = WL_FILTERS.find((f) => f.id === filter)?.label ?? 'All';
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 32px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Waitlist" subtitle={c.waitingText} query={c.query} onQuery={c.setQuery} placeholder="Search waitlist" actionLabel="Add to waitlist" onAction={() => { c.setMode('add'); c.setError(''); c.setNotice(''); }} />
      <div role="group" aria-label="Filter waitlist" style={S('display:flex;flex-wrap:wrap;gap:8px')}>
        {WL_FILTERS.map((f) => <FilterChip key={f.id} on={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</FilterChip>)}
      </div>
      {!!c.notice && <Notice>{c.notice}</Notice>}
      {!!c.error && !c.openId && c.mode === 'list' && <FieldError>{c.error}</FieldError>}
      <section aria-label="Waitlist" style={S('display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:16px;align-items:start')}>
        {list.map((r) => <WlCard key={r.id} r={r} onOpen={() => c.toggle(r)} />)}
      </section>
      {list.length === 0 && <Note>{c.query.trim() ? `Nothing matches "${c.query.trim()}".` : filter !== 'all' ? `Nobody is ${fl.toLowerCase()}.` : 'Nobody is on the waitlist yet.'}</Note>}
      {(!!c.openId || c.mode === 'add') && <Mobile c={c} drawer />}
    </div>
  );
}


function Mobile({ c, drawer }: { c: C; drawer?: boolean }) {
  const [fopen, setFopen] = useState(false);
  const [filter, setFilter] = useState('all');
  const list = c.rows.filter((r) => filter === 'all' || r.status === filter);
  const open = c.openId ? c.rows.find((r) => r.id === c.openId) ?? null : null;
  const fl = WL_FILTERS.find((f) => f.id === filter)?.label ?? 'All';
  return (
    <div className={rootCls(drawer)} style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Waitlist" subtitle={c.waitingText} query={c.query} onQuery={c.setQuery} placeholder="Search waitlist" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:14px')}>
        <div style={S('display:flex;gap:12px')}>
          <FilterButton onClick={() => setFopen(true)} active={filter !== 'all'} label="Filter waitlist" />
          <button onClick={() => { c.setMode('add'); c.setError(''); c.setNotice(''); }} style={S(BLACK)}>Add to waitlist</button>
        </div>
        {filter !== 'all' && <ActiveFilter label={fl} onClear={() => setFilter('all')} />}
        {!!c.notice && <Notice>{c.notice}</Notice>}
        {!!c.error && !open && c.mode === 'list' && <FieldError>{c.error}</FieldError>}
        {list.map((r) => {
          return <WlCard key={r.id} r={r} onOpen={() => c.toggle(r)} />;
        })}
        {list.length === 0 && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:14px')}>{c.query.trim() ? `Nothing matches "${c.query.trim()}".` : filter !== 'all' ? `Nobody is ${fl.toLowerCase()}.` : 'Nobody is on the waitlist yet.'}</p>}
      </main>
      <MobileTabs active="more" />
      {fopen && <FilterSheet title="Filter waitlist" options={WL_FILTERS} value={filter} onPick={setFilter} onClose={() => setFopen(false)} />}
      {open && <EntryPage key={open.id} c={c} r={open} />}
      {c.mode === 'add' && (
        <div role="dialog" aria-label="Add to waitlist" style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:5;display:flex;flex-direction:column;overflow:hidden;background:#FFFFFF;padding:12px 20px 40px;box-sizing:border-box')}>
          <AddFlow c={c} />
        </div>
      )}
    </div>
  );
}

export function WaitlistView(props: Props) {
  const c = useWaitlist(props);
  useNewParam(() => { c.setMode('add'); c.setError(''); c.setNotice(''); });
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
