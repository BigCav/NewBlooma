'use client';
import { CHEV, OUTLINE } from '@/components/ui';
import { NAV, UnreadBadge, salonHref } from '@/components/Nav';
import Link from 'next/link';
import { MobileHeader, MobileTabs } from '@/components/Chrome';
import { S } from '../calendar/pickers';

// Converted 1:1 from MobileMore.dc.html: same rows, icons and styles; the booking row points at the salon's real public page.
// Names and addresses come from the navigation list, so a place has one name everywhere.
const ITEMS: [keyof typeof NAV, React.ReactNode][] = [
  ['inbox', <><path d="M3.5 13.5 6 5.5h12l2.5 8"/><path d="M3.5 13.5V18a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5v-4.5h-5l-1 2h-4l-1-2z"/></>],
  ['products', <><path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8"/></>],
  ['packages', <><path d="M12 3.5 3.5 8 12 12.5 20.5 8z"/><path d="M3.5 12 12 16.5 20.5 12M3.5 16 12 20.5 20.5 16"/></>],
  ['team', <><rect x="4" y="3.5" width="16" height="17" rx="3"/><circle cx="12" cy="10" r="2.5"/><path d="M7.5 17c.6-2 2.4-3 4.5-3s3.9 1 4.5 3"/></>],
  ['waitlist', <><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="8.5"/></>],
  ['clientForms', <><rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 9h6M9 13h6M9 17h3"/></>],
  ['store', <><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4"/></>],
  ['reviews', <><path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/></>],
  ['payroll', <><circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.4 0-2.5.7-2.5 1.8 0 2.5 5 1.2 5 3.8 0 1.1-1.1 1.9-2.5 1.9-1.1 0-2.1-.5-2.6-1.4M12 6.5V8m0 8v1.5"/></>],
  ['sales', <><rect x="3.5" y="6" width="17" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.5"/><path d="M7 9.5v.01M17 14.5v.01"/></>],
  ['gift', <><rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M4 13h16M12 9c-1.5-3-5-3-5-.5S10.5 9 12 9zm0 0c1.5-3 5-3 5-.5S13.5 9 12 9z"/></>],
  ['reports', <><path d="M5 20v-7M12 20V5M19 20V10"/></>],
  ['settings', <><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></>]
];

export function MoreView({ slug, signOut }: { slug: string; signOut: () => Promise<void> }) {
  return (
    <div className="m-cal cal-root" style={S("display:flex;position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="More" subtitle="Everything else in one place" showSearch={false} />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <ul style={S('margin:0;padding:4px 0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px')}>
          {ITEMS.map(([id, icon], i) => {
            const booking = id === 'store';
            const { label } = NAV[id];
            return (
              <li key={id}>
                <Link href={booking ? salonHref(slug) : NAV[id].href} target={booking ? '_blank' : undefined} style={S('display:flex;align-items:center;gap:14px;min-height:64px;box-sizing:border-box;padding:10px 16px;' + (i < ITEMS.length - 1 ? 'border-bottom:1px solid #EEF0F3;' : '') + 'text-decoration:none;color:#0E1116')}>
                  <span style={S('flex:0 0 40px;width:40px;height:40px;border-radius:12px;background:#EEF0F3;display:flex;align-items:center;justify-content:center')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icon}</svg></span>
                  <span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600')}>{label}</span>{id === 'inbox' && <UnreadBadge />}{CHEV}
                </Link>
              </li>
            );
          })}
        </ul>
        <form action={signOut}><button className="ghost" style={S(OUTLINE + ';width:100%;flex:0 0 auto;color:#B42318')}>Sign out</button></form>
      </main>
      <MobileTabs active="more" />
    </div>
  );
}
