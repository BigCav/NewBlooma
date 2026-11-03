'use client';
// Signed-in customer chip for the salon page header: initials, first name (links to the account page) and Sign out.
import Link from 'next/link';
import { Avatar } from '@/components/ui';
import { firstName } from '@/lib/people';
import { clientSignOut } from './book/actions';

/** The signed-in chip keeps its dark ink look. */
const INK = { bg: '#0E1116', fg: '#FFFFFF' };

export function AcctChip({ slug, name, wide = false }: { slug: string; name: string; wide?: boolean }) {
  const signOut = async () => { try { await clientSignOut(); } catch { /* cleared on the next load */ } window.location.assign('/b/' + slug); };
  const first = firstName(name, name);
  if (wide) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 999, background: '#FFFFFF', border: '1px solid #E6E8EC' }}>
      <Avatar name={name} size="sm" tone={INK} />
      <Link href={`/b/${slug}/account`} aria-label="Your account" style={{ flex: '1 1 auto', minWidth: 0, fontSize: 14, fontWeight: 500, overflowWrap: 'anywhere', color: '#0E1116', textDecoration: 'none' }}>{name}</Link>
      <button onClick={signOut} style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', height: 44, padding: '0 14px', borderRadius: 999, border: 0, background: 'transparent', color: '#5B3DF5', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, boxSizing: 'border-box', padding: '0 6px', border: '1px solid #E1E4E9', borderRadius: 999, background: '#FFFFFF' }}>
      <Avatar name={name} size="xs" tone={INK} />
      <Link href={`/b/${slug}/account`} aria-label="Your account" style={{ fontSize: 14, fontWeight: 500, color: '#0E1116', textDecoration: 'none' }}>{first}</Link>
      <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', height: 32, padding: '0 12px', borderRadius: 999, border: 0, background: 'transparent', color: '#5B3DF5', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
    </div>
  );
}
