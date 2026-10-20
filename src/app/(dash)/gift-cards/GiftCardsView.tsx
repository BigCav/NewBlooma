'use client';
// Converted from the prototype's GiftCards.dc.html and MobileGiftCards.dc.html. Markup and style strings follow the prototype;
// data comes from the server and the actions are real server actions.
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { issueGiftCard, voidGiftCard } from './actions';

export type GiftRow = { id: string; code: string; name: string; issued: string; original: number; balance: number; voided: boolean; hist: { d: string; label: string; a: number }[] };
type Props = { rows: GiftRow[]; salonName: string; month: string; today: string; canIssue: boolean };
type NewForm = { amount: string; name: string; code: string };

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const money = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const dShort = (s: string) => parseInt(s.slice(8), 10) + ' ' + MON[parseInt(s.slice(5, 7), 10) - 1];
const dLong = (s: string) => parseInt(s.slice(8), 10) + ' ' + MONL[parseInt(s.slice(5, 7), 10) - 1] + ' ' + s.slice(0, 4);
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const genCode = () => { const g = () => Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join(''); return 'GIFT-' + g() + '-' + g(); };
const chip = (on: boolean, m: boolean) => `flex:0 0 auto;height:${m ? 44 : 40}px;padding:0 14px;border-radius:999px;font-size:13.5px;font-weight:500;border:1px solid ` + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
const statusOf = (c: GiftRow) => (c.voided ? 'Voided' : c.balance === 0 ? 'Used up' : c.balance < c.original ? 'Part used' : 'Unused');
const PILL: Record<string, [string, string]> = { Unused: ['#DDF3EA', '#14624A'], 'Part used': ['#E8ECFF', '#3B2BB8'], 'Used up': ['#EEF0F3', '#4A525E'], Voided: ['#FDECEA', '#B42318'] };
const pill = (s: string) => 'display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + PILL[s][0] + ';color:' + PILL[s][1];
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
  const redeemedM = all.reduce((a, c) => a + c.hist.filter((h) => inMonth(h.d) && h.a < 0 && !h.label.startsWith('Voided')).reduce((b, h) => b - h.a, 0), 0);

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

const field = 'box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF';

