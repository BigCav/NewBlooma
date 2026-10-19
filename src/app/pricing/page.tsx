import { PricingView } from '@/components/Marketing';
import { supabaseServer } from '@/lib/supabase/server';
import { clientHome } from '@/lib/session';

export const metadata = { title: 'Pricing', description: '$24 a month for one stylist, $19 per stylist a month for teams of two or more. Every feature included.' };

export const dynamic = 'force-dynamic';

export default async function Page() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return <PricingView dash={user ? clientHome(user.user_metadata) ?? '/calendar' : null} />;
}
