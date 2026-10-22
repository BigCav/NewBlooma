'use client';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { loadNewAppt } from '@/app/(dash)/calendar/actions';
import type { NewApptData } from '@/app/(dash)/calendar/NewApptSheet';

const loadSheet = () => import('@/app/(dash)/calendar/NewApptSheet');
const Sheet = dynamic(loadSheet, { ssr: false });

export const NEW_APPT_EVENT = 'aster:new-appt';
/** Opens the new-appointment sheet over the current page. */
export const openNewAppt = () => window.dispatchEvent(new Event(NEW_APPT_EVENT));

const FRESH_MS = 5 * 60 * 1000;

/** Lives in the app layout so the + button can open the sheet on any page, without going to the calendar first. */
export function NewApptHost() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [data, setData] = useState<NewApptData | null>(null);
  const cache = useRef<{ at: number; d: NewApptData } | null>(null);
  const fetching = useRef<Promise<NewApptData | null> | null>(null);
  const fetchData = () => {
    fetching.current ??= loadNewAppt().then((d) => { cache.current = { at: Date.now(), d }; return d; }).catch(() => null).finally(() => { fetching.current = null; });
    return fetching.current;
  };
  // On a phone, get the sheet's data and code ready in the background so the + button opens it straight away.
  useEffect(() => {
    if (!window.matchMedia('(max-width:900px)').matches) return;
    const t = setTimeout(() => { void loadSheet(); void fetchData(); }, 800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const open = () => {
      setShow(true);
      const c = cache.current;
      if (c && Date.now() - c.at < FRESH_MS) { setData(c.d); return; }
      setData(null);
      fetchData().then((d) => { if (d) setData(d); else setShow(false); });
    };
    window.addEventListener(NEW_APPT_EVENT, open);
    return () => window.removeEventListener(NEW_APPT_EVENT, open);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show) return null;
  if (!data) return (
    <div role="status" aria-label="Loading" style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(14,17,22,0.4)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', boxSizing: 'border-box', background: '#FFFFFF', borderRadius: '28px 28px 0 0', padding: '28px 20px 40px', fontFamily: "'Geist',system-ui,sans-serif", fontSize: 15, fontWeight: 500, color: '#5E6673' }}>Loading…</div>
    </div>
  );
  return <Sheet data={data} onClose={() => setShow(false)} onCreated={(r) => { setShow(false); cache.current = null; router.push(`/calendar?d=${r.day}${r.id ? '&b=' + r.id : ''}`); }} />;
}
