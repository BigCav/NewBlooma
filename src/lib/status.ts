// What a booking's status is called and what colour it is, defined once. A booking is "Checked in" on the calendar card,
// in its own sheet, in the inbox and on the client's profile; nobody keeps a private list of labels.
import type { ToneName } from './tones';

export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: ToneName }> = {
  pending: { label: 'Needs approval', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'green' },
  checked_in: { label: 'Checked in', tone: 'live' },
  in_progress: { label: 'In progress', tone: 'live' },
  completed: { label: 'Completed', tone: 'grey' },
  cancelled: { label: 'Cancelled', tone: 'red' },
  no_show: { label: 'No-show', tone: 'red' },
};

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(Object.entries(BOOKING_STATUS).map(([k, v]) => [k, v.label]));

/** The chip for a booking status; an unknown status reads as grey with its own name. */
export const bookingStatus = (s: string): { label: string; tone: ToneName } => (BOOKING_STATUS as Record<string, { label: string; tone: ToneName }>)[s] ?? { label: s, tone: 'grey' };

/** Payment state of a sale or booking: Paid, Unpaid (waiting for money) and Refunded. */
export const PAYMENT_STATUS = {
  paid: { label: 'Paid', tone: 'green' },
  pending: { label: 'Pending', tone: 'amber' },
  refunded: { label: 'Refunded', tone: 'red' },
} as const satisfies Record<string, { label: string; tone: ToneName }>;
