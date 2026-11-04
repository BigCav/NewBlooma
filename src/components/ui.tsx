// The small pieces every screen is built from, defined once: round icon buttons, the two big buttons, the menu row, the borderless
// input that sits inside a labelled box, and the icons they hold. A screen that needs a variant adds to the string, it does not copy it.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { S } from '@/app/(dash)/calendar/s';
import { TONE, type ToneName } from '@/lib/tones';
import { initialsOf } from '@/lib/people';

/** A 44px round outlined button (back, close, three dots, message). */
export const RING = 'flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;padding:0';
/** The big black button and its outlined partner: 52px, sharing the row equally. */
export const BLACK = 'flex:1 1 0;height:52px;box-sizing:border-box;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none';
export const OUTLINE = 'flex:1 1 0;height:52px;box-sizing:border-box;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none';
/** Smaller pill buttons for toolbars, cards and forms: 48px inside a card, 44px for a page's main action, 40px beside other controls. */
const PILL = 'box-sizing:border-box;border-radius:999px;font:inherit;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;flex:0 0 auto';
const DARK = ';border:0;background:#0E1116;color:#FFFFFF';
const LIGHT = ';border:1px solid #E1E4E9;background:#FFFFFF;color:#0E1116';
export const BLACK_MD = PILL + ';height:48px;padding:0 18px;font-size:14.5px' + DARK;
export const OUTLINE_MD = PILL + ';height:48px;padding:0 18px;font-size:14.5px' + LIGHT;
export const BLACK_ACTION = PILL + ';height:44px;padding:0 20px;font-size:14px' + DARK;
export const BLACK_SM = PILL + ';height:40px;padding:0 16px;font-size:13.5px' + DARK;
export const OUTLINE_SM = PILL + ';height:40px;padding:0 16px;font-size:13.5px' + LIGHT;
/** A 40px round outlined button (previous / next arrows on a toolbar). */
export const RING_SM = 'flex:0 0 40px;width:40px;height:40px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0';
/** One row of a quick-actions menu. */
export const MENU_ROW = 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:58px;padding:0 4px;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;color:#0E1116;cursor:pointer;text-decoration:none';
/** The input inside a labelled box (the box draws the border). */
export const FIELD_IN = { ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), minHeight: 0, borderRadius: 0 } as const;
/** A text box that stands on its own (sign in, booking, setup, search): 48px tall, 14px corners, 16px text so phones do not zoom in. */
const BOX = 'box-sizing:border-box;width:100%;min-height:0;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:16px;color:#0E1116;background:#FFFFFF';
export const INPUT = BOX + ';height:48px;padding:0 14px';
/** The same for a longer answer. */
export const TEXTAREA = BOX + ';padding:12px 14px';
/** A time of day in a row of two (opens / closes). */
export const TIME_INPUT = INPUT + ';flex:1 1 0;min-width:0;padding:0 10px';
/** Add to an INPUT or TEXTAREA when its answer is wrong. */
export const INPUT_ERROR = ';border-color:#B42318';
/** A caption above a text box. */
export function LabelledField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div style={S('display:flex;flex-direction:column;gap:6px')}><label htmlFor={id} style={S('font-size:14px;font-weight:600')}>{label}</label>{children}</div>;
}
/** A password box with its Show / Hide button. The page keeps whether it is shown. */
export function PasswordInput({ id, value, onChange, show, onToggle, placeholder, autoComplete, onEnter }: {
  id: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder: string; autoComplete: 'current-password' | 'new-password'; onEnter?: () => void;
}) {
  return (
    <div style={S('position:relative')}>
      <input id={id} className="bkf" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onEnter ? (e) => { if (e.key === 'Enter') onEnter(); } : undefined} placeholder={placeholder} autoComplete={autoComplete} style={S(INPUT + ';padding-right:76px')} />
      <button type="button" onClick={onToggle} style={S('position:absolute;right:6px;top:4px;height:40px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:#5B3DF5;font-size:13.5px;font-weight:600')}>{show ? 'Hide' : 'Show'}</button>
    </div>
  );
}
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
/** A short message after something happened (fades by itself). */
export { Notice } from './Notice';
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

