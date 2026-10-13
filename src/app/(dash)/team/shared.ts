export type TeamRow = {
  id: string; name: string; role: string; cats: string[]; days: number[]; shift: string | null; online: boolean;
  cells: string[]; todayOn: boolean; todayLabel: string;
};
export type ShiftPreset = { id: string; label: string; short: string; from: string; to: string };
export const SHIFTS: ShiftPreset[] = [
  { id: '8-17', label: '8:00 to 17:00', short: '8–17', from: '08:00', to: '17:00' },
  { id: '9-17', label: '9:00 to 17:00', short: '9–17', from: '09:00', to: '17:00' },
  { id: '10-18', label: '10:00 to 18:00', short: '10–18', from: '10:00', to: '18:00' },
  { id: '9-13', label: '9:00 to 13:00', short: '9–13', from: '09:00', to: '13:00' },
];
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const FILTERS = [{ id: 'all', label: 'All team' }, { id: 'today', label: 'Working today' }, { id: 'online', label: 'Bookable online' }];
export const initialsOf = (n: string) => n.split(' ').filter((w) => /[A-Za-z0-9]/.test(w[0] ?? '')).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'T';
const hm = (t: string) => { const [h, m] = t.split(':').map(Number); return { h, m }; };
export const clock24 = (t: string) => { const { h, m } = hm(t); return `${h}:${String(m).padStart(2, '0')}`; };
export const shortRange = (a: string, b: string) => { const f = (t: string) => { const { h, m } = hm(t); return m ? `${h}:${String(m).padStart(2, '0')}` : String(h); }; return `${f(a)}–${f(b)}`; };
