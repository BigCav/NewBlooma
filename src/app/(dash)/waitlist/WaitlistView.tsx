'use client';
// 1:1 conversion of the prototype's Waitlist.dc.html and MobileWaitlist.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { useNewParam } from '@/components/useNewParam';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { CalService, CalStaff } from '@/lib/cal';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { ActiveFilter, FilterButton, FilterSheet } from '@/components/FilterBits';
import { ClientMatches } from '../calendar/ClientMatches';
import { S, ServicePicker, TeamPicker } from '../calendar/pickers';
import { addToWaitlist, bookEntry, findTimes, offerTime, removeEntry } from './actions';
import { DAY_PREFS, STATUS, WINDOWS, type WlRow, type WlSlot } from './shared';
import { AddFlow, EntryPage } from './WaitlistFlow';

type Props = { rows: WlRow[]; services: CalService[]; offers: Record<string, string[]>; team: CalStaff[] };
const chip = (on: boolean) => 'flex:0 0 auto;height:40px;padding:0 14px;border-radius:999px;font-size:13.5px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
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
  return { ...props, busy, rows, waiting, narrow, openId, mode, setMode, query, setQuery, notice, setNotice, error, setError, add, setAdd, picked, setPicked, slots, toggle, offerNow, bookNow, remove, submitAdd, pickSvc };
}
type C = ReturnType<typeof useWaitlist>;
export type WaitlistCtl = C;

const GHOST = 'height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500;padding:0 20px;';
const DARK = 'height:44px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500;padding:0 20px;';