/** A figure with its caption above it (Appointments 12). `small` is the phone's size. */
export function Stat({ label, value, small }: { label: ReactNode; value: ReactNode; small?: boolean }) {
  return (
    <div>
      <div style={S('color:#5E6673;font-size:' + (small ? 13 : 13.5) + 'px')}>{label}</div>
      <div style={S('margin-top:' + (small ? 2 : 4) + 'px;font-size:' + (small ? 30 : 38) + 'px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{value}</div>
    </div>
  );
}

/** A figure on a white card, for the phone's row of numbers. `tint` turns it amber when something needs attention. */
export function StatCard({ label, value, tint }: { label: ReactNode; value: ReactNode; tint?: boolean }) {
  return (
    <div style={S('flex:1 1 0;min-width:0;box-sizing:border-box;padding:16px;border-radius:20px;border:1px solid ' + (tint ? '#F6D9A8' : '#E6E8EC') + ';background:' + (tint ? TONE.amber.bg : '#FFFFFF'))}>
      <div style={S('color:#5E6673;font-size:13px')}>{label}</div>
      <div style={S('margin-top:2px;font-size:28px;line-height:1.1;font-weight:500;letter-spacing:-0.03em;font-variant-numeric:tabular-nums')}>{value}</div>
    </div>
  );
}

/* ---------- Icons ---------- */
const ICON_PATH = { plus: 'M12 5v14M5 12h14', tick: 'M5 12.5 10 17.5 19 7.5', close: 'M6 6l12 12M18 6 6 18', next: 'M9.5 6l6 6-6 6', down: 'M6 9l6 6 6-6', mail: 'm4.5 7.5 7.5 5.5 7.5-5.5' } as const;
/** A line icon from the small set every screen draws the same way. Colour is any CSS colour; the default follows the text. */
export function Icon({ name, size = 16, color = 'currentColor', w = 2, style, decorative }: { name: keyof typeof ICON_PATH; size?: number; color?: string; w?: number; style?: React.CSSProperties; decorative?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden={decorative ? true : undefined}><path d={ICON_PATH[name]} /></svg>
  );
}

/* ---------- Boxes and rows ---------- */
/** A small white tile (a figure, a last-visit line). */
export const TILE = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:20px;padding:16px';
/** The white rounded box a phone list sits in. */
export const ROW_LIST = 'margin:0;padding:4px 0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px';
/** The white rounded box a computer's list sits in, beside its detail panel. */
export const DESK_LIST = 'flex:999 1 620px;min-width:0;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden';
/** A "label ... value" line in a list of facts. */
export const KV_ROW = 'display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3';
/** A short grey line: an explanation, or "nothing here yet". `inList` puts it inside a list box, under its rows. */
export function Note({ children, inList }: { children: ReactNode; inList?: boolean }) {
  return <p style={S('margin:0;color:#5E6673;font-size:14px' + (inList ? ';padding:24px 20px;border-top:1px solid #EEF0F3' : ''))}>{children}</p>;
}

/* ---------- Full-page screens (the phone's pages that slide over the current one) ---------- */
/** The screen itself: covers its parent, grey background. */
export const PAGE = "position:absolute;left:0;right:0;top:0;bottom:0;z-index:5;display:flex;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4";
/** The white strip of buttons pinned to the bottom of such a screen. */
export const BAR = 'flex:0 0 auto;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px';
/** A white card holding rows. */
export const CARD = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:4px 18px';
/** The top of such a screen: back button, optional person's circle, title (and a grey line under it), and any buttons on the right. */
export function ScreenHeader({ title, sub, onBack, backHref, backLabel = 'Back', avatar, photo, style, children }: {
  title: ReactNode; sub?: ReactNode; onBack?: () => void; backHref?: string; backLabel?: string; avatar?: string; photo?: string | null; style?: string; children?: ReactNode;
}) {
  return (
    <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px;border-bottom:1px solid #E6E8EC' + (style ? ';' + style : ''))}>
      {backHref ? <Link href={backHref} aria-label={backLabel} style={S(RING + ';text-decoration:none')}>{BACK}</Link> : onBack && <button onClick={onBack} aria-label={backLabel} style={S(RING)}>{BACK}</button>}
      {avatar && <Avatar name={avatar} photo={photo} size="sm" />}
      <div style={S('flex:1 1 auto;min-width:0')}>
        <div style={S('font-size:18px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{title}</div>
        {sub && <div style={S('font-size:13px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{sub}</div>}
      </div>
      {children}
    </header>
  );
}
/** A labelled box on a form: the caption on top, the input (FIELD_IN) inside. */
export function Field({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} style={S('display:block;box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{label}</span>{children}</label>;
}
/** The same box showing an answer instead of asking for one. */
export function AnswerBox({ label, children, muted }: { label: string; children: ReactNode; muted?: boolean }) {
  return (
    <div style={S('box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}>
      <div style={S('font-size:12.5px;color:#5E6673;overflow-wrap:anywhere')}>{label}</div>
      <div style={S('margin-top:3px;font-size:16px;overflow-wrap:anywhere;' + (muted ? 'color:#8A93A0;font-weight:400' : 'font-weight:600'))}>{children}</div>
    </div>
  );
}
