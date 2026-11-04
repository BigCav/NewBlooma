import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendCustomMessage } from '@/lib/notify';

type Problem = { salon_id: string; problem: string; n: number };

/** Runs the database's daily self-check and emails each salon's owner what it found. Returns what was found. */
export async function reportHealth(): Promise<{ problems: Problem[]; emailed: number; error?: string }> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc('health_problems');
  if (error) return { problems: [], emailed: 0, error: 'health check failed: ' + error.message };
  const problems = (data ?? []) as Problem[];
  const bySalon = new Map<string, Problem[]>();
  for (const p of problems) bySalon.set(p.salon_id, [...(bySalon.get(p.salon_id) ?? []), p]);
  let emailed = 0;
  for (const [salonId, list] of bySalon) {
    const { data: salon } = await sb.from('salons').select('email').eq('id', salonId).maybeSingle();
    if (!salon?.email) continue;
    const lines = list.map((p) => `- ${p.problem} (${p.n})`).join('\n');
    const text = `The daily check found something that needs a look:\n\n${lines}\n\nOpen Sales to see card payments that need review, and check your Windcave dashboard if a card payment looks wrong.`;
    const r = await sendCustomMessage(salonId, { email: salon.email }, text, { subject: 'Aster: something needs a look', heading: 'Daily check' }).catch(() => null);
    if (r?.ok) emailed++;
  }
  return { problems, emailed };
}
