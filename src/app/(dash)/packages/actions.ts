'use server';
import { revalidatePath } from 'next/cache';
import { requireCtx, requireOwner, friendly } from '@/lib/session';
import { toCents } from '@/lib/format';

type Res = { error?: string; id?: string; saleId?: string };
export type PkgInput = { id?: string; name: string; serviceId: string; uses: number; price: string; validDays: number | null };

/** Set up or change a package (owner only). Changing one never touches packages clients have already bought. */
export async function savePackage(i: PkgInput): Promise<Res> {
  const { sb, salon } = await requireOwner();
  const name = i.name.trim();
  const priceCents = toCents(i.price);
  if (!name) return { error: 'Give the package a name.' };
  if (name.length > 80) return { error: 'Keep the name under 80 characters.' };
  if (!i.serviceId) return { error: 'Choose the service it is for.' };
  if (!Number.isInteger(i.uses) || i.uses < 2 || i.uses > 100) return { error: 'Choose between 2 and 100 visits.' };
  if (priceCents < 1) return { error: 'Enter a price above zero, like 200 or 199.50.' };
  if (i.validDays !== null && (!Number.isInteger(i.validDays) || i.validDays < 1 || i.validDays > 3650)) return { error: 'Choose how long it lasts.' };
  const { data: svc } = await sb.from('services').select('id').eq('id', i.serviceId).eq('salon_id', salon.id).eq('active', true).maybeSingle();
  if (!svc) return { error: 'That service is no longer available.' };
  const row = { service_id: i.serviceId, name, uses: i.uses, price_cents: priceCents, valid_days: i.validDays };
  let id = i.id;
  if (id) {
    const { data, error } = await sb.from('service_packages').update(row).eq('id', id).eq('salon_id', salon.id).select('id');
    if (error) return { error: friendly(error.message) };
    if (!data?.length) return { error: 'That package no longer exists.' };
  } else {
    const { data, error } = await sb.from('service_packages').insert({ ...row, salon_id: salon.id }).select('id').single();
    if (error) return { error: friendly(error.message) };
    id = data.id;
  }
  revalidatePath('/packages');
  return { id };
}

/** Stop offering a package (or offer it again). Clients who already bought it keep their visits. */
export async function setPackageActive(id: string, active: boolean): Promise<Res> {
  const { sb, salon } = await requireOwner();
  const { error } = await sb.from('service_packages').update({ active }).eq('id', id).eq('salon_id', salon.id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/packages');
  return {};
}

/** Sell a package: makes the unpaid sale. The caller sends the user to the Sales page to take payment. */
export async function sellPackage(clientName: string, clientId: string | null, packageId: string): Promise<Res> {
  const { sb } = await requireCtx();
  const { data, error } = await sb.rpc('create_package_sale', { p_client_name: clientName, p_package: packageId, p_client: clientId });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/packages'); revalidatePath('/sales');
  return { saleId: data as string };
}
