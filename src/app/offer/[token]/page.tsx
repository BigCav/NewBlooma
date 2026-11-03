import { supabaseAdmin } from '@/lib/supabase/admin';
import { time12 } from '@/lib/format';
import { dateShort } from '@/lib/public';
import { CardText, PrimaryButton, PublicCard } from '@/app/b/[slug]/PublicCard';
import { flushOutbox } from '@/lib/notify';

export const metadata = { title: 'Appointment offer' };

async function accept(token: string) {
  'use server';
  const { redirect } = await import('next/navigation');
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc('accept_offer', { p_token: token });
  if (error || !data) redirect(`/offer/${token}?gone=1`);
  await flushOutbox();
  const { data: t } = await sb.from('booking_tokens').select('token').eq('booking_id', data).eq('purpose', 'manage_booking').single();
  redirect(`/manage/${t!.token}?new=1`);
}

export default async function Offer({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ gone?: string }> }) {
  const { token } = await params; const sp = await searchParams;
  const sb = supabaseAdmin();
  const { data: t } = await sb.from('booking_tokens').select('waitlist_id,expires_at,used_at,salon_id').eq('token', token).eq('purpose', 'accept_offer').maybeSingle();
  const { data: e } = t ? await sb.from('waitlist_entries').select('status,offered_start,services(name),staff:offered_staff_id(name)').eq('id', t.waitlist_id!).single() : { data: null };
  const { data: salon } = t ? await sb.from('salons').select('name,timezone').eq('id', t.salon_id).single() : { data: null };
  const live = t && !t.used_at && new Date(t.expires_at) > new Date() && e?.status === 'offered' && !sp.gone;
  if (!live || !e || !salon) return <PublicCard title="This offer is no longer available"><CardText>Sorry, the time has been taken or the offer expired. You are still on the waitlist for the next opening.</CardText></PublicCard>;
  return (
    <PublicCard title="A time just opened up" brand={salon.name}>
      <p style={{ margin: 0, fontSize: 18, lineHeight: 1.4 }}><b>{(e as any).services?.name}</b><br />{dateShort(e.offered_start!, salon.timezone)}, {time12(e.offered_start!, salon.timezone)} with {(e as any).staff?.name}</p>
      <CardText small>Offer held until {time12(t!.expires_at, salon.timezone)}.</CardText>
      <form action={accept.bind(null, token)}><PrimaryButton>Book this time</PrimaryButton></form>
    </PublicCard>
  );
}
