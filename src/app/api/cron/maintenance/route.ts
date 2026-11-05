import { NextResponse, type NextRequest } from 'next/server';
import { cronAuthorised } from '@/lib/cron-auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { reportHealth } from '@/lib/health';
import { smsConfigured } from '@/lib/notify';

export async function GET(req: NextRequest) {
  if (!cronAuthorised(req)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  const sb = supabaseAdmin();
  const [rem, off, mk] = await Promise.all([sb.rpc('enqueue_reminders'), sb.rpc('expire_offers'), sb.rpc('enqueue_marketing', { p_sms: smsConfigured() })]);
  const health = await reportHealth();
  const body = { reminders_queued: rem.data ?? 0, offers_expired: off.data ?? 0, marketing_queued: mk.data ?? 0, health, errors: [rem.error?.message, off.error?.message, mk.error?.message, health.error].filter(Boolean) };
  // A problem found is a failed run, so it shows red in the deployment's cron log as well as arriving by email.
  return NextResponse.json(body, { status: health.problems.length || health.error ? 500 : 200 });
}
