import type { CSSProperties } from 'react';

// Converts the prototype's inline style strings to React style objects, so the markup keeps the exact values.
// Lives on its own so the shared UI pieces and the pickers can both use it without importing each other in a loop.
const cache = new Map<string, CSSProperties>();
export function S(css: string): CSSProperties {
  let o = cache.get(css);
  if (o) return o;
  o = {};
  for (const part of css.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (!k) continue;
    (o as any)[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  cache.set(css, o);
  return o;
}
