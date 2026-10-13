export type ItemType = 'request' | 'reschedule' | 'message' | 'cancellation' | 'booking';
export type ItemStatus = 'new' | 'accepted' | 'declined' | 'done';
export type InboxItem = {
  id: string; type: ItemType; client: string; email: string; time: string; unread: boolean; status: ItemStatus; summary: string;
  cancelled: boolean; rows: [string, string][]; note: string; thread: { mine: boolean; text: string; at: string }[]; calendarDay: string | null;
};
export const TYPES: Record<ItemType, { label: string; bg: string; fg: string }> = {
  request: { label: 'Booking request', bg: '#E9F0FF', fg: '#1B4A8A' },
  reschedule: { label: 'Reschedule request', bg: '#ECE8FF', fg: '#3B2BB5' },
  message: { label: 'Message', bg: '#DDF3EA', fg: '#14624A' },
  cancellation: { label: 'Cancellation', bg: '#FFEBD0', fg: '#7A4204' },
  booking: { label: 'New booking', bg: '#EEF0F3', fg: '#4A525E' },
};
export const STATUS: Record<Exclude<ItemStatus, 'new'>, { t: string; bg: string; fg: string }> = {
  accepted: { t: 'Accepted', bg: '#DDF3EA', fg: '#14624A' },
  declined: { t: 'Declined', bg: '#FCE3E3', fg: '#9B1C1C' },
  done: { t: 'Done', bg: '#EEF0F3', fg: '#4A525E' },
};
export const QUICK: Partial<Record<ItemType, string[]>> = {
  message: ['Yes, we can do that.', 'Let me check and get back to you.', 'Sorry, we cannot do that.'],
  cancellation: ['Thanks for letting us know. Would you like to rebook?', 'No problem, we hope to see you soon.'],
  reschedule: ['Yes, that works. See you then.', 'That time is not free. Could you pick another?'],
};
export const REASONS = ['Not available then', 'Fully booked', 'Something else'];
export const FILTERS = [{ id: 'all', label: 'All' }, { id: 'action', label: 'Needs action' }, { id: 'message', label: 'Messages' }, { id: 'cancellation', label: 'Cancellations' }];
export const isAction = (t: ItemType) => t === 'request' || t === 'reschedule';
export const initialsOf = (n: string) => n.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2);
