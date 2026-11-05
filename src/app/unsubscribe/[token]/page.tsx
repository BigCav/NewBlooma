import { supabaseAdmin } from '@/lib/supabase/admin';
import { CardText, PublicCard } from '@/app/b/[slug]/PublicCard';
import { UnsubscribeForm } from './UnsubscribeForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Unsubscribe', robots: { index: false } };

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Unsubscribe({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: c } = TOKEN.test(token) ? await supabaseAdmin().from('clients').select('marketing,salons(name)').eq('unsub_token', token).maybeSingle() : { data: null };
  if (!c) return <PublicCard title="This link is not valid"><CardText>It may have been copied incompletely. You can reply to the message you received and we will take you off the list.</CardText></PublicCard>;
  const salon = ((c as any).salons?.name as string | undefined) ?? 'the salon';
  // Opening the link changes nothing: a mail scanner that follows links must not unsubscribe anyone. The button does.
  return <PublicCard title="Offers and news" brand={salon}><UnsubscribeForm token={token} salon={salon} subscribed={c.marketing} /></PublicCard>;
}
