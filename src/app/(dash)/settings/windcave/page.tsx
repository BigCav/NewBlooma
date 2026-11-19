import { requireOwner } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WindcaveView } from './WindcaveView';

export const metadata = { title: 'Card payments' };
export const dynamic = 'force-dynamic';

export default async function Windcave() {
  const { sb, salon, settings: st } = await requireOwner();
  const [{ data: pay }, secrets, { data: recent }] = await Promise.all([
    sb.from('salon_payment_settings').select('*').eq('salon_id', salon.id).single(),
    supabaseAdmin().from('salon_payment_secrets').select('online_user,online_key,hit_user,hit_key').eq('salon_id', salon.id).maybeSingle(),
    sb.from('card_payments').select('txn_ref,status,amount_cents,created_at').eq('kind', 'terminal').order('created_at', { ascending: false }).limit(25),
  ]);
  // The latest terminal payments and refunds, so the log of one test can be downloaded on its own.
  const when = new Intl.DateTimeFormat('en-NZ', { timeZone: salon.timezone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const logs = ((recent ?? []) as { txn_ref: string; status: string; amount_cents: number; created_at: string }[]).map((r) => ({ ref: r.txn_ref, label: `${when.format(new Date(r.created_at))}, ${r.txn_ref.startsWith('RF') ? 'refund' : 'payment'} $${(r.amount_cents / 100).toFixed(2)}, ${r.status}` }));
  const has = (k: string) => Boolean((secrets.data as any)?.[k]);
  return <WindcaveView logs={logs} taxInclusive={!!st.tax_inclusive} online={!!pay?.online_cards_enabled} terminal={!!pay?.terminal_enabled} station={pay?.terminal_station_id ?? ''}
    saved={{ online_user: has('online_user'), online_key: has('online_key'), hit_user: has('hit_user'), hit_key: has('hit_key') }} />;
}
