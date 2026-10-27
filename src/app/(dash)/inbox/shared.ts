export type ItemType = 'request' | 'reschedule' | 'rescheduled' | 'message' | 'cancellation' | 'booking';
export type ItemStatus = 'new' | 'accepted' | 'declined' | 'done';
export type InboxItem = {
  id: string; type: ItemType; client: string; email: string; time: string; unread: boolean; status: ItemStatus; summary: string;
  cancelled: boolean; rows: [string, string][]; note: string; thread: { mine: boolean; text: string; at: string }[]; calendarDay: string | null;
  clientId: string | null;
  /** Set while the booking is still on the calendar (not cancelled or a no-show), so "View in calendar" can open it. */
  bookingId: string | null;
};
export const TYPES: Record<ItemType, { label: string; bg: string; fg: string }> = {
  request: { label: 'Booking request', bg: '#E9F0FF', fg: '#1B4A8A' },
  reschedule: { label: 'Reschedule request', bg: '#ECE8FF', fg: '#3B2BB5' },
  rescheduled: { label: 'Rescheduled', bg: '#ECE8FF', fg: '#3B2BB5' },
  message: { label: 'Message', bg: '#DDF3EA', fg: '#14624A' },
  cancellation: { label: 'Cancellation', bg: '#FFEBD0', fg: '#7A4204' },
  booking: { label: 'New booking', bg: '#EEF0F3', fg: '#4A525E' },
};
export const STATUS: Record<Exclude<ItemStatus, 'new'>, { t: string; bg: string; fg: string }> = {
  accepted: { t: 'Accepted', bg: '#DDF3EA', fg: '#14624A' },
  declined: { t: 'Declined', bg: '#FCE3E3', fg: '#9B1C1C' },
  done: { t: 'Done', bg: '#EEF0F3', fg: '#4A525E' },
};
export const REASONS = ['Not available then', 'Fully booked', 'Something else'];
export const FILTERS = [{ id: 'all', label: 'All' }, { id: 'action', label: 'Needs action' }, { id: 'message', label: 'Messages' }, { id: 'cancellation', label: 'Cancellations' }];
export const isAction = (t: ItemType) => t === 'request' || t === 'reschedule';
/** Nothing to approve or decline: shown so you know what happened. */
export const isInfo = (t: ItemType) => t === 'booking' || t === 'cancellation' || t === 'rescheduled';
export const initialsOf = (n: string) => n.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2);
