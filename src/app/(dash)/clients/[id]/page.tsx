import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/session';
import { emailConfigured, smsConfigured } from '@/lib/notify';
import { minutesOfDay, ymd } from '@/lib/format';
import { fmtClock, fmtDay, loadOverview } from '../data';
import { sinceText } from '../shared';
import { ProfileView, type ProfileData } from './ProfileView';

export const metadata = { title: 'Client' };
export const dynamic = 'force-dynamic';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const METHOD: Record<string, string> = { card: 'Card', cash: 'Cash', gift_card: 'Gift card' };
const SHOWN = 6;
/** First name and last initial, so two people called Sarah can be told apart. */
const shortName = (n: string) => { const p = n.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]; };

export default async function ClientProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const { sb, salon } = ctx;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tz = salon.timezone, today = ymd(new Date(), tz);
  const [{ data: c }, ov, { data: notes }, { data: hist }] = await Promise.all([
    sb.from('clients').select('id,name,email,phone,created_at,allergies,patch_test_on,colour_formula,reminders,marketing').eq('id', id).maybeSingle(),
    loadOverview(ctx),
    sb.from('client_notes').select('id,body').eq('client_id', id).order('created_at'),
    sb.from('bookings').select('id,starts_at,staff(name),booking_services(price_cents,services(name)),sales(status,method,total_cents)').eq('client_id', id).eq('status', 'completed').order('starts_at', { ascending: false }).limit(SHOWN),
  ]);
  if (!c) notFound();
  const row = ov.rows.find((r) => r.id === id)!;
  const history: ProfileData['history'] = ((hist ?? []) as any[]).map((b) => {
    const lines = (b.booking_services ?? []) as any[];
    const sale = ((b.sales ?? []) as any[]).find((s) => s.status === 'paid');
    const cents = sale ? sale.total_cents : lines.reduce((a, l) => a + l.price_cents, 0);
    const d = ymd(b.starts_at, tz), [Y, M, D] = d.split('-').map(Number);
    const wd = WD[new Date(`${d}T00:00:00Z`).getUTCDay()];
    const staffFirst = String(b.staff?.name ?? '').split(' ')[0];
    return {
      id: b.id, date: fmtDay(b.starts_at, tz, today), service: lines.map((l) => l.services?.name).filter(Boolean).join(' + ') || 'Visit', staff: staffFirst, cents,
      when: `${wd} ${D} ${MON[M - 1]}, ${fmtClock(b.starts_at, tz)}`, paid: sale ? `${METHOD[sale.method] ?? 'Paid'}, $${(sale.total_cents / 100).toFixed(sale.total_cents % 100 ? 2 : 0)}` : 'Not recorded',
    };
  });
  const switcher = ov.rows.slice(0, 12).map((r) => ({ id: r.id, label: shortName(r.name) }));
  if (!switcher.some((s) => s.id === id)) switcher.push({ id, label: shortName(c.name) });
  const data: ProfileData = {
    row, since: sinceText(c.created_at), allergies: c.allergies ?? [], patchOn: c.patch_test_on, formula: c.colour_formula ?? '', reminders: c.reminders, marketing: c.marketing,
    notes: (notes ?? []).map((n) => ({ id: n.id, text: n.body })), history, historyTotal: row.visits, switcher, today, channels: { sms: smsConfigured(), email: emailConfigured() },
  };
  return <ProfileView key={id} data={data} />;
}
