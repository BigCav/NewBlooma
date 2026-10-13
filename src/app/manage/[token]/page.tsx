import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ymd, minutesOfDay } from '@/lib/format';
import { ManageView } from './ManageView';
import { CANCEL_HOURS, policyInfo } from './shared';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your appointment' };

export default async function Manage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = supabaseAdmin();
  const { data: t } = await sb.from('booking_tokens').select('booking_id,expires_at').eq('token', token).eq('purpose', 'manage_booking').maybeSingle();
  if (!t || new Date(t.expires_at) < new Date()) return <div className="auth"><div className="card"><h1>Link expired</h1><p className="muted">Please contact the salon to manage your appointment.</p></div></div>;
  const { data: b } = await sb.from('bookings').select('starts_at,ends_at,status,salon_id,staff(name),booking_services(price_cents,duration_min,services(name))').eq('id', t.booking_id!).single();
  if (!b) notFound();
  const [{ data: salon }, { data: st }, { data: hrs }] = await Promise.all([
    sb.from('salons').select('name,slug,address,timezone,currency').eq('id', b.salon_id).single(),
    sb.from('salon_settings').select('free_cancel_before').eq('salon_id', b.salon_id).single(),
    sb.from('opening_hours').select('weekday,is_open,open_time,close_time').eq('salon_id', b.salon_id),
  ]);
  const tz = salon!.timezone;
  const hours = Array.from({ length: 7 }, (_, i) => {
    const h = (hrs ?? []).find((x: any) => x.weekday === i) as any;
    return h && h.is_open ? { from: String(h.open_time).slice(0, 5), to: String(h.close_time).slice(0, 5) } : null;
  });
  const items = (b.booking_services as any[]).map((x) => ({ name: x.services.name as string, dur: x.duration_min as number, cents: x.price_cents as number }));
  const canAct = ['pending', 'confirmed'].includes(b.status) && new Date(b.starts_at) > new Date();
  const pol = policyInfo(b.starts_at, tz, CANCEL_HOURS[st!.free_cancel_before] ?? 24);
  return <ManageView token={token} salonName={salon!.name} slug={salon!.slug} address={salon!.address ?? ''} currency={salon!.currency || 'NZD'} staffName={(b as any).staff?.name ?? ''} status={b.status}
    items={items} startYmd={ymd(b.starts_at, tz)} startMin={minutesOfDay(b.starts_at, tz)} canAct={canAct} free={pol.free} deadline={pol.deadline} hours={hours} today={ymd(new Date(), tz)} />;
}
