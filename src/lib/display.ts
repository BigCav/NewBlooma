/** Display helpers shared by the public pages. Safe to import from client and server code. */

/** Minutes after midnight to a 12-hour clock, matching the dashboard: 14:05 becomes "2:05pm". */
export const clock12 = (mins: number) => {
  const t = Math.round(mins), h = Math.floor(t / 60) % 24, m = t % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
};

/** "HH:MM" (as stored for opening hours) to the same 12-hour style. */
export const clockStr = (hhmm: string) => clock12(Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)));

/** Currency formatter that shows whole amounts as "$90" and anything else with two decimals as "$25.50". */
export const makeMoney = (currency: string) => {
  const opts = { style: 'currency', currency, currencyDisplay: 'narrowSymbol' } as const;
  const whole = new Intl.NumberFormat('en-NZ', { ...opts, minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const exact = new Intl.NumberFormat('en-NZ', { ...opts, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (cents: number) => (cents % 100 ? exact : whole).format(cents / 100);
};

/** "2:00pm to 3:30pm": a time range is always written with "to". */
export const timeRange = (a: string, b: string) => `${a} to ${b}`;

/** How long something takes, the same everywhere: 45 min, 1 hr, 1 hr 30 min. */
export const duration = (mins: number) => {
  const t = Math.max(0, Math.round(mins)), h = Math.floor(t / 60), m = t % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} hr` : `${h} hr ${m} min`;
};

/** "1 client", "2 clients". Pass the plural when it is not just an s ("person", "people"). */
export const plural = (n: number, word: string, pluralWord = word + 's') => `${n} ${n === 1 ? word : pluralWord}`;

/** The reference people quote for a booking: B-1048. */
export const bookingRef = (n: number | string | null | undefined) => (n == null || n === '' ? '' : `B-${n}`);
/** What someone typed into a search box as a booking number ("B-1048", "b1048", "#1048") reduced to the digits. */
export const refDigits = (q: string) => q.trim().replace(/^(b-?|#)/i, '');
