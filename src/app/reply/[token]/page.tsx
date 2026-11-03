import { supabaseAdmin } from '@/lib/supabase/admin';
import { whenShort } from '@/lib/public';
import { firstName } from '@/lib/people';
import { CardText, PublicCard } from '@/app/b/[slug]/PublicCard';
import { ReplyView } from './ReplyView';

export const metadata = { title: 'Reply', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function ReplyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = supabaseAdmin();
  const { data: it } = await sb.from('inbox_items').select('id,salon_id,body,created_at,clients(name),bookings(starts_at,booking_services(services(name)))').eq('reply_token', token).eq('type', 'message').maybeSingle();
  if (!it) return <PublicCard title="This link is not available"><CardText>Please contact the salon directly.</CardText></PublicCard>;
  const [{ data: salon }, { data: msgs }] = await Promise.all([
    sb.from('salons').select('name,timezone').eq('id', it.salon_id).single(),
    sb.from('inbox_messages').select('mine,body,created_at').eq('item_id', it.id).order('created_at', { ascending: false }).limit(20),
  ]);
  const tz = salon?.timezone ?? 'UTC';
  const at = (iso: string) => whenShort(iso, tz);
  const thread = [
    ...(it.body ? [{ mine: false, text: it.body as string, at: at(it.created_at) }] : []),
    ...[...(msgs ?? [])].reverse().map((m: any) => ({ mine: !!m.mine, text: m.body as string, at: at(m.created_at) })),
  ];
  const b = (it as any).bookings;
  const svc = (b?.booking_services ?? []).map((l: any) => l.services?.name).filter(Boolean).join(' + ');
  const context = b ? `About your ${svc || 'appointment'} on ${at(b.starts_at)}.` : '';
  return <ReplyView token={token} salon={salon?.name ?? 'The salon'} first={firstName((it as any).clients?.name)} context={context} thread={thread} />;
}
