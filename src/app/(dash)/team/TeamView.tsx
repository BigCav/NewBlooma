'use client';
// 1:1 conversion of the prototype's Team.dc.html and MobileTeam.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { BottomSheet } from '@/components/BottomSheet';
import { Avatar, BLACK, Chip, FilterChip, Notice, Stat } from '@/components/ui';
import { rootCls } from '@/components/drawer';
import { useNewParam } from '@/components/useNewParam';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { ActiveFilter, FilterButton, FilterSheet } from '@/components/FilterBits';
import { TeamFlow } from './TeamFlow';
import { OwnerStar } from './OwnerStar';
import { inviteMember, removeMember, removePhoto, saveMember, uploadPhoto } from './actions';
import { DAYS, FILTERS, SHIFTS, squarePhoto, type TeamRow } from './shared';

type Props = { rows: TeamRow[]; cats: string[]; todayWd: number; owner: boolean };
type Draft = { name: string; role: string; cats: string[]; days: number[]; times: [string, string][]; shift: string | null; online: boolean };
const blank = (): Draft => ({ name: '', role: '', cats: [], days: [0, 1, 2, 3, 4], times: Array.from({ length: 7 }, () => ['09:00', '17:00'] as [string, string]), shift: '9-17', online: true });
const draftOf = (m: TeamRow): Draft => ({ name: m.name, role: m.role, cats: m.cats.slice(), days: m.days.slice(), times: m.times.map((t) => [t[0], t[1]] as [string, string]), shift: m.shift, online: m.online });

