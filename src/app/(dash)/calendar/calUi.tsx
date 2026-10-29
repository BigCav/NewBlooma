import { type CalBlock, type CalBooking, type CalHours, type CalService, type CalSettings, type CalStaff } from '@/lib/cal';
export const HATCH = 'repeating-linear-gradient(135deg,#F7F8FA 0,#F7F8FA 8px,#ECEEF2 8px,#ECEEF2 16px)';
export const first = (n: string) => n.split(' ')[0];
export const usd = (c: number) => '$' + (Math.round(c) / 100).toLocaleString('en-US', { minimumFractionDigits: Math.round(c) % 100 ? 2 : 0, maximumFractionDigits: 2 });
export const m2 = (c: number) => '$' + (Math.round(c) / 100).toLocaleString('en-US', { minimumFractionDigits: Math.round(c) % 100 ? 2 : 0, maximumFractionDigits: 2 });
export const BLOCK_DURS_M: [number, string][] = [[30, '30 min'], [60, '1 hour'], [120, '2 hours'], [180, '3 hours'], [-1, 'All day']];
export const METHODS: [string, string][] = [['card', 'Card'], ['cash', 'Cash'], ['gift_card', 'Gift card']];
export const TIP_OPTS: [number, string][] = [[0, 'No tip'], [10, '10%'], [15, '15%'], [20, '20%']];
export const STEP = 30;

export const chipTone: Record<string, { t: string; bg: string; fg: string }> = {
  live: { t: 'In progress', bg: '#5B3DF5', fg: '#FFFFFF' }, confirmed: { t: 'Confirmed', bg: '#DDF3EA', fg: '#14624A' }, done: { t: 'Done', bg: '#EEF0F3', fg: '#4A525E' },
  pending: { t: 'Awaiting confirmation', bg: '#FFEBD0', fg: '#7A4204' },
};
export const kindOf = (s: CalBooking['status']) => (s === 'checked_in' || s === 'in_progress' ? 'live' : s === 'completed' ? 'done' : s === 'pending' ? 'pending' : 'confirmed');
export const chip = (on: boolean, off = false) => 'flex:0 0 auto;height:44px;padding:0 16px;border-radius:999px;font-size:14px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : (off ? '#F4F5F7' : '#FFFFFF')) + ';color:' + (on ? '#FFFFFF' : (off ? '#8A93A0' : '#0E1116')) + (off ? ';cursor:default' : '');
export const slotCss = (on: boolean, why: boolean) => 'width:100%;height:44px;padding:0;border-radius:14px;font-size:14px;font-weight:500;font-family:inherit;border:1px solid ' + (on ? '#0E1116' : (why ? '#EEF0F3' : '#E1E4E9')) + ';background:' + (on ? '#0E1116' : (why ? '#F4F5F7' : '#FFFFFF')) + ';color:' + (on ? '#FFFFFF' : (why ? '#8A93A0' : '#0E1116')) + (why ? ';text-decoration:line-through;cursor:default' : '');
export const dayCss = (on: boolean, closed: boolean) => 'flex:0 0 60px;height:76px;box-sizing:border-box;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:inherit;border:1px solid ' + (on ? '#0E1116' : '#E6E8EC') + ';background:' + (on ? '#0E1116' : (closed ? '#F4F5F7' : '#FFFFFF')) + ';color:' + (on ? '#FFFFFF' : (closed ? '#8A93A0' : '#0E1116')) + (closed ? ';cursor:default' : '');
export const note = (bg: string, fg: string) => 'border-radius:16px;background:' + bg + ';color:' + fg + ';padding:12px 14px;font-size:13.5px;font-weight:500';
export const PRIMARY = 'flex:1 1 0;height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;cursor:pointer';
export const SECOND = 'flex:1 1 0;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500;cursor:pointer';
export const CLOSE_BTN = 'flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer';
export const H2S = 'margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em';
export const ERR = 'margin:0;color:#B42318;font-size:13.5px;font-weight:500';
export const DLROW = 'display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3';

export function CloseX({ sw = 1.9 }: { sw?: number }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth={sw} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;
}
export const Mag = ({ size, color }: { size: number; color: string }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;

export type Avail = { key: string; busy: { s: number; e: number }[]; open: boolean; from: number; to: number } | null;
export type Props = {
  day: string; today: string; view: 'day' | 'week'; nowMin: number; team: CalStaff[]; bookings: CalBooking[]; blocks: CalBlock[]; hours: CalHours[]; services: CalService[];
  /** Days the salon is closed (date to reason), on top of the weekly hours. */
  closed?: Record<string, string>;
  offers: Record<string, string[]>; cfg: CalSettings; slug: string; tz: string; recent: { id: string; name: string }[]; initialNew?: boolean; initialClient?: string; initialSel?: string; staffFilter: string; remoteSearch?: boolean;
  /** Set when the new-appointment sheet is opened from another page: called instead of staying on the calendar. */
  onCreated?: (r: { id?: string; day: string }) => void;
};

