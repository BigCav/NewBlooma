export type WlRow = {
  id: string; name: string; initials: string; service: string; prefs: string; meta: string; status: 'Waiting' | 'Offered' | 'Booked'; offer: string; clientFirst: string;
};
export type WlSlot = { staffId: string; startsAt: string; label: string };
export const DAY_PREFS: [string, string][] = [['any', 'Any day'], ['weekdays', 'Weekdays'], ['sat', 'Saturday']];
export const WINDOWS: [string, string][] = [['any', 'Any time'], ['am', 'Morning'], ['pm', 'Afternoon']];
export const STATUS: Record<WlRow['status'], [string, string]> = { Waiting: ['#FFEBD0', '#7A4204'], Offered: ['#ECE8FF', '#3B2BB5'], Booked: ['#DDF3EA', '#14624A'] };
export const initialsOf = (n: string) => n.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2);
