import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/session';
import { dateLong, time12 } from '@/lib/format';
import { loadBooking, rowsForBooking, toFill } from '@/lib/forms';
import { FormFillView } from '@/components/FormFillView';
import { submitStaffForms } from '../../actions';

export const metadata = { title: 'Fill in a form' };
export const dynamic = 'force-dynamic';

/** A team member fills a form in with the client at the salon. */
export default async function Fill({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ bookingId }, { t }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) notFound();
  const { sb, salon } = await requireCtx();
  const b = await loadBooking(sb, bookingId, salon.timezone);
  if (!b) notFound();
  const rows = (await rowsForBooking(sb, b, salon.timezone)).filter((r) => r.needed && !r.tpl.isPatch && (r.state === 'missing' || r.state === 'expired') && (!t || r.tpl.id === t));
  const back = `/clients/forms?c=${b.clientId}`;
  if (!rows.length) return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Nothing left to fill in</h1>
      <p style={{ color: '#5E6673', margin: '0 0 16px' }}>{b.clientName} has no outstanding forms for this appointment.</p>
      <Link href={back} style={{ color: '#5B3DF5', fontWeight: 500 }}>Back to client forms</Link>
    </div>
  );
  const when = `${dateLong(b.startsAt, salon.timezone)}, ${time12(b.startsAt, salon.timezone)}`;
  return (
    <FormFillView mode="staff" salon={salon.name} first={b.clientName.split(' ')[0]} clientName={b.clientName} apptLine={when} svcLine={`${b.services} with ${b.staff}`}
      forms={rows.map((r) => toFill(r.tpl))} submit={submitStaffForms.bind(null, bookingId)} links={{ back, backLabel: 'Client forms' }} />
  );
}
