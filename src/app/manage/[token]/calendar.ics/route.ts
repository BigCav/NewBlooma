import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { allow, clientIp } from '@/lib/rate-limit';
import { calEventFor } from '@/lib/booking-cal';
import { icsFile } from '@/lib/ics';

export const dynamic = 'force-dynamic';

/** The appointment as a calendar file, for the client who holds its manage link. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-zA-Z_-]{8,128}$/.test(token)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!(await allow('ics:' + (await clientIp()), 60, 600))) return NextResponse.json({ error: 'slow down' }, { status: 429 });
  const { data: t } = await supabaseAdmin().from('booking_tokens').select('booking_id,expires_at').eq('token', token).eq('purpose', 'manage_booking').maybeSingle();
  if (!t?.booking_id || new Date(t.expires_at) < new Date()) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const ev = await calEventFor(t.booking_id, token);
  if (!ev) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return new NextResponse(icsFile(ev), { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="appointment.ics"', 'Cache-Control': 'no-store' } });
}
