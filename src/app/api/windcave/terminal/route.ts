import { NextResponse, type NextRequest } from 'next/server';
import { pollTerminal } from '@/lib/windcave';

/** Windcave's result notification for a card terminal payment. Idempotent; the call itself is not trusted, the result is fetched from Windcave. */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t') ?? '';
  if (/^TM[0-9a-f]{18}$/.test(t)) await pollTerminal(t).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
