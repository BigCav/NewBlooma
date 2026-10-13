import { NextResponse, type NextRequest } from 'next/server';
import { cronAuthorised } from '@/lib/cron-auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  if (!cronAuthorised(req)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  const sb = supabaseAdmin();
  const [rem, off] = await Promise.all([sb.rpc('enqueue_reminders'), sb.rpc('expire_offers')]);
  return NextResponse.json({ reminders_queued: rem.data ?? 0, offers_expired: off.data ?? 0, errors: [rem.error?.message, off.error?.message].filter(Boolean) });
}
