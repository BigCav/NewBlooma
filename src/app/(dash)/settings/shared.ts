import { checkPhone } from '@/lib/phone';
export type Values = {
  bizName: string; bizPhone: string; bizEmail: string; bizAddress: string; slug: string;
  hours: { open: boolean; from: string; to: string }[];
  online: boolean; window: string; notice: string; confirm: string; cancel: string;
  card: boolean; cash: boolean; gift: boolean; tips: boolean; tipDefault: string; tax: string;
  confirmEmail: boolean; remind24: boolean; remind2: boolean; newBooking: boolean; cancelled: boolean;
};
export type Closed = { id: string; from: string; to: string; reason: string };
export const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function validate(v: Values): { section: string; error: string } | null {
  if (!v.bizName.trim()) return { section: 'business', error: 'Add your business name.' };
  if (!/\S+@\S+\.\S+/.test(v.bizEmail)) return { section: 'business', error: 'Add a valid business email.' };
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(v.slug)) return { section: 'business', error: 'Your booking page address needs 3 to 40 letters, numbers or dashes, and cannot start or end with a dash.' };
  if (v.slug.includes('--')) return { section: 'business', error: 'Use single dashes in your booking page address.' };
  const ph = checkPhone(v.bizPhone); if (ph.error) return { section: 'business', error: ph.error };
  if (!v.card && !v.cash && !v.gift) return { section: 'payments', error: 'Keep at least one payment method on so you can take payment at checkout.' };
  const tax = parseFloat(v.tax);
  if (isNaN(tax) || tax < 0 || tax > 30) return { section: 'payments', error: 'Enter a sales tax rate between 0 and 30.' };
  for (let i = 0; i < 7; i++) if (!v.hours[i].from || !v.hours[i].to || v.hours[i].to <= v.hours[i].from) return { section: 'hours', error: `${DAY_FULL[i]}: closing time must be after opening time.` };
  return null;
}
export const SECTIONS = [
  { id: 'business', label: 'Business details', desc: 'Name, contact and address' },
  { id: 'hours', label: 'Opening hours', desc: 'When the salon is open' },
  { id: 'booking', label: 'Online booking', desc: 'Booking rules for clients' },
  { id: 'payments', label: 'Payments', desc: 'Methods, tips and tax' },
  { id: 'notifications', label: 'Notifications', desc: 'Emails and reminders' },
  { id: 'appearance', label: 'Appearance', desc: 'Light or night mode' },
];
export const GROUPS: Record<string, [string, string][]> = {
  window: [['1w', '1 week'], ['2w', '2 weeks'], ['4w', '4 weeks'], ['8w', '8 weeks']],
  notice: [['none', 'None'], ['1h', '1 hour'], ['2h', '2 hours'], ['24h', '24 hours']],
  confirm: [['auto', 'Instant'], ['manual', 'Manual approval']],
  cancel: [['2h', '2 hours before'], ['24h', '24 hours before'], ['48h', '48 hours before']],
  tipDefault: [['0', 'No default'], ['10', '10%'], ['15', '15%'], ['20', '20%']],
};
