import { requireOwner } from '@/lib/session';
import { loadTemplates } from '@/lib/forms';
import { FormsView } from './FormsView';

export const metadata = { title: 'Forms' };
export const dynamic = 'force-dynamic';

export default async function FormsSettings({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const { sb, salon } = await requireOwner();
  const [templates, { data: cats }] = await Promise.all([
    loadTemplates(sb, salon.id),
    sb.from('service_categories').select('id,name').eq('salon_id', salon.id).order('sort').order('name'),
  ]);
  return <FormsView templates={templates} cats={(cats ?? []).map((c: any) => ({ id: c.id, name: c.name }))} initial={f} />;
}
