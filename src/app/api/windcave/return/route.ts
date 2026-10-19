import { NextResponse, type NextRequest } from 'next/server';
import { releaseOnline, settleOnline } from '@/lib/windcave';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Customer/staff browser lands here after the hosted page. Result is re-checked with Windcave. */
export async function GET(req: NextRequest) {
  const txn = req.nextUrl.searchParams.get('t') ?? '';
  const result = await settleOnline(txn);
  const { data: cp } = await supabaseAdmin().from('card_payments').select('sale_id').eq('txn_ref', txn).maybeSingle();
  if (cp && result === 'pending' && req.nextUrl.searchParams.get('r') !== 'approved') await releaseOnline(cp.sale_id);
  const to =cp ? `/sales?sale=${cp.sale_id}&card=${result}` : '/sales';
  return NextResponse.redirect(new URL(to, req.nextUrl.origin));
}
