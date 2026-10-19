import { requireOwner } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WindcaveView } from './WindcaveView';

export const metadata = { title: 'Card payments' };
export const dynamic = 'force-dynamic';

export default async function Windcave() {
  const { sb, salon, settings: st } = await requireOwner();
  const [{ data: pay }, secrets] = await Promise.all([
    sb.from('salon_payment_settings').select('*').eq('salon_id', salon.id).single(),
    supabaseAdmin().from('salon_payment_secrets').select('online_user,online_key,hit_user,hit_key').eq('salon_id', salon.id).maybeSingle(),
  ]);
  const has = (k: string) => Boolean((secrets.data as any)?.[k]);
  return <WindcaveView taxInclusive={!!st.tax_inclusive} online={!!pay?.online_cards_enabled} terminal={!!pay?.terminal_enabled} station={pay?.terminal_station_id ?? ''}
    saved={{ online_user: has('online_user'), online_key: has('online_key'), hit_user: has('hit_user'), hit_key: has('hit_key') }} />;
}
