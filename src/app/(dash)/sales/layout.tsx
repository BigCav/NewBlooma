import { requireCtx } from '@/lib/session';
import { SubNav } from '@/components/SubNav';

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const { staff } = await requireCtx();
  // The daily summary is for the owner and reception, so stylists get no menu at all.
  if (staff.app_role === 'stylist') return children;
  return (
    <SubNav title="Sales" items={[{ href: '/sales', label: 'Sales' }, { href: '/sales/summary', label: 'Daily summary' }]}>
      {children}
    </SubNav>
  );
}
