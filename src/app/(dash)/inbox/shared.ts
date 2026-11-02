import { TONE } from '@/lib/tones';
export type ItemType = 'request' | 'reschedule' | 'rescheduled' | 'message' | 'cancellation' | 'booking';
export type ItemStatus = 'new' | 'accepted' | 'declined' | 'done';
/** The booking a message or request is about: what the quick view shows. */
export type InboxBooking = {
  id: string; ref: string; status: string; day: string; time: string; staff: string; photo: string | null;
  lines: { key: string; name: string; dur: string; price: string }[]; total: string; label: string;
  paid: boolean; refunded: boolean; paidText: string; clientId: string | null;
  /** Still on the calendar (not cancelled or a no-show), so it can be opened there. */
  calendarHref: string | null;
};
export type InboxItem = {
  id: string; type: ItemType; client: string; email: string; time: string; unread: boolean; status: ItemStatus; summary: string;
  cancelled: boolean; rows: [string, string][]; note: string; thread: { mine: boolean; text: string; at: string }[]; calendarDay: string | null;
  clientId: string | null;
  booking: InboxBooking | null;
  /** Set while the booking is still on the calendar (not cancelled or a no-show), so "View in calendar" can open it. */
  bookingId: string | null;
};
export const TYPES: Record<ItemType, { label: string; bg: string; fg: string }> = {
  request: { label: 'Booking request', ...TONE.blue },
  reschedule: { label: 'Reschedule request', ...TONE.purple },
  rescheduled: { label: 'Rescheduled', ...TONE.purple },
  message: { label: 'Message', ...TONE.green },
  cancellation: { label: 'Cancellation', ...TONE.amber },
  booking: { label: 'New booking', ...TONE.grey },
};
export const STATUS: Record<Exclude<ItemStatus, 'new'>, { t: string; bg: string; fg: string }> = {
  accepted: { t: 'Accepted', ...TONE.green },
  declined: { t: 'Declined', ...TONE.red },
  done: { t: 'Done', ...TONE.grey },
};
export const REASONS = ['Not available then', 'Fully booked', 'Something else'];
export const FILTERS = [{ id: 'all', label: 'All' }, { id: 'action', label: 'Needs action' }, { id: 'message', label: 'Messages' }, { id: 'cancellation', label: 'Cancellations' }];
export const isAction = (t: ItemType) => t === 'request' || t === 'reschedule';
/** Nothing to approve or decline: shown so you know what happened. */
export const isInfo = (t: ItemType) => t === 'booking' || t === 'cancellation' || t === 'rescheduled';
export const initialsOf = (n: string) => n.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2);
