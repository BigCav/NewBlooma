'use client';
// The only JavaScript behind the site's motion. The animations themselves are CSS (see "Motion" in globals.css): they run whenever
// an `enter` class appears on a container. This file adds that class when the page, or a step inside a flow, changes and takes it off
// again after 0.7 seconds, so a choice made inside one step never replays anything.
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const KEEP_MS = 700;
const timers = new WeakMap<Element, number>();

/** Puts `enter` on the element (restarting it if it is already there) and removes it again after about 700ms. */
export function pulseEnter(el: Element | null) {
  if (!el) return;
  const t = timers.get(el);
  if (t) window.clearTimeout(t);
  el.classList.remove('enter');
  void (el as HTMLElement).offsetWidth; // lets the browser see it gone, so adding it back starts the animations again
  el.classList.add('enter');
  timers.set(el, window.setTimeout(() => { el.classList.remove('enter'); timers.delete(el); }, KEEP_MS));
}

/** For a flow inside a sheet: replays the motion inside the returned element whenever `key` changes (not on first show, the sheet has its own). */
export function useEnter<T extends HTMLElement = HTMLDivElement>(key: unknown) {
  const ref = useRef<T>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    pulseEnter(ref.current);
  }, [key]);
  return ref;
}

/** For a view that fills the whole page (sign-in modes, setup steps, the booking page): replays the page's motion whenever `key` changes. */
export function useAppEnter(key: unknown) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    pulseEnter(document.getElementById('app'));
  }, [key]);
}

/** Rendered once in the root layout: the page animates in on every route change, including a page that arrives late behind its loading placeholder. */
export function AppEnter() {
  const path = usePathname();
  const first = useRef(true);
  useEffect(() => {
    const app = document.getElementById('app');
    if (!app) return;
    if (first.current) {
      // The server sent the page with `enter` already on, so the first paint animates; this only takes it off again.
      first.current = false;
      const t = window.setTimeout(() => app.classList.remove('enter'), KEEP_MS);
      return () => window.clearTimeout(t);
    }
    pulseEnter(app);
    // A page that streams in after its placeholder (and after the 700ms) still rises in: watch briefly for the real page appearing.
    const mo = new MutationObserver((recs) => {
      if (app.classList.contains('enter')) return;
      const isPage = (n: Node) => n instanceof Element && (n.matches('.cal-root:not(.m-drawer)') || !!n.querySelector('.cal-root:not(.m-drawer)'));
      if (recs.some((r) => Array.from(r.addedNodes).some(isPage))) { mo.disconnect(); pulseEnter(app); }
    });
    mo.observe(app, { childList: true, subtree: true });
    const stop = window.setTimeout(() => mo.disconnect(), 4000);
    return () => { mo.disconnect(); window.clearTimeout(stop); };
  }, [path]);
  return null;
}
