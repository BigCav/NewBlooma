// The small pieces every screen is built from, defined once: round icon buttons, the two big buttons, the menu row, the borderless
// input that sits inside a labelled box, and the icons they hold. A screen that needs a variant adds to the string, it does not copy it.
import type { ReactNode } from 'react';
import { S } from '@/app/(dash)/calendar/pickers';
import { TONE, type ToneName } from '@/lib/tones';
import { initialsOf } from '@/lib/people';

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

/* ---------- People ---------- */
/** The sizes an avatar comes in (circle px, initials px). Pick a name; do not invent a size. */
export const AVATAR_SIZES = { xs: [28, 11], sm: [36, 13], md: [40, 13], lg: [48, 15], xl: [52, 16], xxl: [72, 22], hero: [112, 34] } as const;
export type AvatarSize = keyof typeof AVATAR_SIZES;
/** A person's avatar is always the brand purple: colour is for status, and the status chip beside it carries that. */
const AVATAR_TONE = TONE.purple;
export const avatarCss = (size: AvatarSize = 'md', tone: { bg: string; fg: string } = AVATAR_TONE) => {
  const [px, fs] = AVATAR_SIZES[size];
  return `flex:0 0 ${px}px;width:${px}px;height:${px}px;border-radius:999px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:${fs}px;font-weight:600;background:${tone.bg};color:${tone.fg}`;
};
/** Someone's circle: their photo if they have one, otherwise their initials. Looks the same wherever the person appears. */
export function Avatar({ name, photo, size = 'md', icon, tone, label }: { name: string; photo?: string | null; size?: AvatarSize; icon?: ReactNode; tone?: { bg: string; fg: string }; label?: string }) {
  return (
    <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={S(avatarCss(size, tone))}>
      {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : icon ?? initialsOf(name)}
    </span>
  );
}

/* ---------- Chips and notices ---------- */
const CHIP_SIZE = { xs: '2px 8px;font-size:11.5px', md: '4px 12px;font-size:12.5px', lg: '8px 16px;font-size:14px' } as const;
/** The style of a status chip, for the few places that still build a style string. */
export const chipCss = (tone: ToneName = 'grey', size: keyof typeof CHIP_SIZE = 'md') =>
  `flex:0 0 auto;display:inline-block;border-radius:999px;font-weight:500;white-space:nowrap;padding:${CHIP_SIZE[size]};background:${TONE[tone].bg};color:${TONE[tone].fg}`;
/** A status label (Paid, Pending, Cancelled...). The same meaning is the same colour and size on every screen. */
export function Chip({ tone = 'grey', size = 'md', children }: { tone?: ToneName; size?: keyof typeof CHIP_SIZE; children: ReactNode }) {
  return <span style={S(chipCss(tone, size))}>{children}</span>;
}
/** A short message after something happened ("Saved", "Reply sent"). Shown under the thing that changed. */
export function Notice({ tone = 'green', children }: { tone?: 'green' | 'red' | 'blue'; children: ReactNode }) {
  return <p role={tone === 'red' ? 'alert' : 'status'} style={S(`margin:0;align-self:flex-start;display:inline-block;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:500;background:${TONE[tone].bg};color:${TONE[tone].fg}`)}>{children}</p>;
}
/** A problem with a form or action, in red under the field or above the buttons. */
export function FieldError({ children }: { children: ReactNode }) {
  return <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{children}</p>;
}

/** The choice chips along the top of a list (All, Paid, Pending...). 44px on a phone, 40px on a computer. */
export const filterChipCss = (on: boolean, phone = false) =>
  `flex:0 0 auto;box-sizing:border-box;height:${phone ? 44 : 40}px;padding:0 16px;border-radius:999px;font:inherit;font-size:${phone ? 14 : 13.5}px;font-weight:500;cursor:pointer;white-space:nowrap;border:1px solid ${on ? '#0E1116' : '#E1E4E9'};background:${on ? '#0E1116' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#0E1116'}`;
export function FilterChip({ on, phone, onClick, children }: { on: boolean; phone?: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} aria-pressed={on} style={S(filterChipCss(on, phone))}>{children}</button>;
}

/* ---------- Buttons and switches ---------- */
/** A destructive big button (Remove, Delete): the black button's red twin. */
export const DANGER = 'flex:1 1 0;height:52px;box-sizing:border-box;border:0;border-radius:999px;background:#B42318;color:#FFFFFF;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none';
/** Fades a button that cannot be pressed (the stylesheet resets opacity on dashboard buttons, so it is set here). */
export const dim = (off: boolean) => (off ? ';opacity:.5;cursor:default' : '');

/** An on/off switch. Give it the id of the text that names it. */
export function Switch({ on, onToggle, labelledBy, label }: { on: boolean; onToggle: () => void; labelledBy?: string; label?: string }) {
  return (
    <button role="switch" aria-checked={on} aria-labelledby={labelledBy} aria-label={label} onClick={onToggle} style={S('position:relative;flex:0 0 52px;width:52px;height:32px;padding:0;border:0;border-radius:999px;cursor:pointer;background:' + (on ? '#0E1116' : '#D5D9E0'))}>
      <span style={S('position:absolute;top:3px;left:' + (on ? 23 : 3) + 'px;width:26px;height:26px;border-radius:999px;background:#FFFFFF')} />
    </button>
  );
}
/** A settings line: a title (and a note) on the left, a switch on the right. */
export function SwitchRow({ id, title, sub, on, toggle, last }: { id: string; title: string; sub?: string; on: boolean; toggle: () => void; last?: boolean }) {
  return (
    <div style={S('display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:' + (last ? '0' : '1px solid #EEF0F3'))}>
      <div style={S('min-width:0')}><div id={id} style={S('font-size:15px;font-weight:500')}>{title}</div>{sub && <div style={S('margin-top:2px;font-size:13px;color:#5E6673')}>{sub}</div>}</div>
      <Switch on={on} onToggle={toggle} labelledBy={id} />
    </div>
  );
}
