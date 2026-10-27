import { describe, expect, it } from 'vitest';
import { safeNext } from '@/lib/safe-redirect';

const O = 'https://aster-co-red.vercel.app';

describe('safeNext (open redirect protection)', () => {
  it('keeps normal in-site paths, with query and hash', () => {
    expect(safeNext('/calendar', O, '/x')).toBe('/calendar');
    expect(safeNext('/reset-password?a=1#top', O, '/x')).toBe('/reset-password?a=1#top');
  });
  it.each([
    ['//evil.example', 'protocol-relative'],
    ['/\t/evil.example', 'tab smuggling'],
    ['/\n/evil.example', 'newline smuggling'],
    ['/\\evil.example', 'backslash'],
    ['https://evil.example', 'absolute url'],
    ['javascript:alert(1)', 'javascript scheme'],
    ['evil.example', 'bare host'],
    ['', 'empty'],
    ['/ /evil', 'space'],
  ])('falls back for %j (%s)', (bad) => {
    expect(safeNext(bad, O, '/fallback')).toBe('/fallback');
  });
  it('falls back for null and undefined', () => {
    expect(safeNext(null, O, '/f')).toBe('/f');
    expect(safeNext(undefined, O, '/f')).toBe('/f');
  });
});
