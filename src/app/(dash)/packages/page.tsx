import { requireCtx } from '@/lib/session';
import { ymd } from '@/lib/format';
import { buildRecent } from '../calendar/base';
import { PackagesView, type PkgSold, type PkgType } from './PackagesView';

export const metadata = { title: 'Packages' };
export const dynamic = 'force-dynamic';

export default async function Packages() {
  const { sb, salon, staff } = await requireCtx();
  const tz = salon.timezone;
  const [{ data: types }, { data: svcs }, { data: cps }, { data: uses }, { data: rc }] = await Promise.all([
    sb.from('service_packages').select('id,name,service_id,uses,price_cents,valid_days,active,services(name,price_cents)').order('created_at', { ascending: false }),
    sb.from('services').select('id,name,price_cents').eq('active', true).eq('is_addon', false).order('name'),
    sb.from('client_package_status').select('id,client_id,package_id,name,uses_total,uses_left,price_cents,sale_status,paid_at,expires_at,created_at').order('created_at', { ascending: false }).limit(500),
    sb.from('package_uses').select('client_package_id,sales(status,paid_at)').limit(3000),
    sb.from('bookings').select('client_id,clients(name,phone)').not('client_id', 'is', null).order('starts_at', { ascending: false }).limit(80),
  ]);
  const ids = [...new Set((cps ?? []).map((c) => c.client_id))];
  const { data: cl } = ids.length ? await sb.from('clients').select('id,name').in('id', ids) : { data: [] as { id: string; name: string }[] };
  const clientName = new Map((cl ?? []).map((c) => [c.id, c.name]));
  const now = Date.now();
  const sold: PkgSold[] = (cps ?? []).map((c) => {
    const exp = c.expires_at ? new Date(c.expires_at).getTime() : null;
    const status: PkgSold['status'] = c.sale_status === 'pending' ? 'Unpaid' : c.sale_status === 'refunded' ? 'Refunded' : exp !== null && exp <= now ? 'Expired' : c.uses_left <= 0 ? 'Used up' : 'Active';
    const used = ((uses ?? []) as any[]).filter((u) => u.client_package_id === c.id && u.sales?.status === 'paid' && u.sales?.paid_at).map((u) => ymd(u.sales.paid_at, tz)).sort();
    return {
      id: c.id, clientId: c.client_id, client: clientName.get(c.client_id) ?? 'Client', packageId: c.package_id ?? '', name: c.name, uses: c.uses_total, left: Math.max(0, c.uses_left), priceCents: c.price_cents,
      status, bought: c.paid_at ? ymd(c.paid_at, tz) : ymd(c.created_at, tz), expires: c.expires_at ? ymd(c.expires_at, tz) : '', used,
    };
  });
  const typeRows: PkgType[] = (types ?? []).map((t: any) => ({
    id: t.id, name: t.name, serviceId: t.service_id, service: t.services?.name ?? 'Service', servicePriceCents: t.services?.price_cents ?? 0, uses: t.uses, priceCents: t.price_cents,
    validDays: t.valid_days, active: t.active, sold: sold.filter((s) => s.packageId === t.id && s.status !== 'Unpaid' && s.status !== 'Refunded').length,
  }));
  return (
    <PackagesView types={typeRows} sold={sold} services={(svcs ?? []).map((s) => ({ id: s.id, name: s.name, priceCents: s.price_cents }))} recent={buildRecent(rc)}
      canEdit={staff.app_role === 'owner'} month={ymd(new Date(), tz).slice(0, 7)} />
  );
}
