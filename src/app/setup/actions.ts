'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { friendly } from '@/lib/session';

export async function createSalon(_: unknown, fd: FormData) {
  const hours = Array.from({ length: 7 }, (_, d) => ({
    weekday: d, is_open: fd.get(`open_${d}`) === 'on',
    open: String(fd.get(`from_${d}`) || '09:00'), close: String(fd.get(`to_${d}`) || '17:00'),
  }));
  for (const h of hours) if (h.is_open && h.close <= h.open) return { error: 'Closing time must be after opening time.' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('create_salon', {
    p_name: String(fd.get('name') ?? ''), p_slug: String(fd.get('slug') ?? ''), p_phone: String(fd.get('phone') ?? ''),
    p_email: String(fd.get('email') ?? ''), p_address: String(fd.get('address') ?? ''), p_timezone: String(fd.get('timezone') ?? ''),
    p_currency: String(fd.get('currency') ?? ''), p_hours: hours, p_owner_name: String(fd.get('owner') ?? ''), p_owner_title: String(fd.get('title') ?? 'Owner'),
  });
  if (error) return { error: friendly(error.message) };
  redirect('/settings?welcome=1');
}
