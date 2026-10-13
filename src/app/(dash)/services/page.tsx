import { requireCtx } from '@/lib/session';
import { ServicesView, type SvcRow } from './ServicesView';

export const metadata = { title: 'Services' };
export const dynamic = 'force-dynamic';

export default async function Services() {
  const { sb, staff } = await requireCtx();
  const [{ data: cats }, { data: svcs }, { data: team }, { data: links }] = await Promise.all([
    sb.from('service_categories').select('id,name').order('sort').order('name'),
    sb.from('services').select('id,name,description,category_id,duration_min,price_cents,online_bookable').eq('active', true).order('name'),
    sb.from('staff').select('id,name').eq('active', true).order('name'),
    sb.from('service_staff').select('service_id,staff_id'),
  ]);
  const catName = new Map((cats ?? []).map((c) => [c.id, c.name]));
  const catIdx = new Map((cats ?? []).map((c, i) => [c.id, i]));
  const services: SvcRow[] = (svcs ?? []).map((s) => ({
    id: s.id, name: s.name, desc: s.description ?? '', catId: s.category_id, cat: catName.get(s.category_id) ?? 'Services', catIdx: catIdx.get(s.category_id) ?? 0,
    dur: s.duration_min, priceCents: s.price_cents, online: s.online_bookable, staffIds: (links ?? []).filter((l) => l.service_id === s.id).map((l) => l.staff_id),
  }));
  return <ServicesView services={services} cats={(cats ?? []).map((c) => ({ id: c.id, name: c.name }))} team={(team ?? []).map((t) => ({ id: t.id, name: t.name }))} canEdit={staff.app_role === 'owner'} />;
}