function Cards({ c, m }: { c: C; m: boolean }) {
  return (<>
    {!!c.notice && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{c.notice}</span>}
    {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
    {c.rows.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>{c.query.trim() ? `Nothing matches "${c.query.trim()}".` : 'Nobody is on the waitlist yet.'}</p>}
    {c.rows.map((r) => {
      const open = c.openId === r.id, tone = STATUS[r.status];
      const sl = open ? c.slots[r.id] : undefined;
      const pick = c.picked[r.id] ?? null;
      const fl = (css: string, mobile: string) => css + (m ? mobile : 'flex:0 0 auto');
      return (
        <article key={r.id} aria-label={`${r.name}, ${r.service.split(',')[0]}, ${r.status}`} style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:' + (m ? 18 : 24) + 'px;display:flex;flex-direction:column;gap:16px')}>
          <div style={S('display:flex;align-items:flex-start;gap:14px')}>
            <div style={S('flex:0 0 44px;width:44px;height:44px;border-radius:999px;background:#EEF0F3;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600')}>{r.initials}</div>
            <div style={S('flex:1 1 auto;min-width:0')}>
              <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px')}><span style={S('font-size:16px;font-weight:600;overflow-wrap:anywhere')}>{r.name}</span><span style={S('display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + tone[0] + ';color:' + tone[1])}>{r.status}</span></div>
              <div style={S('margin-top:2px;font-size:14px;overflow-wrap:anywhere')}>{r.service}</div>
              <div style={S('font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{r.prefs}</div>
              <div style={S('font-size:12.5px;color:#8A93A0')}>{r.meta}</div>
            </div>
          </div>
          {!!r.offer && r.status === 'Offered' && <div style={S('border-radius:16px;background:#ECE8FF;color:#3B2BB5;padding:10px 14px;font-size:13.5px;font-weight:500;overflow-wrap:anywhere')}>{r.offer}. Waiting for a reply.</div>}
          {open && r.status !== 'Booked' && (
            <div style={S('display:flex;flex-direction:column;gap:10px')}>
              <span style={S('font-size:14px;font-weight:600')}>Times that fit</span>
              {sl === 'loading' && <p style={S('margin:0;color:#5E6673;font-size:14px')}>Looking for times…</p>}
              {Array.isArray(sl) && sl.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>Nothing fits in the next two weeks. Loosen the preferences or try another team member.</p>}
              <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>
                {Array.isArray(sl) && sl.map((s) => { const on = pick?.startsAt === s.startsAt && pick?.staffId === s.staffId; return <button key={s.staffId + s.startsAt} onClick={() => c.setPicked({ ...c.picked, [r.id]: s })} aria-pressed={on} style={S(chip(on))}>{s.label}</button>; })}
              </div>
            </div>
          )}
          <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>
            {r.status !== 'Booked' && <button className="ghost" onClick={() => c.toggle(r)} style={S(fl(GHOST, 'flex:1 1 100%'))}>{open ? 'Hide times' : r.status === 'Offered' ? 'Offer another time' : 'Find a time'}</button>}
            {!!pick && r.status === 'Waiting' && <button onClick={() => c.offerNow(r)} disabled={c.busy} style={S(fl(DARK, 'flex:1 1 0'))}>Offer this time</button>}
            {(r.status === 'Offered' || !!pick) && r.status !== 'Booked' && <button className="ghost" onClick={() => c.bookNow(r)} disabled={c.busy} style={S(fl(GHOST, 'flex:1 1 0'))}>Mark as booked</button>}
            <button className="ghost" onClick={() => c.remove(r)} disabled={c.busy} style={S(fl(GHOST, 'flex:1 1 0'))}>Remove</button>
          </div>
        </article>
      );
    })}
  </>);
}

function AddForm({ c, m }: { c: C; m: boolean }) {
  const a = c.add, h = m ? 44 : 40;
  const svc = c.services.find((x) => x.id === a.svc);
  const chipH = (on: boolean) => chip(on).replace('height:40px', 'height:' + 40 + 'px');
  return (
    <section style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:' + (m ? 20 : 24) + 'px;display:flex;flex-direction:column;gap:18px')}>
      <div><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Add to waitlist</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>We will suggest times as they open up.</p></div>
      <div style={S('display:flex;flex-direction:column;gap:6px')}><label htmlFor="wl-name" style={S('font-size:14px;font-weight:600')}>Client name</label>
        <input id="wl-name" type="text" value={a.name} onChange={(e) => { c.setAdd({ ...a, name: e.target.value, clientId: null }); c.setError(''); }} placeholder="Search or type a client name" autoComplete="off" style={{ ...S('box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF'), minHeight: 0 }} />
          <ClientMatches query={a.name} pickedId={a.clientId} onPick={(h) => { c.setAdd({ ...a, name: h.name, clientId: h.id }); c.setError(''); }} /></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="wl-svc" style={S('font-size:14px;font-weight:600')}>Service</span>
        <ServicePicker services={c.services} selected={a.svc ? [a.svc] : []} chipHeight={h} onPick={c.pickSvc} /></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="wl-pro" style={S('font-size:14px;font-weight:600')}>Team member</span>
        <TeamPicker team={c.team} selected={a.pro} anyLabel="Anyone" offers={(sid) => !svc || (c.offers[svc.id] ?? []).includes(sid)} onPick={(id) => { c.setAdd({ ...a, pro: id || 'any' }); c.setError(''); }} /></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="wl-day" style={S('font-size:14px;font-weight:600')}>Days</span>
        <div role="group" aria-labelledby="wl-day" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>
          {DAY_PREFS.map(([id, l]) => <button key={id} onClick={() => c.setAdd({ ...a, dayPref: id })} aria-pressed={a.dayPref === id} style={S(chipH(a.dayPref === id))}>{l}</button>)}</div></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="wl-win" style={S('font-size:14px;font-weight:600')}>Time of day</span>
        <div role="group" aria-labelledby="wl-win" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>
          {WINDOWS.map(([id, l]) => <button key={id} onClick={() => c.setAdd({ ...a, win: id })} aria-pressed={a.win === id} style={S(chipH(a.win === id))}>{l}</button>)}</div></div>
      {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
      <div style={S('display:flex;gap:10px')}>
        <button onClick={c.submitAdd} disabled={c.busy} style={S(DARK + 'flex:1 1 0')}>Add to waitlist</button>
        <button className="ghost" onClick={() => { c.setMode('list'); c.setError(''); }} style={S(GHOST + 'flex:1 1 0')}>Cancel</button>
      </div>
    </section>
  );
}

function Desktop({ c }: { c: C }) {
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Waitlist" subtitle={c.waiting + (c.waiting === 1 ? ' client is waiting' : ' clients are waiting')} query={c.query} onQuery={c.setQuery} placeholder="Search waitlist" actionLabel="Add to waitlist" onAction={() => { c.setMode('add'); c.setError(''); c.setNotice(''); }} />
      <div style={S('width:100%;max-width:760px;display:flex;flex-direction:column;gap:16px')}>
        {c.mode === 'list' ? <Cards c={c} m={false} /> : <AddForm c={c} m={false} />}
      </div>
    </div>
  );
}

const WL_FILTERS = [{ id: 'all', label: 'All' }, { id: 'Waiting', label: 'Waiting' }, { id: 'Offered', label: 'Offered' }, { id: 'Booked', label: 'Booked' }];

function Mobile({ c }: { c: C }) {
  const [fopen, setFopen] = useState(false);
  const [filter, setFilter] = useState('all');
  const list = c.rows.filter((r) => filter === 'all' || r.status === filter);
  const open = c.openId ? c.rows.find((r) => r.id === c.openId) ?? null : null;
  const fl = WL_FILTERS.find((f) => f.id === filter)?.label ?? 'All';
  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Waitlist" subtitle={c.waiting + (c.waiting === 1 ? ' client is waiting' : ' clients are waiting')} query={c.query} onQuery={c.setQuery} placeholder="Search waitlist" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:14px')}>
        <div style={S('display:flex;gap:12px')}>
          <FilterButton onClick={() => setFopen(true)} active={filter !== 'all'} label="Filter waitlist" />
          <button onClick={() => { c.setMode('add'); c.setError(''); c.setNotice(''); }} style={S(DARK + 'flex:1 1 0;height:52px;font-size:14.5px')}>Add to waitlist</button>
        </div>
        {filter !== 'all' && <ActiveFilter label={fl} onClear={() => setFilter('all')} />}
        {!!c.notice && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{c.notice}</span>}
        {!!c.error && !open && c.mode === 'list' && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
        {list.map((r) => {
          const tone = STATUS[r.status];
          return (
            <button key={r.id} onClick={() => c.toggle(r)} aria-label={`${r.name}, ${r.service.split(',')[0]}, ${r.status}`} style={S('display:flex;align-items:flex-start;gap:14px;width:100%;box-sizing:border-box;padding:16px;border-radius:22px;border:1px solid #E6E8EC;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
              <span style={S('flex:0 0 48px;width:48px;height:48px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600')}>{r.initials}</span>
              <span style={S('flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px')}>
                <span style={S('display:flex;align-items:center;justify-content:space-between;gap:10px')}><span style={S('min-width:0;font-size:16px;font-weight:600;letter-spacing:-0.01em;overflow-wrap:anywhere')}>{r.name}</span><span style={S('flex:0 0 auto;display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:500;background:' + tone[0] + ';color:' + tone[1])}>{r.status}</span></span>
                <span style={S('font-size:14px;color:#4A525E;overflow-wrap:anywhere')}>{r.service}</span>
                <span style={S('font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{r.prefs}</span>
                <span style={S('font-size:12.5px;color:#8A93A0')}>{r.meta}</span>
              </span>
            </button>
          );
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
