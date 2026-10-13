export const CANCEL_HOURS: Record<string, number> = { '2h': 2, '24h': 24, '48h': 48 };
/** Whether free cancellation still applies to an appointment, and the last moment it does ("Tue 13 Oct, 10:30"). */
export function policyInfo(startIso: string, tz: string, hours: number) {
  const start = new Date(startIso).getTime();
  const free = Date.now() + hours * 3600e3 <= start;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(new Date(start - hours * 3600e3));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { free, deadline: `${g('weekday')} ${g('day')} ${g('month')}, ${g('hour')}:${g('minute')}${g('dayPeriod').toLowerCase().replace(/[.\s]/g, '')}` };
}
