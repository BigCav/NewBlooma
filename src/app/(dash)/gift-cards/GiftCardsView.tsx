'use client';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmBox } from '@/components/ConfirmBox';
import { dollars } from '@/lib/format';
import { dayInfo } from '@/lib/cal';
import { plural } from '@/lib/display';
import { BLACK, CLOSE, Chip, DESK_LIST, FieldError, FilterChip, Icon, KV_ROW, Note, Notice, OUTLINE, RING, Stat, StatCard } from '@/components/ui';
import { PAYMENT_STATUS } from '@/lib/status';
import type { ToneName } from '@/lib/tones';
import { rootCls } from '@/components/drawer';
import { useNewParam } from '@/components/useNewParam';
// Converted from the prototype's GiftCards.dc.html and MobileGiftCards.dc.html. Markup and style strings follow the prototype;
// data comes from the server and the actions are real server actions.
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { ActiveFilter, FilterButton, FilterSheet } from '@/components/FilterBits';
import { issueGiftCard, voidGiftCard } from './actions';
import { IssueFlow } from './IssueFlow';

export type GiftRow = { id: string; code: string; name: string; issued: string; original: number; balance: number; voided: boolean; hist: { d: string; label: string; a: number }[] };
type Props = { rows: GiftRow[]; salonName: string; month: string; today: string; canIssue: boolean };
type NewForm = { amount: string; name: string; code: string };

/** Dates in the one house style; the year is added only when it is not this year. */
const withYear = (s: string, text: string, today: string) => (s.slice(0, 4) !== today.slice(0, 4) ? text + ' ' + s.slice(0, 4) : text);
const dShort = (s: string, today: string) => withYear(s, dayInfo(s).short, today);
const dLong = (s: string, today: string) => withYear(s, dayInfo(s).full, today);
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const genCode = () => { const g = () => Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join(''); return 'GIFT-' + g() + '-' + g(); };
const statusOf = (c: GiftRow) => (c.voided ? 'Voided' : c.balance === 0 ? 'Used up' : c.balance < c.original ? 'Part used' : 'Unused');
/** The chip colour of each gift card state: unused is green, voided is the same red as a refund. */
const TONE_OF: Record<string, ToneName> = { Unused: 'green', 'Part used': 'purple', 'Used up': 'grey', Voided: PAYMENT_STATUS.refunded.tone };
const MONO = "font-family:'Geist Mono',ui-monospace,monospace";
const FILTERS: [string, string][] = [['all', 'All'], ['active', 'Active'], ['used', 'Used up or voided']];

function useGifts(props: Props) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const all = props.rows;
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selId, setSelId] = useState<string | null>(all[0]?.id ?? null);
  const [mode, setMode] = useState<'view' | 'new'>('view');
  const [open, setOpen] = useState(false);
  const [nf, setNf] = useState<NewForm>({ amount: '', name: '', code: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmVoid, setConfirmVoid] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flash = (msg: string) => { setNotice(msg); clearTimeout(timer.current); timer.current = setTimeout(() => setNotice(''), 3000); };
  useEffect(() => () => clearTimeout(timer.current), []);

  const sel = all.find((c) => c.id === selId) ?? all[0] ?? null;
  const q = query.trim().toLowerCase();
  const shown = all.filter((c) => (filter === 'all' || (filter === 'active' && !c.voided && c.balance > 0) || (filter === 'used' && (c.voided || c.balance === 0))) && (!q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)));
  const live = all.filter((c) => !c.voided);
  const owed = live.reduce((a, c) => a + c.balance, 0);
  const active = all.filter((c) => !c.voided && c.balance > 0).length;
  const inMonth = (s: string) => s.slice(0, 7) === props.month;
  const issuedM = all.filter((c) => inMonth(c.issued)).reduce((a, c) => a + c.original, 0);
  // Redeemed at checkout, less anything refunded back onto a card.
  const redeemedM = Math.max(0, all.reduce((a, c) => a + c.hist.filter((h) => inMonth(h.d) && !h.label.startsWith('Voided')).reduce((b, h) => b - h.a, 0), 0));

  const pick = (id: string) => { setSelId(id); setMode('view'); setConfirmVoid(false); setError(''); setOpen(true); };
  const openNew = () => { setMode('new'); setNf({ amount: '', name: '', code: genCode() }); setError(''); setConfirmVoid(false); setOpen(true); };
  const closeNew = () => { setMode('view'); setError(''); setOpen(false); };
  const issue = () => startT(async () => {
    const r = await issueGiftCard(nf);
    if (r.error) { setError(r.error); return; }
    setSelId(r.id ?? null); setMode('view'); setError(''); setFilter('all'); setQuery(''); flash('Gift card issued'); router.refresh();
  });
  const doVoid = () => { if (!sel) return; startT(async () => { const r = await voidGiftCard(sel.id); setConfirmVoid(false); if (r.error) { setError(r.error); return; } setError(''); flash('Gift card voided'); router.refresh(); }); };
  const copy = () => { if (!sel) return; try { navigator.clipboard.writeText(sel.code); flash('Code copied'); } catch { flash('Could not copy'); } };
  return { ...props, busy, narrow, all, shown, sel, filter, setFilter, query, setQuery, mode, open, setOpen, nf, setNf, error, setError, notice, confirmVoid, setConfirmVoid,
    owed, active, issuedM, redeemedM, pick, openNew, closeNew, issue, doVoid, copy };
}
type C = ReturnType<typeof useGifts>;
export type GiftCtl = C;

