'use client';
import { useEffect, useState } from 'react';
import { DesktopCalendar } from './DesktopCalendar';
import { MobileCalendar } from './MobileCalendar';
import { useCalendar } from './useCalendar';
import type { Props } from './calUi';

/** One set of state and handlers, two layouts (desktop from Main.dc.html, mobile from Mobile.dc.html). */
export function CalendarView(props: Omit<Props, 'recent' | 'remoteSearch'> & { recent: Props['recent'] }) {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const p: Props = { ...props, remoteSearch: narrow !== null };
  const c = useCalendar(p);
  // Before the first client render both are present and CSS (.only-m / .only-d) shows the right one.
  return (<>
    {narrow !== false && <MobileCalendar c={c} props={p} />}
    {narrow !== true && <DesktopCalendar c={c} props={p} />}
  </>);
}
