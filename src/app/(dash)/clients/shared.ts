import { MONTHS_FULL } from '@/lib/cal';
import type { ToneName } from '@/lib/tones';
// Types and pure helpers shared by the Clients list, the profile and their server code.
export type Tag = 'Regular' | 'New' | 'Lapsed';
export type ClientRow = {
  id: string; name: string; email: string; phone: string; tag: Tag;
  last: string; lastService: string; next: string; staff: string; visits: number; spentCents: number;
};
export const TAG_LIST: Tag[] = ['Regular', 'New', 'Lapsed'];
export const FILTERS: { id: 'all' | Tag; label: string }[] = [{ id: 'all', label: 'All clients' }, { id: 'Regular', label: 'Regulars' }, { id: 'New', label: 'New' }, { id: 'Lapsed', label: 'Lapsed' }];

/** The colour of each tag, defined once for the list, the quick view and the profile. */
export const TAG_TONE: Record<Tag, ToneName> = { Regular: 'purple', New: 'green', Lapsed: 'amber' };
/** The colour of a patch test's state (patchInfo.tone). */
export const PATCH_TONE: Record<'ok' | 'bad' | 'none', ToneName> = { ok: 'green', bad: 'red', none: 'grey' };

const MON = MONTHS_FULL.map((m) => m.slice(0, 3));
/** Patch tests are valid for twelve months. */
export function patchInfo(on: string | null, today: string): { text: string; tone: 'ok' | 'bad' | 'none'; needsAction: boolean } {
  if (!on) return { text: 'Not recorded', tone: 'none', needsAction: true };
  const [y, m] = on.split('-').map(Number);
  const until = `${y + 1}-${String(m).padStart(2, '0')}-${on.slice(8, 10)}`;
  if (until < today) return { text: 'Expired', tone: 'bad', needsAction: true };
  return { text: `Valid until ${MON[m - 1]} ${y + 1}`, tone: 'ok', needsAction: false };
}
export const sinceText = (iso: string) => { const d = new Date(iso); return `Client since ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

export type Channels = { sms: boolean; email: boolean };
export const channelNote = (ch: Channels, phone: string, email: string) =>
  ch.sms && phone ? `Sent as a text to ${phone}.` : ch.email && email ? `Sent by email to ${email}.` : 'Messaging is not set up yet. Add Twilio or Resend keys to send.';
