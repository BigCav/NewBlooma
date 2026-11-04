import { requireCtx } from '@/lib/session';
import { emailConfigured, smsConfigured } from '@/lib/notify';
import { loadOverview } from './data';
import { ClientsView } from './ClientsView';

export const metadata = { title: 'Clients' };
export const dynamic = 'force-dynamic';

export default async function Clients() {
  const ctx = await requireCtx();
  const ov = await loadOverview(ctx);
  return (
    <ClientsView
      clients={ov.rows} count={ov.count} newThisMonth={ov.newThisMonth} rebookRate={ov.rebookRate}
      channels={{ sms: smsConfigured(), email: emailConfigured() }}
    />
  );
}