function Panel({ c }: { c: C }) {
  const close = (
    <button className="ghost" onClick={() => c.setOpen(false)} aria-label="Close" style={S(RING)}>{CLOSE}</button>
  );
  const sel = c.sel;
  if (!sel) return <Note>{c.canIssue ? 'No gift cards yet. Issue your first one.' : 'No gift cards yet.'}</Note>;
  const st = statusOf(sel);
  const canVoid = c.canIssue && !sel.voided && sel.balance > 0;
  const rowCss = KV_ROW;
  const hist = sel.hist.concat([{ d: sel.issued, label: 'Issued', a: sel.original }]);
  return (
    <div style={S('display:flex;flex-direction:column;gap:20px')}>
      <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
        <Chip tone={TONE_OF[st]}>{st}</Chip>
        {!!c.notice && <Notice>{c.notice}</Notice>}
        {close}
      </div>
      <div style={S('box-sizing:border-box;border-radius:20px;background:#0E1116;color:#FFFFFF;padding:22px;display:flex;flex-direction:column;gap:24px')}>
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><span style={S('font-size:15px;font-weight:600')}>{c.salonName}</span><span style={S('font-size:12.5px;color:#C4C9D2')}>Gift card</span></div>
        <div><div style={S('font-size:12.5px;color:#C4C9D2')}>Balance</div><div style={S('margin-top:2px;font-size:36px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{dollars(sel.balance)}</div></div>
        <div style={S('font-size:15px;font-weight:500;letter-spacing:0.06em;overflow-wrap:anywhere;' + MONO)}>{sel.code}</div>
      </div>
      <div style={S('display:flex;gap:10px')}>
        <button onClick={c.copy} style={S(BLACK)}>Copy code</button>
        {canVoid && <button className="ghost" onClick={() => c.setConfirmVoid(true)} style={S(OUTLINE)}>Void card</button>}
      </div>
      {c.confirmVoid && (
        <ConfirmBox label="Void this gift card" title="Void this card?" body={'Its ' + dollars(sel.balance) + ' balance will be set to zero and cannot be used again.'} action="Void card" onAction={c.doVoid} busy={c.busy} onKeep={() => c.setConfirmVoid(false)} />
      )}
      {!!c.error && <FieldError>{c.error}</FieldError>}
      <dl style={S('margin:0;display:flex;flex-direction:column')}>
        <div style={S(rowCss)}><dt style={S('color:#5E6673')}>For</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{sel.name || 'No name'}</dd></div>
        <div style={S(rowCss)}><dt style={S('color:#5E6673')}>Issued</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{dLong(sel.issued, c.today)}</dd></div>
        <div style={S(rowCss)}><dt style={S('color:#5E6673')}>Original amount</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{dollars(sel.original)}</dd></div>
        <div style={S(rowCss + ';border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Used so far</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{dollars(sel.original - sel.balance - sel.hist.filter((h) => h.label.startsWith('Voided')).reduce((t, h) => t - h.a, 0))}</dd></div>
      </dl>
      <section aria-label="History" style={S('display:flex;flex-direction:column;gap:4px')}>
        <h3 style={S('margin:0 0 4px;font-size:15px;font-weight:600')}>History</h3>
        <ul style={S('margin:0;padding:0;list-style:none')}>
          {hist.map((h, i) => (
            <li key={i} style={S('display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #EEF0F3')}>
              <span style={S('min-width:0')}><span style={S('display:block;font-size:14px;font-weight:500;overflow-wrap:anywhere')}>{h.label}</span><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{dLong(h.d, c.today)}</span></span>
              <span style={S('flex:0 0 auto;font-weight:600;color:' + (h.a > 0 ? '#14624A' : '#0E1116'))}>{(h.a > 0 ? '+' : '-') + dollars(Math.abs(h.a))}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const noneText = (c: C) => (c.all.length === 0 ? (c.canIssue ? 'No gift cards yet. Issue your first one.' : 'No gift cards yet.') : 'No gift cards match.');

function Desktop({ c }: { c: C }) {
  const stat = (l: string, v: string) => <Stat key={l} label={l} value={v} />;
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 32px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Gift cards" subtitle="Issue gift cards and track what is left on them" query={c.query} onQuery={c.setQuery} placeholder="Search code or name" actionLabel="Issue gift card" onAction={c.openNew} showAction={c.canIssue} />
      <section aria-label="Gift cards at a glance" style={S('display:flex;flex-wrap:wrap;gap:20px 64px')}>
        {stat('Owed to clients', dollars(c.owed))}{stat('Active cards', String(c.active))}{stat('Issued this month', dollars(c.issuedM))}{stat('Redeemed this month', dollars(c.redeemedM))}
      </section>
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <section aria-label="Gift card list" style={S(DESK_LIST)}>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E6E8EC')}>
            <div role="group" aria-label="Filter gift cards" style={S('display:flex;flex-wrap:wrap;gap:8px')}>{FILTERS.map(([id, l]) => <FilterChip key={id} on={c.filter === id} onClick={() => c.setFilter(id)}>{l}</FilterChip>)}</div>
            <span style={S('color:#5E6673;font-size:13.5px')}>{plural(c.shown.length, 'card')}</span>
          </div>
          <div style={S('overflow-x:auto')}>
            <div style={S('min-width:720px')}>
              <div style={S('display:flex;align-items:center;gap:16px;padding:12px 20px;border-bottom:1px solid #EEF0F3;color:#5E6673;font-size:12.5px;font-weight:500')}>
                <div style={S('flex:1.5 1 0;min-width:0')}>Code</div><div style={S('flex:1.3 1 0;min-width:0')}>For</div><div style={S('flex:0.9 1 0;min-width:0')}>Issued</div><div style={S('flex:0.8 1 0;min-width:0')}>Original</div><div style={S('flex:1.3 1 0;min-width:0')}>Balance</div><div style={S('flex:0.9 1 0;min-width:0')}>Status</div>
              </div>
              <ul style={S('margin:0;padding:0;list-style:none')}>
                {c.shown.map((g) => {
                  const s = statusOf(g), on = c.open && c.mode === 'view' && c.sel?.id === g.id, pct = g.original ? Math.round(g.balance / g.original * 100) : 0;
                  return (
                    <li key={g.id}><button className="row" onClick={() => c.pick(g.id)} aria-pressed={on} aria-label={`${g.code}, ${dollars(g.balance)} left, ${s}`} style={S('display:flex;align-items:center;gap:16px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 20px;border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;color:#0E1116;cursor:pointer;background:' + (on ? '#F4F5F7' : 'transparent'))}>
                      <span style={S('flex:1.5 1 0;min-width:0;font-size:13.5px;font-weight:500;letter-spacing:0.02em;' + MONO)}>{g.code}</span>
                      <span style={S('flex:1.3 1 0;min-width:0;overflow-wrap:anywhere;color:' + (g.name ? '#0E1116' : '#8A93A0'))}>{g.name || 'No name'}</span>
                      <span style={S('flex:0.9 1 0;min-width:0;color:#5E6673')}>{dShort(g.issued, c.today)}</span>
                      <span style={S('flex:0.8 1 0;min-width:0;color:#5E6673')}>{dollars(g.original)}</span>
                      <span style={S('flex:1.3 1 0;min-width:0')}><span style={S('display:block;font-weight:600')}>{dollars(g.balance)}</span><span style={S('display:block;margin-top:6px;height:6px;border-radius:999px;background:#EEF0F3')}><span style={S('display:block;height:6px;border-radius:999px;background:#0E1116;width:' + pct + '%')} /></span></span>
                      <span style={S('flex:0.9 1 0;min-width:0')}><Chip tone={TONE_OF[s]}>{s}</Chip></span>
                    </button></li>
                  );
                })}
              </ul>
            </div>
          </div>
          {c.shown.length === 0 && <p style={S('margin:0;padding:28px 20px;color:#5E6673;font-size:14px')}>{noneText(c)}</p>}
        </section>
      </div>
      {c.open && <Mobile c={c} drawer />}
    </div>
  );
}

function Mobile({ c, drawer }: { c: C; drawer?: boolean }) {
  const [fopen, setFopen] = useState(false);
  const opts = FILTERS.map(([id, label]) => ({ id: id as string, label: label as string }));
  const stat = (l: string, v: string) => <StatCard key={l} label={l} value={v} />;
  return (
    <div className={rootCls(drawer)} style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Gift cards" subtitle="Issue and track balances" query={c.query} onQuery={c.setQuery} placeholder="Search code or name" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <section aria-label="Gift cards at a glance" style={S('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px')}>
          {stat('Owed to clients', dollars(c.owed))}{stat('Active cards', String(c.active))}{stat('Issued this month', dollars(c.issuedM))}{stat('Redeemed this month', dollars(c.redeemedM))}
        </section>
        <div style={S('display:flex;gap:10px')}>
          <FilterButton onClick={() => setFopen(true)} active={c.filter !== 'all'} label="Filter gift cards" />
          {c.canIssue && (
            <button onClick={c.openNew} style={S(BLACK + ';gap:8px')}>
              <Icon name="plus" color="#FFFFFF" />
              Issue gift card
            </button>
          )}
        </div>
        {c.filter !== 'all' && <ActiveFilter label={opts.find((f) => f.id === c.filter)?.label ?? ''} onClear={() => c.setFilter('all')} />}
        {c.shown.length === 0 && <Note>{noneText(c)}</Note>}
        <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px')}>
          {c.shown.map((g) => {
            const s = statusOf(g), pct = g.original ? Math.round(g.balance / g.original * 100) : 0;
            return (
              <li key={g.id}><button className="ghost" onClick={() => c.pick(g.id)} aria-label={`${g.code}, ${dollars(g.balance)} left, ${s}`} style={S('display:flex;flex-direction:column;gap:10px;width:100%;box-sizing:border-box;padding:16px 18px;border:1px solid #E6E8EC;border-radius:20px;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
                <span style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><span style={S('font-size:13.5px;font-weight:500;letter-spacing:0.02em;' + MONO)}>{g.code}</span><Chip tone={TONE_OF[s]}>{s}</Chip></span>
                <span style={S('display:flex;align-items:baseline;justify-content:space-between;gap:12px')}><span style={S('min-width:0;overflow-wrap:anywhere;font-size:14px;color:' + (g.name ? '#0E1116' : '#8A93A0'))}>{g.name || 'No name'}</span><span style={S('flex:0 0 auto;font-size:18px;font-weight:600;letter-spacing:-0.01em')}>{dollars(g.balance)}</span></span>
                <span style={S('display:block;height:6px;border-radius:999px;background:#EEF0F3')}><span style={S('display:block;height:6px;border-radius:999px;background:#0E1116;width:' + pct + '%')} /></span>
                <span style={S('font-size:12.5px;color:#5E6673')}>{dollars(g.original)} issued {dShort(g.issued, c.today)}</span>
              </button></li>
            );
          })}
        </ul>
      </main>
      <MobileTabs active="more" />
      {fopen && <FilterSheet title="Filter gift cards" options={opts} value={c.filter} onPick={(id) => c.setFilter(id as never)} onClose={() => setFopen(false)} />}
      {c.open && (
        <BottomSheet label="Gift card" onClose={() => c.setOpen(false)} maxHeight="90%" gap={18}>
            {c.mode === 'new' ? <IssueFlow c={c} genCode={genCode} /> : <Panel c={c} />}
          </BottomSheet>
      )}
    </div>
  );
}

export function GiftCardsView(props: Props) {
  const c = useGifts(props);
  useNewParam(() => c.openNew());
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
