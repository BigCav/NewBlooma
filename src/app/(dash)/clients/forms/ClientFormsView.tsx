'use client';
// Client forms: who has an appointment coming up, which forms it needs, what is done, and what to send or record.
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../../calendar/pickers';
import { Done, FormsMain, FormsOverlay, Upcoming } from './FormsMobile';
import type { FormState, How } from '@/lib/forms-shared';
import { recordPatchTest, sendFormLinks } from './actions';

export type RowVM = { tplId: string; name: string; how: How; isPatch: boolean; needed: boolean; state: FormState; line: string; canSend: boolean; canFill: boolean; canRecord: boolean; answers: { k: string; v: string }[] };
export type ClientCard = { id: string; clientId: string; dayYmd: string; ref: string; time: string; name: string; init: string; email: string; bookingId: string; when: string; svc: string; who: string; level: 'ok' | 'todo' | 'alert'; todoCount: number; banner: { title: string; text: string }; rows: RowVM[]; sendable: number };
export type DoneRow = { id: string; clientId: string; client: string; form: string; date: string; ref: string; by: string; flagged: boolean; answers: { k: string; v: string }[] };
type Props = { cards: ClientCard[]; done: DoneRow[]; initial: string; hasForms: boolean; owner: boolean; today: string };

const STAT: Record<FormState, { t: string; bg: string; fg: string }> = {
  valid: { t: 'Valid', bg: '#DDF3EA', fg: '#14624A' }, expired: { t: 'Expired', bg: '#FDECEA', fg: '#B42318' }, missing: { t: 'Not completed', bg: '#FFF4E5', fg: '#7A4204' },
  na: { t: 'Not needed yet', bg: '#EEF0F3', fg: '#4A525E' }, reaction: { t: 'Reaction', bg: '#FDECEA', fg: '#B42318' },
};

function useClientForms(props: Props) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => { const mq = window.matchMedia('(max-width:900px)'); const f = () => setNarrow(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  const [tab, setTab] = useState<'upcoming' | 'done'>('upcoming');
  const [sel, setSel] = useState(props.initial);
  const [open, setOpen] = useState('');
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [rec, setRec] = useState<{ tplId: string; date: string; reaction: boolean; note: string } | null>(null);
  const [bk, setBk] = useState(false);
  const [fm, setFm] = useState('');
  const [query, setQuery] = useState('');
  const [ans, setAns] = useState<{ name: string; sub: string; flagged: boolean; answers: { k: string; v: string }[]; clientId: string } | null>(null);
  const cur = props.cards.find((x) => x.id === sel) ?? props.cards[0] ?? null;
  const pick = (id: string) => { setSel(id); setOpen(''); setRec(null); setError(''); setNotice(''); };
  const openBk = (id: string) => { pick(id); setBk(true); setFm(''); };
  const send = () => { if (!cur) return; const k = cur.bookingId; startT(async () => { const r = await sendFormLinks(k); if (r.error) { setError(r.error); setNotice(''); return; } setError(''); setNotice(r.notice ?? 'Link sent'); setSent((s) => ({ ...s, [k]: true })); }); };
  const saveRec = () => {
    if (!cur || !rec) return;
    startT(async () => { const r = await recordPatchTest(cur.clientId, rec.tplId, rec.date, rec.reaction, rec.note); if (r.error) { setError(r.error); return; } setError(''); setRec(null); setNotice(r.notice ?? 'Saved'); router.refresh(); });
  };
  return { ...props, tab, setTab, busy, narrow, cur, sel, pick, open, setOpen, sent, notice, error, setError, rec, setRec, send, saveRec, ans, setAns, stat: STAT, bk, setBk: (v: boolean) => { setBk(v); if (!v) { setFm(''); setError(''); setNotice(''); } }, fm, setFm, query, setQuery, openBooking: openBk };
}
type C = ReturnType<typeof useClientForms>;
export type FormsCtl = C;

const chipD = (on: boolean) => 'height:40px;padding:0 16px;border-radius:999px;font:inherit;font-size:13.5px;font-weight:500;cursor:pointer;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
const bigD = (l: string, v: number) => <div key={l}><div style={S('color:#5E6673;font-size:13.5px')}>{l}</div><div style={S('margin-top:4px;font-size:38px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{String(v)}</div></div>;

/** Desktop: the same cards as the phone, in a grid. A visit or a completed form opens in the right-hand drawer. */
function Desktop({ c }: { c: C }) {
  const needed = c.cards.reduce((n, k) => n + (k.todoCount || 0), 0);
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 32px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Client forms" subtitle="Forms for upcoming appointments" query={c.query} onQuery={c.setQuery} placeholder="Search client forms" showAction={false} />
      <section aria-label="Client forms at a glance" style={S('display:flex;flex-wrap:wrap;gap:20px 64px')}>{bigD('Upcoming visits', c.cards.length)}{bigD('Forms needed', needed)}{bigD('Completed forms', c.done.length)}</section>
      <div role="tablist" aria-label="Client forms view" style={S('display:flex;gap:8px')}>
        {([['upcoming', 'Upcoming visits'], ['done', 'Completed']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={c.tab === id} onClick={() => c.setTab(id)} style={S(chipD(c.tab === id))}>{label}</button>)}
      </div>
      {c.tab === 'done'
        ? <div style={S('display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:12px')}><Done c={c} /></div>
        : <div style={S('display:flex;flex-direction:column;gap:20px')}><Upcoming c={c} wide /></div>}
      {(c.bk || !!c.ans || !!c.rec) && <div className="m-cal cal-root m-drawer"><FormsOverlay c={c} /></div>}
    </div>
  );
}

export function ClientFormsView(props: Props) {
  const c = useClientForms(props);
  return (<>
    {c.narrow !== false && (
      <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
        <MobileHeader title="Client forms" subtitle="Forms for upcoming appointments" query={c.query} onQuery={c.setQuery} placeholder="Search client forms" />
        <FormsMain c={c} />
        <MobileTabs active="clients" />
        <FormsOverlay c={c} />
      </div>
    )}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
