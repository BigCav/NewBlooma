'use client';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { CLOSE, RING } from '@/components/ui';
import { S } from '@/app/(dash)/calendar/pickers';
import { loadNewAppt } from '@/app/(dash)/calendar/actions';
import type { NewApptData } from '@/app/(dash)/calendar/NewApptSheet';

const loadSheet = () => import('@/app/(dash)/calendar/NewApptSheet');
const Sheet = dynamic(loadSheet, { ssr: false });

export const NEW_APPT_EVENT = 'aster:new-appt';
type Chosen = { id: string; name: string };
/** Opens the new-appointment sheet over the current page, for an existing client when one is given (their profile's Book button). */
export const openNewAppt = (client?: Chosen) => window.dispatchEvent(new CustomEvent<Chosen | null>(NEW_APPT_EVENT, { detail: client && typeof client.id === 'string' ? { id: client.id, name: client.name } : null }));

const FRESH_MS = 5 * 60 * 1000;

/** Lives in the app layout so the + button can open the sheet on any page, without going to the calendar first. */
export function NewApptHost() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [data, setData] = useState<NewApptData | null>(null);
  const [who, setWho] = useState<Chosen | null>(null);
  // The data came after the placeholder was showing: the real sheet takes its place without sliding in again.
  const [late, setLate] = useState(false);
  const cache = useRef<{ at: number; d: NewApptData } | null>(null);
  const fetching = useRef<Promise<NewApptData | null> | null>(null);
  const fetchData = () => {
    fetching.current ??= loadNewAppt().then((d) => { cache.current = { at: Date.now(), d }; return d; }).catch(() => null).finally(() => { fetching.current = null; });
    return fetching.current;
  };
  // Get the sheet's data and code ready in the background (phone and computer) so the + and Book buttons open it straight away.
  useEffect(() => {
    const t = setTimeout(() => { void loadSheet(); void fetchData(); }, 800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const open = (e: Event) => {
      setWho((e as CustomEvent<Chosen | null>).detail ?? null);
      setShow(true);
      const c = cache.current;
      if (c && Date.now() - c.at < FRESH_MS) { setLate(false); setData(c.d); return; }
      setData(null);
      fetchData().then((d) => { if (d) { setLate(true); setData(d); } else setShow(false); });
    };
    window.addEventListener(NEW_APPT_EVENT, open);
    return () => window.removeEventListener(NEW_APPT_EVENT, open);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show) return null;
  // While the data is on its way: the same drawer (computer) or sheet (phone) the wizard opens in, with placeholders shaped like its first step.
  if (!data) return (
    <div className="m-cal cal-root m-drawer" data-instant="" style={S("font-family:'Geist',system-ui,sans-serif;color:#0E1116;font-size:14px;line-height:1.4")}>
      <BottomSheet label="New appointment" onClose={() => setShow(false)} backdropLabel="Cancel" z={60} fixed>
        <div role="status" aria-label="Loading" style={S('display:flex;flex-direction:column;gap:14px')}>
          <div style={S('display:flex;align-items:center;justify-content:space-between;min-height:44px')}><span className="sk" style={S('width:90px;height:14px')} /><button onClick={() => setShow(false)} aria-label="Close" style={S(RING)}>{CLOSE}</button></div>
          <div className="sk" style={S('height:4px;border-radius:999px')} />
          <div className="sk" style={S('height:30px;width:60%;margin-top:6px')} />
          {[0, 1, 2, 3].map((i) => <div key={i} className="sk" style={S('height:64px;border-radius:16px')} />)}
        </div>
      </BottomSheet>
    </div>
  );
  return <Sheet data={data} client={who} instant={late} onClose={() => setShow(false)} onCreated={(r) => { setShow(false); cache.current = null; router.push(`/calendar?d=${r.day}${r.id ? '&b=' + r.id : ''}`); }} />;
}
