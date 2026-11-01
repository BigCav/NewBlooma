'use client';
import { useEffect } from 'react';

const LIVE = '.m-drawer:not(.m-drawer-out)';

/** Closes the front-most layer of the open desktop drawer the same way its own close button does. */
function closeFront() {
  const top = [...document.querySelectorAll<HTMLElement>(`${LIVE} .sheet, ${LIVE} > [role="dialog"]`)].pop();
  if (!top) return false;
  let btn: HTMLElement | null | undefined;
  if (top.classList.contains('sheet')) {
    const back = top.previousElementSibling;
    btn = back instanceof HTMLButtonElement && (back.getAttribute('aria-label') ?? '').startsWith('Close') ? back : top.querySelector<HTMLElement>('button[aria-label^="Close"]');
  } else {
    // A page-style drawer: its Close (X) button, or its Back button when it has no X on this step.
    btn = [...top.querySelectorAll<HTMLElement>('button[aria-label="Close"]')].find((b) => !b.closest('.sheet')) ?? top.querySelector<HTMLElement>('button[aria-label="Back"]');
  }
  if (!btn) return false;
  btn.click();
  return true;
}

/**
 * Desktop drawers: Esc and a click on the blurred area close the front layer, whatever kind of page it is.
 * A drawer that unmounts is copied back for a moment and played out in reverse, so it slides away instead of snapping shut.
 */
export function DrawerKeys() {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeFront()) e.preventDefault();
    };
    const g = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.classList?.contains('m-drawer') && !t.classList.contains('m-drawer-out')) closeFront();
    };
    window.addEventListener('keydown', f);
    window.addEventListener('click', g);
    const wide = window.matchMedia('(min-width:901px)');
    const calm = window.matchMedia('(prefers-reduced-motion:reduce)');
    const mo = new MutationObserver((list) => {
      if (!wide.matches || calm.matches) return;
      for (const m of list) {
        m.removedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement) || !n.classList.contains('m-drawer') || n.classList.contains('m-drawer-out') || n.isConnected) return;
          const ghost = n.cloneNode(true) as HTMLElement;
          ghost.classList.add('m-drawer-out');
          ghost.setAttribute('aria-hidden', 'true');
          document.body.appendChild(ghost);
          setTimeout(() => ghost.remove(), 240);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { window.removeEventListener('keydown', f); window.removeEventListener('click', g); mo.disconnect(); };
  }, []);
  return null;
}
