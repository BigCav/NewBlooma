import { supabaseAdmin } from '@/lib/supabase/admin';
import { ReviewView } from './ReviewView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leave a review' };

export default async function Review({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = supabaseAdmin();
  const { data: t } = await sb.from('booking_tokens').select('booking_id,salon_id,expires_at,used_at').eq('token', token).eq('purpose', 'review').maybeSingle();
  if (!t || t.used_at || new Date(t.expires_at) < new Date()) return <div className="auth"><div className="card"><h1>Thanks!</h1><p className="muted">This review link has already been used or has expired.</p></div></div>;
  const [{ data: salon }, { data: b }] = await Promise.all([
    sb.from('salons').select('name,slug').eq('id', t.salon_id).single(),
    sb.from('bookings').select('clients(name)').eq('id', t.booking_id!).single(),
  ]);
  return <ReviewView token={token} salon={salon?.name ?? ''} slug={salon?.slug ?? ''} name={(b as any)?.clients?.name ?? ''} />;
}
