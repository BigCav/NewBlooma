import { NextResponse, type NextRequest } from 'next/server';
import { settleOnline } from '@/lib/windcave';

/** Server-to-server notification. Idempotent; the body is ignored and the result is fetched from Windcave. */
export async function GET(req: NextRequest) { await settleOnline(req.nextUrl.searchParams.get('t') ?? ''); return NextResponse.json({ ok: true }); }
export async function POST(req: NextRequest) { await settleOnline(req.nextUrl.searchParams.get('t') ?? ''); return NextResponse.json({ ok: true }); }
