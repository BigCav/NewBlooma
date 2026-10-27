export function money(cents: number, currency = 'NZD') {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(cents / 100);
}
/** 12-hour time like "2:00pm" in the salon's timezone. */
export function time12(iso: string | Date, tz: string) {
  const s = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz }).format(new Date(iso));
  return s.replace(' AM', 'am').replace(' PM', 'pm').replace(':00', ':00');
}
export function dateLong(iso: string | Date, tz: string) {
  return new Intl.DateTimeFormat('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }).format(new Date(iso));
}
/** yyyy-mm-dd of an instant in the given timezone. */
export function ymd(iso: string | Date, tz: string) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz }).format(new Date(iso));
}
export function toCents(v: FormDataEntryValue | null) {
  const t = String(v ?? '').replace(/[^0-9.]/g, '');
  if (!/^\d*\.?\d*$/.test(t) || !/\d/.test(t)) return 0;
  // Worked out from the digits, not by multiplying, so 1.005 is 101 cents and never 100.49999.
  const [whole = '', frac = ''] = t.split('.');
  const f = (frac + '000').slice(0, 3);
  return Number(whole || 0) * 100 + Number(f.slice(0, 2)) + (Number(f[2]) >= 5 ? 1 : 0);
}
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Convert a wall-clock date + time in `tz` to a UTC Date. */
export function zonedToUtc(date: string, time: string, tz: string) {
  const guess = new Date(`${date}T${time.length === 5 ? time + ':00' : time}Z`);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const offsetAt = (at: Date) => {
    const parts = fmt.formatToParts(at);
    const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - at.getTime();
  };
  // The offset must be read at the answer, not at the guess, or the two days a year the clocks change come out an hour wrong.
  const first = new Date(guess.getTime() - offsetAt(guess));
  return new Date(guess.getTime() - offsetAt(first));
}
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function minutesOfDay(iso: string | Date, tz: string) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso));
  return Number(p.find((x) => x.type === 'hour')!.value) * 60 + Number(p.find((x) => x.type === 'minute')!.value);
}
export const STATUS_LABEL: Record<string, string> = { pending: 'Needs approval', confirmed: 'Confirmed', checked_in: 'Checked in', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };
