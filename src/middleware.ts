import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = [/^\/$/, /^\/pricing/, /^\/join\//, /^\/sign-in/, /^\/sign-up/, /^\/b\//, /^\/manage(\/|$)/, /^\/review\//, /^\/form\//, /^\/reply\//,/^\/offer\//, /^\/api\/(public|cron|windcave)/, /^\/auth\//];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims?.sub ? { id: claims.claims.sub } : null;
  const path = req.nextUrl.pathname;
  if (!user && !PUBLIC.some((r) => r.test(path))) {
    const url = req.nextUrl.clone(); url.pathname = '/sign-in'; url.search = '';
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|svg|webp|ico)$).*)'] };
