'use client';
// A short message after something happened ("Saved", "Reply sent"). A good-news message fades away by itself after a few seconds so it
// never sits on the screen or follows you to the next one; a red message stays until the problem is dealt with.
import { useEffect, useState, type ReactNode } from 'react';
import { S } from '@/app/(dash)/calendar/s';
import { TONE } from '@/lib/tones';

export function Notice({ tone = 'green', children, onDone, ms = 4000 }: { tone?: 'green' | 'red' | 'blue'; children: ReactNode; onDone?: () => void; ms?: number }) {
  const [gone, setGone] = useState(false);
  const key = typeof children === 'string' ? children : '';
  useEffect(() => {
    setGone(false);
    if (tone === 'red') return;
    const t = setTimeout(() => { setGone(true); onDone?.(); }, ms);
    return () => clearTimeout(t);
  }, [key, tone, ms]); // eslint-disable-line react-hooks/exhaustive-deps
  if (gone) return null;
  return <p role={tone === 'red' ? 'alert' : 'status'} style={S(`margin:0;align-self:flex-start;display:inline-block;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:500;background:${TONE[tone].bg};color:${TONE[tone].fg}`)}>{children}</p>;
}
