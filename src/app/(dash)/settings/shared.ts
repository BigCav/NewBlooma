export type Values = {
  bizName: string; bizPhone: string; bizEmail: string; bizAddress: string;
  hours: { open: boolean; from: string; to: string }[];
  online: boolean; window: string; notice: string; confirm: string; cancel: string;
  card: boolean; cash: boolean; gift: boolean; tips: boolean; tipDefault: string; tax: string;
  confirmEmail: boolean; remind24: boolean; remind2: boolean; newBooking: boolean; cancelled: boolean;
};
export const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function validate(v: Values): { section: string; error: string } | null {
  if (!v.bizName.trim()) return { section: 'business', error: 'Add your business name.' };
  if (!/\S+@\S+\.\S+/.test(v.bizEmail)) return { section: 'business', error: 'Add a valid business email.' };
  const tax = parseFloat(v.tax);
  if (isNaN(tax) || tax < 0 || tax > 30) return { section: 'payments', error: 'Enter a sales tax rate between 0 and 30.' };
  for (let i = 0; i < 7; i++) if (!v.hours[i].from || !v.hours[i].to || v.hours[i].to <= v.hours[i].from) return { section: 'hours', error: `${DAY_FULL[i]}: closing time must be after opening time.` };
  return null;
}
