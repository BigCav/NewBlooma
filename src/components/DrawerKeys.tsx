'use client';
import { useEffect } from 'react';

/** Esc closes the front-most desktop drawer, by pressing its Close backdrop. */
export function DrawerKeys() {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const all = document.querySelectorAll<HTMLButtonElement>('.m-drawer > div > button[aria-label^="Close"]');
      const last = all[all.length - 1] ?? [...document.querySelectorAll<HTMLButtonElement>('.m-drawer > [role="dialog"] button[aria-label="Back"]')].pop();
      if (last) { e.preventDefault(); last.click(); }
    };
    // A page-style drawer has no backdrop button: a click on the blurred area beside it goes back.
    const g = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.classList?.contains('m-drawer')) return;
      const back = [...t.querySelectorAll<HTMLButtonElement>(':scope > [role="dialog"] button[aria-label="Back"]')].pop();
      if (back) back.click();
    };
    window.addEventListener('keydown', f);
    window.addEventListener('click', g);
    return () => { window.removeEventListener('keydown', f); window.removeEventListener('click', g); };
  }, []);
  return null;
}
