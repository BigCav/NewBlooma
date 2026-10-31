'use client';
import { rootCls } from '@/components/drawer';
import { useEffect, useState } from 'react';
import { MobileHeader, MobileTabs } from '@/components/Chrome';
import { ActiveFilter, FilterButton, FilterSheet } from '@/components/FilterBits';
import { S } from '../calendar/pickers';
import { DetailRows, ICONS } from '../calendar/wizardUi';
import type { ReviewRow, ReviewsCtl } from './ReviewsView';

const STARS = '★★★★★';
const RING = 'flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0';
const BACK = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6l-6 6 6 6" /></svg>;
const BLACK = 'flex:1 1 0;height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer';
const OUTLINE = 'flex:1 1 0;height:52px;box-sizing:border-box;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer';
const PAGE = "position:absolute;left:0;right:0;top:0;bottom:0;z-index:5;display:flex;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4";
const BAR = 'flex:0 0 auto;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px';
const FIELD_IN = { ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116;resize:none'), minHeight: 0, borderRadius: 0 } as const;
const initials = (n: string) => n.split(' ').filter((w) => /[A-Za-z0-9]/.test(w[0] ?? '')).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'C';
const AV = (px: number, fs: number) => 'flex:0 0 ' + px + 'px;width:' + px + 'px;height:' + px + 'px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:' + fs + 'px;font-weight:600';

function Stars({ n, size }: { n: number; size: number }) {
  return <span role="img" aria-label={n + ' out of 5 stars'} style={S('font-size:' + size + 'px;letter-spacing:1px;line-height:1')}><span style={S('color:#E8A317')}>{STARS.slice(0, n)}</span><span style={S('color:#D5D9E0')}>{STARS.slice(n)}</span></span>;
}

function Header({ title, onBack, avatar }: { title: string; onBack: () => void; avatar?: string }) {
  return (
    <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px;border-bottom:1px solid #E6E8EC')}>
      <button onClick={onBack} aria-label="Back" style={S(RING)}>{BACK}</button>
      {avatar && <div style={S(AV(36, 13))}>{avatar}</div>}
      <div style={S('flex:1 1 auto;min-width:0;font-size:18px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{title}</div>
    </header>
  );
}

export function ReviewCard({ r, onOpen }: { r: ReviewRow; onOpen: () => void }) {
  return (
          <button onClick={onOpen} aria-label={`${r.name}, ${r.stars} stars, ${r.reply ? 'replied' : 'needs a reply'}`} style={S('display:flex;align-items:flex-start;gap:14px;width:100%;box-sizing:border-box;padding:16px;border-radius:22px;border:1px solid ' + (r.reply ? '#E6E8EC' : '#F3D9AE') + ';background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
            <span style={S(AV(48, 15))}>{initials(r.name)}</span>
            <span style={S('flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:4px')}>
              <span style={S('display:flex;align-items:center;justify-content:space-between;gap:10px')}><span style={S('min-width:0;font-size:16px;font-weight:600;letter-spacing:-0.01em;overflow-wrap:anywhere')}>{r.name}</span><span style={S('flex:0 0 auto;font-size:12.5px;color:#5E6673')}>{r.date}</span></span>
              <Stars n={r.stars} size={15} />
              <span style={S('display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;font-size:14.5px;color:#0E1116')}>{r.text}</span>
              <span style={S('font-size:12.5px;color:#8A93A0;overflow-wrap:anywhere')}>{r.svc} with {r.pro}</span>
              <span style={S('align-self:flex-start;margin-top:4px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:' + (r.reply ? '#DDF3EA' : '#FFF4E5') + ';color:' + (r.reply ? '#14624A' : '#8A4B00'))}>{r.reply ? 'Replied' : 'Needs reply'}</span>
            </span>
          </button>
  );
}

export function ReviewsMobile({ c, filters, drawer, startId, onClose }: { c: ReviewsCtl; filters: [string, string][]; drawer?: boolean; startId?: string; onClose?: () => void }) {
  const [fopen, setFopen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(startId ?? null);
  useEffect(() => { if (drawer && openId === null && !c.replyId) onClose?.(); }, [openId, c.replyId]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = c.query.trim().toLowerCase();
  const list = c.shown.filter((r) => !q || (r.name + ' ' + r.text + ' ' + r.svc + ' ' + r.pro).toLowerCase().includes(q));
  const open = openId ? c.rows.find((r) => r.id === openId) ?? null : null;
  const replying = c.replyId ? c.rows.find((r) => r.id === c.replyId) ?? null : null;
  const fl = filters.find((f) => f[0] === c.filter)?.[1] ?? 'All';
  const rounded = Math.round(c.avg);
  const err = c.error ? <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p> : null;

  return (
    <div className={rootCls(drawer)} style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Reviews" subtitle="What clients say" query={c.query} onQuery={c.setQuery} placeholder="Search reviews" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:14px')}>
        <section aria-label="Rating summary" style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px;display:flex;align-items:center;gap:20px')}>
          <div style={S('flex:0 0 auto')}>
            <div style={S('font-size:44px;line-height:1;font-weight:600;letter-spacing:-0.04em')}>{c.avg.toFixed(1)}</div>
            <div aria-hidden="true" style={S('margin-top:6px;font-size:16px;letter-spacing:2px')}><span style={S('color:#E8A317')}>{STARS.slice(0, rounded)}</span><span style={S('color:#D5D9E0')}>{STARS.slice(rounded)}</span></div>
            <div style={S('margin-top:4px;color:#5E6673;font-size:13px')}>{c.n + (c.n === 1 ? ' review' : ' reviews')}</div>
          </div>
          <div style={S('flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:6px')}>
            {[5, 4, 3, 2, 1].map((k) => { const cnt = c.rows.filter((r) => r.stars === k).length; return (
              <div key={k} style={S('display:flex;align-items:center;gap:8px;font-size:12.5px;color:#5E6673')}><span style={S('flex:0 0 12px')}>{k}</span><div style={S('flex:1 1 auto;background:#EEF0F3;border-radius:999px')}><div style={S('height:6px;border-radius:999px;background:#0E1116;width:' + (c.n ? Math.round(cnt / c.n * 100) : 0) + '%')} /></div><span style={S('flex:0 0 20px;text-align:right')}>{cnt}</span></div>
            ); })}
          </div>
        </section>
        <div style={S('display:flex;gap:12px')}>
          <FilterButton onClick={() => setFopen(true)} active={c.filter !== 'all'} label="Filter reviews" />
          <button onClick={c.request} disabled={c.busy} style={S(BLACK)}>Ask clients for a review</button>
        </div>
        {c.filter !== 'all' && <ActiveFilter label={fl} onClear={() => c.pickFilter('all')} />}
        {!!c.notice && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{c.notice}</span>}
        {!open && !replying && err}
        {list.length === 0 && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:14px')}>{c.n === 0 ? 'No reviews yet. Ask recent clients to leave one.' : q ? `Nothing matches "${c.query.trim()}".` : 'No reviews match this filter.'}</p>}
        {list.map((r) => <ReviewCard key={r.id} r={r} onOpen={() => { c.pickFilter(c.filter); setOpenId(r.id); }} />)}
      </main>
      <MobileTabs active="more" />
      {fopen && <FilterSheet title="Filter reviews" options={filters.map(([id, label]) => ({ id, label }))} value={c.filter} onPick={c.pickFilter} onClose={() => setFopen(false)} />}

      {open && <ReviewPage c={c} r={open} onBack={() => { setOpenId(null); c.closeReply(); }} />}
      {replying && <ReplyPage c={c} r={replying} />}
    </div>
  );
}

function ReviewPage({ c, r, onBack }: { c: ReviewsCtl; r: ReviewRow; onBack: () => void }) {
  return (
    <div role="dialog" aria-label="Review" style={S(PAGE)}>
      <Header title={r.name} avatar={initials(r.name)} onBack={onBack} />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 24px;display:flex;flex-direction:column;gap:16px')}>
        <div>
          <Stars n={r.stars} size={26} />
          <p style={S('margin:12px 0 0;font-size:17px;line-height:1.4;overflow-wrap:anywhere')}>{r.text}</p>
        </div>
        <DetailRows go={() => {}} rows={[
          { icon: ICONS.scissors, text: r.svc },
          { icon: ICONS.person, text: r.pro },
          { icon: ICONS.day, text: r.date },
        ]} />
        {!!r.reply && (
          <div style={S('box-sizing:border-box;padding:14px 16px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}>
            <div style={S('font-size:12.5px;color:#5E6673')}>Reply from {c.salonName}</div>
            <div style={S('margin-top:3px;font-size:15px;overflow-wrap:anywhere')}>{r.reply}</div>
          </div>
        )}
        {!!c.notice && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{c.notice}</span>}
        {!!c.error && !c.replyId && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
      </main>
      <div style={S(BAR)}>
        <button onClick={() => c.openReply(r)} style={S(BLACK + ';flex:0 0 auto;width:100%')}>{r.reply ? 'Edit reply' : 'Reply'}</button>
      </div>
    </div>
  );
}

function ReplyPage({ c, r }: { c: ReviewsCtl; r: ReviewRow }) {
  return (
    <div role="dialog" aria-label="Reply" style={S(PAGE + ';z-index:6')}>
      <Header title={'Reply to ' + r.name.split(' ')[0]} onBack={c.closeReply} />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 24px;display:flex;flex-direction:column;gap:14px')}>
        <div style={S('box-sizing:border-box;padding:14px 16px;border:1px solid #E6E8EC;border-radius:20px;background:#FFFFFF;display:flex;flex-direction:column;gap:6px')}>
          <Stars n={r.stars} size={16} />
          <div style={S('font-size:14.5px;overflow-wrap:anywhere')}>{r.text}</div>
        </div>
        <label htmlFor={'rp-' + r.id} style={S('display:block;box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}>
          <span style={S('display:block;font-size:12.5px;color:#5E6673')}>Your reply</span>
          <textarea id={'rp-' + r.id} rows={7} value={c.text} onChange={(e) => c.setText(e.target.value)} placeholder="Thank them or make it right" style={FIELD_IN} />
        </label>
        <p style={S('margin:0;font-size:13px;color:#5E6673')}>Your reply shows with the review.</p>
      </main>
      <div style={S(BAR)}>
        {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
        <div style={S('display:flex;gap:10px')}>
          {!!r.reply && <button className="ghost" onClick={() => c.removeReply(r.id)} disabled={c.busy} style={S(OUTLINE + ';color:#B42318')}>Delete reply</button>}
          <button onClick={() => c.save(r.id)} disabled={c.busy} style={S(BLACK)}>Post reply</button>
        </div>
      </div>
    </div>
  );
}
