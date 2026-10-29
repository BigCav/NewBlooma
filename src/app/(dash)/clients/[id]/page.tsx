import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/session';
import { emailConfigured, smsConfigured } from '@/lib/notify';
import { minutesOfDay, time12, ymd } from '@/lib/format';
import { fmtClock, fmtDay, loadOverview } from '../data';
import { dayInfo } from '@/lib/cal';
import { sinceText } from '../shared';
import { niceDate } from '@/lib/forms-shared';
import { ProfileView, type ProfileData } from './ProfileView';

export const metadata = { title: 'Client' };
export const dynamic = 'force-dynamic';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const METHOD: Record<string, string> = { card: 'Card', cash: 'Cash', gift_card: 'Gift card' };

export default async function ClientProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const { sb, salon } = ctx;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tz = salon.timezone, today = ymd(new Date(), tz);
  const [{ data: c }, ov, { data: notes }, { data: hist }, { data: allBk }, { data: sls }, { data: subs }] = await Promise.all([
    sb.from('clients').select('id,name,email,phone,created_at,allergies,patch_test_on,colour_formula,reminders,marketing').eq('id', id).maybeSingle(),
    loadOverview(ctx),
    sb.from('client_notes').select('id,body').eq('client_id', id).order('created_at'),
    sb.from('bookings').select('id,ref_no,starts_at,staff(name),booking_services(price_cents,services(name)),sales(status,method,total_cents)').eq('client_id', id).eq('status', 'completed').order('starts_at', { ascending: false }).limit(200),
    sb.from('bookings').select('id,ref_no,starts_at,ends_at,status,staff(name),booking_services(price_cents,services(name))').eq('client_id', id).order('starts_at', { ascending: false }).limit(200),
    sb.from('sales').select('id,status,method,total_cents,created_at,paid_at,booking_id,sale_items(label)').eq('client_id', id).order('created_at', { ascending: false }).limit(100),
    sb.from('form_submissions').select('id,answers,flagged,performed_on,completed_at,form_templates(name),bookings(ref_no)').eq('client_id', id).order('completed_at', { ascending: false }).limit(30),
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
      id: b.id, ref: 'B-' + b.ref_no, date: fmtDay(b.starts_at, tz, today), service: lines.map((l) => l.services?.name).filter(Boolean).join(' + ') || 'Visit', staff: staffFirst, cents,
      when: `${wd} ${D} ${MON[M - 1]}, ${fmtClock(b.starts_at, tz)}`, paid: sale ? `${METHOD[sale.method] ?? 'Paid'}, $${(sale.total_cents / 100).toFixed(sale.total_cents % 100 ? 2 : 0)}` : 'Not recorded',
    };
  });
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const nowIso = new Date().toISOString();
  const money0 = (c: number) => '$' + (c / 100).toFixed(c % 100 ? 2 : 0);
  const saleOf = new Map<string, any>();
  for (const x of (sls ?? []) as any[]) { if (x.booking_id && x.status !== 'refunded' && !saleOf.has(x.booking_id)) saleOf.set(x.booking_id, x); }
  const visits: (ProfileData['appts'][number] & { at: string })[] = ((allBk ?? []) as any[]).map((b) => {
    const lines = (b.booking_services ?? []) as any[];
    const d = ymd(b.starts_at, tz), [Y, M] = d.split('-').map(Number);
    const sale = saleOf.get(b.id);
    const pay = sale ? (sale.status === 'paid' ? `Paid ${money0(sale.total_cents)} by ${String(METHOD[sale.method] ?? 'card').toLowerCase()}` : 'Awaiting payment') : '';
    return {
      at: b.starts_at as string, id: b.id as string, href: `/calendar?d=${d}&b=${b.id}`, month: MONTHS[M - 1] + (d.slice(0, 4) !== today.slice(0, 4) ? ' ' + Y : ''), label: dayInfo(d).short, time: fmtClock(b.starts_at, tz) + ' – ' + fmtClock(b.ends_at, tz),
      status: b.status as string, staff: String(b.staff?.name ?? '').split(' ')[0], services: lines.map((l) => l.services?.name).filter(Boolean).join(' + ') || 'Visit', cents: lines.reduce((a, l) => a + l.price_cents, 0), pay,
      upcoming: ['pending', 'confirmed', 'checked_in', 'in_progress'].includes(b.status) && b.ends_at >= nowIso,
    };
  });
  // Sales that were not made from a booking (walk-ins, retail) sit in the same list.
  for (const x of ((sls ?? []) as any[]).filter((y) => !y.booking_id)) {
    const when = (x.paid_at ?? x.created_at) as string, d = ymd(when, tz), [Y, M] = d.split('-').map(Number);
    visits.push({
      at: when, id: x.id as string, href: `/sales?sale=${x.id}`, month: MONTHS[M - 1] + (d.slice(0, 4) !== today.slice(0, 4) ? ' ' + Y : ''), label: dayInfo(d).short, time: fmtClock(when, tz),
      status: x.status === 'paid' ? 'completed' : x.status === 'refunded' ? 'refunded' : 'pending', staff: '', services: ((x.sale_items ?? []) as any[]).map((i) => i.label).join(' + ') || 'Sale', cents: x.total_cents as number,
      pay: x.status === 'paid' ? `Paid by ${String(METHOD[x.method] ?? 'card').toLowerCase()}` : x.status === 'pending' ? 'Awaiting payment' : '', upcoming: false,
    });
  }
  visits.sort((a, b) => (a.at < b.at ? 1 : -1));
  const appts: ProfileData['appts'] = visits.map(({ at, ...rest }) => rest);
  const data: ProfileData = {
    row, since: sinceText(c.created_at), allergies: c.allergies ?? [], patchOn: c.patch_test_on, formula: c.colour_formula ?? '', reminders: c.reminders, marketing: c.marketing,
    notes: (notes ?? []).map((n) => ({ id: n.id, text: n.body })), history, appts,
    forms: ((subs ?? []) as any[]).map((s) => ({ id: s.id, name: s.form_templates?.name ?? 'Form', date: (s.performed_on ? `Applied ${niceDate(s.performed_on)} · recorded ` : '') + `${niceDate(ymd(s.completed_at, tz))}, ${time12(s.completed_at, tz)}` + (s.bookings?.ref_no ? ' · booking B-' + s.bookings.ref_no : ''), flagged: !!s.flagged, answers: ((s.answers ?? []) as { q: string; a: string }[]).map((a) => ({ k: a.q, v: a.a || 'No answer' })) })), historyTotal: row.visits, today, channels: { sms: smsConfigured(), email: emailConfigured() },
  };
  return <ProfileView key={id} data={data} />;
}
