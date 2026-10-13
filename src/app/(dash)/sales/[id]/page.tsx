import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/session';
import { dateLong, money, time12 } from '@/lib/format';
import { setTip, payManual, payOnline, voidSale, refund } from '../actions';
import TerminalPay from './TerminalPay';

export const metadata = { title: 'Checkout' };

export default async function Sale({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string; card?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const { sb, salon, settings: st, staff } = await requireCtx();
  const { data: s } = await sb.from('sales').select('*,clients(name),staff(name),sale_items(label,qty,price_cents)').eq('id', id).maybeSingle();
  if (!s) notFound();
  const [{ data: pay }, { data: attempts }] = await Promise.all([
    sb.from('salon_payment_settings').select('online_cards_enabled,terminal_enabled').eq('salon_id', salon.id).single(),
    sb.from('card_payments').select('id,kind,status,response_text,needs_review,review_note,created_at').eq('sale_id', id).order('created_at', { ascending: false }),
  ]);
  const cur = salon.currency, open = s.status === 'pending';
  const svc = (s.sale_items as any[]).reduce((a, i) => a + i.price_cents * i.qty, 0);
  const tipPct = s.tip_cents && svc ? Math.round((s.tip_cents / svc) * 100) : 0;
  const inProgress = attempts?.some((a) => a.status === 'pending');
  const flash = sp.card === 'declined' ? 'The card payment was not completed.' : sp.card === 'pending' ? 'Still waiting for the bank. Refresh in a moment.' : '';
  return (
    <>
      <div className="page-head"><div><Link href="/sales" className="muted small">‹ Sales</Link><h1>{open ? 'Checkout' : 'Sale'}</h1>
        <div className="muted">{(s as any).clients?.name ?? 'Walk-in'} · {dateLong(s.paid_at ?? s.created_at, salon.timezone)} {time12(s.paid_at ?? s.created_at, salon.timezone)}</div></div>
        <span className={`pill ${s.status === 'paid' ? 'ok' : s.status === 'refunded' ? 'bad' : 'warn'}`}>{open ? 'Open' : s.status}</span></div>
      {sp.err && <div className="notice err" role="alert">{sp.err}</div>}
      {flash && <div className="notice err" role="alert">{flash}</div>}
      {attempts?.some((a) => a.needs_review) && <div className="notice err">A card payment needs review: {attempts.find((a) => a.needs_review)?.review_note}</div>}
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2 style={{ marginBottom: 10 }}>Summary</h2>
          {(s.sale_items as any[]).map((i, k) => <div className="row between" key={k} style={{ padding: '5px 0' }}><span>{i.label}{i.qty > 1 ? ` × ${i.qty}` : ''}</span><b>{money(i.price_cents * i.qty, cur)}</b></div>)}
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 8 }}>
            <div className="row between"><span className="muted">Subtotal</span><span>{money(s.subtotal_cents, cur)}</span></div>
            {s.tip_cents > 0 && <div className="row between"><span className="muted">Tip</span><span>{money(s.tip_cents, cur)}</span></div>}
            {!s.tax_inclusive && s.tax_cents > 0 && <div className="row between"><span className="muted">Tax ({Number(s.tax_rate)}%)</span><span>{money(s.tax_cents, cur)}</span></div>}
            <div className="row between" style={{ marginTop: 6 }}><b>Total</b><span className="big" style={{ fontSize: 24 }}>{money(s.total_cents, cur)}</span></div>
            {s.tax_inclusive && s.tax_cents > 0 && <div className="muted small right">Includes {money(s.tax_cents, cur)} tax ({Number(s.tax_rate)}%)</div>}
          </div>
          {open && st.ask_for_tip && !inProgress && (
            <div style={{ marginTop: 16 }}><div className="lbl" style={{ marginBottom: 6 }}>Tip</div>
              <div className="row wrap">{[0, 10, 15, 20].map((p) => <form action={setTip} key={p}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="pct" value={p} /><button className={`btn sm ${tipPct === p ? 'dark' : ''}`}>{p === 0 ? 'None' : `${p}%`}</button></form>)}</div></div>)}
        </div>
        <div className="card">
          {open ? (<>
            <h2 style={{ marginBottom: 12 }}>Take payment</h2>
            <div className="stack">
              {st.accept_card && pay?.terminal_enabled && <TerminalPay saleId={s.id} />}
              {st.accept_card && pay?.online_cards_enabled && <form action={payOnline}><input type="hidden" name="id" value={s.id} /><button className="btn primary" style={{ width: '100%' }} disabled={inProgress}>Pay by card on screen</button></form>}
              {st.accept_card && !pay?.terminal_enabled && !pay?.online_cards_enabled && staff.app_role === 'owner' && <div className="muted small">Card payments are on but no provider is set up. <Link href="/settings"><b>Add Windcave in Settings</b></Link>.</div>}
              {st.accept_cash && <form action={payManual}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="method" value="cash" /><button className="btn" style={{ width: '100%' }} disabled={inProgress}>Cash received</button></form>}
              {st.accept_gift_cards && <form action={payManual} className="row"><input type="hidden" name="id" value={s.id} /><input type="hidden" name="method" value="gift_card" /><input name="code" placeholder="Gift card code" required aria-label="Gift card code" /><button className="btn" disabled={inProgress}>Redeem</button></form>}
              <form action={voidSale}><input type="hidden" name="id" value={s.id} /><button className="btn danger sm" disabled={inProgress}>Cancel sale</button></form>
            </div></>) : (<>
            <h2 style={{ marginBottom: 8 }}>Payment</h2>
            <div className="muted">{s.method === 'gift_card' ? 'Gift card' : s.method}{s.paid_at ? ` · ${dateLong(s.paid_at, salon.timezone)}` : ''}</div>
            {s.status === 'paid' && staff.app_role === 'owner' && <form action={refund} style={{ marginTop: 14 }}><input type="hidden" name="id" value={s.id} /><button className="btn danger">Refund {money(s.total_cents, cur)}</button></form>}
            {s.status === 'refunded' && <div className="muted" style={{ marginTop: 8 }}>Refunded {s.refunded_at ? dateLong(s.refunded_at, salon.timezone) : ''}</div>}
          </>)}
          {!!attempts?.length && <div style={{ marginTop: 18 }}><div className="lbl" style={{ marginBottom: 6 }}>Card attempts</div>
            {attempts.map((a) => <div className="row between small" key={a.id}><span className="muted">{a.kind === 'terminal' ? 'Terminal' : 'On screen'} · {time12(a.created_at, salon.timezone)}</span><span>{a.status}{a.response_text ? ` · ${a.response_text}` : ''}</span></div>)}</div>}
        </div>
      </div>
    </>
  );
}
