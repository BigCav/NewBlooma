'use client';
// 1:1 conversion of the prototype's Team.dc.html and MobileTeam.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { removeMember, removePhoto, saveMember, uploadPhoto } from './actions';
import { DAYS, DAY_FULL, FILTERS, SHIFTS, initialsOf, photoCss, squarePhoto, type TeamRow } from './shared';

type Props = { rows: TeamRow[]; cats: string[]; todayWd: number; owner: boolean };
type Draft = { name: string; role: string; cats: string[]; days: number[]; shift: string | null; online: boolean };
const blank = (): Draft => ({ name: '', role: '', cats: [], days: [0, 1, 2, 3, 4], shift: '9-17', online: true });
const draftOf = (m: TeamRow): Draft => ({ name: m.name, role: m.role, cats: m.cats.slice(), days: m.days.slice(), shift: m.shift, online: m.online });

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
  const mobile = narrow === true;

  // After a refresh the server rows change; keep the draft in step with the saved member.
  useEffect(() => {
    if (mode === 'edit' && selectedId) { const m = items.find((x) => x.id === selectedId); if (m) setDraftState(draftOf(m)); }
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const setDraft = <K extends keyof Draft>(k: K, v: Draft[K]) => { setDraftState((d) => ({ ...d, [k]: v })); setError(''); setNotice(''); };
  const flip = (k: 'cats' | 'days', v: any) => { const cur = draft[k] as any[]; setDraft(k, (cur.includes(v) ? cur.filter((x) => x !== v) : cur.concat([v])) as any); };
  const select = (id: string) => { const m = items.find((i) => i.id === id)!; setSelectedId(id); setMode('edit'); setDraftState(draftOf(m)); setConfirm(false); setError(''); setNotice(''); setOpen(true); };
  const startNew = () => { setSelectedId(null); setMode('new'); setDraftState(blank()); setConfirm(false); setError(''); setNotice(''); setOpen(true); };
  const cancelNew = () => { const first = items[0]; if (mobile || !first) { setOpen(false); setError(''); return; } select(first.id); };
  const save = () => {
    if (!draft.name.trim()) { setError("Add the team member's name."); return; }
    if (!draft.cats.length) { setError('Choose at least one service category.'); return; }
    startT(async () => {
      const r = await saveMember({ id: mode === 'edit' ? selectedId : null, ...draft, days: draft.days.slice().sort((a, b) => a - b) });
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
  return { ...props, items, photoBusy, pickPhoto, dropPhoto, busy, narrow, selectedId, mode, draft, setDraft, flip, filter, setFilter, query, setQuery, confirm, setConfirm, error, notice, open, setOpen, select, startNew, cancelNew, save, remove, list,
    close: () => { setOpen(false); setConfirm(false); setError(''); } };
}
type C = ReturnType<typeof useTeam>;

const chipD = (on: boolean) => 'height:40px;padding:0 16px;border-radius:999px;font-size:13.5px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
const chipM = (on: boolean) => 'flex:0 0 auto;height:44px;padding:0 18px;border-radius:999px;font-size:14px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
const formChip = (on: boolean, m: boolean) => m
  ? 'flex:0 0 auto;white-space:nowrap;height:44px;padding:0 16px;border-radius:999px;font-size:14px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116')
  : 'flex:0 0 auto;white-space:nowrap;height:36px;padding:0 14px;border-radius:999px;font-size:13px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
const onlinePill = (on: boolean) => 'display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;white-space:nowrap;background:' + (on ? '#DDF3EA' : '#EEF0F3') + ';color:' + (on ? '#14624A' : '#4A525E');
const inp = (h: number): React.CSSProperties => ({ ...S(`box-sizing:border-box;width:100%;height:${h}px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF`), padding: '0 14px', minHeight: 0 });

function Form({ c, m }: { c: C; m: boolean }) {
  const d = c.draft, h = m ? 48 : 44, isNew = c.mode === 'new';
  const Chips = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
    <div style={S('display:flex;flex-direction:column;gap:8px')}>
      <span id={id} style={S('font-size:14px;font-weight:600')}>{label}</span>
      <div role="group" className="hscroll" aria-labelledby={id} style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>{children}</div>
    </div>
  );
  return (
    <div style={S('display:flex;flex-direction:column;gap:18px')}>
      {(() => {
        const cur = c.items.find((x) => x.id === c.selectedId) ?? null;
        return (
          <div style={S('display:flex;align-items:center;gap:16px')}>
            <span aria-hidden="true" style={S('flex:0 0 72px;width:72px;height:72px;border-radius:999px;background:#EEF0F3;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:600' + photoCss(cur?.photo ?? null))}>{cur?.photo ? '' : initialsOf(d.name || '?')}</span>
            {isNew ? <span style={S('font-size:13px;color:#5E6673')}>Save the team member first, then add a photo.</span> : (
              <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>
                <label style={S('display:inline-flex;align-items:center;justify-content:center;height:40px;padding:0 16px;border-radius:999px;border:1px solid #E1E4E9;background:#FFFFFF;font-size:13.5px;font-weight:500;cursor:pointer')}>
                  {c.photoBusy ? 'Uploading…' : cur?.photo ? 'Change photo' : 'Add photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={c.photoBusy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; c.pickPhoto(f); }} style={S('position:absolute;width:1px;height:1px;opacity:0;pointer-events:none')} />
                </label>
                {!!cur?.photo && <button type="button" className="ghost" onClick={c.dropPhoto} disabled={c.photoBusy} style={S('height:40px;padding:0 16px;border-radius:999px;border:1px solid #E1E4E9;background:#FFFFFF;font-size:13.5px;font-weight:500')}>Remove</button>}
              </div>
            )}
          </div>
        );
      })()}
      <div style={S('display:flex;flex-direction:column;gap:8px')}>
        <label htmlFor="tm-name" style={S('font-size:14px;font-weight:600')}>Name</label>
        <input id="tm-name" type="text" value={d.name} onChange={(e) => c.setDraft('name', e.target.value)} placeholder="Full name" style={inp(h)} />
      </div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}>
        <label htmlFor="tm-role" style={S('font-size:14px;font-weight:600')}>Role</label>
        <input id="tm-role" type="text" value={d.role} onChange={(e) => c.setDraft('role', e.target.value)} placeholder="For example, Senior stylist" style={inp(h)} />
      </div>
      <Chips id="tm-cat-label" label="Services they offer">{c.cats.map((x) => <button key={x} onClick={() => c.flip('cats', x)} aria-pressed={d.cats.includes(x)} style={S(formChip(d.cats.includes(x), m))}>{x}</button>)}</Chips>
      <Chips id="tm-day-label" label="Working days">{DAYS.map((n, i) => <button key={n} onClick={() => c.flip('days', i)} aria-pressed={d.days.includes(i)} aria-label={DAY_FULL[i]} style={S(formChip(d.days.includes(i), m))}>{n}</button>)}</Chips>
      <Chips id="tm-shift-label" label="Shift">{SHIFTS.map((s) => <button key={s.id} onClick={() => c.setDraft('shift', s.id)} aria-pressed={d.shift === s.id} style={S(formChip(d.shift === s.id, m))}>{s.label}</button>)}</Chips>
      <div style={S('display:flex;align-items:center;justify-content:space-between;gap:16px')}>
        <div style={S('min-width:0')}>
          <div id="tm-online-label" style={S('font-size:14px;font-weight:600')}>Bookable online</div>
          <div style={S('font-size:13px;color:#5E6673')}>Clients can choose them when booking.</div>
        </div>
        <button role="switch" aria-checked={d.online} aria-labelledby="tm-online-label" onClick={() => c.setDraft('online', !d.online)} style={S('position:relative;flex:0 0 52px;width:52px;height:32px;padding:0;border:0;border-radius:999px;background:' + (d.online ? '#0E1116' : '#D5D9E0'))}><span style={S('position:absolute;top:3px;left:' + (d.online ? 23 : 3) + 'px;width:26px;height:26px;border-radius:999px;background:#FFFFFF')} /></button>
      </div>
      {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
      {!c.confirm && (
        <div style={S('display:flex;gap:10px')}>
          <button onClick={c.save} disabled={c.busy} style={S(`flex:1 1 0;height:${h}px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500`)}>{isNew ? 'Add team member' : 'Save changes'}</button>
          <button className="ghost" onClick={() => (isNew ? c.cancelNew() : c.setConfirm(true))} style={S(`flex:1 1 0;height:${h}px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500`)}>{isNew ? 'Cancel' : 'Remove'}</button>
        </div>
      )}
      {c.confirm && (
        <div role="alertdialog" aria-label="Confirm removal" style={S('display:flex;flex-direction:column;gap:12px;box-sizing:border-box;padding:16px;border:1px solid #F3C6C3;border-radius:18px;background:#FEF3F2')}>
          <div>
            <div style={S('font-size:14.5px;font-weight:600')}>Remove this team member?</div>
            <div style={S('margin-top:2px;font-size:13px;color:#5E6673')}>They will no longer appear on the calendar or in online booking.</div>
          </div>
          <div style={S('display:flex;gap:10px')}>
            <button className="ghost" onClick={() => c.setConfirm(false)} style={S(`flex:1 1 0;height:${h}px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500`)}>Cancel</button>
            <button onClick={c.remove} disabled={c.busy} style={S(`flex:1 1 0;height:${h}px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font-size:14px;font-weight:500`)}>Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY = (c: C) => (c.query.trim() ? `Nothing matches "${c.query.trim()}".` : 'No team members yet.');

function Desktop({ c }: { c: C }) {
  const stat = (label: string, v: number) => (
    <div><div style={S('color:#5E6673;font-size:13.5px')}>{label}</div><div style={S('margin-top:4px;font-size:38px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div></div>
  );
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Team" subtitle="Who works when, and what they offer" query={c.query} onQuery={c.setQuery} placeholder="Search team" actionLabel="New team member" onAction={c.startNew} />
      <section aria-label="Team at a glance" style={S('display:flex;flex-wrap:wrap;gap:20px 64px')}>
        {stat('Team members', c.items.length)}{stat('Working today', c.items.filter((m) => m.todayOn).length)}{stat('Bookable online', c.items.filter((m) => m.online).length)}
      </section>
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <section aria-label="Team schedule" style={S('flex:999 1 620px;min-width:0;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E6E8EC')}>
            <div role="group" aria-label="Filter team" style={S('display:flex;flex-wrap:wrap;gap:8px')}>
              {FILTERS.map((f) => <button key={f.id} onClick={() => c.setFilter(f.id)} aria-pressed={c.filter === f.id} style={S(chipD(c.filter === f.id))}>{f.label}</button>)}
            </div>
            <span style={S('color:#5E6673;font-size:13.5px')}>{`Showing ${c.list.length} of ${c.items.length}`}</span>
          </div>
          <div style={S('overflow-x:auto')}>
            <div style={S('min-width:860px')}>
              <div style={S('display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid #EEF0F3;color:#5E6673;font-size:12.5px;font-weight:500')}>
                <div style={S('flex:2.6 1 0;min-width:0')}>Team member</div>
                {DAYS.map((n, i) => <div key={n} style={S('flex:1 1 0;min-width:0;text-align:center;' + (i === c.todayWd ? 'color:#0E1116;font-weight:600' : ''))}>{n}</div>)}
                <div style={S('flex:1.1 1 0;min-width:0;text-align:right')}>Online</div>
              </div>
              {c.list.map((m) => (
                <button key={m.id} className="s-row" onClick={() => c.select(m.id)} aria-label={`${m.name}, ${m.role}, ${m.todayOn ? 'working today' : 'off today'}, ${m.online ? 'bookable online' : 'hidden online'}`}
                  style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:64px;padding:8px 20px;border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;font-size:14px;color:#0E1116;background:' + (c.mode === 'edit' && c.selectedId === m.id ? '#F4F5F7' : 'transparent'))}>
                  <span style={S('flex:2.6 1 0;min-width:0;display:flex;align-items:center;gap:12px')}>
                    <span style={S('flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:#EEF0F3;color:#0E1116;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600' + photoCss(m.photo))}>{m.photo ? '' : initialsOf(m.name)}</span>
                    <span style={S('min-width:0')}>
                      <span style={S('display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{m.name}</span>
                      <span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{m.role}</span>
                    </span>
                  </span>
                  {m.cells.map((t, i) => <span key={i} style={S('flex:1 1 0;min-width:0;text-align:center;font-size:13px;font-weight:' + (t !== 'Off' ? 500 : 400) + ';color:' + (t !== 'Off' ? '#0E1116' : '#8A93A0'))}>{t}</span>)}
                  <span style={S('flex:1.1 1 0;min-width:0;text-align:right')}><span style={S(onlinePill(m.online))}>{m.online ? 'Online' : 'Hidden'}</span></span>
                </button>
              ))}
            </div>
          </div>
          {c.list.length === 0 && <p style={S('margin:0;padding:24px 20px;color:#5E6673;font-size:14px;border-top:1px solid #EEF0F3')}>{EMPTY(c)}</p>}
        </section>
        <aside aria-label="Team member editor" style={S('flex:1 1 440px;max-width:520px;min-width:0;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:20px')}>
          <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
            <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{c.mode === 'new' ? 'New team member' : 'Edit team member'}</h2>
            {!!c.notice && <span role="status" style={S('flex:0 0 auto;padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.notice}</span>}
          </div>
          <Form c={c} m={false} />
        </aside>
      </div>
    </div>
  );
}

function Mobile({ c }: { c: C }) {
  const stat = (label: string, v: number) => (
    <div><div style={S('color:#5E6673;font-size:13px')}>{label}</div><div style={S('margin-top:2px;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div></div>
  );
  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Team" subtitle="Who works when, and what they offer" query={c.query} onQuery={c.setQuery} placeholder="Search team" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <section aria-label="Team at a glance" style={S('display:flex;gap:40px')}>{stat('Team members', c.items.length)}{stat('Working today', c.items.filter((m) => m.todayOn).length)}</section>
        <button onClick={c.startNew} style={S('display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New team member
        </button>
        <div role="group" className="hscroll" aria-label="Filter team" style={S('display:flex;gap:8px;overflow-x:auto')}>
          {FILTERS.map((f) => <button key={f.id} onClick={() => c.setFilter(f.id)} aria-pressed={c.filter === f.id} style={S(chipM(c.filter === f.id))}>{f.label}</button>)}
        </div>
        <ul style={S('margin:0;padding:4px 0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px')}>
          {c.list.map((m) => (
            <li key={m.id}>
              <button onClick={() => c.select(m.id)} aria-label={`${m.name}, ${m.role}, ${m.todayOn ? 'working today' : 'off today'}, ${m.online ? 'bookable online' : 'hidden online'}`}
                style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 16px;border:0;border-bottom:1px solid #EEF0F3;background:transparent;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
                <span style={S('flex:0 0 44px;width:44px;height:44px;border-radius:999px;background:#EEF0F3;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600' + photoCss(m.photo))}>{m.photo ? '' : initialsOf(m.name)}</span>
                <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{m.name}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{m.role}, {m.todayOn ? 'Today, ' + m.todayLabel : 'Off today'}</span></span>
                <span style={S('flex:0 0 auto')}><span style={S(onlinePill(m.online))}>{m.online ? 'Online' : 'Hidden'}</span></span>
              </button>
            </li>
          ))}
        </ul>
        {c.list.length === 0 && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:14px')}>{EMPTY(c)}</p>}
      </main>
      <MobileTabs active="more" />
      {c.open && (
        <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:5')}>
          <button onClick={c.close} aria-label="Close editor" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
          <div className="sheet" role="dialog" aria-label="Team member editor" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:18px')}>
            <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0')} />
            <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
              <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{c.mode === 'new' ? 'New team member' : 'Edit team member'}</h2>
              <button onClick={c.close} aria-label="Close" style={S('flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <Form c={c} m={true} />
          </div>
        </div>
      )}
    </div>
  );
}

export function TeamView(props: Props) {
  const c = useTeam(props);
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
