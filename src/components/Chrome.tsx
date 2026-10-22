'use client';
// Shared page chrome converted 1:1 from the prototype: PageHeader.dc.html, MobileHeader.dc.html, MobileTabs.dc.html.
import Link from 'next/link';
import { useState } from 'react';
import { S } from '@/app/(dash)/calendar/pickers';
import { openNewAppt } from '@/components/NewApptHost';

export const Mag = ({ size, color }: { size: number; color: string }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;

export function PageHeader({ title, subtitle, query, onQuery, placeholder = 'Search clients', actionLabel = 'New appointment', onAction, showSearch = true, showAction = true }: {
  title: string; subtitle: string; query?: string; onQuery?: (v: string) => void; placeholder?: string; actionLabel?: string; onAction?: () => void; showSearch?: boolean; showAction?: boolean;
}) {
  return (
    <header style={S("display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;font-family:'Geist',system-ui,sans-serif;color:#0E1116")}>
      <div style={S('min-width:0')}>
        <h1 style={S('margin:0;font-size:34px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{title}</h1>
        <p style={S('margin:6px 0 0;color:#5E6673;font-size:15px')}>{subtitle}</p>
      </div>
      <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px')}>
        {showSearch && (
          <label className="search" style={S('display:flex;align-items:center;gap:10px;height:44px;box-sizing:border-box;padding:0 16px;border-radius:999px;background:#FFFFFF;border:1px solid #E6E8EC;color:#5E6673')}>
            <Mag size={18} color="#5E6673" />
            <input type="text" value={query ?? ''} onChange={(e) => onQuery?.(e.target.value)} placeholder={placeholder} aria-label={placeholder} style={{ ...S('border:0;outline:none;background:transparent;font:inherit;color:#0E1116;width:150px'), padding: '1px 2px', minHeight: 0, borderRadius: 0 }} />
          </label>
        )}
        {showAction && (
          <button onClick={onAction} style={S('display:flex;align-items:center;gap:8px;height:44px;padding:0 20px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            {actionLabel}
          </button>
        )}
      </div>
    </header>
  );
}

export function MobileHeader({ title, subtitle, query, onQuery, placeholder = 'Search', showSearch = true }: {
  title: string; subtitle: string; query?: string; onQuery?: (v: string) => void; placeholder?: string; showSearch?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header style={S("display:flex;flex-direction:column;gap:12px;padding:28px 20px 16px;font-family:'Geist',system-ui,sans-serif;color:#0E1116")}>
      <div style={S('display:flex;align-items:flex-end;justify-content:space-between;gap:12px')}>
        <div style={S('min-width:0')}>
          <h1 style={S('margin:0;font-size:30px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{title}</h1>
          <p style={S('margin:4px 0 0;color:#5E6673;font-size:14.5px')}>{subtitle}</p>
        </div>
        {showSearch && (
          <button onClick={() => { if (open) onQuery?.(''); setOpen(!open); }} aria-label={open ? 'Close search' : 'Search'} aria-expanded={open}
            style={S('flex:0 0 44px;width:44px;height:44px;border:1px solid ' + (open ? '#0E1116' : '#E1E4E9') + ';border-radius:999px;background:' + (open ? '#0E1116' : '#FFFFFF') + ';display:flex;align-items:center;justify-content:center;cursor:pointer')}>
            <Mag size={20} color={open ? '#FFFFFF' : '#0E1116'} />
          </button>
        )}
      </div>
      {open && (
        <label style={S('display:flex;align-items:center;gap:10px;height:48px;box-sizing:border-box;padding:0 16px;border-radius:999px;background:#FFFFFF;border:1px solid #E6E8EC')}>
          <Mag size={18} color="#5E6673" />
          <input autoFocus type="text" value={query ?? ''} onChange={(e) => onQuery?.(e.target.value)} placeholder={placeholder} aria-label={placeholder}
            style={{ ...S('flex:1 1 auto;min-width:0;border:0;outline:none;background:transparent;font:inherit;color:#0E1116'), padding: '1px 2px', minHeight: 0, width: 'auto', borderRadius: 0, margin: 0 }} />
        </label>
      )}
    </header>
  );
}

const ic = (color: string, children: React.ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
export function MobileTabs({ active }: { active: 'calendar' | 'services' | 'clients' | 'more' }) {
  const tab = (id: typeof active, href: string, label: string, svg: (c: string) => React.ReactNode) => {
    const on = active === id;
    return (
      <Link key={id} href={href} aria-current={on ? 'page' : 'false'} style={S('width:100%;min-height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-decoration:none;font-size:12px;font-weight:' + (on ? 600 : 500) + ';color:' + (on ? '#0E1116' : '#5E6673'))}>
        {ic(on ? '#0E1116' : '#5E6673', svg(on ? '#0E1116' : '#5E6673'))}{label}
      </Link>
    );
  };
  return (
    <nav aria-label="Main" style={S("box-sizing:border-box;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center;justify-items:center;padding:10px 8px 22px;background:#FFFFFF;border-top:1px solid #E6E8EC;font-family:'Geist',system-ui,sans-serif")}>
      {tab('calendar', '/calendar', 'Calendar', () => <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>)}
      {tab('services', '/services', 'Services', () => <><circle cx="6" cy="7" r="2.5" /><circle cx="6" cy="17" r="2.5" /><path d="M8 8.5 20 18M8 15.5 20 6" /></>)}
      <button type="button" onClick={openNewAppt} aria-label="New appointment" style={S('width:48px;height:48px;padding:0;border:0;border-radius:999px;background:#0E1116;display:flex;align-items:center;justify-content:center;cursor:pointer')}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      {tab('clients', '/clients', 'Clients', () => <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18.5 14.8c1.6.8 2.6 2.4 3 5.2" /></>)}
      {tab('more', '/more', 'More', () => <><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></>)}
    </nav>
  );
}
