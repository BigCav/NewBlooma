import { supabaseAdmin } from '@/lib/supabase/admin';
import { dateLong, time12 } from '@/lib/format';
import { clientPending, loadBooking, rowsForBooking, toFill } from '@/lib/forms';
import { FormFillView } from '@/components/FormFillView';
import { submitPublicForms } from './actions';

export const metadata = { title: 'Before your visit' };
export const dynamic = 'force-dynamic';

const Card = ({ title, text, link }: { title: string; text: string; link?: { href: string; label: string } }) => (
  <div className="auth"><div className="card"><h1>{title}</h1><p className="muted">{text}</p>{link && <p><a className="btn primary" href={link.href}>{link.label}</a></p>}</div></div>
);

export default async function FormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = supabaseAdmin();
  const { data: t } = await sb.from('booking_tokens').select('booking_id,salon_id,expires_at').eq('token', token).eq('purpose', 'fill_form').maybeSingle();
  if (!t || !t.booking_id || new Date(t.expires_at) < new Date()) return <Card title="This link has expired" text="Forms can be completed until the day after your appointment. Please call the salon if you still need to fill one in." />;
  const { data: salon } = await sb.from('salons').select('name,slug,timezone').eq('id', t.salon_id).single();
  if (!salon) return <Card title="This link is not available" text="Please contact the salon." />;
  const b = await loadBooking(sb, t.booking_id, salon.timezone);
  if (!b || ['cancelled', 'no_show'].includes(b.status)) return <Card title="This appointment is no longer booked" text="There is nothing to fill in." link={{ href: `/b/${salon.slug}`, label: 'Book a new appointment' }} />;
  const [rows, { data: mt }] = await Promise.all([rowsForBooking(sb, b, salon.timezone), sb.from('booking_tokens').select('token').eq('booking_id', b.id).eq('purpose', 'manage_booking').maybeSingle()]);
  const manage = mt ? `/manage/${mt.token}` : undefined;
  const pend = clientPending(rows);
  const when = new Intl.DateTimeFormat('en-NZ', { timeZone: salon.timezone, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(b.startsAt)) + ', ' + time12(b.startsAt, salon.timezone);
  void dateLong;
  return (
    <FormFillView mode="public" salon={salon.name} first={b.clientName.split(' ')[0]} clientName={b.clientName} apptLine={when} svcLine={`${b.services} with ${b.staff}`}
      forms={pend.map((r) => toFill(r.tpl))} submit={submitPublicForms.bind(null, token)} links={{ manage, home: `/b/${salon.slug}` }}
      empty={{ title: 'You are all set', text: 'There are no forms for you to complete before this appointment. Thank you.', link: manage ? { href: manage, label: 'Manage booking' } : { href: `/b/${salon.slug}`, label: 'Back to ' + salon.name } }} />
  );
}
