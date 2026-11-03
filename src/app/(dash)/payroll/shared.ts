import { PAYMENT_STATUS } from '@/lib/status';
import { workedTime } from '@/lib/display';
import { TONE, type ToneName } from '@/lib/tones';

export type Cell = { day: string; txt: string; kind: 'done' | 'today' | 'plan' };
export type PayRow = {
  id: string; name: string; role: string; photo: string | null; cells: Cell[]; total: string; hours: number; planned: string; inSince: string | null; canClock: boolean;
  svc: number; prod: number; tips: number; rate: number; prodPct: number; commission: number; paid: boolean;
};
/** Hours worked, written the one way everywhere: 7hr 30m. */
export const hrs = (h: number) => workedTime(h * 60);
/** The colours of a day in the week grid. */
export const CELL = {
  done: `background:${TONE.grey.bg};color:#0E1116;font-weight:500`,
  today: `background:${TONE.purple.bg};color:${TONE.purple.fg};font-weight:600`,
  plan: 'background:#F4F5F7;color:#8A93A0',
};
/** Where a person's pay stands for the week on show: still pending, ready to pay, or paid. */
export const payTone = (over: boolean, paid: boolean): { label: string; tone: ToneName } =>
  !over ? { label: PAYMENT_STATUS.pending.label, tone: PAYMENT_STATUS.pending.tone } : paid ? { label: PAYMENT_STATUS.paid.label, tone: PAYMENT_STATUS.paid.tone } : { label: 'Ready to pay', tone: 'purple' };
