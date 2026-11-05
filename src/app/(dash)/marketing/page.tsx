import { requireOwner } from '@/lib/session';
import { emailConfigured, smsConfigured } from '@/lib/notify';
import { dateShort } from '@/lib/public';
import { DEFAULT_BIRTHDAY, DEFAULT_WINBACK } from '@/lib/marketing-shared';
import { MarketingView } from './MarketingView';

export const metadata = { title: 'Marketing' };
export const dynamic = 'force-dynamic';

export default async function Marketing() {
  const { sb, salon } = await requireOwner();
  const month = new Date(Date.now() - 30 * 86400e3).toISOString();
  const [{ data: st }, { count: total }, { count: agreed }, { count: birthdays }, { data: svcs }, { data: log }, { count: sent }] = await Promise.all([
    sb.from('marketing_settings').select('winback_on,winback_weeks,winback_text,birthday_on,birthday_text').maybeSingle(),
    sb.from('clients').select('id', { count: 'exact', head: true }),
    sb.from('clients').select('id', { count: 'exact', head: true }).eq('marketing', true),
    sb.from('clients').select('id', { count: 'exact', head: true }).not('birthday', 'is', null),
    sb.from('services').select('id,name').eq('active', true).eq('is_addon', false).order('name'),
    sb.from('marketing_log').select('kind,created_at,clients(name)').order('created_at', { ascending: false }).limit(12),
    sb.from('marketing_log').select('id', { count: 'exact', head: true }).gte('created_at', month),
  ]);
  return (
    <MarketingView
      settings={{ winbackOn: st?.winback_on ?? false, winbackWeeks: st?.winback_weeks ?? 8, winbackText: st?.winback_text ?? DEFAULT_WINBACK, birthdayOn: st?.birthday_on ?? false, birthdayText: st?.birthday_text ?? DEFAULT_BIRTHDAY }}
      counts={{ total: total ?? 0, agreed: agreed ?? 0, birthdays: birthdays ?? 0, sent: sent ?? 0 }}
      services={(svcs ?? []).map((s) => ({ id: s.id as string, name: s.name as string }))}
      recent={((log ?? []) as any[]).map((l) => ({ kind: l.kind as string, name: (l.clients?.name ?? 'Client') as string, when: dateShort(l.created_at, salon.timezone) }))}
      channels={{ email: emailConfigured(), sms: smsConfigured() }}
    />
  );
}
