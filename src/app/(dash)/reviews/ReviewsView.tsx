'use client';
// 1:1 conversion of the prototype's Reviews.dc.html and MobileReviews.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { deleteReply, requestReviews, saveReply } from './actions';
import { ReviewCard, ReviewsMobile } from './ReviewsMobile';

export type ReviewRow = { id: string; name: string; stars: number; text: string; svc: string; pro: string; date: string; reply: string };
type Props = { rows: ReviewRow[]; salonName: string };
export const FILTERS: [string, string][] = [['all', 'All'], ['reply', 'Needs reply'], ['5', '5 stars'], ['4', '4 stars'], ['low', '3 or fewer']];
const chip = (on: boolean) => 'flex:0 0 auto;height:40px;padding:0 14px;border-radius:999px;font-size:13.5px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
const STARS = '★★★★★';

function useReviews(props: Props) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [replyId, setReplyId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const n = props.rows.length;
  const avg = n ? props.rows.reduce((a, r) => a + r.stars, 0) / n : 0;
  const shown = props.rows.filter((r) => filter === 'all' || (filter === 'reply' && !r.reply) || (filter === '5' && r.stars === 5) || (filter === '4' && r.stars === 4) || (filter === 'low' && r.stars <= 3));
  const save = (id: string) => startT(async () => { const r = await saveReply(id, text); if (r.error) { setError(r.error); return; } setError(''); setNotice(r.notice ?? ''); setReplyId(null); setText(''); router.refresh(); });
  const removeReply = (id: string) => startT(async () => { const r = await deleteReply(id); if (r.error) { setError(r.error); return; } setError(''); setNotice(r.notice ?? ''); setReplyId(null); setText(''); router.refresh(); });
  const request = () => startT(async () => { const r = await requestReviews(); if (r.error) { setError(r.error); setNotice(''); return; } setError(''); setNotice(r.notice ?? ''); router.refresh(); });
  return { ...props, busy, narrow, query, setQuery, filter, pickFilter: (f: string) => { setFilter(f); setReplyId(null); setError(''); }, replyId, text, setText, notice, error, n, avg, shown, save, removeReply, request,
    openReply: (r: ReviewRow) => { setReplyId(r.id); setText(r.reply); setError(''); }, closeReply: () => { setReplyId(null); setText(''); setError(''); } };
}
type C = ReturnType<typeof useReviews>;
export type ReviewsCtl = C;

function Summary({ c, m }: { c: C; m: boolean }) {
  const rounded = Math.round(c.avg);
  return (<>
    <section aria-label="Rating summary" style={S(`box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:${m ? 20 : 24}px;display:flex;flex-wrap:wrap;align-items:center;gap:${m ? 20 : 32}px`)}>
      <div style={S('flex:0 0 auto')}><div style={S(`font-size:${m ? 44 : 56}px;line-height:1;font-weight:600;letter-spacing:-0.04em`)}>{c.avg.toFixed(1)}</div><div aria-hidden="true" style={S('margin-top:6px;font-size:20px;letter-spacing:2px')}><span style={S('color:#E8A317')}>{STARS.slice(0, rounded)}</span><span style={S('color:#D5D9E0')}>{STARS.slice(rounded)}</span></div><div style={S('margin-top:4px;color:#5E6673;font-size:13.5px')}>{c.n + (c.n === 1 ? ' review' : ' reviews')}</div></div>
      <div style={S('flex:1 1 220px;min-width:0;display:flex;flex-direction:column;gap:8px')}>
        {[5, 4, 3, 2, 1].map((k) => { const cnt = c.rows.filter((r) => r.stars === k).length; return (
          <div key={k} style={S('display:flex;align-items:center;gap:10px;font-size:13px;color:#5E6673')}><span style={S('flex:0 0 46px')}>{k + ' star'}</span><div style={S('flex:1 1 auto;background:#EEF0F3;border-radius:999px')}><div style={S('height:8px;border-radius:999px;background:#0E1116;width:' + (c.n ? Math.round(cnt / c.n * 100) : 0) + '%')} /></div><span style={S('flex:0 0 24px;text-align:right')}>{cnt}</span></div>
        ); })}
      </div>
    </section>
    <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px')}>
      <button onClick={c.request} disabled={c.busy} style={S('height:44px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500;padding:0 20px;' + (m ? 'flex:1 1 100%' : 'flex:0 0 auto'))}>Ask recent clients for a review</button>
    </div>
    {!!c.notice && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{c.notice}</span>}
    {!!c.error && !c.replyId && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
  </>);
}

function Filters({ c }: { c: C }) {
  return (<>
    <div role="group" aria-label="Filter reviews" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>
      {FILTERS.map(([id, label]) => <button key={id} onClick={() => c.pickFilter(id)} aria-pressed={c.filter === id} style={S(chip(c.filter === id))}>{label}</button>)}
    </div>
  </>);
}

function Desktop({ c }: { c: C }) {
  const [sel, setSel] = useState<string | null>(null);
  const q = c.query.trim().toLowerCase();
  const list = c.shown.filter((r) => !q || (r.name + ' ' + r.text + ' ' + r.svc + ' ' + r.pro).toLowerCase().includes(q));
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Reviews" subtitle={`What clients say about ${c.salonName}`} query={c.query} onQuery={c.setQuery} placeholder="Search reviews" showAction={false} />
      <div style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:16px;align-items:start')}><Summary c={c} m={false} /></div>
      <Filters c={c} />
      {list.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>{c.n === 0 ? 'No reviews yet. Ask recent clients to leave one.' : 'No reviews match this filter.'}</p>}
      <section aria-label="Reviews" style={S('display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:16px;align-items:start')}>
        {list.map((r) => <ReviewCard key={r.id} r={r} onOpen={() => setSel(r.id)} />)}
      </section>
      {sel && <ReviewsMobile key={sel} c={c} filters={FILTERS} drawer startId={sel} onClose={() => setSel(null)} />}
    </div>
  );
}
export function ReviewsView(props: Props) {
  const c = useReviews(props);
  return (<>
    {c.narrow !== false && <ReviewsMobile c={c} filters={FILTERS} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
