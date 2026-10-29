'use client';
// 1:1 conversion of the prototype's Sales.dc.html and MobileSales.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { decimalInput } from '@/lib/numeric';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { ClientMatches } from '../calendar/ClientMatches';
import { S } from '../calendar/pickers';
import { CloseX, CLOSE_BTN } from '../calendar/calUi';
import { createWalkin, payFlow, refundSale, sendReceipt, setPrice, terminalCancel, terminalPoll } from './actions';
import { DISC_PCTS, FILTERS, NO_DISC, STATUS, TIP_OPTS, discOf, discountCents, fmt, type DiscPick, type PayMethod, type SaleRow, type SvcOpt } from './shared';

type Props = {
  rows: SaleRow[]; bars: { day: string; cents: number; today: boolean }[]; todayTotal: number; paidCount: number; subtitle: string;
  methods: PayMethod[]; services: SvcOpt[]; askTip: boolean; canDiscount: boolean; initial: { sale: string | null; pay: boolean; card: string };
};
type Mode = 'view' | 'pay' | 'edit' | 'new';
const CARD_MSG: Record<string, string> = { declined: 'The card payment was not completed.', pending: 'Still waiting for the bank. Refresh in a moment.', unknown: 'The card payment could not be confirmed.' };

function useSales(props: Props) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const first = props.methods[0]?.id ?? 'cash';
  const blankPay = (tip = '0', disc: DiscPick = NO_DISC) => ({ method: first as PayMethod['id'], tip, code: '', disc });
  // A sale started at the calendar already has a tip; keep it when payment opens instead of resetting to none.
  const tipPctOf = (r?: { amount: number; tip: number }) => (r && r.amount > 0 && r.tip > 0 ? String(Math.round((r.tip * 100) / r.amount)) : '0');
  const blankNew = () => ({ client: '', clientId: null as string | null, service: null as string | null, method: first as PayMethod['id'], tip: '0', code: '', disc: NO_DISC as DiscPick });
  const rows = props.rows;
  const startSel = props.initial.sale && rows.some((r) => r.id === props.initial.sale) ? props.initial.sale : rows[0]?.id ?? null;
  const startPay = !!props.initial.pay && rows.find((r) => r.id === startSel)?.status === 'Pending';
  const [selectedId, setSelectedId] = useState<string | null>(startSel);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>(startPay ? 'pay' : 'view');
  const [open, setOpen] = useState(!!props.initial.sale);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(props.initial.card ? CARD_MSG[props.initial.card] ?? '' : '');
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [pay, setPay] = useState(blankPay(tipPctOf(rows.find((r) => r.id === startSel)), discOf(rows.find((r) => r.id === startSel))));
  const [editAmount, setEditAmount] = useState('');
  const [nw, setNw] = useState(blankNew());
  const [txn, setTxn] = useState('');
  const [wait, setWait] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mobile = narrow === true;

  const sel = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  // Card terminal: poll the provider until the customer finishes.
  useEffect(() => {
    if (!txn) return;
    let stop = false;
    const tick = async () => {
      const r = await terminalPoll(txn);
      if (stop) return;
      if (r.state === 'pending') { setWait(r.text || 'Waiting for the customer…'); timer.current = setTimeout(tick, 2000); return; }
      setTxn(''); setWait('');
      if (r.state === 'approved') { setMode('view'); setNotice('Payment taken'); setError(''); }
      else setError(r.state === 'declined' ? `Not approved${r.text ? `: ${r.text}` : ''}` : r.text || 'Something went wrong. Check the terminal.');
      router.refresh();
    };
    tick();
    return () => { stop = true; clearTimeout(timer.current); };
  }, [txn, router]);

  const pick = (id: string) => { setSelectedId(id); setMode('view'); setConfirmRefund(false); setNotice(''); setError(''); setOpen(true); };
  const openNew = () => { setMode('new'); setNw(blankNew()); setError(''); setNotice(''); setConfirmRefund(false); setOpen(true); };
  const cancel = () => {
    if (txn) { terminalCancel(txn); setTxn(''); setWait(''); }
    setMode('view'); setError(''); setConfirmRefund(false); setOpen(mobile ? mode !== 'new' : false);
  };
  const close = () => { setOpen(false); setMode('view'); setConfirmRefund(false); setError(''); };

  const settle = (r: { error?: string; notice?: string; txn?: string; url?: string }) => {
    if (r.error) { setError(r.error); return false; }
    if (r.url) { window.location.href = r.url; return true; }
    if (r.txn) { setTxn(r.txn); setWait('Sent to the terminal…'); setError(''); return true; }
    setMode('view'); setError(''); setNotice(r.notice ?? ''); router.refresh(); return true;
  };
  const takePayment = () => {
    if (!sel) return;
    if (!props.methods.length) { setError('No payment methods are switched on. Turn some on in Settings.'); return; }
    startT(async () => { setError(''); settle(await payFlow(sel.id, pay.method, parseInt(pay.tip, 10) || 0, pay.code, props.canDiscount ? pay.disc : undefined)); });
  };
  const saveEdit = () => { if (sel) startT(async () => { const r = await setPrice(sel.id, editAmount); if (r.error) { setError(r.error); return; } setMode('view'); setError(''); setNotice(r.notice ?? ''); router.refresh(); }); };
  const doRefund = () => { if (sel) startT(async () => { const r = await refundSale(sel.id); setConfirmRefund(false); if (r.error) { setError(r.error); return; } setError(''); setNotice(r.notice ?? ''); router.refresh(); }); };
  const receipt = () => { if (sel) startT(async () => { const r = await sendReceipt(sel.id); if (r.error) { setError(r.error); setNotice(''); } else { setError(''); setNotice(r.notice ?? ''); } }); };
  const createSale = () => {
    if (!nw.client.trim()) { setError("Add the client's name."); return; }
    if (!nw.service) { setError('Choose a service.'); return; }
    if (!props.methods.length) { setError('No payment methods are switched on. Turn some on in Settings.'); return; }
    startT(async () => {
      const c = await createWalkin(nw.client, nw.clientId, nw.service!, parseInt(nw.tip, 10) || 0);
      if (c.error || !c.saleId) { setError(c.error ?? 'Could not record the sale.'); return; }
      setSelectedId(c.saleId); setFilter('all'); setOpen(true);
      const r = await payFlow(c.saleId, nw.method, parseInt(nw.tip, 10) || 0, nw.code, props.canDiscount ? nw.disc : undefined);
      if (!r.error && (r.txn || r.url)) setMode('pay');
      const ok = settle(r.error ? { error: r.error + ' The sale was saved as pending.' } : r.notice ? { notice: 'Sale recorded' } : r);
      if (!ok) { setMode('view'); }
      setNw(blankNew());
    });
  };

  const sq = query.trim().toLowerCase();
  const list = rows.filter((t) => (filter === 'all' || t.status === filter) && (!sq || (t.client + ' ' + t.ref + ' ' + t.service + ' ' + t.staffName + ' ' + t.status + ' ' + t.method + ' ' + t.total / 100).toLowerCase().includes(sq.replace(/[$,]/g, ''))));
  return { ...props, busy, narrow, rows, list, sel, selectedId, filter, setFilter, query, setQuery, mode, setMode, open, notice, error, setError, confirmRefund, setConfirmRefund,
    canDiscount: props.canDiscount, pay, setPay, tipPctOf, editAmount, setEditAmount, nw, setNw, txn, wait, pick, openNew, cancel, close, takePayment, saveEdit, doRefund, receipt, createSale,
    paidTotal: props.todayTotal, pendingCount: rows.filter((r) => r.status === 'Pending').length };
}
type C = ReturnType<typeof useSales>;

