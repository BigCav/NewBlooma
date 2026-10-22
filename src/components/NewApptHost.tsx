'use client';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { loadNewAppt } from '@/app/(dash)/calendar/actions';
import type { NewApptData } from '@/app/(dash)/calendar/NewApptSheet';

const Sheet = dynamic(() => import('@/app/(dash)/calendar/NewApptSheet'), { ssr: false });

export const NEW_APPT_EVENT = 'aster:new-appt';
/** Opens the new-appointment sheet over the current page. */
export const openNewAppt = () => window.dispatchEvent(new Event(NEW_APPT_EVENT));

/** Lives in the app layout so the + button can open the sheet on any page, without going to the calendar first. */
export function NewApptHost() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [data, setData] = useState<NewApptData | null>(null);
  useEffect(() => {
    const open = () => { setShow(true); setData(null); loadNewAppt().then((d) => setData(d)).catch(() => setShow(false)); };
    window.addEventListener(NEW_APPT_EVENT, open);
    return () => window.removeEventListener(NEW_APPT_EVENT, open);
  }, []);
  if (!show) return null;
  if (!data) return <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(14,17,22,0.4)' }} />;
  return <Sheet data={data} onClose={() => setShow(false)} onCreated={(r) => { setShow(false); router.push(`/calendar?d=${r.day}${r.id ? '&b=' + r.id : ''}`); }} />;
}
