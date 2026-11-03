'use client';
import { BottomSheet } from '@/components/BottomSheet';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { S } from '@/app/(dash)/calendar/pickers';
import { openNewAppt } from '@/components/NewApptHost';
import { RING, CLOSE } from '@/components/ui';
import { TONE } from '@/lib/tones';

const NEW_MENU_EVENT = 'aster:new-menu';
/** Opens the + sheet. A page can pass its own new-appointment opener (for example the calendar, which knows the day). */
export const openNewMenu = (onAppt?: () => void) => window.dispatchEvent(new CustomEvent(NEW_MENU_EVENT, { detail: onAppt }));

const ic = (color: string, children: React.ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;

/** Everything you can create from a page's own button. Each href opens that page's create flow through ?new=1 (see useNewParam); a page without that deep link is not listed. */
const NEW_ITEMS: [string, string, React.ReactNode][] = [
  ['New client', '/clients?new=1', <><circle cx="10" cy="8.5" r="3.5" /><path d="M3.5 20c.6-3.6 3.2-5.5 6.5-5.5S16 16.4 16.5 20M19 8v6M16 11h6" /></>],
  ['New sale', '/sales?new=1', <><rect x="3" y="6" width="18" height="12.5" rx="3" /><path d="M3 10.5h18M7 15h3" /></>],
  ['New team member', '/team?new=1', <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5" /></>],
  ['New service', '/services?new=1', <><circle cx="6" cy="7" r="2.5" /><circle cx="6" cy="17" r="2.5" /><path d="M8 8.5 20 18M8 15.5 20 6" /></>],
  ['New product', '/products?new=1', <><path d="M4 8l8-4 8 4-8 4-8-4Z" /><path d="M4 8v8l8 4 8-4V8M12 12v8" /></>],
  ['Add to waitlist', '/waitlist?new=1', <><path d="M12 7v5l3 2" /><circle cx="12" cy="12" r="8.5" /></>],
  ['Issue gift card', '/gift-cards?new=1', <><rect x="3.5" y="8" width="17" height="12" rx="2.5" /><path d="M3.5 12.5h17M12 8v12M12 8c-1-3-4.5-3.5-4.5-1.2S10.5 8 12 8Zm0 0c1-3 4.5-3.5 4.5-1.2S13.5 8 12 8Z" /></>],
];

/** The + button's sheet: new appointment first in black, then everything else you can create. */
function NewSheet({ onClose, onAppt }: { onClose: () => void; onAppt: () => void }) {
  const router = useRouter();
  const go = (href: string) => { onClose(); router.push(href); };
  return (
    <div className="m-drawer"><BottomSheet label="Create new" onClose={onClose} fixed z={60} gap={10} handleGap={4} extraStyle="font-family:'Geist',system-ui,sans-serif;color:#0E1116">
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
          <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Create new</h2>
          <button onClick={onClose} aria-label="Close" data-close="" style={S(RING)}>{CLOSE}</button>
        </div>
        <button onClick={() => { onClose(); onAppt(); }} style={S('display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;min-height:64px;padding:10px 18px;border:0;border-radius:22px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:16px;font-weight:600;text-align:left;cursor:pointer')}>
          <span style={S('flex:0 0 40px;width:40px;height:40px;border-radius:14px;background:rgba(255,255,255,0.14);display:flex;align-items:center;justify-content:center')}>{ic('#FFFFFF', <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4M12 13v4M10 15h4" /></>)}</span>
          New appointment
        </button>
        {NEW_ITEMS.map(([label, href, svg]) => (
          <button key={label} onClick={() => go(href)} style={S('display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;min-height:64px;padding:10px 18px;border:1px solid #E6E8EC;border-radius:22px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:16px;font-weight:500;text-align:left;cursor:pointer')}>
            <span style={S('flex:0 0 40px;width:40px;height:40px;border-radius:14px;background:' + TONE.purple.bg + ';display:flex;align-items:center;justify-content:center')}>{ic(TONE.purple.fg, svg)}</span>
            {label}
          </button>
        ))}
    </BottomSheet></div>
  );
}

/** Lives in the app layout so every + button opens the same sheet. */
export function NewMenuHost() {
  const [on, setOn] = useState<{ appt: () => void } | null>(null);
  useEffect(() => {
    const f = (e: Event) => setOn({ appt: (e as CustomEvent<(() => void) | undefined>).detail ?? openNewAppt });
    window.addEventListener(NEW_MENU_EVENT, f);
    return () => window.removeEventListener(NEW_MENU_EVENT, f);
  }, []);
  return on ? <NewSheet onClose={() => setOn(null)} onAppt={on.appt} /> : null;
}
