import { clockStr, timeRange } from '@/lib/display';

export type TeamRow = {
  id: string; name: string; role: string; cats: string[]; days: number[]; shift: string | null; online: boolean;
  times: [string, string][]; cells: string[]; todayOn: boolean; todayLabel: string; photo: string | null;
  /** The salon owner (cannot be removed). */
  isOwner: boolean;
  /** Already has their own login. */
  linked: boolean;
};
/** "09:00", "17:00" as "9:00am to 5:00pm". */
export const shortRange = (a: string, b: string) => timeRange(clockStr(a), clockStr(b));
export type ShiftPreset = { id: string; label: string; from: string; to: string };
const preset = (id: string, from: string, to: string): ShiftPreset => ({ id, label: shortRange(from, to), from, to });
export const SHIFTS: ShiftPreset[] = [preset('8-17', '08:00', '17:00'), preset('9-17', '09:00', '17:00'), preset('10-18', '10:00', '18:00'), preset('9-13', '09:00', '13:00')];
/** Browser only: crop to a centred square, shrink to 480px and encode as JPEG so uploads stay small. */
export async function squarePhoto(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height), size = Math.min(480, side);
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  cv.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.85));
}
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const FILTERS = [{ id: 'all', label: 'All team' }, { id: 'today', label: 'Working today' }, { id: 'online', label: 'Bookable online' }];
