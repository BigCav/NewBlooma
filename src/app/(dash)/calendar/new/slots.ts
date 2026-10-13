'use server';
import { requireCtx } from '@/lib/session';
import { time12 } from '@/lib/format';

export async function loadSlots(date: string, serviceIds: string[], staffId: string) {
  if (!serviceIds.length) return { slots: [] as { key: string; label: string; staff: string }[] };
  const { sb, salon } = await requireCtx();
  const { data, error } = await sb.rpc('available_slots', { p_salon: salon.id, p_service_ids: serviceIds, p_staff: staffId || null, p_from: date, p_to: date, p_mode: 'staff' });
  if (error) return { slots: [], error: error.message };
  const { data: team } = await sb.from('staff').select('id,name');
  const name = (id: string) => team?.find((t) => t.id === id)?.name ?? '';
  return { slots: (data ?? []).map((r: any) => ({ key: `${r.staff_id}|${r.starts_at}`, label: time12(r.starts_at, salon.timezone), staff: name(r.staff_id) })) };
}
