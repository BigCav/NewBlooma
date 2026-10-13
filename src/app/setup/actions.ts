'use server';
import { checkPhone } from '@/lib/phone';
import { supabaseServer } from '@/lib/supabase/server';
import { friendly } from '@/lib/session';
import { CATS, DAYS, PRESETS, ROLES, STARTERS, currencyFor, slugOf, type SetupInput } from './shared';

export async function createSalon(v: SetupInput): Promise<{ error?: string; slug?: string }> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };
  if (!v.name.trim()) return { error: 'Add your salon name to continue.' };
  const ph = checkPhone(v.phone); if (ph.error) return { error: ph.error };
  const cats = v.cats.filter((c) => CATS.includes(c));
  if (!cats.length) return { error: 'Choose at least one category.' };
  const preset = PRESETS.find((p) => p[0] === v.preset) ?? PRESETS[0];
  const hours = DAYS.map((_, d) => ({ weekday: d, is_open: !!v.open[DAYS[d]], open: preset[3], close: preset[4] }));
  if (!hours.some((h) => h.is_open)) return { error: 'Open at least one day.' };
  const team = v.team.map((m) => ({ name: m.name.trim(), role: ROLES.includes(m.role) ? m.role : 'Other' })).filter((m) => m.name).slice(0, 20);
  const categories = cats.map((c) => ({ name: c, services: STARTERS[c].map(([name, duration, price]) => ({ name, duration, price_cents: price * 100 })) }));
  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const email = user.email ?? '';
  const owner = (meta.full_name || meta.name || email.split('@')[0] || 'Owner').trim();
  const tz = v.timezone || 'UTC';
  const base = slugOf(v.name);
  for (let i = 0; i < 6; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const { error } = await sb.rpc('setup_salon', {
      p_name: v.name.trim(), p_slug: slug, p_phone: checkPhone(v.phone).value, p_email: email, p_address: v.address.trim(), p_timezone: tz,
      p_currency: currencyFor(tz), p_hours: hours, p_owner_name: owner, p_categories: categories, p_team: team,
    });
    if (!error) return { slug };
    if (!/salons_slug|duplicate key|unique/i.test(error.message)) return { error: friendly(error.message) };
  }
  return { error: 'That salon name is taken. Try a slightly different name.' };
}
