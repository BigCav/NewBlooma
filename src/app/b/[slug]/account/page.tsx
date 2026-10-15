import { notFound } from 'next/navigation';
import { currentClient } from '@/lib/client-auth';
import { clock12, makeMoney } from '@/lib/display';
import { minutesOfDay, ymd } from '@/lib/format';
import { getPublicSalon } from '@/lib/public';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AccountView, type BookingRow } from './AccountView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My bookings' };

const STATUS: Record<string, string> = { pending: 'Awaiting confirmation', confirmed: 'Confirmed', checked_in: 'In progress', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled', no_show: 'Missed' };
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getPublicSalon(slug);
  if (!d) notFound();
  const { salon } = d;
  const account = await currentClient(salon.id);
  if (!account) return <AccountView slug={slug} salon={salon.name} account={null} upcoming={[]} past={[]} />;

  const sb = supabaseAdmin();
  const tz = salon.timezone, money = makeMoney(salon.currency || 'NZD');
  const { data: cl } = await sb.from('clients').select('id').eq('salon_id', salon.id).ilike('email', account.email.replace(/[%_]/g, '\\$&')).maybeSingle();
  const { data: bks } = cl
    ? await sb.from('bookings').select('id,starts_at,status,staff(name),booking_services(price_cents,service_id,services(name))').eq('client_id', cl.id).order('starts_at', { ascending: false }).limit(40)
    : { data: [] as any[] };
  const now = new Date();
  const live = (bks ?? []).filter((b: any) => ['pending', 'confirmed'].includes(b.status) && new Date(b.starts_at) > now);

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
    return {
      id: b.id, when: `${DAY[wd]} ${da} ${MON[mo - 1]}, ${clock12(minutesOfDay(b.starts_at, tz))}`, services: items.join(' + '), staff: b.staff?.name ?? '',
      total: money((b.booking_services as any[]).reduce((a, x) => a + x.price_cents, 0)), status: STATUS[b.status] ?? b.status,
      manage: liveIds.has(b.id) && tokens.get(b.id) ? `/manage/${tokens.get(b.id)}` : null, again: (b.booking_services as any[]).find((x) => x.service_id)?.service_id ?? null,
    };
  };
  const upcoming = live.slice().reverse().map(toRow);
  const past = (bks ?? []).filter((b: any) => !liveIds.has(b.id)).slice(0, 12).map(toRow);
  return <AccountView slug={slug} salon={salon.name} account={{ name: account.name, email: account.email }} upcoming={upcoming} past={past} />;
}
