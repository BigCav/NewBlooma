// The small pieces every screen is built from, defined once: round icon buttons, the two big buttons, the menu row, the borderless
// input that sits inside a labelled box, and the icons they hold. A screen that needs a variant adds to the string, it does not copy it.
import { S } from '@/app/(dash)/calendar/pickers';

/** A 44px round outlined button (back, close, three dots, message). */
export const RING = 'flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;padding:0';
/** The big black button and its outlined partner: 52px, sharing the row equally. */
export const BLACK = 'flex:1 1 0;height:52px;box-sizing:border-box;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none';
export const OUTLINE = 'flex:1 1 0;height:52px;box-sizing:border-box;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none';
/** One row of a quick-actions menu. */
export const MENU_ROW = 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:58px;padding:0 4px;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;color:#0E1116;cursor:pointer;text-decoration:none';
/** The input inside a labelled box (the box draws the border). */
export const FIELD_IN = { ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), minHeight: 0, borderRadius: 0 } as const;
/** The same, filling the space beside an icon or a button. */
export const BARE = { ...S('flex:1 1 auto;min-width:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), padding: 0, minHeight: 0, width: 'auto', borderRadius: 0 } as const;

export const BACK = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6l-6 6 6 6" /></svg>;
export const CLOSE = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const DOTS = <svg width="20" height="20" viewBox="0 0 24 24" fill="#0E1116"><circle cx="12" cy="5.5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="18.5" r="1.6" /></svg>;
export const SEND = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
/** The arrow at the end of a row that opens something. */
export const CHEV = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }} aria-hidden="true"><path d="M9.5 6l6 6-6 6" /></svg>;
