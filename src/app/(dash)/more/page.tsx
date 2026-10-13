import Link from 'next/link';
import { requireCtx } from '@/lib/session';
import { signOut } from '../../auth-actions';

export const metadata = { title: 'More' };
const LINKS: [string, string][] = [['/services', 'Services'], ['/team', 'Team'], ['/products', 'Products'], ['/waitlist', 'Waitlist'], ['/reviews', 'Reviews'], ['/reports', 'Reports'], ['/payroll', 'Payroll'], ['/settings', 'Settings']];

export default async function More() {
  const { salon, staff } = await requireCtx();
  return (
    <>
      <div className="page-head"><div><h1>More</h1><div className="muted">{salon.name} · {staff.name}</div></div></div>
      <div className="card stack" style={{ gap: 0 }}>
        {LINKS.map(([h, l]) => <Link key={h} href={h} className="row between" style={{ padding: '14px 4px', borderBottom: '1px solid var(--line)' }}><b>{l}</b><span className="muted">›</span></Link>)}
        <form action={signOut} style={{ paddingTop: 14 }}><button className="btn danger">Sign out</button></form>
      </div>
    </>
  );
}
