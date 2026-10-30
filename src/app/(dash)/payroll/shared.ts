export type Cell = { day: string; txt: string; kind: 'done' | 'today' | 'plan' };
export type PayRow = {
  id: string; name: string; role: string; photo: string | null; cells: Cell[]; total: string; planned: string; inSince: string | null; canClock: boolean;
  svc: number; prod: number; tips: number; rate: number; prodPct: number; commission: number; paid: boolean;
};
export const hrs = (h: number) => (Math.round(h * 10) / 10) + 'h';
export const dollars0 = (cents: number) => '$' + Math.round(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
