'use client';
// The bottom sheet every page uses on a phone (and, inside the right-hand drawer, on a computer): a dimmed backdrop and a white sheet with a grab handle.
import type { ReactNode } from 'react';
import { S } from '@/app/(dash)/calendar/pickers';

export function BottomSheet({ label, onClose, backdropLabel = 'Close', z = 5, fixed = false, maxHeight = '92%', gap = 16, handleGap = 0, handle = true, bg = '#FFFFFF', extraStyle = '', children }: {
  /** The sheet's name for a screen reader. */
  label: string;
  /** Pressing the dimmed backdrop. */
  onClose: () => void;
  backdropLabel?: string; z?: number; maxHeight?: string; gap?: number;
  /** Over the whole window (a global menu) instead of over its drawer. */
  fixed?: boolean;
  /** Space under the grab handle in px, for sheets that do not space their content with a gap. */
  handleGap?: number;
  /** False when the content draws its own handle. */
  handle?: boolean; bg?: string;
  /** More style for the sheet itself, such as the font when it sits outside the page's own. */
  extraStyle?: string; children: ReactNode;
}) {
  return (
    <div style={S('position:' + (fixed ? 'fixed' : 'absolute') + ';left:0;right:0;top:0;bottom:0;z-index:' + z)}>
      <button onClick={onClose} aria-label={backdropLabel} style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
      <div className="sheet" role="dialog" aria-label={label} style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:' + maxHeight + ';overflow-y:auto;background:' + bg + ';border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:' + gap + 'px' + (extraStyle ? ';' + extraStyle : ''))}>
        {handle && <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0' + (handleGap ? ';margin-bottom:' + handleGap + 'px' : ''))} />}
        {children}
      </div>
    </div>
  );
}
