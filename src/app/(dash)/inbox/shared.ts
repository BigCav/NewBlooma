import type { ToneName } from '@/lib/tones';
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
export const TYPES: Record<ItemType, { label: string; tone: ToneName }> = {
  request: { label: 'Booking request', tone: 'blue' },
  reschedule: { label: 'Reschedule request', tone: 'purple' },
  rescheduled: { label: 'Rescheduled', tone: 'purple' },
  message: { label: 'Message', tone: 'green' },
  cancellation: { label: 'Cancellation', tone: 'amber' },
  booking: { label: 'New booking', tone: 'grey' },
};
/** What a handled item says. An accepted request is stored as 'accepted' and shown as "Approved". */
export const STATUS: Record<Exclude<ItemStatus, 'new'>, { t: string; tone: ToneName }> = {
  accepted: { t: 'Approved', tone: 'green' },
  declined: { t: 'Declined', tone: 'red' },
  done: { t: 'Done', tone: 'grey' },
};
export const REASONS = ['Not available then', 'Fully booked', 'Something else'];
export const FILTERS = [{ id: 'all', label: 'All' }, { id: 'action', label: 'Needs action' }, { id: 'message', label: 'Messages' }, { id: 'cancellation', label: 'Cancellations' }];
/** Only a booking request has Approve / Decline buttons, so only a request that is still open "needs action" (a reschedule request is read, then marked done). */
export const needsAction = (i: Pick<InboxItem, 'type' | 'status' | 'cancelled'>) => i.type === 'request' && i.status === 'new' && !i.cancelled;
/** Nothing to approve or decline: shown so you know what happened. */
export const isInfo = (t: ItemType) => t === 'booking' || t === 'cancellation' || t === 'rescheduled';
