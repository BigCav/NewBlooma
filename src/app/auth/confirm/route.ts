import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';

/** Opens a one-time email link (password reset) by exchanging its token for a session, then moves on. */
export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get('token_hash');
  const type = req.nextUrl.searchParams.get('type') as EmailOtpType | null;
  const next = req.nextUrl.searchParams.get('next') ?? '';
  const dest = /^\/(?!\/)/.test(next) ? next : '/calendar';
  if (tokenHash && type) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(dest, req.url));
  }
  return NextResponse.redirect(new URL('/sign-in?expired=1', req.url));
}
