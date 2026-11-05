'use server';
import { revalidatePath } from 'next/cache';
import { requireOwner, friendly } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/admin';

const BUCKET = 'salon-photos';
const MAX = 5;
export type SalonPhoto = { id: string; url: string };
type Res = { error?: string; notice?: string };

/** What the file really is, from its first bytes (the type a browser reports can be anything). */
const looksLikeImage = (b: Buffer) =>
  (b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b.subarray(1, 4).toString() === 'PNG') || (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP');

const done = (slug: string) => { revalidatePath('/settings'); revalidatePath(`/b/${slug}`); };

/** Owner adds one picture (already shrunk in the browser) to the booking page, up to five. */
export async function addSalonPhoto(fd: FormData): Promise<Res & { photo?: SalonPhoto }> {
  const { sb, salon } = await requireOwner();
  const file = fd.get('photo');
  if (!(file instanceof File) || !file.size) return { error: 'Choose a photo.' };
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return { error: 'Use a JPG, PNG or WebP photo.' };
  if (file.size > 1_400_000) return { error: 'That photo is too large. Try a smaller one.' };
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(bytes)) return { error: 'That file is not a photo we can use.' };
  const { data: have } = await sb.from('salon_photos').select('sort').order('sort', { ascending: false });
  if ((have ?? []).length >= MAX) return { error: `You can have up to ${MAX} photos. Remove one first.` };
  const admin = supabaseAdmin();
  const path = `${salon.id}/${Date.now()}.jpg`;
  const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
  if (up.error) return { error: 'Could not upload the photo. Please try again.' };
  const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { data: row, error } = await sb.from('salon_photos').insert({ salon_id: salon.id, url, path, sort: ((have ?? [])[0]?.sort ?? -1) + 1 }).select('id').single();
  if (error || !row) { await admin.storage.from(BUCKET).remove([path]); return { error: friendly(error?.message) }; }
  done(salon.slug);
  return { photo: { id: row.id, url }, notice: 'Photo added' };
}

export async function removeSalonPhoto(id: string): Promise<Res> {
  const { sb, salon } = await requireOwner();
  const { data: p } = await sb.from('salon_photos').select('id,path').eq('id', id).maybeSingle();
  if (!p) return { error: 'Photo not found.' };
  const { error } = await sb.from('salon_photos').delete().eq('id', id);
  if (error) return { error: friendly(error.message) };
  await supabaseAdmin().storage.from(BUCKET).remove([p.path]);
  done(salon.slug);
  return { notice: 'Photo removed' };
}

/** Puts one picture first, which makes it the large one on the booking page. */
export async function makeMainPhoto(id: string): Promise<Res> {
  const { sb, salon } = await requireOwner();
  const { data: all } = await sb.from('salon_photos').select('id').order('sort').order('created_at');
  const ids = (all ?? []).map((x) => x.id as string);
  if (!ids.includes(id)) return { error: 'Photo not found.' };
  const order = [id, ...ids.filter((x) => x !== id)];
  for (let i = 0; i < order.length; i++) {
    const { error } = await sb.from('salon_photos').update({ sort: i }).eq('id', order[i]);
    if (error) return { error: friendly(error.message) };
  }
  done(salon.slug);
  return { notice: 'Main photo changed' };
}
