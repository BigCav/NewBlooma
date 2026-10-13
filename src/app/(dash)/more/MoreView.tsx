import Link from 'next/link';
import { MobileHeader, MobileTabs } from '@/components/Chrome';
import { S } from '../calendar/pickers';

// Converted 1:1 from MobileMore.dc.html: same rows, icons and styles; the booking row points at the salon's real public page.
const ITEMS: [string, string, React.ReactNode][] = [
  ['/inbox', 'Inbox', <><path d="M3.5 13.5 6 5.5h12l2.5 8"/><path d="M3.5 13.5V18a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5v-4.5h-5l-1 2h-4l-1-2z"/></>],
  ['/products', 'Products', <><path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8"/></>],
  ['/team', 'Team', <><rect x="4" y="3.5" width="16" height="17" rx="3"/><circle cx="12" cy="10" r="2.5"/><path d="M7.5 17c.6-2 2.4-3 4.5-3s3.9 1 4.5 3"/></>],
  ['/waitlist', 'Waitlist', <><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="8.5"/></>],
  ['SLUG', 'Online booking page', <><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4"/></>],
  ['/reviews', 'Reviews', <><path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/></>],
  ['/payroll', 'Payroll', <><circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.4 0-2.5.7-2.5 1.8 0 2.5 5 1.2 5 3.8 0 1.1-1.1 1.9-2.5 1.9-1.1 0-2.1-.5-2.6-1.4M12 6.5V8m0 8v1.5"/></>],
  ['/reports', 'Reports', <><path d="M5 20v-7M12 20V5M19 20V10"/></>],
  ['/settings', 'Settings', <><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></>]
];
const CHEV = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')}><path d="M9.5 6l6 6-6 6" /></svg>;

export function MoreView({ slug, signOut }: { slug: string; signOut: () => Promise<void> }) {
  return (
    <div className="m-cal cal-root" style={S("display:flex;position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="More" subtitle="Everything else in one place" showSearch={false} />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <ul style={S('margin:0;padding:4px 0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px')}>
          {ITEMS.map(([href, label, icon], i) => {
            const booking = href === 'SLUG';
            return (
              <li key={label}>
                <Link href={booking ? `/b/${slug}` : href} target={booking ? '_blank' : undefined} style={S('display:flex;align-items:center;gap:14px;min-height:64px;box-sizing:border-box;padding:10px 16px;' + (i < ITEMS.length - 1 ? 'border-bottom:1px solid #EEF0F3;' : '') + 'text-decoration:none;color:#0E1116')}>
                  <span style={S('flex:0 0 40px;width:40px;height:40px;border-radius:12px;background:#EEF0F3;display:flex;align-items:center;justify-content:center')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icon}</svg></span>
                  <span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600')}>{label}</span>{CHEV}
                </Link>
              </li>
            );
          })}
        </ul>
        <form action={signOut}><button style={S('width:100%;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#B42318;font:inherit;font-size:14px;font-weight:500;cursor:pointer')}>Sign out</button></form>
      </main>
      <MobileTabs active="more" />
    </div>
  );
}
