import { requireCtx } from '@/lib/session';
import { ymd } from '@/lib/format';
import NewAppointment from './NewAppointment';

export const metadata = { title: 'New appointment' };

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string; client?: string }> }) {
  const { sb, salon } = await requireCtx();
  const sp = await searchParams;
  const [{ data: clients }, { data: services }, { data: team }] = await Promise.all([
    sb.from('clients').select('id,name,email,phone').order('name').limit(1000),
    sb.from('services').select('id,name,duration_min,price_cents,category_id').eq('active', true).order('name'),
    sb.from('staff').select('id,name').eq('active', true).order('name'),
  ]);
  return <NewAppointment salonId={salon.id} tz={salon.timezone} currency={salon.currency} clients={clients ?? []} services={services ?? []} team={team ?? []}
    initialDate={/^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? '') ? sp.d! : ymd(new Date(), salon.timezone)} initialClient={sp.client ?? ''} />;
}
