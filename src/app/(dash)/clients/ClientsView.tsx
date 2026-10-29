'use client';
// 1:1 conversion of the prototype's Clients.dc.html and MobileClients.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { phoneInput } from '@/lib/phone';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { BookPanel, type BookData } from './BookPanel';
import { addNote, createClient, sendClientMessage } from './actions';
import { ActiveFilter, FilterButton, FilterSheet } from '@/components/FilterBits';
import { FILTERS, channelNote, initialsOf, money, type Channels, type ClientRow } from './shared';

type Props = { clients: ClientRow[]; count: number; newThisMonth: number; rebookRate: string; book: BookData; channels: Channels };
type Mode = 'view' | 'book' | 'message' | 'new';
const TAGS: Record<string, { bg: string; fg: string }> = { Regular: { bg: '#ECE8FF', fg: '#3B2BB5' }, New: { bg: '#DDF3EA', fg: '#14624A' }, Lapsed: { bg: '#FFEBD0', fg: '#7A4204' } };
const tagStyle = (t: string) => 'flex:0 0 auto;display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + TAGS[t].bg + ';color:' + TAGS[t].fg;
const SHOW_MAX = 300;

function useClients(props: Props) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [added, setAdded] = useState<ClientRow[]>([]);
  const items = useMemo(() => [...added.filter((a) => !props.clients.some((c) => c.id === a.id)), ...props.clients], [added, props.clients]);
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('view');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [nc, setNc] = useState({ name: '', email: '', phone: '' });
  const [noteDraft, setNoteDraft] = useState('');
  const [open, setOpen] = useState(false);

  const sq = query.trim().toLowerCase();
  const filtered = items.filter((c) => (filter === 'all' || c.tag === filter) && (!sq || (c.name + ' ' + c.email + ' ' + c.phone + ' ' + c.tag).toLowerCase().includes(sq)));
  const sel = items.find((c) => c.id === selectedId) ?? (narrow === false ? items[0] ?? null : null);
  const first = sel ? sel.name.split(' ')[0] : '';

  const select = (id: string) => { setSelectedId(id); setMode('view'); setNotice(''); setError(''); setOpen(true); };
  const cancel = () => { if (narrow && mode === 'new') { setOpen(false); setMode('view'); setError(''); return; } setMode('view'); setError(''); };
  const openNew = () => { setMode('new'); setNc({ name: '', email: '', phone: '' }); setError(''); setNotice(''); setOpen(true); };
  const send = () => {
    if (!sel) return;
    if (!msg.trim()) { setError('Write a message first.'); return; }
    startT(async () => {
      const r = await sendClientMessage(sel.id, msg);
      if (r.error) { setError(r.error); return; }
      setMode('view'); setMsg(''); setError(''); setNotice('Message sent to ' + first);
    });
  };
  const create = () => {
    startT(async () => {
      const r = await createClient(nc.name, nc.email, nc.phone);
      if (r.error || !r.row) { setError(r.error ?? 'Something went wrong'); return; }
      setAdded((a) => [r.row!, ...a]); setSelectedId(r.row.id); setMode('view'); setFilter('all'); setNc({ name: '', email: '', phone: '' }); setError(''); setNotice('Client added'); setOpen(!!narrow);
      router.refresh();
    });
  };
  const saveNote = () => {
    const t = noteDraft.trim(); if (!sel || !t) return;
    startT(async () => { const r = await addNote(sel.id, t); if (r.error) { setError(r.error); return; } setNoteDraft(''); setNotice('Note added'); });
  };
  const booked = (when: string) => { setMode('view'); setError(''); setNotice('Booked for ' + when); router.refresh(); };
  return { ...props, items, narrow, selectedId, filter, setFilter, query, setQuery, mode, setMode, notice, setNotice, error, setError, msg, setMsg, nc, setNc, noteDraft, setNoteDraft, open, setOpen, filtered, sel, first, select, cancel, openNew, send, create, saveNote, booked, busy };
}
type C = ReturnType<typeof useClients>;

