import { supabaseAdmin } from '@/lib/supabase/admin';
import ReviewForm from './ReviewForm';
import { supabaseServer } from '@/lib/supabase/server';

export const metadata = { title: 'Leave a review' };

export default async function Review({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token === 'preview') {
    // Staff preview from the Reviews screen. Nothing is submitted.
    const ssb = await supabaseServer();
    const { data: me } = await ssb.from('staff').select('salons(name)').eq('active', true).maybeSingle();
    if (me) return <ReviewForm token="preview" salon={(me as any).salons?.name ?? ''} />;
  }
  const sb = supabaseAdmin();
  const { data: t } = await sb.from('booking_tokens').select('booking_id,salon_id,expires_at,used_at').eq('token', token).eq('purpose', 'review').maybeSingle();
  if (!t || t.used_at || new Date(t.expires_at) < new Date()) return <div className="auth"><div className="card"><h1>Thanks!</h1><p className="muted">This review link has already been used or has expired.</p></div></div>;
  const { data: salon } = await sb.from('salons').select('name').eq('id', t.salon_id).single();
  return <ReviewForm token={token} salon={salon?.name ?? ''} />;
}
