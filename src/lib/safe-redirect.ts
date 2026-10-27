/**
 * A "next" address from a link may only ever lead to a page on this site. Browsers strip tabs and line breaks when reading
 * a web address, so "/<tab>/evil.example" would otherwise slip past a simple "starts with a single slash" check.
 */
export function safeNext(next: string | null | undefined, origin: string, fallback: string): string {
  if (!next || next.startsWith('//') || next.includes('\\') || !/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$/.test(next)) return fallback;
  try {
    const u = new URL(next, origin);
    return u.origin === origin ? u.pathname + u.search + u.hash : fallback;
  } catch { return fallback; }
}
