import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { firstName } from '@/lib/people';
import { esc, mailButton, mailP, mailShell, mailUnsub } from '@/lib/email-layout';
import { fillTokens } from '@/lib/marketing-shared';

const base = () => process.env.NEXT_PUBLIC_APP_URL ?? '';

/** Outbox templates that are marketing: they go only to clients who agreed, and carry an unsubscribe link. */
export const MARKETING_TEMPLATES: ReadonlySet<string> = new Set(['winback', 'birthday', 'broadcast']);

type Salon = { name: string; phone?: string | null; slug: string };
export type Rendered = { subject: string; text: string; html: string };

/** One marketing message as email html and plain text. `unsubUrl` is null only for the owner's own test copy. */
export function renderMarketing(o: { salon: Salon; subject: string; heading: string; body: string; first: string; unsubUrl: string | null; test?: boolean }): Rendered {
  const body = fillTokens(o.body, { first: o.first, salon: o.salon.name });
  const book = `${base()}/b/${o.salon.slug}`;
  const foot = `${o.salon.name}${o.salon.phone ? ` · ${o.salon.phone}` : ''}`;
  const text = [o.test ? 'This is a test. Clients will see the unsubscribe link here.' : '', body, '', `Book online: ${book}`, '', o.unsubUrl ? `Unsubscribe: ${o.unsubUrl}` : '', foot].filter((x, i, a) => x !== '' || (i > 0 && a[i - 1] !== '')).join('\n').trim();
  const html = mailShell({
    brand: o.salon.name, heading: o.heading,
    body: body.split(/\n+/).map(mailP).join('') + mailButton('Book an appointment', book) + (o.unsubUrl ? mailUnsub(o.unsubUrl) : `<p style="margin:22px 0 0;font-size:12.5px;color:#5E6673">${esc('Test copy. Clients also see an unsubscribe link here.')}</p>`),
    footer: foot, preheader: body.slice(0, 90),
  });
  return { subject: o.subject, text, html };
}

/** The message for one queued marketing row, or null when it should not go (the client has since unsubscribed, or the owner switched the automatic message off). */
export async function composeMarketing(r: { salon_id: string; template: string; payload: any }, salon: Salon): Promise<Rendered | null> {
  const sb = supabaseAdmin();
  const { data: c } = await sb.from('clients').select('name,marketing,unsub_token').eq('id', String(r.payload?.client_id ?? '')).eq('salon_id', r.salon_id).maybeSingle();
  if (!c || !c.marketing) return null;
  let subject: string, heading: string, body: string;
  if (r.template === 'broadcast') {
    subject = String(r.payload?.subject ?? '').trim(); body = String(r.payload?.text ?? '').trim();
    if (!subject || !body) return null;
    heading = subject;
  } else {
    const { data: m } = await sb.from('marketing_settings').select('winback_on,winback_text,birthday_on,birthday_text').eq('salon_id', r.salon_id).maybeSingle();
    if (!m) return null;
    if (r.template === 'winback') { if (!m.winback_on) return null; subject = `We miss you at ${salon.name}`; heading = 'We miss you'; body = m.winback_text; }
    else { if (!m.birthday_on) return null; subject = `Happy birthday from ${salon.name}`; heading = 'Happy birthday'; body = m.birthday_text; }
  }
  return renderMarketing({ salon, subject, heading, body, first: firstName(c.name), unsubUrl: `${base()}/unsubscribe/${c.unsub_token}` });
}
