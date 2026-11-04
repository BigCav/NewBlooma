import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type OpenInvite = { token: string; name: string; salon: string };

/** The team invite behind a /join link, when it can still be used: the person it was made for (their name is already on the Team page) and the salon. */
export async function openInvite(token: string | null | undefined): Promise<OpenInvite | null> {
  if (!token || token.length > 100) return null;
  const sb = supabaseAdmin();
  const { data: inv } = await sb.from('staff_invites').select('accepted_at,expires_at,salon_id,staff(name,active,user_id)').eq('token', token).maybeSingle();
  const who = (inv as any)?.staff as { name: string; active: boolean; user_id: string | null } | null | undefined;
  if (!inv || inv.accepted_at || new Date(inv.expires_at) < new Date() || !who?.active || who.user_id) return null;
  const { data: salon } = await sb.from('salons').select('name').eq('id', inv.salon_id).single();
  return { token, name: who.name, salon: salon?.name ?? 'the team' };
}
