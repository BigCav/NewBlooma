import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/session';
import { emailConfigured, smsConfigured } from '@/lib/notify';
import { dollars, time12, ymd } from '@/lib/format';
import { fmtClock, fmtDay, loadOverview } from '../data';
import { MONTHS_FULL, dayInfo } from '@/lib/cal';
import { bookingRef, timeRange } from '@/lib/display';
import { firstName } from '@/lib/people';
import { sinceText } from '../shared';
import { niceDate } from '@/lib/forms-shared';
import { ProfileView, type ProfileData } from './ProfileView';
import { loadThread } from '../thread';

export const metadata = { title: 'Client' };
export const dynamic = 'force-dynamic';

const METHOD: Record<string, string> = { card: 'Card', cash: 'Cash', gift_card: 'Gift card', package: 'Package' };

export default async function ClientProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireCtx();
  const { sb, salon } = ctx;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tz = salon.timezone, today = ymd(new Date(), tz);
  const [{ data: c }, ov, { data: notes }, { data: allBk }, { data: sls }, { data: subs }] = await Promise.all([
    sb.from('clients').select('id,name,email,phone,created_at,allergies,patch_test_on,colour_formula,reminders,marketing').eq('id', id).maybeSingle(),
    loadOverview(ctx),
    sb.from('client_notes').select('id,body').eq('client_id', id).order('created_at'),
    sb.from('bookings').select('id,ref_no,starts_at,ends_at,status,staff(name),booking_services(price_cents,services(name))').eq('client_id', id).order('starts_at', { ascending: false }).limit(200),
    sb.from('sales').select('id,status,method,total_cents,created_at,paid_at,booking_id,sale_items(label)').eq('client_id', id).order('created_at', { ascending: false }).limit(100),
    sb.from('form_submissions').select('id,answers,flagged,performed_on,completed_at,form_templates(name),bookings(ref_no)').eq('client_id', id).order('completed_at', { ascending: false }).limit(30),
  ]);
  if (!c) notFound();
  const row = ov.rows.find((r) => r.id === id)!;
  // Every conversation with this client, in time order.
  const messages = await loadThread(sb, id, tz);
  const MONTHS = MONTHS_FULL;
  const nowIso = new Date().toISOString();
  const saleOf = new Map<string, any>();
  for (const x of (sls ?? []) as any[]) { if (x.booking_id && x.status !== 'refunded' && !saleOf.has(x.booking_id)) saleOf.set(x.booking_id, x); }
  const visits: (ProfileData['appts'][number] & { at: string })[] = ((allBk ?? []) as any[]).map((b) => {
    const lines = (b.booking_services ?? []) as any[];
    const d = ymd(b.starts_at, tz), [Y, M] = d.split('-').map(Number);
    const sale = saleOf.get(b.id);
    const pay = sale ? (sale.status === 'paid' ? `Paid ${dollars(sale.total_cents)} by ${String(METHOD[sale.method] ?? 'card').toLowerCase()}` : 'Awaiting payment') : '';
    return {
      at: b.starts_at as string, id: b.id as string, href: `/calendar?d=${d}&b=${b.id}`, month: MONTHS[M - 1] + (d.slice(0, 4) !== today.slice(0, 4) ? ' ' + Y : ''), label: dayInfo(d).short, time: timeRange(fmtClock(b.starts_at, tz), fmtClock(b.ends_at, tz)),
      status: b.status as string, staff: firstName(b.staff?.name, ''), services: lines.map((l) => l.services?.name).filter(Boolean).join(' + ') || 'Visit', cents: lines.reduce((a, l) => a + l.price_cents, 0), pay,
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
    notes: (notes ?? []).map((n) => ({ id: n.id, text: n.body })), appts, messages,
    forms: ((subs ?? []) as any[]).map((s) => ({ id: s.id, name: s.form_templates?.name ?? 'Form', date: (s.performed_on ? `Applied ${niceDate(s.performed_on)} · recorded ` : '') + `${niceDate(ymd(s.completed_at, tz))}, ${time12(s.completed_at, tz)}` + (s.bookings?.ref_no ? ' · ' + bookingRef(s.bookings.ref_no) : ''), flagged: !!s.flagged, answers: ((s.answers ?? []) as { q: string; a: string }[]).map((a) => ({ k: a.q, v: a.a || 'No answer' })) })), today, channels: { sms: smsConfigured(), email: emailConfigured() },
  };
  return <ProfileView key={id} data={data} initial={sp.v} />;
}
