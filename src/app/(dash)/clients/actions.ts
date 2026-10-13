'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCtx, friendly } from '@/lib/session';

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function addClient(_: unknown, fd: FormData) {
  const { sb, salon } = await requireCtx();
  const name = s(fd, 'name'); if (!name) return { error: 'Enter a name.' };
  const { data, error } = await sb.from('clients').insert({ salon_id: salon.id, name, email: s(fd, 'email') || null, phone: s(fd, 'phone') || null, notes: s(fd, 'notes') || null }).select('id').single();
  if (error) return { error: error.code === '23505' ? 'A client with that email already exists.' : friendly(error.message) };
  revalidatePath('/clients'); redirect(`/clients/${data.id}`);
}

export async function updateClient(_: unknown, fd: FormData) {
  const { sb } = await requireCtx();
  const { error } = await sb.from('clients').update({ name: s(fd, 'name'), email: s(fd, 'email') || null, phone: s(fd, 'phone') || null, notes: s(fd, 'notes') || null }).eq('id', s(fd, 'id'));
  if (error) return { error: error.code === '23505' ? 'Another client already uses that email.' : friendly(error.message) };
  revalidatePath('/clients'); return { ok: 'Saved.' };
}
