import { requireCtx } from '@/lib/session';
import { loadInbox } from './data';
import { InboxView } from './InboxView';

export const metadata = { title: 'Inbox' };
export const dynamic = 'force-dynamic';

export default async function Inbox() {
  const ctx = await requireCtx();
  return <InboxView items={await loadInbox(ctx)} />;
}
