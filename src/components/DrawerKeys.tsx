'use client';
import { useEffect } from 'react';

const LIVE = '.m-drawer:not(.m-drawer-out)';

/** Closes the front-most layer of the open desktop drawer the same way its own close button does. */
function closeFront() {
  // A card payment is working on the terminal: nothing closes the page it is shown on.
  if (document.querySelector('[data-pay-lock]')) return false;
  const top = [...document.querySelectorAll<HTMLElement>(`${LIVE} .sheet, ${LIVE} > [role="dialog"]`)].pop();
  if (!top) return false;
  let btn: HTMLElement | null | undefined;
  if (top.classList.contains('sheet')) {
    const back = top.previousElementSibling;
    // The sheet's backdrop carries data-close (the old wording check stays as a fallback for anything that does not yet).
    btn = back instanceof HTMLButtonElement && (back.hasAttribute('data-close') || (back.getAttribute('aria-label') ?? '').startsWith('Close')) ? back : top.querySelector<HTMLElement>('[data-close], button[aria-label^="Close"]');
  } else {
    // A page-style drawer: its Close (X) button, or its Back button when it has no X on this step.
    btn = [...top.querySelectorAll<HTMLElement>('[data-close], button[aria-label="Close"]')].find((b) => !b.closest('.sheet')) ?? top.querySelector<HTMLElement>('button[aria-label="Back"]');
  }
  if (!btn) return false;
  btn.click();
  return true;
}

/**
 * Desktop drawers: Esc and a click on the blurred area close the front layer, whatever kind of page it is.
 * A drawer, or a sheet inside one, that unmounts is copied back for a moment and played out in reverse, so it slides away instead of snapping shut.
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
    // Following a link away while the terminal is working: say what happens first, and stay if the person changes their mind.
    const leave = (e: MouseEvent) => {
      if (!document.querySelector('[data-pay-lock]')) return;
      const a = (e.target as HTMLElement).closest?.('a[href]');
      if (a && !window.confirm('A card payment is still in progress on the terminal. Leaving this page does not stop it, but you will not see the result here. Leave anyway?')) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('keydown', f);
    window.addEventListener('click', leave, true);
    window.addEventListener('click', g);
    const wide = window.matchMedia('(min-width:901px)');
    const calm = window.matchMedia('(prefers-reduced-motion:reduce)');
    const mo = new MutationObserver((list) => {
      if (!wide.matches || calm.matches) return;
      for (const m of list) {
        m.removedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement) || n.isConnected || n.classList.contains('m-drawer-out') || n.classList.contains('sheet-out')) return;
          if (n.classList.contains('m-drawer')) {
            const ghost = n.cloneNode(true) as HTMLElement;
            ghost.classList.add('m-drawer-out');
            ghost.setAttribute('aria-hidden', 'true');
            document.body.appendChild(ghost);
            setTimeout(() => ghost.remove(), 240);
            return;
          }
          // A sheet (such as the triple-dot menu) or its backdrop closing inside an open drawer: put it back where it was and play it out.
          const host = m.target instanceof HTMLElement ? m.target : null;
          if (!host || !host.isConnected || !host.closest(LIVE) || n.querySelector('.m-drawer')) return;
          const backdrop = n.tagName === 'BUTTON' && (n.hasAttribute('data-close') || (n.getAttribute('aria-label') ?? '').startsWith('Close'));
          if (!backdrop && !n.matches('.sheet') && !n.querySelector('.sheet')) return;
          const ghost = n.cloneNode(true) as HTMLElement;
          ghost.classList.add('sheet-out');
          ghost.setAttribute('aria-hidden', 'true');
          host.insertBefore(ghost, m.nextSibling && m.nextSibling.parentNode === host ? m.nextSibling : null);
          setTimeout(() => ghost.remove(), 240);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { window.removeEventListener('keydown', f); window.removeEventListener('click', leave, true); window.removeEventListener('click', g); mo.disconnect(); };
  }, []);
  return null;
}
