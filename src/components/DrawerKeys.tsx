'use client';
import { useEffect } from 'react';

/** Esc closes the front-most desktop drawer, by pressing its Close backdrop. */
export function DrawerKeys() {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const all = document.querySelectorAll<HTMLButtonElement>('.m-drawer > div > button[aria-label^="Close"]');
      const last = all[all.length - 1];
      if (last) { e.preventDefault(); last.click(); }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);
  return null;
}
