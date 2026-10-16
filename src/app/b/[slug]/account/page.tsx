import { notFound } from 'next/navigation';
import { currentClient } from '@/lib/client-auth';
import { loadClientVisits } from '@/lib/client-visits';
import { getPublicSalon } from '@/lib/public';
import { AccountView } from './AccountView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your account' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getPublicSalon(slug);
  if (!d) notFound();
  const { salon } = d;
  const account = await currentClient(salon.id);
  if (!account) return <AccountView slug={slug} salon={salon.name} account={null} upcoming={[]} past={[]} />;
  const { upcoming, past } = await loadClientVisits(salon, account.email);
  return <AccountView slug={slug} salon={salon.name} account={{ name: account.name, email: account.email, phone: account.phone }} upcoming={upcoming} past={past} />;
}
