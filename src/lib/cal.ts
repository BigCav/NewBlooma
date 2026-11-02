// Shared calendar helpers (pure, safe for client and server).
export type Tone = { bg: string; fg: string; dot: string };
export const TONE_LIST: Tone[] = [
  { bg: '#EEEAFE', fg: '#3A2BB5', dot: '#7A64FF' }, // hair
  { bg: '#E9F0FF', fg: '#1B4A8A', dot: '#4C93F0' }, // barber
  { bg: '#DDF3EA', fg: '#14624A', dot: '#2FB985' }, // nails
  { bg: '#FFEBD0', fg: '#7A4204', dot: '#F0A044' }, // colour
];
const KEYS: [RegExp, number][] = [[/hair|cut|style|blow/i, 0], [/barber|beard|shave/i, 1], [/nail|mani|pedi/i, 2], [/colou?r|tint|foil|balayage/i, 3]];
export function toneFor(category: string | null | undefined, index = 0): Tone {
  if (category) for (const [re, i] of KEYS) if (re.test(category)) return TONE_LIST[i];
  return TONE_LIST[index % TONE_LIST.length];
}
export function fmtMin(m: number) {
  const h = Math.floor(m / 60), mm = Math.round(m % 60);
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')}${h % 24 < 12 ? 'am' : 'pm'}`;
}
export function hourLabel(h: number) { return `${((h + 11) % 12) + 1}:00${h < 12 ? 'am' : 'pm'}`; }
export function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join(''); }

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export type DayInfo = { ymd: string; weekday: string; abbr: string; num: number; month: string; short: string; full: string; wd: number /* 0=Mon */ };
export function dayInfo(ymd: string): DayInfo {
  const d = new Date(`${ymd}T00:00:00Z`);
  const w = WD[d.getUTCDay()], mo = MO[d.getUTCMonth()], n = d.getUTCDate();
  return { ymd, weekday: w, abbr: w.slice(0, 3), num: n, month: mo, short: `${w.slice(0, 3)} ${n} ${mo.slice(0, 3)}`, full: `${w} ${n} ${mo}`, wd: (d.getUTCDay() + 6) % 7 };
}
export function addDaysYmd(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function weekStartOf(ymd: string) { return addDaysYmd(ymd, -dayInfo(ymd).wd); }

export type CalStaff = { id: string; name: string; role: string; photo?: string | null };
export type CalBooking = {
  id: string; staffId: string; clientId: string; client: string; services: string; dayYmd: string; start: number; end: number;
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  priceCents: number; paid: boolean; refunded?: boolean; paidText: string; saleId: string | null; ref: number; serviceIds: string[]; tone: number; walkin: boolean; notes: string | null; forms?: { level: 'todo' | 'alert'; text: string } | null;
};
export type CalBlock = { id: string; staffId: string; dayYmd: string; start: number; end: number; kind: string; note: string | null };
export type CalService = { id: string; name: string; dur: number; priceCents: number; cat: string; addon?: boolean; parents?: string[] };
export type CalSettings = { taxRate: number; taxInclusive: boolean; askTip: boolean; tipDefault: number; acceptCard: boolean; acceptCash: boolean; acceptGift: boolean; canDiscount: boolean };
export type CalHours = { wd: number; open: boolean; from: number; to: number };
/** Why a booking is cancelled from the calendar. The first is the common case. */
export const CANCEL_REASONS = ['Client cancelled', 'Client unwell', 'Stylist unavailable', 'Salon closed', 'Double booked', 'Other'] as const;
export const BLOCK_KINDS: [string, string][] = [['lunch', 'Lunch'], ['break', 'Break'], ['time_off', 'Time off'], ['other', 'Other']];
export const BLOCK_DURS: [number, string][] = [[30, '30 min'], [60, '1 hour'], [120, '2 hours'], [180, '3 hours']];
export const STEP = 30;
export function slotsBetween(from: number, to: number) { const a: number[] = []; for (let t = from; t + STEP <= to; t += STEP) a.push(t); return a; }

/**
 * Which services can be picked when a sale is changed at the till: an add-on needs one of its main services chosen, and someone has to offer it.
 * Shared by the calendar checkout and the Sales checkout so they always agree.
 */
export function serviceRules(services: CalService[], offers: Record<string, string[]>) {
  const map = new Map(services.map((s) => [s.id, s]));
  const offered = (sid: string, staffId: string) => { const sv = map.get(sid); return sv?.addon ? (sv.parents ?? []).some((pid) => (offers[pid] ?? []).includes(staffId)) : (offers[sid] ?? []).includes(staffId); };
  const hasProvider = (sid: string) => { const sv = map.get(sid); return sv?.addon ? (sv.parents ?? []).some((pid) => (offers[pid] ?? []).length > 0) : (offers[sid] ?? []).length > 0; };
  /** Why a service cannot be picked right now (empty when it can). */
  const lockFor = (chosen: string[]) => (x: CalService) => x.addon
    ? ((x.parents ?? []).some((pid) => chosen.includes(pid)) ? '' : 'add-on, choose its main service first')
    : (hasProvider(x.id) ? '' : 'no one offers this yet');
  /** Picking or dropping one: dropping a main service drops the add-ons that depended on it. */
  const toggle = (ids: string[], id: string) => {
    let next = ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id];
    next = next.filter((i) => { const sv = map.get(i); return !sv?.addon || (sv.parents ?? []).some((pid) => next.includes(pid)); });
    return next;
  };
  return { map, offered, hasProvider, lockFor, toggle };
}
