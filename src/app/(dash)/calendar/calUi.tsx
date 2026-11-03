import { TONE, type ToneName } from '@/lib/tones';
import { BLACK as PRIMARY, OUTLINE as SECOND, RING, CLOSE, Notice } from '@/components/ui';
export { PRIMARY, SECOND };
import { bookingStatus } from '@/lib/status';
import { duration, timeRange } from '@/lib/display';
import { S } from './pickers';
import type { CoPackage, CoProduct } from '../sales/shared';
import { fmtMin, type CalBlock, type CalBooking, type CalHours, type CalService, type CalSettings, type CalStaff } from '@/lib/cal';
export const HATCH = 'repeating-linear-gradient(135deg,#F7F8FA 0,#F7F8FA 8px,#ECEEF2 8px,#ECEEF2 16px)';
export const BLOCK_DURS_M: [number, string][] = [[30, duration(30)], [60, duration(60)], [120, duration(120)], [180, duration(180)], [-1, 'All day']];
export const METHODS: [string, string][] = [['card', 'Card'], ['cash', 'Cash'], ['gift_card', 'Gift card']];
export const TIP_OPTS: [number, string][] = [[0, 'No tip'], [10, '10%'], [15, '15%'], [20, '20%']];
export const STEP = 30;

/** @deprecated Status chips come from `bookingStatus()` in lib/status. Kept for one release so the inbox keeps compiling; it now reads that table. */
const kindStatus = { live: 'in_progress', confirmed: 'confirmed', done: 'completed', pending: 'pending' } as const;
export const chipTone: Record<string, { t: string; bg: string; fg: string }> = Object.fromEntries(
  Object.entries(kindStatus).map(([k, st]) => { const b = bookingStatus(st); return [k, { t: b.label, ...TONE[b.tone] }]; }),
);
/** A short text for a start and end in minutes: "2:00pm to 3:30pm". */
export const spanText = (a: number, b: number) => timeRange(fmtMin(a), fmtMin(b));
/** A note box in the colours of a tone (green good news, red a problem, purple a heads-up). */
export const noteTone = (t: ToneName) => note(TONE[t].bg, TONE[t].fg);
export const kindOf = (s: CalBooking['status']) => (s === 'checked_in' || s === 'in_progress' ? 'live' : s === 'completed' ? 'done' : s === 'pending' ? 'pending' : 'confirmed');
export const note = (bg: string, fg: string) => 'border-radius:16px;background:' + bg + ';color:' + fg + ';padding:12px 14px;font-size:13.5px;font-weight:500';
/** @deprecated Use RING from components/ui. */
export const CLOSE_BTN = RING;
export const H2S = 'margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em';
export const DLROW = 'display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3';

/** @deprecated Use CLOSE from components/ui. */
export function CloseX() { return CLOSE; }

/** A success message that can be dismissed: under the header on the calendar, or inside an open sheet. */
export function NoticeBar({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div style={S('display:flex;align-items:center;gap:4px;flex:0 0 auto')}>
      <Notice>{text}</Notice>
      <button onClick={onDismiss} aria-label="Dismiss message" style={S('flex:0 0 44px;width:44px;height:44px;border:0;border-radius:999px;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
    </div>
  );
}
export const Mag = ({ size, color }: { size: number; color: string }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;

/** A booking as the calendar page builds it: the usual fields plus what its sale came to (tip and discount included), for the refund. */
export type CalBk = CalBooking & { saleCents?: number };
export type Avail = { key: string; busy: { s: number; e: number }[]; open: boolean; from: number; to: number } | null;
export type Props = {
  day: string; today: string; view: 'day' | 'week'; nowMin: number; team: CalStaff[]; bookings: CalBk[]; blocks: CalBlock[]; hours: CalHours[]; services: CalService[];
  /** Days the salon is closed (date to reason), on top of the weekly hours. */
  closed?: Record<string, string>;
  offers: Record<string, string[]>; cfg: CalSettings; slug: string; tz: string; recent: { id: string; name: string; phone?: string }[]; products?: CoProduct[]; packages?: Record<string, CoPackage[]>; terminal?: boolean; initialNew?: boolean; initialClient?: string; initialSel?: string; staffFilter: string; remoteSearch?: boolean;
  /** Set when the new-appointment sheet is opened from another page: called instead of staying on the calendar. */
  onCreated?: (r: { id?: string; day: string }) => void;
};

