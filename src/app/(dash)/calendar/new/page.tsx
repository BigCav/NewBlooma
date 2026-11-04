import { redirect } from 'next/navigation';

// New appointments open in the calendar (side panel on desktop, sheet on mobile).
export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string; client?: string }> }) {
  const sp = await searchParams;
  const q = new URLSearchParams({ new: '1' });
  if (/^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? '')) q.set('d', sp.d!);
  // The calendar looks the client up by id, so the booking goes on that client and not on a new one with the same name.
  if (sp.client && /^[0-9a-f-]{36}$/i.test(sp.client)) q.set('cid', sp.client);
  redirect(`/calendar?${q.toString()}`);
}
