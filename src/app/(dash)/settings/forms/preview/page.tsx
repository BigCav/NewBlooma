import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/session';
import { loadTemplates, toFill } from '@/lib/forms';
import { FormFillView } from '@/components/FormFillView';

export const metadata = { title: 'Form preview' };
export const dynamic = 'force-dynamic';

/** What a client sees for one form. Nothing entered here is saved. */
export default async function Preview({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const { sb, salon } = await requireOwner();
  const t = (await loadTemplates(sb, salon.id)).find((x) => x.id === f);
  if (!t) notFound();
  async function noop() { 'use server'; return {}; }
  return (
    <FormFillView mode="preview" salon={salon.name} first="there" clientName="" apptLine="Your appointment date and time" svcLine="Your service with your stylist"
      forms={[toFill(t)]} submit={noop} links={{ back: `/settings/forms?f=${t.id}`, backLabel: 'Forms' }} />
  );
}
