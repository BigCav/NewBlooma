import { requireCtx } from '@/lib/session';
import ActionForm from '@/components/ActionForm';
import { money, dateLong } from '@/lib/format';
import { issueGiftCard } from './actions';

export const metadata = { title: 'Gift cards' };

export default async function GiftCards() {
  const { sb, salon, staff } = await requireCtx();
  const { data: cards } = await sb.from('gift_cards').select('id,code,balance_cents,issued_at').order('issued_at', { ascending: false }).limit(50);
  return (
    <>
      <div className="page-head"><div><h1>Gift cards</h1><div className="muted">Issue and check balances</div></div></div>
      <div className="card">
        {staff.app_role === 'owner' && <ActionForm action={issueGiftCard} submit="Issue gift card" resetOnOk><div className="grid g2"><div className="field"><label>Code</label><input name="code" required minLength={4} style={{ textTransform: 'uppercase' }} /></div><div className="field"><label>Amount ({salon.currency})</label><input name="amount" inputMode="decimal" required /></div></div></ActionForm>}
        {!cards?.length ? <div className="empty">No gift cards issued.</div> : cards.map((g) => <div className="row between" key={g.id} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}><span><b>{g.code}</b> <span className="muted small">issued {dateLong(g.issued_at, salon.timezone)}</span></span><b>{money(g.balance_cents, salon.currency)}</b></div>)}
      </div>
    </>
  );
}
