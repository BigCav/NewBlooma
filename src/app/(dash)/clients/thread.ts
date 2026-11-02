import { ymd } from '@/lib/format';
import { dayInfo } from '@/lib/cal';
import { fmtClock } from './data';

export type ChatMsg = { id: string; mine: boolean; text: string; day: string; time: string };

/** Every conversation with a client: the one about each booking and the general one, in time order. */
export async function loadThread(sb: any, clientId: string, tz: string): Promise<ChatMsg[]> {
  const today = ymd(new Date(), tz);
  const { data: threads } = await sb.from('inbox_items').select('id,body,created_at').eq('client_id', clientId).eq('type', 'message');
  const tids = ((threads ?? []) as any[]).map((t) => t.id as string);
  const { data: tmsgs } = tids.length ? await sb.from('inbox_messages').select('id,item_id,mine,body,created_at').in('item_id', tids) : { data: [] as any[] };
  const rows = [
    ...((threads ?? []) as any[]).filter((t) => t.body).map((t) => ({ id: 'first-' + t.id, mine: false, text: t.body as string, at: t.created_at as string })),
    ...((tmsgs ?? []) as any[]).map((m) => ({ id: m.id as string, mine: !!m.mine, text: m.body as string, at: m.created_at as string })),
  ].sort((a, b) => (a.at < b.at ? -1 : 1));
  return rows.map((m) => ({ id: m.id, mine: m.mine, text: m.text, day: ymd(m.at, tz) === today ? 'Today' : dayInfo(ymd(m.at, tz)).short, time: fmtClock(m.at, tz) }));
}