function useTeam(props: Props) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const items = props.rows;
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [mode, setMode] = useState<'edit' | 'new'>(items.length ? 'edit' : 'new');
  const [draft, setDraftState] = useState<Draft>(items[0] ? draftOf(items[0]) : blank());
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const mobile = true; // desktop edits in the same drawer

  // After a refresh the server rows change; keep the draft in step with the saved member.
  useEffect(() => {
    if (mode === 'edit' && selectedId) { const m = items.find((x) => x.id === selectedId); if (m) setDraftState(draftOf(m)); }
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const setDraft = <K extends keyof Draft>(k: K, v: Draft[K]) => { setDraftState((d) => ({ ...d, [k]: v })); setError(''); setNotice(''); };
  const flip = (k: 'cats' | 'days', v: any) => { const cur = draft[k] as any[]; setDraft(k, (cur.includes(v) ? cur.filter((x) => x !== v) : cur.concat([v])) as any); };
  const pickShift = (id: string) => { const p = SHIFTS.find((s) => s.id === id)!; setDraftState((d) => ({ ...d, shift: id, times: d.times.map(() => [p.from, p.to] as [string, string]) })); setError(''); setNotice(''); };
  const setTime = (day: number, k: 0 | 1, v: string) => { setDraftState((d) => ({ ...d, shift: null, times: d.times.map((t, i) => (i === day ? (k === 0 ? [v, t[1]] : [t[0], v]) as [string, string] : t)) })); setError(''); setNotice(''); };
  const [invite, setInvite] = useState('');
  const makeInvite = () => startT(async () => { const r = await inviteMember(selectedId!); if (r.error) { setError(r.error); return; } setError(''); setInvite(r.link ?? ''); });
  const select = (id: string) => { setInvite(''); const m = items.find((i) => i.id === id)!; setSelectedId(id); setMode('edit'); setDraftState(draftOf(m)); setConfirm(false); setError(''); setNotice(''); setOpen(true); };
  const startNew = () => { setSelectedId(null); setMode('new'); setDraftState(blank()); setConfirm(false); setError(''); setNotice(''); setOpen(true); };
  const cancelNew = () => { const first = items[0]; if (mobile || !first) { setOpen(false); setError(''); return; } select(first.id); };
  const save = () => {
    if (!draft.name.trim()) { setError("Add the team member's name."); return; }
    if (!draft.cats.length) { setError('Choose at least one service category.'); return; }
    startT(async () => {
      const r = await saveMember({ id: mode === 'edit' ? selectedId : null, name: draft.name, role: draft.role, cats: draft.cats, online: draft.online, times: draft.times, days: draft.days.slice().sort((a, b) => a - b) });
      if (r.error) { setError(r.error); return; }
      setError(''); setNotice(r.notice ?? ''); setFilter('all'); setOpen(!mobile);
      if (mode === 'new' && r.id) { setSelectedId(r.id); setMode('edit'); }
      router.refresh();
    });
  };
  const remove = () => startT(async () => {
    const r = await removeMember(selectedId!);
    if (r.error) { setError(r.error); setConfirm(false); return; }
    setConfirm(false); setError('');
    const left = items.filter((m) => m.id !== selectedId);
    if (mobile) { setSelectedId(null); setOpen(false); setNotice(''); }
    else if (left.length) { setSelectedId(left[0].id); setMode('edit'); setDraftState(draftOf(left[0])); setNotice(r.notice ?? ''); }
    else { setSelectedId(null); setMode('new'); setDraftState(blank()); setNotice(r.notice ?? ''); }
    router.refresh();
  });

  const [photoBusy, setPhotoBusy] = useState(false);
  const [askPhoto, setAskPhoto] = useState(false);
  const pickPhoto = async (file: File | undefined) => {
    if (!file || !selectedId) return;
    setPhotoBusy(true); setError(''); setNotice('');
    try {
      const blob = await squarePhoto(file);
      const fd = new FormData(); fd.append('photo', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      const r = await uploadPhoto(selectedId, fd);
      if (r.error) setError(r.error); else { setNotice(r.notice ?? ''); router.refresh(); }
    } catch { setError('Could not read that photo. Try a JPG or PNG.'); }
    setPhotoBusy(false);
  };
  const dropPhoto = async () => {
    if (!selectedId) return;
    setPhotoBusy(true); setError('');
    const r = await removePhoto(selectedId);
    if (r.error) setError(r.error); else { setNotice(r.notice ?? ''); router.refresh(); }
    setPhotoBusy(false);
  };

  const sq = query.trim().toLowerCase();
  const list = items.filter((m) => (filter === 'all' || (filter === 'today' && m.todayOn) || (filter === 'online' && m.online)) && (!sq || (m.name + ' ' + m.role).toLowerCase().includes(sq)));
  return { ...props, pickShift, setTime, invite, makeInvite, items, photoBusy, askPhoto, setAskPhoto, pickPhoto, dropPhoto, busy, narrow, selectedId, mode, draft, setDraft, flip, filter, setFilter, query, setQuery, confirm, setConfirm, error, setError, notice, open, setOpen, select, startNew, cancelNew, save, remove, list,
    close: () => { setOpen(false); setConfirm(false); setError(''); } };
}
type C = ReturnType<typeof useTeam>;
export type TeamCtl = C;


const EMPTY = (c: C) => (c.query.trim() ? `Nothing matches "${c.query.trim()}".` : 'No team members yet.');

function Desktop({ c }: { c: C }) {
  const stat = (label: string, v: number) => (
    <Stat label={label} value={v} />
  );
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 32px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Team" subtitle="Who works when, and what they offer" query={c.query} onQuery={c.setQuery} placeholder="Search team" actionLabel="New team member" onAction={c.startNew} />
      <section aria-label="Team at a glance" style={S('display:flex;flex-wrap:wrap;gap:20px 64px')}>
        {stat('Team members', c.items.length)}{stat('Working today', c.items.filter((m) => m.todayOn).length)}{stat('Bookable online', c.items.filter((m) => m.online).length)}
      </section>
      {!!c.notice && !c.open && <Notice>{c.notice}</Notice>}
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <section aria-label="Team schedule" style={S('flex:999 1 620px;min-width:0;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E6E8EC')}>
            <div role="group" aria-label="Filter team" style={S('display:flex;flex-wrap:wrap;gap:8px')}>
              {FILTERS.map((f) => <FilterChip key={f.id} on={c.filter === f.id} onClick={() => c.setFilter(f.id)}>{f.label}</FilterChip>)}
            </div>
            <span style={S('color:#5E6673;font-size:13.5px')}>{`Showing ${c.list.length} of ${c.items.length}`}</span>
          </div>
          <div style={S('overflow-x:auto')}>
            <div style={S('min-width:1000px')}>
              <div style={S('display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid #EEF0F3;color:#5E6673;font-size:12.5px;font-weight:500')}>
                <div style={S('flex:2.6 1 0;min-width:0')}>Team member</div>
                {DAYS.map((n, i) => <div key={n} style={S('flex:1 1 0;min-width:0;text-align:center;' + (i === c.todayWd ? 'color:#0E1116;font-weight:600' : ''))}>{n}</div>)}
                <div style={S('flex:1.1 1 0;min-width:0;text-align:right')}>Online</div>
              </div>
              {c.list.map((m) => (
                <button key={m.id} className="s-row" onClick={() => c.select(m.id)} aria-label={`${m.name}, ${m.role}, ${m.todayOn ? 'working today' : 'off today'}, ${m.online ? 'bookable online' : 'hidden online'}`}
                  style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:64px;padding:8px 20px;border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;font-size:14px;color:#0E1116;background:' + (c.open && c.mode === 'edit' && c.selectedId === m.id ? '#F4F5F7' : 'transparent'))}>
                  <span style={S('flex:2.6 1 0;min-width:0;display:flex;align-items:center;gap:12px')}>
                    <Avatar name={m.name} photo={m.photo} size="md" />
                    <span style={S('min-width:0')}>
                      <span style={S('display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{m.name}</span>
                      <span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{m.role}</span>
                    </span>
                  </span>
                  {m.cells.map((t, i) => <span key={i} style={S('flex:1 1 0;min-width:0;text-align:center;font-size:13px;font-weight:' + (t !== 'Off' ? 500 : 400) + ';color:' + (t !== 'Off' ? '#0E1116' : '#8A93A0'))}>{t}</span>)}
                  <span style={S('flex:1.1 1 0;min-width:0;text-align:right')}><Chip tone={m.online ? 'green' : 'grey'}>{m.online ? 'Online' : 'Hidden'}</Chip></span>
                </button>
              ))}
            </div>
          </div>
          {c.list.length === 0 && <p style={S('margin:0;padding:24px 20px;color:#5E6673;font-size:14px;border-top:1px solid #EEF0F3')}>{EMPTY(c)}</p>}
        </section>
      </div>
      {c.open && <Mobile c={c} drawer />}
    </div>
  );
}

function Mobile({ c, drawer }: { c: C; drawer?: boolean }) {
  const [fopen, setFopen] = useState(false);
  const stat = (label: string, v: number) => (
    <Stat label={label} value={v} small />
  );
  return (
    <div className={rootCls(drawer)} style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Team" subtitle="Who works when, and what they offer" query={c.query} onQuery={c.setQuery} placeholder="Search team" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <section aria-label="Team at a glance" style={S('display:flex;gap:40px')}>{stat('Team members', c.items.length)}{stat('Working today', c.items.filter((m) => m.todayOn).length)}</section>
        {!!c.notice && !c.open && <Notice>{c.notice}</Notice>}
        <div style={S('display:flex;gap:10px')}>
          <FilterButton onClick={() => setFopen(true)} active={c.filter !== 'all'} label="Filter team" />
          <button onClick={c.startNew} style={S(BLACK + ';gap:8px')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            New team member
          </button>
        </div>
        {c.filter !== 'all' && <ActiveFilter label={FILTERS.find((f) => f.id === c.filter)?.label ?? ''} onClear={() => c.setFilter('all')} />}
        <ul style={S('margin:0;padding:4px 0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px')}>
          {c.list.map((m) => (
            <li key={m.id}>
              <button onClick={() => c.select(m.id)} aria-label={`${m.name}, ${m.role}, ${m.todayOn ? 'working today' : 'off today'}, ${m.online ? 'bookable online' : 'hidden online'}`}
                style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 16px;border:0;border-bottom:1px solid #EEF0F3;background:transparent;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
                <Avatar name={m.name} photo={m.photo} size="lg" />
                <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{m.name}{m.isOwner && <OwnerStar />}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{m.role}, {m.todayOn ? 'Today, ' + m.todayLabel : 'Off today'}</span></span>
                <span style={S('flex:0 0 auto')}><Chip tone={m.online ? 'green' : 'grey'}>{m.online ? 'Online' : 'Hidden'}</Chip></span>
              </button>
            </li>
          ))}
        </ul>
        {c.list.length === 0 && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:14px')}>{EMPTY(c)}</p>}
      </main>
      <MobileTabs active="more" />
      {fopen && <FilterSheet title="Filter team" options={FILTERS} value={c.filter} onPick={c.setFilter} onClose={() => setFopen(false)} />}
      {c.open && (
        <BottomSheet label="Team member editor" onClose={c.close} backdropLabel="Close editor" gap={18} handle={false}>
            <TeamFlow key={c.mode + (c.selectedId ?? 'new')} c={c} />
          </BottomSheet>
      )}
    </div>
  );
}

export function TeamView(props: Props) {
  const c = useTeam(props);
  useNewParam(() => c.startNew());
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
