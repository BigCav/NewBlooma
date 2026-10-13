export const STEPS = ['Your salon', 'Services', 'Opening hours', 'Team', 'Ready'];
export const CATS = ['Hair', 'Colour', 'Nails', 'Barber', 'Brows & lashes', 'Massage', 'Skin'];
// Starter services offered for each category: [name, minutes, price in whole currency units].
export const STARTERS: Record<string, [string, number, number][]> = {
  'Hair': [['Cut & finish', 60, 85], ['Blow-dry', 45, 55]],
  'Colour': [['Full colour', 120, 220], ['Toner & gloss', 90, 95]],
  'Nails': [['Gel manicure', 60, 55], ['Pedicure', 75, 65]],
  'Barber': [['Fade', 30, 40], ['Beard trim', 30, 25]],
  'Brows & lashes': [['Brow shape', 30, 35], ['Lash lift', 60, 80]],
  'Massage': [['Relaxing massage', 60, 95], ['Deep tissue', 60, 110]],
  'Skin': [['Signature facial', 60, 100], ['Express facial', 30, 60]],
};
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const PRESETS: [string, string, string, string, string][] = [['std', 'Standard', '8:00 – 18:00', '08:00', '18:00'], ['early', 'Early', '7:00 – 15:00', '07:00', '15:00'], ['late', 'Late', '10:00 – 20:00', '10:00', '20:00']];
export const ROLES = ['Stylist', 'Barber', 'Nail tech', 'Colourist', 'Other'];
export type SetupInput = { name: string; phone: string; address: string; cats: string[]; preset: string; open: Record<string, boolean>; team: { name: string; role: string }[]; timezone: string };
export const slugOf = (n: string) => (n || 'your-salon').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'your-salon';
// Currency from the browser's time zone for the regions the product targets; Settings does not change it.
export function currencyFor(tz: string) {
  if (/^Pacific\/(Auckland|Chatham)/.test(tz)) return 'NZD';
  if (/^Australia\//.test(tz)) return 'AUD';
  if (/^Europe\/London|^Europe\/Belfast/.test(tz)) return 'GBP';
  if (/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina)/.test(tz)) return 'CAD';
  if (/^Europe\//.test(tz)) return 'EUR';
  return 'USD';
}
