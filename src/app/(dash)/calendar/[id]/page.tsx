import { notFound, redirect } from 'next/navigation';
import { requireCtx } from '@/lib/session';
import { ymd } from '@/lib/format';

// An appointment opens on the calendar, in its sheet.
export default async function Appt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { sb, salon } = await requireCtx();
  const { data: b } = await sb.from('bookings').select('starts_at').eq('id', id).maybeSingle();
  if (!b) notFound();
  redirect(`/calendar?d=${ymd(b.starts_at, salon.timezone)}&b=${id}`);
}