const GHOST = (h: number) => `flex:1 1 0;height:${h}px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500`;
const DARK = (h: number) => `flex:1 1 0;height:${h}px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500`;
const statusStyle = (s: SaleRow['status']) => 'display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + STATUS[s][0] + ';color:' + STATUS[s][1];
const pill = (on: boolean, m: boolean) => `flex:0 0 auto;height:${m ? 44 : 40}px;padding:0 16px;border-radius:999px;font-size:${m ? 14 : 13.5}px;font-weight:500;border:1px solid ` + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
const inputS = (h: number): React.CSSProperties => ({ ...S(`box-sizing:border-box;width:100%;height:${h}px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF`), padding: '0 14px', minHeight: 0 });
const DL = (label: string, value: string, o: { last?: boolean; bold?: boolean; wrap?: boolean } = {}) => (
  <div key={label} style={S('display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3;' + (o.last ? 'border-bottom:1px solid #EEF0F3' : ''))}><dt style={S('color:#5E6673')}>{label}</dt><dd style={S('margin:0;text-align:right;font-weight:' + (o.bold ? 600 : 500) + ';' + (o.wrap ? 'overflow-wrap:anywhere' : 'white-space:nowrap'))}>{value}</dd></div>
);
const Chips = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
  <div style={S('display:flex;flex-direction:column;gap:8px')}><span id={id} style={S('font-size:14px;font-weight:600')}>{label}</span><div role="group" className="hscroll" aria-labelledby={id} style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>{children}</div></div>
);

