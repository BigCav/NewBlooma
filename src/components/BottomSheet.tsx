'use client';
// The sheet every page uses on a phone (and, inside the right-hand drawer, on a computer): a dimmed backdrop and a white page-sized sheet.
// The stylesheet makes every .sheet a full page, so the size, corner and grab-handle props below are accepted (callers still pass them) but ignored.
import type { ReactNode } from 'react';
import { S } from '@/app/(dash)/calendar/pickers';

export function BottomSheet({ label, onClose, backdropLabel = 'Close', z = 5, fixed = false, gap = 16, bg = '#FFFFFF', extraStyle = '', children }: {
  /** The sheet's name for a screen reader. */
  label: string;
  /** Pressing the dimmed backdrop. */
  onClose: () => void;
  /** Only the backdrop's own name; it is hidden from screen readers (the sheet's own Close button is the one they get). */
  backdropLabel?: string; z?: number; gap?: number;
  /** Over the whole window (a global menu) instead of over its drawer. */
  fixed?: boolean;
  bg?: string;
  /** More style for the sheet itself, such as the font when it sits outside the page's own. */
  extraStyle?: string; children: ReactNode;
  /** IGNORED (the stylesheet fixes the sheet to a full page). Kept so existing callers compile. */
  maxHeight?: string;
  /** IGNORED (no grab handle is drawn). Kept so existing callers compile. */
  handle?: boolean;
  /** IGNORED (no grab handle is drawn). Kept so existing callers compile. */
  handleGap?: number;
}) {
  return (
    <div style={S('position:' + (fixed ? 'fixed' : 'absolute') + ';left:0;right:0;top:0;bottom:0;z-index:' + z)}>
      {/* Click-to-close only: hidden from the accessibility tree and the tab order so the sheet exposes ONE Close. */}
      <button type="button" data-close="" onClick={onClose} aria-label={backdropLabel} aria-hidden="true" tabIndex={-1} style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;overflow-y:auto;background:' + bg + ';display:flex;flex-direction:column;gap:' + gap + 'px' + (extraStyle ? ';' + extraStyle : ''))}>
        {children}
      </div>
    </div>
  );
}