function Panel({ c, m }: { c: C; m: boolean }) {
  const { nf, setNf } = c;
  const cur = Math.round(parseFloat(String(nf.amount).replace(/[^0-9.]/g, '')) * 100);
  const close = (
    <button className="ghost" onClick={c.closeNew} aria-label="Close" style={S('flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  );
  if (c.mode === 'new') return (
    <div style={S('display:flex;flex-direction:column;gap:20px')}>
      <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Issue a gift card</h2>{close}</div>
      <div role="group" aria-label="Amount" style={S('display:flex;flex-direction:column;gap:10px')}>
        <span style={S('font-size:14px;font-weight:600')}>Amount</span>
        <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>{[2500, 5000, 10000, 15000].map((p) => <button key={p} onClick={() => { setNf({ ...nf, amount: String(p / 100) }); c.setError(''); }} aria-pressed={cur === p} style={S(chip(cur === p, m))}>{money(p)}</button>)}</div>
        <input className="field" type="text" inputMode="decimal" value={nf.amount} onChange={(e) => { setNf({ ...nf, amount: e.target.value.replace(/[^0-9.]/g, '') }); c.setError(''); }} placeholder="Or enter an amount" aria-label="Custom amount" style={S(field)} />
      </div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="gc-for" style={S('font-size:14px;font-weight:600')}>For</label><input id="gc-for" className="field" type="text" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="Optional" style={S(field)} /></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="gc-code" style={S('font-size:14px;font-weight:600')}>Code</label>
        <div style={S('display:flex;gap:8px')}>
          <input id="gc-code" className="field" type="text" value={nf.code} onChange={(e) => { setNf({ ...nf, code: e.target.value.toUpperCase() }); c.setError(''); }} autoCapitalize="characters" style={S('flex:1 1 auto;min-width:0;box-sizing:border-box;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font-size:14px;letter-spacing:0.02em;color:#0E1116;background:#FFFFFF;' + MONO)} />
          <button className="ghost" onClick={() => { setNf({ ...nf, code: genCode() }); c.setError(''); }} style={S('flex:0 0 auto;height:48px;padding:0 16px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500')}>New code</button>
        </div>
        <span style={S('color:#5E6673;font-size:13px')}>Clients give this code at the counter. Gift cards do not expire.</span>
      </div>
      {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
      <button onClick={c.issue} disabled={c.busy} style={S('height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;padding:0 24px')}>Issue gift card</button>
    </div>
  );
  const sel = c.sel;
  if (!sel) return <p style={S('margin:0;color:#5E6673;font-size:14px')}>{c.canIssue ? 'No gift cards yet. Issue your first one.' : 'No gift cards yet.'}</p>;
  const st = statusOf(sel);
  const canVoid = c.canIssue && !sel.voided && sel.balance > 0;
  const rowCss = 'display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3';
  const hist = sel.hist.concat([{ d: sel.issued, label: 'Issued', a: sel.original }]);
  return (
    <div style={S('display:flex;flex-direction:column;gap:20px')}>
      <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
        <span style={S(pill(st))}>{st}</span>
        {!!c.notice && <span role="status" style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.notice}</span>}
        {m && close}
      </div>
      <div style={S('box-sizing:border-box;border-radius:20px;background:#0E1116;color:#FFFFFF;padding:' + (m ? 22 : 24) + 'px;display:flex;flex-direction:column;gap:' + (m ? 24 : 28) + 'px')}>
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><span style={S('font-size:15px;font-weight:600')}>{c.salonName}</span><span style={S('font-size:12.5px;color:#C4C9D2')}>Gift card</span></div>
        <div><div style={S('font-size:12.5px;color:#C4C9D2')}>Balance</div><div style={S('margin-top:2px;font-size:' + (m ? 36 : 40) + 'px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{money(sel.balance)}</div></div>
        <div style={S('font-size:' + (m ? 15 : 16) + 'px;font-weight:500;letter-spacing:0.06em;overflow-wrap:anywhere;' + MONO)}>{sel.code}</div>
      </div>
      <div style={S('display:flex;gap:10px')}>
        <button onClick={c.copy} style={S('flex:1 1 0;height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500')}>Copy code</button>
        {canVoid && <button className="ghost" onClick={() => c.setConfirmVoid(true)} style={S('flex:1 1 0;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500')}>Void card</button>}
      </div>
      {c.confirmVoid && (
        <div role="alertdialog" aria-label="Void this gift card" style={S('border-radius:16px;background:#FDECEA;padding:14px 16px;display:flex;flex-direction:column;gap:10px')}>
          <span style={S('font-size:14px;color:#B42318;font-weight:500')}>Void this card? Its {money(sel.balance)} balance will be set to zero and cannot be used again.</span>
          <div style={S('display:flex;gap:10px')}>
            <button onClick={c.doVoid} disabled={c.busy} style={S('flex:1 1 0;height:44px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font-size:14px;font-weight:500')}>Void card</button>
            <button className="ghost" onClick={() => c.setConfirmVoid(false)} style={S('flex:1 1 0;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500')}>Keep it</button>
          </div>
        </div>
      )}
      {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
      <dl style={S('margin:0;display:flex;flex-direction:column')}>
        <div style={S(rowCss)}><dt style={S('color:#5E6673')}>For</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{sel.name || 'No name'}</dd></div>
        <div style={S(rowCss)}><dt style={S('color:#5E6673')}>Issued</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{dLong(sel.issued)}</dd></div>
        <div style={S(rowCss)}><dt style={S('color:#5E6673')}>Original amount</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{money(sel.original)}</dd></div>
        <div style={S(rowCss + ';border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Used so far</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{money(sel.original - sel.balance)}</dd></div>
      </dl>
      <section aria-label="History" style={S('display:flex;flex-direction:column;gap:4px')}>
        <h3 style={S('margin:0 0 4px;font-size:15px;font-weight:600')}>History</h3>
        <ul style={S('margin:0;padding:0;list-style:none')}>
          {hist.map((h, i) => (
            <li key={i} style={S('display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #EEF0F3')}>
              <span style={S('min-width:0')}><span style={S('display:block;font-size:14px;font-weight:500;overflow-wrap:anywhere')}>{h.label}</span><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{dLong(h.d)}</span></span>
              <span style={S('flex:0 0 auto;font-weight:600;color:' + (h.a > 0 ? '#14624A' : '#0E1116'))}>{(h.a > 0 ? '+' : '-') + money(Math.abs(h.a))}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const noneText = (c: C) => (c.all.length === 0 ? (c.canIssue ? 'No gift cards yet. Issue your first one.' : 'No gift cards yet.') : 'No gift cards match.');

function Desktop({ c }: { c: C }) {
  const stat = (l: string, v: string) => <div key={l}><div style={S('color:#5E6673;font-size:13.5px')}>{l}</div><div style={S('margin-top:4px;font-size:38px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div></div>;
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Gift cards" subtitle="Issue gift cards and track what is left on them" query={c.query} onQuery={c.setQuery} placeholder="Search code or name" actionLabel="Issue gift card" onAction={c.openNew} showAction={c.canIssue} />
      <section aria-label="Gift cards at a glance" style={S('display:flex;flex-wrap:wrap;gap:20px 64px')}>
        {stat('Owed to clients', money(c.owed))}{stat('Active cards', String(c.active))}{stat('Issued this month', money(c.issuedM))}{stat('Redeemed this month', money(c.redeemedM))}
      </section>
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <section aria-label="Gift card list" style={S('flex:999 1 620px;min-width:0;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E6E8EC')}>
            <div role="group" aria-label="Filter gift cards" style={S('display:flex;flex-wrap:wrap;gap:8px')}>{FILTERS.map(([id, l]) => <button key={id} onClick={() => c.setFilter(id)} aria-pressed={c.filter === id} style={S(chip(c.filter === id, false))}>{l}</button>)}</div>
            <span style={S('color:#5E6673;font-size:13.5px')}>{c.shown.length + (c.shown.length === 1 ? ' card' : ' cards')}</span>
          </div>
          <div style={S('overflow-x:auto')}>
            <div style={S('min-width:720px')}>
              <div style={S('display:flex;align-items:center;gap:16px;padding:12px 20px;border-bottom:1px solid #EEF0F3;color:#5E6673;font-size:12.5px;font-weight:500')}>
                <div style={S('flex:1.5 1 0;min-width:0')}>Code</div><div style={S('flex:1.3 1 0;min-width:0')}>For</div><div style={S('flex:0.9 1 0;min-width:0')}>Issued</div><div style={S('flex:0.8 1 0;min-width:0')}>Original</div><div style={S('flex:1.3 1 0;min-width:0')}>Balance</div><div style={S('flex:0.9 1 0;min-width:0')}>Status</div>
              </div>
              <ul style={S('margin:0;padding:0;list-style:none')}>
                {c.shown.map((g) => {
                  const s = statusOf(g), on = c.mode === 'view' && c.sel?.id === g.id, pct = g.original ? Math.round(g.balance / g.original * 100) : 0;
                  return (
                    <li key={g.id}><button className="row" onClick={() => c.pick(g.id)} aria-pressed={on} aria-label={`${g.code}, ${money(g.balance)} left, ${s}`} style={S('display:flex;align-items:center;gap:16px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 20px;border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;color:#0E1116;cursor:pointer;background:' + (on ? '#F4F5F7' : 'transparent'))}>
                      <span style={S('flex:1.5 1 0;min-width:0;font-size:13.5px;font-weight:500;letter-spacing:0.02em;' + MONO)}>{g.code}</span>
                      <span style={S('flex:1.3 1 0;min-width:0;overflow-wrap:anywhere;color:' + (g.name ? '#0E1116' : '#8A93A0'))}>{g.name || 'No name'}</span>
                      <span style={S('flex:0.9 1 0;min-width:0;color:#5E6673')}>{dShort(g.issued)}</span>
                      <span style={S('flex:0.8 1 0;min-width:0;color:#5E6673')}>{money(g.original)}</span>
                      <span style={S('flex:1.3 1 0;min-width:0')}><span style={S('display:block;font-weight:600')}>{money(g.balance)}</span><span style={S('display:block;margin-top:6px;height:6px;border-radius:999px;background:#EEF0F3')}><span style={S('display:block;height:6px;border-radius:999px;background:#0E1116;width:' + pct + '%')} /></span></span>
                      <span style={S('flex:0.9 1 0;min-width:0')}><span style={S(pill(s))}>{s}</span></span>
                    </button></li>
                  );
                })}
              </ul>
            </div>
          </div>
          {c.shown.length === 0 && <p style={S('margin:0;padding:28px 20px;color:#5E6673;font-size:14px')}>{noneText(c)}</p>}
        </section>
        <aside className="side-sticky" aria-label="Gift card details" style={S('flex:1 1 440px;max-width:520px;min-width:0;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:20px')}>
          <Panel c={c} m={false} />
        </aside>
      </div>
    </div>
  );
}

function Mobile({ c }: { c: C }) {
  const stat = (l: string, v: string) => <div key={l} style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:20px;padding:16px')}><div style={S('color:#5E6673;font-size:13px')}>{l}</div><div style={S('margin-top:4px;font-size:26px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div></div>;
  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Gift cards" subtitle="Issue and track balances" query={c.query} onQuery={c.setQuery} placeholder="Search code or name" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <section aria-label="Gift cards at a glance" style={S('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px')}>
          {stat('Owed to clients', money(c.owed))}{stat('Active cards', String(c.active))}{stat('Issued this month', money(c.issuedM))}{stat('Redeemed this month', money(c.redeemedM))}
        </section>
        {c.canIssue && <button onClick={c.openNew} style={S('height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;padding:0 24px')}>Issue gift card</button>}
        <div role="group" aria-label="Filter gift cards" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>{FILTERS.map(([id, l]) => <button key={id} onClick={() => c.setFilter(id)} aria-pressed={c.filter === id} style={S(chip(c.filter === id, true))}>{l}</button>)}</div>
        {c.shown.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>{noneText(c)}</p>}
        <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px')}>
          {c.shown.map((g) => {
            const s = statusOf(g), pct = g.original ? Math.round(g.balance / g.original * 100) : 0;
            return (
              <li key={g.id}><button className="ghost" onClick={() => c.pick(g.id)} aria-label={`${g.code}, ${money(g.balance)} left, ${s}`} style={S('display:flex;flex-direction:column;gap:10px;width:100%;box-sizing:border-box;padding:16px 18px;border:1px solid #E6E8EC;border-radius:20px;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
                <span style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><span style={S('font-size:13.5px;font-weight:500;letter-spacing:0.02em;' + MONO)}>{g.code}</span><span style={S(pill(s))}>{s}</span></span>
                <span style={S('display:flex;align-items:baseline;justify-content:space-between;gap:12px')}><span style={S('min-width:0;overflow-wrap:anywhere;font-size:14px;color:' + (g.name ? '#0E1116' : '#8A93A0'))}>{g.name || 'No name'}</span><span style={S('flex:0 0 auto;font-size:18px;font-weight:600;letter-spacing:-0.01em')}>{money(g.balance)}</span></span>
                <span style={S('display:block;height:6px;border-radius:999px;background:#EEF0F3')}><span style={S('display:block;height:6px;border-radius:999px;background:#0E1116;width:' + pct + '%')} /></span>
                <span style={S('font-size:12.5px;color:#5E6673')}>{money(g.original)} issued {dShort(g.issued)}</span>
              </button></li>
            );
          })}
        </ul>
      </main>
      <MobileTabs active="more" />
      {c.open && (
        <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:5')}>
          <button onClick={() => c.setOpen(false)} aria-label="Close" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
          <div className="sheet" role="dialog" aria-label="Gift card" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:90%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:18px')}>
            <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0')} />
            <Panel c={c} m={true} />
          </div>
        </div>
      )}
    </div>
  );
}

export function GiftCardsView(props: Props) {
  const c = useGifts(props);
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