/** The phone's sale details, laid out like a booking: status, client, details, lines, then the total and actions pinned at the bottom. */
function MobileSale({ c, s }: { c: C; s: SaleRow }) {
  const ic = (children: React.ReactNode) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true">{children}</svg>;
  const detail = [
    ['Time', s.time, <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>],
    ['With', s.staffName, <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.6-3.4 3.3-5 7-5s6.4 1.6 7 5" /></>],
    ['Payment', s.method, <><rect x="3.5" y="6" width="17" height="12" rx="2.5" /><path d="M3.5 10.5h17" /></>],
  ] as const;
  const extra: [string, string][] = [
    ...(s.discount ? [['Discount' + (s.discountNote ? ' (' + s.discountNote + ')' : ''), '-' + fmt(s.discount)] as [string, string]] : []),
    ...(s.tip ? [['Tip', fmt(s.tip)] as [string, string]] : []),
    ...(s.gst ? [[s.taxIncl ? 'Includes ' + s.taxRate + '% GST' : 'GST ' + s.taxRate + '%', fmt(s.gst)] as [string, string]] : []),
  ];
  const pending = s.status === 'Pending';
  const secondary = s.status === 'Paid' ? 'Refund' : pending && s.canEdit ? 'Edit sale' : null;
  const BTN = 'height:52px;border-radius:999px;font-size:14.5px;font-weight:500;cursor:pointer';
  return (<>
    <div style={S('display:flex;justify-content:flex-end;margin-bottom:-8px')}><button onClick={c.close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button></div>
    <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
      <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;min-width:0')}>{s.dayShort}</h2>
      <span style={S(statusStyle(s.status) + ';flex:0 0 auto;font-size:14px;padding:8px 16px')}>{s.status}</span>
    </div>
    <div style={S('display:flex;align-items:center;gap:14px;padding:16px;border:1px solid #E6E8EC;border-radius:22px')}>
      <div style={S('flex:0 0 52px;width:52px;height:52px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600')}>{s.initials}</div>
      <div style={S('flex:1 1 auto;min-width:0')}>
        <div style={S('font-size:19px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{s.client}</div>
        <div style={S('margin-top:2px;font-size:13.5px;color:#5E6673')}>{s.ref ? 'Booking ' + s.ref : 'Sale'}</div>
      </div>
    </div>
    <div className="sum-rows" style={S('padding:2px 16px;border:1px solid #E6E8EC;border-radius:22px')}>
      {detail.map(([l, v, icon]) => <div key={l} style={S('display:flex;align-items:center;gap:12px;padding:14px 0;font-size:15px')}>{ic(icon)}<span style={S('min-width:0;overflow-wrap:anywhere')} aria-label={l}>{v}</span></div>)}
    </div>
    <div style={S('display:flex;flex-direction:column;gap:10px')}>
      <h3 style={S('margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Services</h3>
      {s.lines.map((l, i) => (
        <div key={l.label + i} style={S('display:flex;align-items:center;gap:12px')}>
          <span style={S('flex:0 0 4px;align-self:stretch;min-height:28px;border-radius:999px;background:#B9AEFB')} />
          <span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{l.label + (l.qty > 1 ? ' x' + l.qty : '')}</span>
          <span style={S('flex:0 0 auto;font-size:14.5px;font-weight:500')}>{fmt(l.cents * l.qty)}</span>
        </div>
      ))}
    </div>
    {extra.length > 0 && (
      <div className="sum-rows" style={S('padding:2px 16px;border:1px solid #E6E8EC;border-radius:22px')}>
        {extra.map(([l, v]) => <div key={l} style={S('display:flex;justify-content:space-between;gap:12px;padding:13px 0;font-size:15px')}><span style={S('color:#5E6673;overflow-wrap:anywhere')}>{l}</span><span style={S('font-weight:500;white-space:nowrap')}>{v}</span></div>)}
      </div>
    )}
    <div style={S('position:sticky;bottom:-40px;margin:0 -20px -40px;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px')}>
      {!!c.notice && <span role="status" style={S('align-self:flex-start;padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.notice}</span>}
      {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
      <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px')}><span style={S('color:#5E6673;font-size:14px')}>{pending ? 'To pay' : 'Total'}</span><span style={S('font-size:22px;font-weight:600;letter-spacing:-0.02em')}>{fmt(s.total)}</span></div>
      {!c.confirmRefund ? (
        <div style={S('display:flex;gap:10px')}>
          {secondary && <button className="ghost" onClick={() => { if (s.status === 'Paid') c.setConfirmRefund(true); else { c.setEditAmount(String(s.amount / 100)); c.setMode('edit'); c.setError(''); } }} style={S('flex:1 1 0;border:1px solid #E1E4E9;background:#FFFFFF;color:#0E1116;' + BTN)}>{secondary}</button>}
          <button onClick={() => { if (pending) { c.setPay({ method: c.methods[0]?.id ?? 'cash', tip: c.tipPctOf(s), code: '', disc: discOf(s) }); c.setMode('pay'); c.setError(''); } else c.receipt(); }} disabled={c.busy} style={S('flex:1 1 0;border:0;background:#0E1116;color:#FFFFFF;' + BTN)}>{pending ? 'Take payment' : 'Send receipt'}</button>
        </div>
      ) : (
        <div role="alertdialog" aria-label="Confirm refund" style={S('display:flex;flex-direction:column;gap:12px;box-sizing:border-box;padding:16px;border:1px solid #F3C6C3;border-radius:18px;background:#FEF3F2')}>
          <div><div style={S('font-size:14.5px;font-weight:600')}>Refund {fmt(s.total)}?</div><div style={S('margin-top:2px;font-size:13px;color:#5E6673')}>The sale is marked as refunded and removed from today&apos;s sales.</div></div>
          <div style={S('display:flex;gap:10px')}>
            <button className="ghost" onClick={() => c.setConfirmRefund(false)} style={S('flex:1 1 0;border:1px solid #E1E4E9;background:#FFFFFF;color:#0E1116;' + BTN)}>Cancel</button>
            <button onClick={c.doRefund} disabled={c.busy} style={S('flex:1 1 0;border:0;background:#C0261B;color:#FFFFFF;' + BTN)}>Refund</button>
          </div>
        </div>
      )}
    </div>
  </>);
}

function Panel({ c, m }: { c: C; m: boolean }) {
  const h = m ? 48 : 44, s = c.sel;
  const notice = !!c.notice && <span role="status" style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.notice}</span>;
  const err = !!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>;
  const tipChips = (cur: string, on: (v: string) => void, id: string) => c.askTip && (
    <Chips id={id} label="Tip">{TIP_OPTS.map(([v, l]) => <button key={v} onClick={() => on(v)} aria-pressed={cur === v} style={S(pill(cur === v, m))}>{l}</button>)}</Chips>
  );
  const methodChips = (cur: string, on: (v: PayMethod['id']) => void, id: string) => (
    <Chips id={id} label="Payment method">{c.methods.map((x) => <button key={x.id} onClick={() => on(x.id)} aria-pressed={cur === x.id} style={S(pill(cur === x.id, m))}>{x.label}</button>)}</Chips>
  );
  const codeField = (v: string, on: (v: string) => void, id: string) => (
    <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor={id} style={S('font-size:14px;font-weight:600')}>Gift card code</label>
      <input id={id} type="text" value={v} onChange={(e) => on(e.target.value)} placeholder="Gift card code" style={inputS(h)} /></div>
  );
  const discountControl = (cur: DiscPick, on: (d: DiscPick) => void, id: string) => c.canDiscount && (
    <>
      <Chips id={id + '-label'} label="Discount">
        <button onClick={() => on(NO_DISC)} aria-pressed={cur.kind === 'none'} style={S(pill(cur.kind === 'none', m))}>None</button>
        {DISC_PCTS.map((v) => <button key={v} onClick={() => on({ ...cur, kind: 'percent', value: v })} aria-pressed={cur.kind === 'percent' && cur.value === v} style={S(pill(cur.kind === 'percent' && cur.value === v, m))}>{v}%</button>)}
        <button onClick={() => on({ ...cur, kind: 'amount', value: cur.kind === 'amount' ? cur.value : '' })} aria-pressed={cur.kind === 'amount'} style={S(pill(cur.kind === 'amount', m))}>$ off</button>
      </Chips>
      {cur.kind === 'amount' && <input aria-label="Discount amount in dollars" inputMode="decimal" value={cur.value} onChange={(e) => on({ ...cur, value: decimalInput(e.target.value) })} placeholder="Amount off, like 10 or 7.50" style={inputS(h)} />}
      {cur.kind !== 'none' && <input aria-label="Discount reason" maxLength={60} value={cur.note} onChange={(e) => on({ ...cur, note: e.target.value })} placeholder="Reason (optional), e.g. Staff discount" style={inputS(h)} />}
    </>
  );
  if (c.mode === 'new') {
    const svc = c.services.find((x) => x.id === c.nw.service) ?? null;
    const tipAmt = svc && c.askTip ? Math.round(svc.priceCents * (parseInt(c.nw.tip, 10) || 0) / 100) : 0;
    const nwDisc = svc && c.canDiscount ? discountCents(svc.priceCents, c.nw.disc) : 0;
    return (<>
      <div style={S('display:flex;flex-direction:column;gap:18px')}>
        <div><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>New sale</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>{svc ? svc.name + ', ' + fmt(svc.priceCents) + (nwDisc ? ' less ' + fmt(nwDisc) + ' discount' : '') + (tipAmt ? ' plus ' + fmt(tipAmt) + ' tip' : '') + ', total ' + fmt(svc.priceCents - nwDisc + tipAmt) : 'Choose a service to see the total.'}</p></div>
        <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="nw-client" style={S('font-size:14px;font-weight:600')}>Client</label>
          <input id="nw-client" type="text" value={c.nw.client} onChange={(e) => { c.setNw({ ...c.nw, client: e.target.value, clientId: null }); c.setError(''); }} placeholder="Search or type a client name" autoComplete="off" style={inputS(48)} />
          <ClientMatches mobile={m} query={c.nw.client} pickedId={c.nw.clientId} onPick={(h) => { c.setNw({ ...c.nw, client: h.name, clientId: h.id }); c.setError(''); }} /></div>
        <Chips id="nw-service-label" label="Service">{c.services.map((x) => <button key={x.id} onClick={() => { c.setNw({ ...c.nw, service: x.id }); c.setError(''); }} aria-pressed={c.nw.service === x.id} style={S(pill(c.nw.service === x.id, m))}>{x.name}</button>)}</Chips>
        {methodChips(c.nw.method, (v) => c.setNw({ ...c.nw, method: v }), 'nw-method-label')}
        {c.nw.method === 'gift_card' && codeField(c.nw.code, (v) => c.setNw({ ...c.nw, code: v }), 'nw-code')}
        {discountControl(c.nw.disc, (d) => c.setNw({ ...c.nw, disc: d }), 'nw-disc')}
        {tipChips(c.nw.tip, (v) => c.setNw({ ...c.nw, tip: v }), 'nw-tip-label')}
        {err}
        <div style={S('display:flex;gap:10px')}><button onClick={c.createSale} disabled={c.busy} style={S(DARK(h))}>Record sale</button><button className="ghost" onClick={c.cancel} style={S(GHOST(h))}>Cancel</button></div>
      </div>
    </>);
  }
  if (!s) return <p style={S('margin:0;color:#5E6673;font-size:14px')}>No sales yet. Record one with New sale.</p>;
  if (c.mode === 'pay') {
    const pct = c.askTip ? parseInt(c.pay.tip, 10) || 0 : 0;
    const svcCents = s.amount, tipAmt = Math.round(svcCents * pct / 100);
    const disc = c.canDiscount ? discountCents(svcCents, c.pay.disc) : s.discount, net = svcCents - disc;
    const tax = s.taxIncl || !s.taxRate ? 0 : Math.round(net * s.taxRate / 100);
    return (
      <div style={S('display:flex;flex-direction:column;gap:18px')}>
        <div><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Take payment</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{s.client}, {s.service}</p></div>
        {methodChips(c.pay.method, (v) => c.setPay({ ...c.pay, method: v }), 'pay-method-label')}
        {c.pay.method === 'gift_card' && codeField(c.pay.code, (v) => c.setPay({ ...c.pay, code: v }), 'pay-code')}
        {discountControl(c.pay.disc, (d) => c.setPay({ ...c.pay, disc: d }), 'pay-disc')}
        {tipChips(c.pay.tip, (v) => c.setPay({ ...c.pay, tip: v }), 'pay-tip-label')}
        <dl style={S('margin:0;display:flex;flex-direction:column')}>
          {DL('Service', fmt(svcCents))}{disc ? DL('Discount', '-' + fmt(disc)) : null}{DL('Tip', tipAmt ? fmt(tipAmt) : 'None')}{tax ? DL('Tax', fmt(tax)) : null}{DL('Total', fmt(net + tipAmt + tax), { last: true, bold: true })}
        </dl>
        {!!c.wait && <p role="status" style={S('margin:0;color:#5E6673;font-size:13.5px')}>{c.wait}</p>}
        {err}
        <div style={S('display:flex;gap:10px')}>
          <button onClick={c.takePayment} disabled={c.busy || !!c.txn} style={S(DARK(h))}>{c.txn ? 'Waiting on terminal…' : 'Take payment'}</button>
          <button className="ghost" onClick={c.cancel} style={S(GHOST(h))}>{c.txn ? 'Cancel on terminal' : 'Cancel'}</button>
        </div>
      </div>
    );
  }
  if (c.mode === 'edit') return (
    <div style={S('display:flex;flex-direction:column;gap:18px')}>
      <div><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Edit sale</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{s.client}, {s.service}</p></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="sale-amount" style={S('font-size:14px;font-weight:600')}>Service price</label>
        <div style={S('display:flex;align-items:center;gap:6px;box-sizing:border-box;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;background:#FFFFFF')}><span style={S('color:#5E6673')}>$</span>
          <input id="sale-amount" type="text" inputMode="decimal" value={c.editAmount} onChange={(e) => { c.setEditAmount(decimalInput(e.target.value)); c.setError(''); }} style={{ ...S('flex:1 1 auto;min-width:0;border:0;outline:none;background:transparent;font:inherit;color:#0E1116'), padding: 0, minHeight: 0, width: 'auto', borderRadius: 0 }} /></div></div>
      {err}
      <div style={S('display:flex;gap:10px')}><button onClick={c.saveEdit} disabled={c.busy} style={S(DARK(h))}>Save sale</button><button className="ghost" onClick={c.cancel} style={S(GHOST(h))}>Cancel</button></div>
    </div>
  );
  if (m) return <MobileSale c={c} s={s} />;
  // view
  const secondary = s.status === 'Paid' ? 'Refund' : s.status === 'Pending' && s.canEdit ? 'Edit sale' : null;
  return (<>
    <div style={S('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}><span style={S(statusStyle(s.status))}>{s.status}</span>{notice}</div>
    {err}
    <div style={S('display:flex;align-items:center;gap:14px')}>
      <div style={S('flex:0 0 56px;width:56px;height:56px;border-radius:999px;background:#EEF0F3;color:#0E1116;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600')}>{s.initials}</div>
      <div style={S('min-width:0')}><div style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{s.client}</div><div style={S('font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{s.service}</div></div>
    </div>
    <dl style={S('margin:0;display:flex;flex-direction:column')}>
      {s.ref ? DL('Booking', s.ref) : null}{DL('Time', s.time)}{DL('With', s.staffName, { wrap: true })}{DL('Payment', s.method, { wrap: true })}{DL('Service', fmt(s.amount))}{s.discount ? DL('Discount' + (s.discountNote ? ' (' + s.discountNote + ')' : ''), '-' + fmt(s.discount), { wrap: true }) : null}{DL('Tip', s.tip ? fmt(s.tip) : 'None')}{s.tax ? DL('Tax', fmt(s.tax)) : null}{DL('Total', fmt(s.total), { last: true, bold: true })}
    </dl>
    {!c.confirmRefund && (
      <div style={S('display:flex;gap:10px')}>
        <button onClick={() => { if (s.status === 'Pending') { c.setPay({ method: c.methods[0]?.id ?? 'cash', tip: c.tipPctOf(s), code: '', disc: discOf(s) }); c.setMode('pay'); c.setError(''); } else c.receipt(); }} disabled={c.busy} style={S(DARK(h))}>{s.status === 'Pending' ? 'Take payment' : 'Send receipt'}</button>
        {secondary && <button className="ghost" onClick={() => { if (s.status === 'Paid') c.setConfirmRefund(true); else { c.setEditAmount(String(s.amount / 100)); c.setMode('edit'); c.setError(''); } }} style={S(GHOST(h))}>{secondary}</button>}
      </div>
    )}
    {c.confirmRefund && (
      <div role="alertdialog" aria-label="Confirm refund" style={S('display:flex;flex-direction:column;gap:12px;box-sizing:border-box;padding:16px;border:1px solid #F3C6C3;border-radius:18px;background:#FEF3F2')}>
        <div><div style={S('font-size:14.5px;font-weight:600')}>Refund {fmt(s.total)}?</div><div style={S("margin-top:2px;font-size:13px;color:#5E6673")}>The sale is marked as refunded and removed from today's sales.</div></div>
        <div style={S('display:flex;gap:10px')}>
          <button className="ghost" onClick={() => c.setConfirmRefund(false)} style={S(GHOST(h))}>Cancel</button>
          <button onClick={c.doRefund} disabled={c.busy} style={S(`flex:1 1 0;height:${h}px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font-size:14px;font-weight:500`)}>Refund</button>
        </div>
      </div>
    )}
  </>);
}

function Desktop({ c }: { c: C }) {
  const stat = (label: string, v: string) => <div><div style={S('color:#5E6673;font-size:13.5px')}>{label}</div><div style={S('margin-top:4px;font-size:38px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div></div>;
  const max = Math.max(1, ...c.bars.map((b) => b.cents));
  const week = c.bars.reduce((a, b) => a + b.cents, 0);
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Sales" subtitle={c.subtitle} query={c.query} onQuery={c.setQuery} placeholder="Search sales" actionLabel="New sale" onAction={c.openNew} />
      <section aria-label="Sales at a glance" style={S('display:flex;flex-wrap:wrap;gap:20px 64px')}>{stat('Sales today', fmt(c.todayTotal))}{stat('Paid sales', String(c.paidCount))}{stat('Average sale', fmt(c.paidCount ? Math.round(c.todayTotal / c.paidCount) : 0))}</section>
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <div style={S('flex:999 1 620px;min-width:0;display:flex;flex-direction:column;gap:20px')}>
          <section aria-label="Last 7 days" style={S('background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px')}>
            <div style={S('display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px')}><h2 style={S('margin:0;font-size:16px;font-weight:600')}>Last 7 days</h2><span style={S('color:#5E6673;font-size:13.5px')}>{fmt(week)} in total</span></div>
            <div role="group" aria-label="Daily sales for the last 7 days" style={S('margin-top:20px;display:flex;align-items:flex-end;gap:16px;height:186px')}>
              {c.bars.map((b, i) => (
                <div key={i} role="img" aria-label={b.day + ', ' + fmt(b.cents)} style={S('flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px')}>
                  <span style={S('font-size:12.5px;color:#5E6673')}>{fmt(b.cents)}</span>
                  <div style={S('width:100%;height:' + Math.max(6, Math.round(b.cents / max * 130)) + 'px;border-radius:10px;background:' + (b.today ? '#0E1116' : '#DADDE4'))} />
                  <span style={S('font-size:12.5px;font-weight:500')}>{b.day}</span>
                </div>
              ))}
            </div>
          </section>
          <section aria-label="Sales list" style={S('min-width:0;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
            <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E6E8EC')}>
              <div role="group" aria-label="Filter sales" style={S('display:flex;flex-wrap:wrap;gap:8px')}>{FILTERS.map((f) => <button key={f.id} onClick={() => c.setFilter(f.id)} aria-pressed={c.filter === f.id} style={S('height:40px;padding:0 16px;border-radius:999px;font-size:13.5px;font-weight:500;border:1px solid ' + (c.filter === f.id ? '#0E1116' : '#E1E4E9') + ';background:' + (c.filter === f.id ? '#0E1116' : '#FFFFFF') + ';color:' + (c.filter === f.id ? '#FFFFFF' : '#0E1116'))}>{f.label}</button>)}</div>
              <span style={S('color:#5E6673;font-size:13.5px')}>{`Showing ${c.list.length} of ${c.rows.length}`}</span>
            </div>
            <div style={S('overflow-x:auto')}><div style={S('min-width:880px')}>
              <div style={S('display:flex;align-items:center;gap:16px;padding:12px 20px;border-bottom:1px solid #EEF0F3;color:#5E6673;font-size:12.5px;font-weight:500')}>
                {([['2.2', 'Client'], ['0.8', 'Booking'], ['1.6', 'Service'], ['1', 'Staff'], ['1', 'Time'], ['0.9', 'Total'], ['1', 'Status']] as const).map(([f, l]) => <div key={l} style={S(`flex:${f} 1 0;min-width:0`)}>{l}</div>)}
              </div>
              {c.list.map((t) => (
                <button key={t.id} className="s-row" onClick={() => c.pick(t.id)} aria-label={`${t.client}, ${t.service}, ${fmt(t.total)}, ${t.status}`}
                  style={S('display:flex;align-items:center;gap:16px;width:100%;box-sizing:border-box;min-height:64px;padding:8px 20px;border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;font-size:14px;color:#0E1116;background:' + (c.selectedId === t.id ? '#F4F5F7' : 'transparent'))}>
                  <span style={S('flex:2.2 1 0;min-width:0;display:flex;align-items:center;gap:12px')}>
                    <span style={S('flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:#EEF0F3;color:#0E1116;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600')}>{t.initials}</span>
                    <span style={S('min-width:0;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{t.client}</span>
                  </span>
                  <span style={S('flex:0.8 1 0;min-width:0;white-space:nowrap;color:#5E6673')}>{t.ref || '—'}</span>
                  <span style={S('flex:1.6 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{t.service}</span>
                  <span style={S('flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{t.firstName}</span>
                  <span style={S('flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{t.time}</span>
                  <span style={S('flex:0.9 1 0;min-width:0;font-weight:500')}>{fmt(t.total)}</span>
                  <span style={S('flex:1 1 0;min-width:0')}><span style={S(statusStyle(t.status))}>{t.status}</span></span>
                </button>
              ))}
            </div></div>
            {c.list.length === 0 && <p style={S('margin:0;padding:24px 20px;color:#5E6673;font-size:14px;border-top:1px solid #EEF0F3')}>{c.query.trim() ? `Nothing matches "${c.query.trim()}".` : 'No sales yet.'}</p>}
          </section>
        </div>
        <aside aria-label="Sale details" style={S('flex:1 1 440px;max-width:520px;min-width:0;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:16px')}><Panel c={c} m={false} /></aside>
      </div>
    </div>
  );
}

function Mobile({ c }: { c: C }) {
  const stat = (label: string, v: string) => <div><div style={S('color:#5E6673;font-size:13px')}>{label}</div><div style={S('margin-top:2px;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div></div>;
  const max = Math.max(1, ...c.bars.map((b) => b.cents));
  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Sales" subtitle={c.subtitle} query={c.query} onQuery={c.setQuery} placeholder="Search sales" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <section aria-label="Sales at a glance" style={S('display:flex;gap:40px')}>{stat('Sales today', fmt(c.todayTotal))}{stat('Pending', String(c.pendingCount))}</section>
        <button onClick={c.openNew} style={S('display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New sale
        </button>
        {c.canDiscount && <Link href="/sales/summary" style={S('display:inline-flex;align-items:center;height:44px;padding:0 18px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:13.5px;font-weight:500;text-decoration:none')}>Daily summary and cash-up</Link>}
        <section aria-label="Last 7 days" style={S('background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px')}>
          <div style={S('display:flex;align-items:baseline;justify-content:space-between;gap:8px')}><h2 style={S('margin:0;font-size:16px;font-weight:600')}>Last 7 days</h2><span style={S('color:#5E6673;font-size:13px')}>{fmt(c.bars.reduce((a, b) => a + b.cents, 0))}</span></div>
          <div role="group" aria-label="Daily sales for the last 7 days" style={S('margin-top:16px;display:flex;align-items:flex-end;gap:8px;height:128px')}>
            {c.bars.map((b, i) => (
              <div key={i} role="img" aria-label={b.day + ', ' + fmt(b.cents)} style={S('flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px')}>
                <div style={S('width:100%;height:' + Math.max(6, Math.round(b.cents / max * 96)) + 'px;border-radius:10px;background:' + (b.today ? '#0E1116' : '#DADDE4'))} />
                <span style={S('font-size:12px;font-weight:500')}>{b.day}</span>
              </div>
            ))}
          </div>
        </section>
        <div role="group" className="hscroll" aria-label="Filter sales" style={S('display:flex;gap:8px;overflow-x:auto')}>{FILTERS.map((f) => <button key={f.id} onClick={() => c.setFilter(f.id)} aria-pressed={c.filter === f.id} style={S('flex:0 0 auto;height:44px;padding:0 18px;border-radius:999px;font-size:14px;font-weight:500;border:1px solid ' + (c.filter === f.id ? '#0E1116' : '#E1E4E9') + ';background:' + (c.filter === f.id ? '#0E1116' : '#FFFFFF') + ';color:' + (c.filter === f.id ? '#FFFFFF' : '#0E1116'))}>{f.label}</button>)}</div>
        <ul style={S('margin:0;padding:4px 0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px')}>
          {c.list.map((t) => (
            <li key={t.id}>
              <button onClick={() => c.pick(t.id)} aria-label={`${t.client}, ${t.service}, ${fmt(t.total)}, ${t.status}`} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 16px;border:0;border-bottom:1px solid #EEF0F3;background:transparent;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
                <span style={S('flex:0 0 44px;width:44px;height:44px;border-radius:999px;background:#EEF0F3;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600')}>{t.initials}</span>
                <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{t.client}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{t.ref ? t.ref + ' · ' : ''}{t.service}, {t.time}</span></span>
                <span style={S('flex:0 0 auto;text-align:right')}><span style={S('display:block;font-size:14.5px;font-weight:600')}>{fmt(t.total)}</span><span style={S('display:block;margin-top:2px')}><span style={S(statusStyle(t.status))}>{t.status}</span></span></span>
              </button>
            </li>
          ))}
        </ul>
        {c.list.length === 0 && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:14px')}>{c.query.trim() ? `Nothing matches "${c.query.trim()}".` : 'No sales yet.'}</p>}
      </main>
      <MobileTabs active="more" />
      {c.open && (
        <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:5')}>
          <button onClick={c.close} aria-label="Close details" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
          <div className="sheet" role="dialog" aria-label="Sale details" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:86%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:16px')}>
            <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0')} />
            {(c.mode !== 'view' || !c.sel) && <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Sale</h2><button onClick={c.close} aria-label="Close" style={S('flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button></div>}
            <Panel c={c} m={true} />
          </div>
        </div>
      )}
    </div>
  );
}

export function SalesView(props: Props) {
  const c = useSales(props);
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
