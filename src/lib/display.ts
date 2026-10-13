/** Display helpers shared by the public pages. Safe to import from client and server code. */

/** Minutes after midnight to a 12-hour clock, matching the dashboard: 14:05 becomes "2:05pm". */
export const clock12 = (mins: number) => {
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
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
