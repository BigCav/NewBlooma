'use client';
import { BLACK_ACTION, Icon } from '@/components/ui';
// Shared page chrome converted 1:1 from the prototype: PageHeader.dc.html, MobileHeader.dc.html, MobileTabs.dc.html.
import { useState } from 'react';
import { S } from '@/app/(dash)/calendar/pickers';
import { PhoneTabs, type TabId } from '@/components/Nav';

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
          <button onClick={onAction} style={S(BLACK_ACTION)}>
            <Icon name="plus" color="#FFFFFF" />
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
    <header style={S("display:flex;flex-direction:column;gap:12px;padding:28px 20px 18px;margin-bottom:20px;border-bottom:1px solid #E6E8EC;font-family:'Geist',system-ui,sans-serif;color:#0E1116")}>
      <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
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

/** The phone tab bar drawn in place at the bottom of a page: the one shared component from Nav, so every page shows the same tabs, names and unread count. */
export function MobileTabs({ active }: { active?: TabId }) {
  return <PhoneTabs active={active} inPage />;
}
