import type { ToneName } from '@/lib/tones';

export type WlRow = {
  id: string; name: string; service: string; prefs: string; meta: string; status: 'Waiting' | 'Offered' | 'Booked'; offer: string; clientFirst: string;
};
export type WlSlot = { staffId: string; startsAt: string; label: string };
export const DAY_PREFS: [string, string][] = [['any', 'Any day'], ['weekdays', 'Weekdays'], ['sat', 'Saturday']];
export const WINDOWS: [string, string][] = [['any', 'Any time'], ['am', 'Morning'], ['pm', 'Afternoon']];
export const STATUS: Record<WlRow['status'], ToneName> = { Waiting: 'amber', Offered: 'purple', Booked: 'green' };
