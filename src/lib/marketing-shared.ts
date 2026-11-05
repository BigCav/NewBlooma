// What marketing messages are made of, shared by the owner's screen and the sender. No server-only code in here.
export const DEFAULT_WINBACK = 'Hi {first}, it has been a while since your last visit and we would love to see you again. You can book online any time.';
export const DEFAULT_BIRTHDAY = 'Happy birthday {first}! We hope you have a lovely day. Treat yourself to something special this month, we would love to see you.';

/** {first} becomes the client's first name and {salon} the salon's name. */
export const fillTokens = (text: string, v: { first: string; salon: string }) => text.replace(/\{first\}/gi, v.first).replace(/\{salon\}/gi, v.salon);

export type AudienceKind = 'all' | 'lapsed' | 'regulars' | 'new' | 'birthday' | 'service';
export const AUDIENCES: { id: AudienceKind; label: string; n?: { label: string; options: [number, string][] } }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'lapsed', label: 'Not been in for a while', n: { label: 'Last visit was more than', options: [[4, '4 weeks ago'], [8, '8 weeks ago'], [12, '12 weeks ago'], [26, '6 months ago'], [52, 'a year ago']] } },
  { id: 'regulars', label: 'Regulars', n: { label: 'Has visited at least', options: [[3, '3 times'], [5, '5 times'], [10, '10 times']] } },
  { id: 'new', label: 'New clients (one visit so far)' },
  { id: 'birthday', label: 'Birthday this month' },
  { id: 'service', label: 'Has had a particular service' },
];
export const BROADCAST_MAX = 200;
export const SUBJECT_MAX = 100;
export const TEXT_MAX = 500;

/** The day and month of a birthday as "MM-DD" (stored in the year 2000), or '' for none. */
export function birthdayParts(b: string | null | undefined): { month: number; day: number } | null {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(b ?? '');
  return m ? { month: Number(m[1]), day: Number(m[2]) } : null;
}
/** "MM-DD" from the profile's two pickers, or null when it is not a real day of the year (30 February, say). 29 February counts. */
export function birthdayDate(month: number, day: number): string | null {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) return null;
  const d = new Date(Date.UTC(2000, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `2000-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
