'use client';
// The details sheet for a visit, shared by the calendar (an appointment) and Sales (its sale): one layout, so they cannot drift apart.
import type { ReactNode } from 'react';
import { S } from './pickers';
import { CloseX, CLOSE_BTN } from './calUi';

export type VisitDetail = { label: string; value: string; icon: ReactNode; photo?: string | null };
export type VisitLine = { key: string; name: string; sub?: string; price: string };

const AVATAR = 'flex:0 0 52px;width:52px;height:52px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600';
const ROUND = 'flex:0 0 52px;width:52px;height:52px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer';

const Ico = ({ children }: { children: ReactNode }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true">{children}</svg>;
export const ICON_TIME = <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>;
export const ICON_PERSON = <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.6-3.4 3.3-5 7-5s6.4 1.6 7 5" /></>;
export const ICON_CARD = <><rect x="3.5" y="6" width="17" height="12" rx="2.5" /><path d="M3.5 10.5h17" /></>;

/** The three dots that open the quick actions. */
export function MoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="More actions" aria-haspopup="dialog" style={S(ROUND)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#0E1116"><circle cx="12" cy="5.5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="18.5" r="1.6" /></svg>
    </button>
  );
}

export const QA_ITEM = 'display:flex;align-items:center;width:100%;min-height:54px;box-sizing:border-box;padding:0;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;text-decoration:none;color:#0E1116;cursor:pointer';
/** Quick actions: groups of items in a bottom sheet over the details. */
export function QuickActions({ onClose, children, title = 'Quick actions' }: { onClose: () => void; children: ReactNode; title?: string }) {
  return (
    <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:6')}>
      <button onClick={onClose} aria-label="Close quick actions" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
      <div className="sheet" role="dialog" aria-label="Quick actions" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column')}>
        <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0;margin-bottom:12px')} />
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{title}</h2><button onClick={onClose} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button></div>
        {children}
      </div>
    </div>
  );
}
export const QaGroup = ({ first, children }: { first?: boolean; children: ReactNode }) => <div style={S('display:flex;flex-direction:column;padding:4px 0;' + (first ? '' : 'border-top:1px solid #EEF0F3'))}>{children}</div>;

export function VisitSheet(p: {
  onClose: () => void; title: string;
  /** The status chip (a button on the calendar, where it can be changed). */
  status: ReactNode;
  /** Small tags under the title, for example what was paid. */
  tags?: ReactNode;
  avatar: string; avatarStyle?: string; name: string; sub: string; clientAction?: ReactNode;
  /** A notice about the visit, shown under the client. */
  banner?: ReactNode;
  details: VisitDetail[]; lines: VisitLine[]; fallback?: string; extra?: [string, string][];
  total: string; label: string;
  /** A notice or error, pinned above the total. */
  message?: ReactNode;
  /** The buttons at the bottom. */
  actions: ReactNode;
}) {
  return (<>
    <div style={S('display:flex;justify-content:flex-end;margin-bottom:-8px')}><button onClick={p.onClose} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button></div>
    <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
      <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;min-width:0')}>{p.title}</h2>
      {p.status}
    </div>
    {p.tags}
    <div style={S('display:flex;align-items:center;gap:14px;padding:16px;border:1px solid #E6E8EC;border-radius:22px')}>
      <div style={S(p.avatarStyle ?? AVATAR)}>{p.avatar}</div>
      <div style={S('flex:1 1 auto;min-width:0')}>
        <div style={S('font-size:19px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{p.name}</div>
        <div style={S('margin-top:2px;font-size:13.5px;color:#5E6673;overflow-wrap:anywhere')}>{p.sub}</div>
      </div>
      {p.clientAction}
    </div>
    {p.banner}
    <div className="sum-rows" style={S('padding:2px 16px;border:1px solid #E6E8EC;border-radius:22px;background:#FFFFFF')}>
      {p.details.map((d) => (
        <div key={d.label} style={S('display:flex;align-items:center;gap:12px;padding:14px 0;font-size:15px')}>
          {d.photo ? <span aria-hidden="true" style={S('flex:0 0 28px;width:28px;height:28px;margin:-4px 0;border-radius:999px;background-size:cover;background-position:center;background-image:url(' + d.photo + ')')} /> : <Ico>{d.icon}</Ico>}
          <span style={S('min-width:0;overflow-wrap:anywhere')} aria-label={d.label}>{d.value}</span>
        </div>
      ))}
    </div>
    <div style={S('display:flex;flex-direction:column;gap:10px')}>
      <h3 style={S('margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Services</h3>
      {p.lines.map((l) => (
        <div key={l.key} style={S('display:flex;align-items:center;gap:12px')}>
          <span style={S('flex:0 0 4px;align-self:stretch;min-height:28px;border-radius:999px;background:#B9AEFB')} />
          <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{l.name}</span>{!!l.sub && <span style={S('display:block;font-size:13px;color:#5E6673')}>{l.sub}</span>}</span>
          <span style={S('flex:0 0 auto;font-size:14.5px;font-weight:500')}>{l.price}</span>
        </div>
      ))}
      {!p.lines.length && !!p.fallback && <div style={S('font-size:14.5px;color:#4A525E')}>{p.fallback}</div>}
    </div>
    {!!p.extra?.length && (
      <div className="sum-rows" style={S('padding:2px 16px;border:1px solid #E6E8EC;border-radius:22px')}>
        {p.extra.map(([l, v]) => <div key={l} style={S('display:flex;justify-content:space-between;gap:12px;padding:13px 0;font-size:15px')}><span style={S('color:#5E6673;overflow-wrap:anywhere')}>{l}</span><span style={S('font-weight:500;white-space:nowrap')}>{v}</span></div>)}
      </div>
    )}
    <div style={S('position:sticky;bottom:-40px;margin:auto -20px -40px;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px')}>
      {p.message}
      <div>
        <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px')}><span style={S('color:#5E6673;font-size:14px')}>Total</span><span style={S('color:#5E6673;font-size:16px')}>{p.total}</span></div>
        <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:2px')}><span style={S('font-size:15px;font-weight:600')}>{p.label}</span><span style={S('font-size:22px;font-weight:600;letter-spacing:-0.02em')}>{p.total}</span></div>
      </div>
      {p.actions}
    </div>
  </>);
}