/** The phone's quick view of a client, laid out like a booking: tag, client card with a message button, details, figures, and the actions pinned at the bottom. */
function MobileClientView({ c, sel }: { c: C; sel: ClientRow }) {
  const tag = TAGS[sel.tag];
  const ic = (path: string) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true"><path d={path} /></svg>;
  const rows: [string, string, string][] = [
    ['Phone', sel.phone || 'No phone', 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z'],
    ['Last visit', sel.lastService === 'No visits' ? 'No visits yet' : sel.last + ', ' + sel.lastService, 'M12 7.5V12l3 2M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0z'],
    ['Next appointment', sel.next, 'M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V7A1.5 1.5 0 0 1 5 5.5zM3.5 10h17M8 3.5v4M16 3.5v4'],
    ['Usually sees', sel.staff, 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c.6-3.4 3.3-5 7-5s6.4 1.6 7 5'],
  ];
  const close = () => { c.setOpen(false); c.setMode('view'); c.setError(''); };
  const BTN = 'height:52px;border-radius:999px;font-size:14.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none;box-sizing:border-box;flex:1 1 0';
  return (<>
    <div style={S('display:flex;justify-content:flex-end;margin-bottom:-8px')}><button onClick={close} aria-label="Close" style={S('flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button></div>
    <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
      <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>Client</h2>
      <span style={S('flex:0 0 auto;display:inline-block;padding:8px 16px;border-radius:999px;font-size:14px;font-weight:500;background:' + tag.bg + ';color:' + tag.fg)}>{sel.tag}</span>
    </div>
    <div style={S('display:flex;align-items:center;gap:14px;padding:16px;border:1px solid #E6E8EC;border-radius:22px')}>
      <div style={S('flex:0 0 52px;width:52px;height:52px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600')}>{initialsOf(sel.name)}</div>
      <div style={S('flex:1 1 auto;min-width:0')}>
        <div style={S('font-size:19px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{sel.name}</div>
        <div style={S('margin-top:2px;font-size:13.5px;color:#5E6673;overflow-wrap:anywhere')}>{sel.email || 'No email'}</div>
      </div>
      <Link href={`/clients/${sel.id}?v=messages`} aria-label={'Messages with ' + c.first} style={S('flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="3" /><path d="m4.5 7.5 7.5 5.5 7.5-5.5" /></svg>
      </Link>
    </div>
    <div className="sum-rows" style={S('padding:2px 16px;border:1px solid #E6E8EC;border-radius:22px')}>
      {rows.map(([l, v, icon]) => (
        <div key={l} style={S('display:flex;align-items:center;gap:12px;padding:13px 0')}>{ic(icon)}
          <span style={S('min-width:0')}><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{l}</span><span style={S('display:block;font-size:15px;overflow-wrap:anywhere')}>{v}</span></span>
        </div>
      ))}
    </div>
    <div style={S('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px')}>
      {([['Visits', String(sel.visits)], ['Total spent', money(sel.spentCents)]] as [string, string][]).map(([l, v]) => <div key={l} style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:20px;padding:16px')}><div style={S('font-size:13px;color:#5E6673')}>{l}</div><div style={S('margin-top:4px;font-size:22px;font-weight:600;letter-spacing:-0.02em')}>{v}</div></div>)}
    </div>
    <div style={S('position:sticky;bottom:-40px;margin:auto -20px -40px;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px')}>
      {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
      <div style={S('display:flex;gap:10px')}>
        <Link href={`/clients/${sel.id}`} style={S(BTN + ';border:1px solid #E1E4E9;background:#FFFFFF;color:#0E1116')}>View profile</Link>
        <button onClick={() => { c.setMode('book'); c.setError(''); c.setNotice(''); }} style={S(BTN + ';border:0;background:#0E1116;color:#FFFFFF')}>Book appointment</button>
      </div>
    </div>
  </>);
}

/* The five side-panel modes, shared by the desktop aside and the mobile sheet (the prototype repeats them with 48px buttons on mobile). */
function Panel({ c, m }: { c: C; m: boolean }) {
  const { sel, first } = c;
  const bh = m ? 48 : 44;
  const BTN = 'flex:1 1 0;height:' + bh + 'px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500';
  const BTN2 = 'flex:1 1 0;height:' + bh + 'px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500';
  const INP = 'box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF';
  const inp = (css: string) => ({ ...S(css), minHeight: 0 });
  const err = c.error ? <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p> : null;
  const DL = (label: string, value: string, last = false, nowrap = false) => (
    <div key={label} style={S('display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3' + (last ? ';border-bottom:1px solid #EEF0F3' : ''))}>
      <dt style={S('color:#5E6673')}>{label}</dt><dd style={S('margin:0;font-weight:500;text-align:right;' + (nowrap ? 'white-space:nowrap' : 'overflow-wrap:anywhere'))}>{value}</dd>
    </div>
  );
  const pill = 'flex:0 0 auto;height:' + (m ? 44 : 40) + 'px;padding:0 16px;border-radius:999px;font-size:13.5px;font-weight:500;border:1px solid #E1E4E9;background:#FFFFFF;color:#0E1116';
  if (m && c.mode === 'view' && sel) return <MobileClientView c={c} sel={sel} />;
  return (<>
    {c.mode === 'view' && !sel && c.items.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>No clients yet. Add your first client to get started.</p>}
    {c.mode === 'view' && sel && (<>
      <div style={S('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}>
        <span style={S(tagStyle(sel.tag))}>{sel.tag}</span>
        {!!c.notice && <span role="status" style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.notice}</span>}
      </div>
      <div style={S('display:flex;align-items:center;gap:14px')}>
        <div style={S('flex:0 0 56px;width:56px;height:56px;border-radius:999px;background:#EEF0F3;color:#0E1116;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600')}>{initialsOf(sel.name)}</div>
        <div style={S('min-width:0')}>
          <div style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{sel.name}</div>
          <div style={S('font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{sel.email || 'No email'}</div>
        </div>
      </div>
      <dl style={S('margin:0;display:flex;flex-direction:column')}>
        {DL('Phone', sel.phone || 'No phone', false, true)}
        {DL('Last visit', sel.lastService === 'No visits' ? 'No visits yet' : sel.last + ', ' + sel.lastService)}
        {DL('Next appointment', sel.next)}
        {DL('Usually sees', sel.staff)}
        {DL('Visits', String(sel.visits))}
        {DL('Total spent', money(sel.spentCents), true)}
      </dl>
      <div style={S('display:flex;gap:10px')}>
        <button onClick={() => { c.setMode('book'); c.setError(''); c.setNotice(''); }} style={S(BTN)}>Book appointment</button>
        <button className="ghost" onClick={() => { c.setMode('message'); c.setMsg(''); c.setError(''); c.setNotice(''); }} style={S(BTN2)}>Message</button>
      </div>
      <Link href={`/clients/${sel.id}`} style={S('display:flex;align-items:center;justify-content:center;height:' + bh + 'px;box-sizing:border-box;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;text-decoration:none;font-size:14px;font-weight:500')}>View profile</Link>
      {!m && (
        <div style={S('display:flex;flex-direction:column;gap:8px')}>
          <label htmlFor="client-note" style={S('font-size:14px;font-weight:600')}>Notes</label>
          <textarea id="client-note" value={c.noteDraft} onChange={(e) => c.setNoteDraft(e.target.value)} onBlur={c.saveNote} placeholder="Add a note for the team" style={{ ...S('box-sizing:border-box;width:100%;min-height:96px;resize:vertical;padding:12px 14px;border:1px solid #E1E4E9;border-radius:16px;font:inherit;color:#0E1116;background:#FFFFFF') }} />
        </div>
      )}
    </>)}
    {c.mode === 'book' && sel && <BookPanel data={c.book} client={{ id: sel.id, name: sel.name, first: c.first }} mobile={m} onBooked={c.booked} onCancel={c.cancel} />}
    {c.mode === 'message' && sel && (
      <div style={S('display:flex;flex-direction:column;gap:18px')}>
        <div><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>Message {c.first}</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{channelNote(c.channels, sel.phone, sel.email)}</p></div>
        <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="msg-text" style={S('font-size:14px;font-weight:600')}>Message</label>
          <textarea id="msg-text" value={c.msg} onChange={(e) => { c.setMsg(e.target.value); c.setError(''); }} placeholder="Write a message" style={S('box-sizing:border-box;width:100%;min-height:120px;resize:vertical;padding:12px 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF')} /></div>
        {err}
        <div style={S('display:flex;gap:10px')}><button onClick={c.send} disabled={c.busy} style={S(BTN)}>Send message</button><button className="ghost" onClick={c.cancel} style={S(BTN2)}>Cancel</button></div>
      </div>
    )}
    {c.mode === 'new' && (
      <div style={S('display:flex;flex-direction:column;gap:18px')}>
        <div><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>New client</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>They start with the New tag.</p></div>
        <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="nc-name" style={S('font-size:14px;font-weight:600')}>Full name</label><input id="nc-name" type="text" value={c.nc.name} onChange={(e) => { c.setNc({ ...c.nc, name: e.target.value }); c.setError(''); }} placeholder="Client name" style={inp(INP)} /></div>
        <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="nc-email" style={S('font-size:14px;font-weight:600')}>Email (optional)</label><input id="nc-email" type="email" value={c.nc.email} onChange={(e) => { c.setNc({ ...c.nc, email: e.target.value }); c.setError(''); }} placeholder="name@example.com" style={inp(INP)} /></div>
        <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="nc-phone" style={S('font-size:14px;font-weight:600')}>Phone (optional)</label><input id="nc-phone" type="tel" inputMode="tel" value={c.nc.phone} onChange={(e) => { c.setNc({ ...c.nc, phone: phoneInput(e.target.value) }); c.setError(''); }} placeholder="Optional" style={inp(INP)} /></div>
        {err}
        <div style={S('display:flex;gap:10px')}><button onClick={c.create} disabled={c.busy} style={S(BTN)}>Add client</button><button className="ghost" onClick={c.cancel} style={S(BTN2)}>Cancel</button></div>
      </div>
    )}
  </>);
}

function Desktop({ c }: { c: C }) {
  const router = useRouter();
  const rows = c.filtered.slice(0, SHOW_MAX);
  const chipS = (on: boolean) => 'height:40px;padding:0 16px;border-radius:999px;font-size:13.5px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
  const rowS = (on: boolean) => 'display:flex;align-items:center;gap:16px;width:100%;box-sizing:border-box;min-height:64px;padding:8px 20px;border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;font-size:14px;color:#0E1116;background:' + (on ? '#F4F5F7' : 'transparent');
  const big = (l: string, v: string) => <div key={l}><div style={S('color:#5E6673;font-size:13.5px')}>{l}</div><div style={S('margin-top:4px;font-size:38px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div></div>;
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Clients" subtitle="Everyone who has booked with you" query={c.query} onQuery={c.setQuery} placeholder="Search clients" actionLabel="New client" onAction={c.openNew} />
      <section aria-label="Clients at a glance" style={S('display:flex;flex-wrap:wrap;align-items:flex-end;gap:20px 64px')}>
        {big('Clients', String(c.count))}{big('New this month', String(c.newThisMonth))}{big('Rebook rate', c.rebookRate)}
      </section>
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <section aria-label="Client list" style={S('flex:999 1 620px;min-width:0;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E6E8EC')}>
            <div role="group" aria-label="Filter clients" style={S('display:flex;flex-wrap:wrap;gap:8px')}>
              {FILTERS.map((f) => <button key={f.id} onClick={() => c.setFilter(f.id)} aria-pressed={c.filter === f.id} style={S(chipS(c.filter === f.id))}>{f.label}</button>)}
            </div>
            <span style={S('color:#5E6673;font-size:13.5px')}>{`Showing ${rows.length} of ${c.count}`}</span>
          </div>
          <div style={S('overflow-x:auto')}>
            <div style={S('min-width:780px')}>
              <div style={S('display:flex;align-items:center;gap:16px;padding:12px 20px;border-bottom:1px solid #EEF0F3;color:#5E6673;font-size:12.5px;font-weight:500')}>
                <div style={S('flex:2.4 1 0;min-width:0')}>Client</div><div style={S('flex:1.2 1 0;min-width:0')}>Last visit</div><div style={S('flex:1.4 1 0;min-width:0')}>Next appointment</div>
                <div style={S('flex:0.7 1 0;min-width:0')}>Visits</div><div style={S('flex:0.9 1 0;min-width:0')}>Spent</div><div style={S('flex:1 1 0;min-width:0')}>Status</div>
              </div>
              {rows.map((r) => (
                <button key={r.id} className="s-row" onClick={() => c.select(r.id)} onDoubleClick={() => router.push(`/clients/${r.id}`)} title="Double-click to open the profile" aria-label={`${r.name}, ${r.tag}, last visit ${r.last}`} style={S(rowS(r.id === c.sel?.id && c.mode !== 'new'))}>
                  <span style={S('flex:2.4 1 0;min-width:0;display:flex;align-items:center;gap:12px')}>
                    <span style={S('flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:#EEF0F3;color:#0E1116;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600')}>{initialsOf(r.name)}</span>
                    <span style={S('min-width:0')}><span style={S('display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.name}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.email || 'No email'}</span></span>
                  </span>
                  <span style={S('flex:1.2 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.last}</span>
                  <span style={S('flex:1.4 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.next}</span>
                  <span style={S('flex:0.7 1 0;min-width:0')}>{r.visits}</span>
                  <span style={S('flex:0.9 1 0;min-width:0')}>{money(r.spentCents)}</span>
                  <span style={S('flex:1 1 0;min-width:0')}><span style={S(tagStyle(r.tag))}>{r.tag}</span></span>
                </button>
              ))}
            </div>
          </div>
          {rows.length === 0 && <p style={S('margin:0;padding:24px 20px;color:#5E6673;font-size:14px;border-top:1px solid #EEF0F3')}>{c.items.length === 0 ? 'No clients yet.' : `Nothing matches "${c.query.trim()}".`}</p>}
          {c.filtered.length > SHOW_MAX && <p style={S('margin:0;padding:16px 20px;color:#5E6673;font-size:13px;border-top:1px solid #EEF0F3')}>Showing the first {SHOW_MAX}. Search to narrow the list.</p>}
        </section>
        <aside aria-label="Client details" style={S('flex:1 1 440px;max-width:520px;min-width:0;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:16px')}>
          <Panel c={c} m={false} />
        </aside>
      </div>
    </div>
  );
}

function Mobile({ c }: { c: C }) {
  const [fopen, setFopen] = useState(false);
  const rows = c.filtered.slice(0, SHOW_MAX);
  const chipS = (on: boolean) => 'flex:0 0 auto;height:44px;padding:0 18px;border-radius:999px;font-size:14px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
  const rowS = 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 16px;border:0;border-bottom:1px solid #EEF0F3;background:transparent;text-align:left;font:inherit;color:#0E1116;cursor:pointer';
  const sub = (r: ClientRow) => r.next === 'In progress' ? 'In progress' : r.next.startsWith('Today') ? 'Next ' + r.next.toLowerCase() : r.next === 'Not booked' ? 'Last visit ' + r.last.toLowerCase() : 'Next ' + r.next;
  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Clients" subtitle={`${c.count} client${c.count === 1 ? '' : 's'}`} query={c.query} onQuery={c.setQuery} placeholder="Search clients" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <section aria-label="Clients at a glance" style={S('display:flex;gap:40px')}>
          <div><div style={S('color:#5E6673;font-size:13px')}>Clients</div><div style={S('margin-top:2px;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{String(c.count)}</div></div>
          <div><div style={S('color:#5E6673;font-size:13px')}>New this month</div><div style={S('margin-top:2px;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{String(c.newThisMonth)}</div></div>
        </section>
        <div style={S('display:flex;gap:10px')}>
          <FilterButton onClick={() => setFopen(true)} active={c.filter !== 'all'} label="Filter clients" />
          <button onClick={c.openNew} style={S('flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            New client
          </button>
        </div>
        {c.filter !== 'all' && <ActiveFilter label={FILTERS.find((f) => f.id === c.filter)?.label ?? ''} onClear={() => c.setFilter('all')} />}
        <ul style={S('margin:0;padding:4px 0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px')}>
          {rows.map((r) => (
            <li key={r.id}>
              <button onClick={() => c.select(r.id)} aria-label={`${r.name}, ${r.tag}, last visit ${r.last}`} style={S(rowS)}>
                <span style={S('flex:0 0 44px;width:44px;height:44px;border-radius:999px;background:#EEF0F3;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600')}>{initialsOf(r.name)}</span>
                <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.name}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{sub(r)}</span></span>
                <span style={S(tagStyle(r.tag))}>{r.tag}</span>
              </button>
            </li>
          ))}
        </ul>
        {rows.length === 0 && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:14px')}>{c.items.length === 0 ? 'No clients yet.' : `Nothing matches "${c.query.trim()}".`}</p>}
      </main>
      <MobileTabs active="clients" />
      {fopen && <FilterSheet title="Filter clients" options={FILTERS} value={c.filter} onPick={c.setFilter} onClose={() => setFopen(false)} />}
      {c.open && (
        <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:5')}>
          <button onClick={() => { c.setOpen(false); c.setMode('view'); c.setError(''); }} aria-label="Close details" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
          <div className="sheet" role="dialog" aria-label="Client" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:16px')}>
            <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0')} />
            {(c.mode !== 'view' || !c.sel) && <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Client</h2>
              <button onClick={() => { c.setOpen(false); c.setMode('view'); c.setError(''); }} aria-label="Close" style={S('flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button></div>}
            <Panel c={c} m={true} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ClientsView(props: Props) {
  const c = useClients(props);
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
