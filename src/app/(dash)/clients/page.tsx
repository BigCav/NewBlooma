import { requireCtx } from '@/lib/session';
import { emailConfigured, smsConfigured } from '@/lib/notify';
import { ymd } from '@/lib/format';
import type { CalHours, CalService } from '@/lib/cal';
import { loadOverview } from './data';
import { ClientsView } from './ClientsView';

export const metadata = { title: 'Clients' };
export const dynamic = 'force-dynamic';

export default async function Clients() {
  const ctx = await requireCtx();
  const { sb, salon } = ctx;
  const [ov, { data: team }, { data: oh }, { data: svc }, { data: ss }] = await Promise.all([
    loadOverview(ctx),
    sb.from('staff').select('id,name,role_title').eq('active', true).order('name'),
    sb.from('opening_hours').select('*'),
    sb.from('services').select('id,name,duration_min,price_cents,service_categories(name)').eq('active', true).order('name'),
    sb.from('service_staff').select('service_id,staff_id'),
  ]);
  const mm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const hours: CalHours[] = Array.from({ length: 7 }, (_, wd) => { const r = (oh ?? []).find((h) => h.weekday === wd); return { wd, open: !!r?.is_open, from: r?.is_open ? mm(r.open_time) : 8 * 60, to: r?.is_open ? mm(r.close_time) : 18 * 60 }; });
  const services: CalService[] = (svc ?? []).map((s: any) => ({ id: s.id, name: s.name, dur: s.duration_min, priceCents: s.price_cents, cat: s.service_categories?.name ?? 'Services' }));
  const offers: Record<string, string[]> = {}; for (const r of ss ?? []) (offers[r.service_id] ??= []).push(r.staff_id);
  return (
    <ClientsView
      clients={ov.rows} count={ov.count} newThisMonth={ov.newThisMonth} rebookRate={ov.rebookRate}
      channels={{ sms: smsConfigured(), email: emailConfigured() }}
      book={{ services, offers, hours, team: (team ?? []).map((t) => ({ id: t.id, name: t.name, role: t.role_title ?? '' })), today: ymd(new Date(), salon.timezone), tz: salon.timezone }}
    />
  );
}
