'use client';
// 1:1 conversion of the prototype's Clients.dc.html and MobileClients.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { BottomSheet } from '@/components/BottomSheet';
import { openNewAppt } from '@/components/NewApptHost';
import { rootCls } from '@/components/drawer';
import { useNewParam } from '@/components/useNewParam';
import { Avatar, BLACK, CLOSE, Chip, DESK_LIST, FieldError, FilterChip, Icon, Note, Notice, OUTLINE, RING, ROW_LIST, Stat, TILE } from '@/components/ui';
import { dollars } from '@/lib/format';
import { plural } from '@/lib/display';
import { firstName } from '@/lib/people';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { createClient } from './actions';
import { ActiveFilter, FilterButton, FilterSheet } from '@/components/FilterBits';
import { NewClientFlow } from './NewClientFlow';
import { FILTERS, TAG_TONE, type Channels, type ClientRow } from './shared';

type Props = { clients: ClientRow[]; count: number; newThisMonth: number; rebookRate: string; channels: Channels };
type Mode = 'view' | 'new';
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
  const [nc, setNc] = useState({ name: '', email: '', phone: '' });
  const [open, setOpen] = useState(false);

  const sq = query.trim().toLowerCase();
  const filtered = items.filter((c) => (filter === 'all' || c.tag === filter) && (!sq || (c.name + ' ' + c.email + ' ' + c.phone + ' ' + c.tag).toLowerCase().includes(sq)));
  const sel = items.find((c) => c.id === selectedId) ?? (narrow === false ? items[0] ?? null : null);
  const first = sel ? firstName(sel.name) : '';

  const select = (id: string) => { setSelectedId(id); setMode('view'); setNotice(''); setError(''); setOpen(true); };
  const cancel = () => { if (mode === 'new') { setOpen(false); setMode('view'); setError(''); return; } setMode('view'); setError(''); };
  const openNew = () => { setMode('new'); setNc({ name: '', email: '', phone: '' }); setError(''); setNotice(''); setOpen(true); };
  const create = () => {
    if (!nc.name.trim()) { setError("Add the client's name."); return; }
    if (!nc.email.trim()) { setError("Add the client's email address."); return; }
    if (!nc.phone.trim()) { setError("Add the client's phone number."); return; }
    startT(async () => {
      const r = await createClient(nc.name, nc.email, nc.phone);
      if (r.error || !r.row) { setError(r.error ?? 'Something went wrong. Please try again.'); return; }
      setAdded((a) => [r.row!, ...a]); setSelectedId(r.row.id); setMode('view'); setFilter('all'); setNc({ name: '', email: '', phone: '' }); setError(''); setNotice('Client added'); setOpen(true);
      router.refresh();
    });
  };
  return { ...props, items, narrow, selectedId, filter, setFilter, query, setQuery, mode, setMode, notice, setNotice, error, setError, nc, setNc, open, setOpen, filtered, sel, first, select, cancel, openNew, create, busy };
}
type C = ReturnType<typeof useClients>;
export type ClientsCtl = C;

