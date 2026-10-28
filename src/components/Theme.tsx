'use client';
import { useEffect, useState } from 'react';

const COOKIE = 'theme';

/** Applies the saved night-mode choice to the page while the dashboard is open, and removes it on the public pages. */
export function ThemeApply({ dark }: { dark: boolean }) {
  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.dataset.theme = 'dark'; else delete root.dataset.theme;
    return () => { delete root.dataset.theme; };
  }, [dark]);
  return dark ? <script dangerouslySetInnerHTML={{ __html: "document.documentElement.dataset.theme='dark'" }} /> : null;
}

export function useNightMode(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(document.documentElement.dataset.theme === 'dark'); }, []);
  const set = (next: boolean) => {
    setOn(next);
    if (next) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
    document.cookie = `${COOKIE}=${next ? 'dark' : 'light'}; path=/; max-age=31536000; samesite=lax`;
  };
  return [on, set];
}
