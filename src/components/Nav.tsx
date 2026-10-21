'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

const S = (children: ReactNode, size = 20, sw = 1.7) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const ICON: Record<string, (s?: number, w?: number) => ReactNode> = {
  calendar: (s, w) => S(<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>, s, w),
  inbox: (s, w) => S(<><path d="M3.5 13.5 6 5.5h12l2.5 8" /><path d="M3.5 13.5V18a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5v-4.5h-5l-1 2h-4l-1-2z" /></>, s, w),
  clients: (s, w) => S(<><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18.5 14.8c1.6.8 2.6 2.4 3 5.2" /></>, s, w),
  waitlist: (s, w) => S(<><path d="M12 7v5l3 2" /><circle cx="12" cy="12" r="8.5" /></>, s, w),
  services: (s, w) => S(<><circle cx="6" cy="7" r="2.5" /><circle cx="6" cy="17" r="2.5" /><path d="M8 8.5 20 18M8 15.5 20 6" /></>, s, w),
  team: (s, w) => S(<><rect x="4" y="3.5" width="16" height="17" rx="3" /><circle cx="12" cy="10" r="2.5" /><path d="M7.5 17c.6-2 2.4-3 4.5-3s3.9 1 4.5 3" /></>, s, w),
  payroll: (s, w) => S(<><circle cx="12" cy="12" r="8.5" /><path d="M14.6 9.3c-.5-.9-1.4-1.3-2.6-1.3-1.5 0-2.6.8-2.6 1.9 0 2.8 5.2 1.4 5.2 4.1 0 1.2-1.2 2-2.6 2-1.2 0-2.2-.5-2.7-1.4M12 6.3V8M12 16v1.7" /></>, s, w),
  sales: (s, w) => S(<><rect x="3" y="6" width="18" height="12.5" rx="3" /><path d="M3 10.5h18M7 15h3" /></>, s, w),
  products: (s, w) => S(<><path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z" /><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8" /></>, s, w),
  reviews: (s, w) => S(<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z" />, s, w),
  reports: (s, w) => S(<path d="M5 20v-7M12 20V5M19 20V10" />, s, w),
  store: (s, w) => S(<><path d="M4 9.5 5.2 4.5h13.6L20 9.5" /><path d="M4 9.5a2.67 2.67 0 0 0 5.33 0 2.67 2.67 0 0 0 5.34 0A2.67 2.67 0 0 0 20 9.5" /><path d="M5 12.5V20h14v-7.5" /><path d="M10 20v-4.5h4V20" /></>, s, w),
  settings: (s, w) => S(<><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>, s, w),
  gift: (s, w) => S(<><rect x="4" y="9" width="16" height="11" rx="2" /><path d="M12 9v11M4 13h16M12 9c-1.5-3-5-3-5-.5S10.5 9 12 9zm0 0c1.5-3 5-3 5-.5S13.5 9 12 9z" /></>, s, w),
  more: (s, w) => S(<><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></>, s, w),
};
const RAIL: [string, string, string][] = [
  ['calendar', '/calendar', 'Calendar'], ['inbox', '/inbox', 'Inbox'], ['clients', '/clients', 'Clients'], ['waitlist', '/waitlist', 'Waitlist'],
  ['services', '/services', 'Services'], ['team', '/team', 'Team'], ['payroll', '/payroll', 'Payroll'], ['sales', '/sales', 'Sales'],
  ['products', '/products', 'Products'], ['gift', '/gift-cards', 'Gift cards'], ['reviews', '/reviews', 'Reviews'], ['reports', '/reports', 'Reports'],
];

export function SideNav({ slug, unread }: { slug: string; unread: number }) {
  const p = usePathname();
  const [wide, setWide] = useState(false);
  useEffect(() => { try { setWide(localStorage.getItem('aster_rail') === '1'); } catch { /* storage blocked */ } }, []);
  const toggle = () => setWide((w) => { try { localStorage.setItem('aster_rail', w ? '0' : '1'); } catch { /* storage blocked */ } return !w; });
  const item = (id: string, href: string, label: string, extra?: React.CSSProperties, ext = false) => {
    const on = !ext && p.startsWith(href);
    return (
      <Link key={id} href={href} className="rail-link" aria-label={id === 'inbox' && unread > 0 ? `Inbox, ${unread} need attention` : label} title={label} aria-current={on ? 'page' : undefined} target={ext ? '_blank' : undefined}
        style={{ width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: on ? '#0E1116' : 'transparent', color: on ? '#fff' : '#4A525E', ...extra }}>
        {ICON[id]()}
        <span className="rail-label">{id === 'store' ? 'Your salon page' : label}</span>
        {id === 'inbox' && unread > 0 && <span aria-hidden="true" style={{ position: 'absolute', top: 0, right: 0, minWidth: 20, height: 20, padding: '0 5px', boxSizing: 'border-box', borderRadius: 999, background: '#5B3DF5', color: '#fff', fontSize: 11, fontWeight: 600, lineHeight: '16px', textAlign: 'center', border: '2px solid #F4F5F7' }}>{unread > 9 ? '9+' : unread}</span>}
      </Link>
    );
  };
  return (
    <nav className={'rail' + (wide ? ' wide' : '')} aria-label="Main">
      <button type="button" onClick={toggle} aria-expanded={wide} aria-label={wide ? 'Collapse menu' : 'Expand menu'} title={wide ? 'Collapse menu' : 'Expand menu'} className="rail-logo" style={{ width: 40, height: 40, flex: '0 0 auto', border: 0, padding: 0, cursor: 'pointer', borderRadius: 14, background: '#0E1116', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, color: '#fff' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="7.5" /><path d="M8.5 13.5c1 1.6 2.2 2.3 3.5 2.3s2.5-.7 3.5-2.3" /></svg>
      </button>
      {RAIL.map(([id, href, label]) => item(id, href, label))}
      {item('store', `/b/${slug}`, 'View your public salon page', { marginTop: 'auto' }, true)}
      {item('settings', '/settings', 'Settings')}
    </nav>
  );
}

export function TabBar() {
  const p = usePathname();
  const tab = (id: string, href: string, label: string, on: boolean) => (
    <Link key={id} href={href} aria-current={on ? 'page' : undefined} style={{ width: '100%', minHeight: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, fontSize: 12, fontWeight: on ? 600 : 500, color: on ? '#0E1116' : '#5E6673' }}>
      {ICON[id](22, 1.8)}{label}
    </Link>
  );
  const main = ['/calendar', '/services', '/clients'].some((h) => p.startsWith(h));
  return (
    <nav className="tabs-bar" aria-label="Main">
      {tab('calendar', '/calendar', 'Calendar', p.startsWith('/calendar'))}
      {tab('services', '/services', 'Services', p.startsWith('/services'))}
      <Link href="/calendar/new" aria-label="New appointment" style={{ width: 48, height: 48, borderRadius: 999, background: '#0E1116', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </Link>
      {tab('clients', '/clients', 'Clients', p.startsWith('/clients'))}
      {tab('more', '/more', 'More', !main)}
    </nav>
  );
}
