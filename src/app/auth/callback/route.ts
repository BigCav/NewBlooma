import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-redirect';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (code) { const sb = await supabaseServer(); await sb.auth.exchangeCodeForSession(code); }
  const next = req.nextUrl.searchParams.get('next') ?? '';
  return NextResponse.redirect(new URL(safeNext(next, req.nextUrl.origin, '/setup'), req.nextUrl.origin));
}
