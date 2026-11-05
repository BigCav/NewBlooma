import { NextResponse, type NextRequest } from 'next/server';
import { cronAuthorised } from '@/lib/cron-auth';
import { processOutbox } from '@/lib/notify';

export const maxDuration = 60;
export async function GET(req: NextRequest) {
  if (!cronAuthorised(req)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  // A group message can queue hundreds at once, so keep sending batches until nothing is due or the time is nearly up.
  const stats = { sent: 0, failed: 0, skipped: 0, waiting: 0 };
  const stop = Date.now() + 45_000;
  for (;;) {
    const s = await processOutbox();
    stats.sent += s.sent; stats.failed += s.failed; stats.skipped += s.skipped; stats.waiting = s.waiting;
    if (s.sent + s.failed + s.skipped === 0 || Date.now() > stop) break;
  }
  return NextResponse.json(stats);
}
