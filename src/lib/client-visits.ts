import 'server-only';
import { clock12, makeMoney } from '@/lib/display';
import { minutesOfDay, ymd } from '@/lib/format';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { BookingRow } from '@/app/b/[slug]/account/AccountView';

const STATUS: Record<string, string> = { pending: 'Awaiting confirmation', confirmed: 'Confirmed', checked_in: 'In progress', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled', no_show: 'Missed' };
const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDur = (m: number) => { const h = Math.floor(m / 60), r = m % 60; return h ? h + ' hr' + (r ? ' ' + r + ' min' : '') : m + ' min'; };

/** A signed-in customer's upcoming and past visits at one salon, matched through their email. Upcoming ones carry a manage link. */
export async function loadClientVisits(salon: { id: string; timezone: string; currency: string | null }, email: string): Promise<{ upcoming: BookingRow[]; past: BookingRow[] }> {
  const sb = supabaseAdmin();
  const tz = salon.timezone, money = makeMoney(salon.currency || 'NZD');
  const { data: cl } = await sb.from('clients').select('id').eq('salon_id', salon.id).ilike('email', email.replace(/[%_]/g, '\\$&')).maybeSingle();
  const { data: bks } = cl
    ? await sb.from('bookings').select('id,starts_at,status,staff(name),booking_services(price_cents,duration_min,service_id,services(name))').eq('client_id', cl.id).order('starts_at', { ascending: false }).limit(40)
    : { data: [] as any[] };
  const now = new Date();
  const live = (bks ?? []).filter((b: any) => ['pending', 'confirmed'].includes(b.status) && new Date(b.starts_at) > now);
  // Once the salon has checked a client in, the visit stays on the list but can no longer be changed or cancelled.
  const inProgress = (bks ?? []).filter((b: any) => ['checked_in', 'in_progress'].includes(b.status));
  // Each upcoming booking links to the same manage page the emails use; make a link if an older booking has none.
  const tokens = new Map<string, string>();
  if (live.length) {
    const { data: ts } = await sb.from('booking_tokens').select('booking_id,token,expires_at').eq('purpose', 'manage_booking').in('booking_id', live.map((b: any) => b.id));
    for (const t of ts ?? []) if (new Date(t.expires_at) > now) tokens.set(t.booking_id!, t.token);
    for (const b of live as any[]) {
      if (tokens.has(b.id)) continue;
      const { data: made } = await sb.from('booking_tokens').insert({ salon_id: salon.id, purpose: 'manage_booking', booking_id: b.id, expires_at: new Date(new Date(b.starts_at).getTime() + 30 * 864e5).toISOString() }).select('token').single();
      if (made) tokens.set(b.id, made.token);
    }
  }
  const liveIds = new Set(live.map((b: any) => b.id));
  const toRow = (b: any): BookingRow => {
    const [y, mo, da] = ymd(b.starts_at, tz).split('-').map(Number);
    const wd = new Date(Date.UTC(y, mo - 1, da)).getUTCDay();
    const items = (b.booking_services as any[]).map((x) => x.services?.name as string).filter(Boolean);
    const cents = (b.booking_services as any[]).reduce((a, x) => a + x.price_cents, 0), mins = (b.booking_services as any[]).reduce((a, x) => a + x.duration_min, 0);
    return {
      id: b.id, date: `${DAY[wd]} ${da} ${MON[mo - 1]}`, when: `${DAY[wd]} ${da} ${MON[mo - 1]}, ${clock12(minutesOfDay(b.starts_at, tz))}`, what: items.join(' + '), who: b.staff?.name ?? '',
      meta: `${fmtDur(mins)}, ${money(cents)}`, price: money(cents), status: STATUS[b.status] ?? b.status,
      manage: liveIds.has(b.id) && tokens.get(b.id) ? `/manage/${tokens.get(b.id)}` : null, again: (b.booking_services as any[]).find((x) => x.service_id)?.service_id ?? null,
    };
  };
  return { upcoming: [...inProgress.slice().reverse(), ...live.slice().reverse()].map(toRow), past: (bks ?? []).filter((b: any) => b.status === 'completed').slice(0, 12).map(toRow) };
}