/** The phone's quick view of a client, laid out like a booking: tag, client card with a message button, details, figures, and the actions pinned at the bottom. */
function MobileClientView({ c, sel }: { c: C; sel: ClientRow }) {
  const ic = (path: string) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true"><path d={path} /></svg>;
  const rows: [string, string, string][] = [
    ['Phone', sel.phone || 'No phone', 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z'],
    ['Last visit', sel.lastService === 'No visits' ? 'No visits yet' : sel.last + ', ' + sel.lastService, 'M12 7.5V12l3 2M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0z'],
    ['Next appointment', sel.next, 'M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V7A1.5 1.5 0 0 1 5 5.5zM3.5 10h17M8 3.5v4M16 3.5v4'],
    ['Usually sees', sel.staff, 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c.6-3.4 3.3-5 7-5s6.4 1.6 7 5'],
  ];
  const close = () => { c.setOpen(false); c.setMode('view'); c.setError(''); };
  return (<>
    <div style={S('display:flex;justify-content:flex-end;margin-bottom:-8px')}><button onClick={close} aria-label="Close" style={S(RING)}>{CLOSE}</button></div>
    <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
      <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>Client</h2>
      <Chip tone={TAG_TONE[sel.tag]} size="lg">{sel.tag}</Chip>
    </div>
    {!!c.notice && <Notice>{c.notice}</Notice>}
    <div style={S('display:flex;align-items:center;gap:14px;padding:16px;border:1px solid #E6E8EC;border-radius:22px')}>
      <Avatar name={sel.name} size="xl" />
      <div style={S('flex:1 1 auto;min-width:0')}>
        <div style={S('font-size:19px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{sel.name}</div>
        <div style={S('margin-top:2px;font-size:13.5px;color:#5E6673;overflow-wrap:anywhere')}>{sel.email || 'No email'}</div>
      </div>
      <Link href={`/clients/${sel.id}?v=messages`} aria-label={'Messages with ' + c.first} style={S(RING)}>
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
      {([['Visits', String(sel.visits)], ['Total spent', dollars(sel.spentCents)]] as [string, string][]).map(([l, v]) => <div key={l} style={S(TILE)}><div style={S('font-size:13px;color:#5E6673')}>{l}</div><div style={S('margin-top:4px;font-size:22px;font-weight:600;letter-spacing:-0.02em')}>{v}</div></div>)}
    </div>
    <div style={S('position:sticky;bottom:-40px;margin:auto -20px -40px;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px')}>
      {!!c.error && <FieldError>{c.error}</FieldError>}
      <div style={S('display:flex;gap:10px')}>
        <Link href={`/clients/${sel.id}`} style={S(OUTLINE)}>Open profile</Link>
        <button onClick={() => { c.setError(''); c.setNotice(''); openNewAppt({ id: sel.id, name: sel.name }); }} style={S(BLACK)}>Book appointment</button>
      </div>
    </div>
  </>);
}

/* What the sheet shows under its header: the quick view of the chosen client (Book appointment opens the same new-appointment sheet as everywhere else). */
function Panel({ c }: { c: C }) {
  const { sel } = c;
  if (c.mode === 'view' && sel) return <MobileClientView c={c} sel={sel} />;
  return (<>
    {c.mode === 'view' && !sel && c.items.length === 0 && <Note>No clients yet. Add your first client to get started.</Note>}
  </>);
}

function Desktop({ c }: { c: C }) {
  const router = useRouter();
  const rows = c.filtered.slice(0, SHOW_MAX);
  const rowS = (on: boolean) => 'display:flex;align-items:center;gap:16px;width:100%;box-sizing:border-box;min-height:64px;padding:8px 20px;border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;font-size:14px;color:#0E1116;background:' + (on ? '#F4F5F7' : 'transparent');
  const big = (l: string, v: string) => <Stat key={l} label={l} value={v} />;
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 32px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Clients" subtitle="Everyone who has booked with you" query={c.query} onQuery={c.setQuery} placeholder="Search clients" actionLabel="New client" onAction={c.openNew} />
      <section aria-label="Clients at a glance" style={S('display:flex;flex-wrap:wrap;align-items:flex-end;gap:20px 64px')}>
        {big('Clients', String(c.count))}{big('New this month', String(c.newThisMonth))}{big('Rebook rate', c.rebookRate)}
      </section>
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <section aria-label="Client list" style={S(DESK_LIST)}>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E6E8EC')}>
            <div role="group" aria-label="Filter clients" style={S('display:flex;flex-wrap:wrap;gap:8px')}>
              {FILTERS.map((f) => <FilterChip key={f.id} on={c.filter === f.id} onClick={() => c.setFilter(f.id)}>{f.label}</FilterChip>)}
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
                <button key={r.id} className="s-row" onClick={() => c.select(r.id)} onDoubleClick={() => router.push(`/clients/${r.id}`)} title="Double-click to open the profile" aria-label={`${r.name}, ${r.tag}, last visit ${r.last}`} style={S(rowS(c.open && r.id === c.sel?.id && c.mode !== 'new'))}>
                  <span style={S('flex:2.4 1 0;min-width:0;display:flex;align-items:center;gap:12px')}>
                    <Avatar name={r.name} size="md" />
                    <span style={S('min-width:0')}><span style={S('display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.name}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.email || 'No email'}</span></span>
                  </span>
                  <span style={S('flex:1.2 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.last}</span>
                  <span style={S('flex:1.4 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.next}</span>
                  <span style={S('flex:0.7 1 0;min-width:0')}>{r.visits}</span>
                  <span style={S('flex:0.9 1 0;min-width:0')}>{dollars(r.spentCents)}</span>
                  <span style={S('flex:1 1 0;min-width:0')}><Chip tone={TAG_TONE[r.tag]}>{r.tag}</Chip></span>
                </button>
              ))}
            </div>
          </div>
          {rows.length === 0 && <Note inList>{c.items.length === 0 ? 'No clients yet.' : `Nothing matches "${c.query.trim()}".`}</Note>}
          {c.filtered.length > SHOW_MAX && <p style={S('margin:0;padding:16px 20px;color:#5E6673;font-size:13px;border-top:1px solid #EEF0F3')}>Showing the first {SHOW_MAX}. Search to narrow the list.</p>}
        </section>
      </div>
      {c.open && <Mobile c={c} drawer />}
    </div>
  );
}

function Mobile({ c, drawer }: { c: C; drawer?: boolean }) {
  const [fopen, setFopen] = useState(false);
  const rows = c.filtered.slice(0, SHOW_MAX);
  const rowS = 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 16px;border:0;border-bottom:1px solid #EEF0F3;background:transparent;text-align:left;font:inherit;color:#0E1116;cursor:pointer';
  const sub = (r: ClientRow) => r.next === 'In progress' ? 'In progress' : r.next.startsWith('Today') ? 'Next ' + r.next.toLowerCase() : r.next === 'Not booked' ? 'Last visit: ' + (r.last === 'None yet' ? 'none yet' : r.last) : 'Next ' + r.next;
  return (
    <div className={rootCls(drawer)} style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Clients" subtitle={plural(c.count, 'client')} query={c.query} onQuery={c.setQuery} placeholder="Search clients" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <section aria-label="Clients at a glance" style={S('display:flex;gap:40px')}>
          <Stat label="Clients" value={String(c.count)} small />
          <Stat label="New this month" value={String(c.newThisMonth)} small />
        </section>
        <div style={S('display:flex;gap:10px')}>
          <FilterButton onClick={() => setFopen(true)} active={c.filter !== 'all'} label="Filter clients" />
          <button onClick={c.openNew} style={S(BLACK + ';gap:8px')}>
            <Icon name="plus" color="#FFFFFF" />
            New client
          </button>
        </div>
        {c.filter !== 'all' && <ActiveFilter label={FILTERS.find((f) => f.id === c.filter)?.label ?? ''} onClear={() => c.setFilter('all')} />}
        <ul style={S(ROW_LIST)}>
          {rows.map((r) => (
            <li key={r.id}>
              <button onClick={() => c.select(r.id)} aria-label={`${r.name}, ${r.tag}, last visit ${r.last}`} style={S(rowS)}>
                <Avatar name={r.name} size="lg" />
                <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.name}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{sub(r)}</span></span>
                <Chip tone={TAG_TONE[r.tag]}>{r.tag}</Chip>
              </button>
            </li>
          ))}
        </ul>
        {rows.length === 0 && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:14px')}>{c.items.length === 0 ? 'No clients yet.' : `Nothing matches "${c.query.trim()}".`}</p>}
      </main>
      <MobileTabs active="clients" />
      {fopen && <FilterSheet title="Filter clients" options={FILTERS.filter((f) => f.id !== 'Lapsed')} value={c.filter} onPick={c.setFilter} onClose={() => setFopen(false)} />}
      {c.open && (
        <BottomSheet label="Client" onClose={() => { c.setOpen(false); c.setMode('view'); c.setError(''); }} backdropLabel="Close details" handle={false}>
            {c.mode === 'new' ? <NewClientFlow c={c} /> : (<>
              <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0')} />
              {(c.mode !== 'view' || !c.sel) && <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Client</h2>
                <button onClick={() => { c.setOpen(false); c.setMode('view'); c.setError(''); }} aria-label="Close" style={S(RING)}>{CLOSE}</button></div>}
              <Panel c={c} />
            </>)}
          </BottomSheet>
      )}
    </div>
  );
}

export function ClientsView(props: Props) {
  const c = useClients(props);
  useNewParam(() => c.openNew());
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
