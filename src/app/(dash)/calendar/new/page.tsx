import { redirect } from 'next/navigation';
import { requireCtx } from '@/lib/session';

// New appointments open in the calendar (side panel on desktop, sheet on mobile).
export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string; client?: string }> }) {
  const sp = await searchParams;
  const q = new URLSearchParams({ new: '1' });
  if (/^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? '')) q.set('d', sp.d!);
  if (sp.client && /^[0-9a-f-]{36}$/i.test(sp.client)) {
    const { sb } = await requireCtx();
    const { data } = await sb.from('clients').select('name').eq('id', sp.client).maybeSingle();
    if (data?.name) q.set('c', data.name);
  }
  redirect(`/calendar?${q.toString()}`);
}
