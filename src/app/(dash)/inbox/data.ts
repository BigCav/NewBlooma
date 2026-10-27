import { time12, ymd } from '@/lib/format';
import type { Ctx } from '@/lib/session';
import { fmtClock, fmtDay } from '../clients/data';
import type { InboxItem, ItemStatus, ItemType } from './shared';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (iso: string, tz: string) => time12(iso, tz);
const addDay = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400e3).toISOString().slice(0, 10);
/** Today: the time. Yesterday: "Yesterday". Older: the date. */
export function stamp(iso: string, tz: string, today: string) {
  const d = ymd(iso, tz);
  if (d === today) return hhmm(iso, tz);
  if (d === addDay(today, -1)) return 'Yesterday';
  const [Y, M, D] = d.split('-').map(Number);
  return `${D} ${MON[M - 1]}` + (String(Y) !== today.slice(0, 4) ? ' ' + Y : '');
}
const dur = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m / 60} hr`);
const dayLabel = (iso: string, tz: string, today: string) => {
  const d = ymd(iso, tz);
  if (d === today) return 'Today';
  const [, M, D] = d.split('-').map(Number);
  return `${WD[new Date(`${d}T00:00:00Z`).getUTCDay()]} ${D} ${MON[M - 1]}`;
};

export async function loadInbox(ctx: Pick<Ctx, 'sb' | 'salon'>): Promise<InboxItem[]> {
  const { sb, salon } = ctx, tz = salon.timezone, today = ymd(new Date(), tz);
  const { data } = await sb.from('inbox_items')
    .select('id,type,body,unread,status,created_at,client_id,booking_id,clients(name,email),bookings(ref_no,status,starts_at,ends_at,notes,staff(name),booking_services(price_cents,duration_min,services(name)))')
    .order('created_at', { ascending: false }).limit(500);
  const ids = (data ?? []).filter((i: any) => i.type === 'message').map((i: any) => i.id);
  const { data: msgs } = ids.length ? await sb.from('inbox_messages').select('item_id,mine,body,created_at').in('item_id', ids).order('created_at') : { data: [] as any[] };
  return ((data ?? []) as any[]).map((i): InboxItem => {
    // A client who moves their own booking has already changed it: that is news to read, not a request to action.
    const moved = i.type === 'reschedule' && i.status === 'handled' && String(i.body ?? '').startsWith('Moved by the client');
    const type = (moved ? 'rescheduled' : i.type) as ItemType, b = i.bookings, client = i.clients?.name ?? 'Client';
    const lines = (b?.booking_services ?? []) as any[];
    const svc = lines.map((l) => l.services?.name).filter(Boolean).join(' + ') || 'Appointment';
    const mins = lines.reduce((a, l) => a + l.duration_min, 0), cents = lines.reduce((a, l) => a + l.price_cents, 0);
    const staffFull = b?.staff?.name ?? '', staffFirst = staffFull.split(' ')[0];
    const when = b ? `${dayLabel(b.starts_at, tz, today)}, ${fmtClock(b.starts_at, tz)}` : '';
    const range = b ? `${when} to ${fmtClock(b.ends_at, tz)}` : '';
    const price = '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
    const svcDur = `${svc}, ${dur(mins)}`;
    const status: ItemStatus = i.status === 'new' ? 'new' : i.status === 'declined' ? 'declined' : type === 'request' ? 'accepted' : 'done';
    let summary = '', rows: [string, string][] = [], note = '';
    if (type === 'request') { summary = `${svc} with ${staffFirst}, ${when}`; rows = [['Service', svcDur], ['When', range], ['With', staffFull], ['Price', price]]; note = b?.notes ?? ''; }
    else if (type === 'booking') { summary = `Booked ${svc} online`; rows = [['Service', svcDur], ['When', range], ['With', staffFull], ['Price', price]]; note = b?.notes ?? ''; }
    else if (type === 'reschedule') { summary = `Wants to move ${svc} with ${staffFirst}`; rows = [['Service', svcDur], ['Now', when], ['With', staffFull]]; note = i.body ?? ''; }
    else if (type === 'rescheduled') { summary = `Moved ${svc} with ${staffFirst}`; rows = [['Service', svcDur], ['Now', range], ['With', staffFull]]; note = i.body ?? ''; }
    else if (type === 'cancellation') { summary = `Cancelled ${svc} with ${staffFirst}`; rows = [['Service', svcDur], ['Was', when], ['With', staffFull]]; if (b && new Date(b.starts_at) > new Date()) rows.push(['Slot', 'Free again']); }
    if (b?.ref_no && rows.length) rows.unshift(['Booking', 'B-' + b.ref_no]);
    const thread = type === 'message' ? [
      ...(i.body ? [{ mine: false, text: i.body as string, at: stamp(i.created_at, tz, today) }] : []),
      ...((msgs ?? []) as any[]).filter((m) => m.item_id === i.id).map((m) => ({ mine: m.mine as boolean, text: m.body as string, at: stamp(m.created_at, tz, today) })),
    ] : [];
    if (type === 'message') summary = (thread.filter((m) => !m.mine).pop()?.text ?? thread[0]?.text ?? 'Message').slice(0, 120);
    const cancelled = ['booking', 'request', 'reschedule', 'rescheduled'].includes(type) && ['cancelled', 'no_show'].includes(b?.status) && i.status !== 'declined';
    return { id: i.id, type, client, email: i.clients?.email ?? '', time: stamp(i.created_at, tz, today), unread: i.unread, status, cancelled, summary, rows, note, thread, calendarDay: b ? ymd(b.starts_at, tz) : null, clientId: i.client_id ?? null, bookingId: b && i.booking_id && !['cancelled', 'no_show'].includes(b.status) ? i.booking_id : null };
  });
}
export { fmtDay };
