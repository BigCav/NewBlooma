import { NextResponse, type NextRequest } from 'next/server';
import { requireCtx } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * The card terminal log as a text file: every request sent to Windcave's terminal service and every reply, with times (UTC), oldest first.
 * Owner only. `?txn=` limits it to one payment or refund; `?days=` (1 to 90, default 30) sets how far back.
 */
export async function GET(req: NextRequest) {
  const { salon, staff } = await requireCtx();
  if (staff.app_role !== 'owner') return NextResponse.json({ error: 'Only the owner can download the terminal log.' }, { status: 403 });
  const txn = req.nextUrl.searchParams.get('txn') ?? '';
  if (txn && !/^[A-Z]{2,4}[0-9a-f]{1,24}$/.test(txn)) return NextResponse.json({ error: 'bad txn' }, { status: 400 });
  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 30));
  let q = supabaseAdmin().from('hit_log').select('id,txn_ref,direction,body,http_status,at').eq('salon_id', salon.id).gte('at', new Date(Date.now() - days * 86400e3).toISOString()).order('at', { ascending: true }).order('id', { ascending: true }).limit(5000);
  if (txn) q = q.eq('txn_ref', txn);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'Could not read the log.' }, { status: 500 });
  const head = [`Windcave HIT log: ${salon.name}`, txn ? `Transaction ${txn}` : `Last ${days} days`, `Times are UTC. Generated ${new Date().toISOString()}.`, `${data?.length ?? 0} entries.`, ''];
  const body = (data ?? []).map((r) => `=== ${r.at}  ${String(r.direction).toUpperCase()}  ${r.txn_ref ?? '-'}${r.http_status ? '  HTTP ' + r.http_status : ''} ===\n${r.body}\n`);
  const name = `windcave-hit-log-${txn || 'all'}-${new Date().toISOString().slice(0, 10)}.txt`;
  return new NextResponse(head.join('\n') + '\n' + body.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' } });
}
