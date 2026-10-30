import { cookies } from 'next/headers';
import { requireCtx } from '@/lib/session';
import { SideNav, TabBar } from '@/components/Nav';
import { NewApptHost } from '@/components/NewApptHost';
import { NewMenuHost } from '@/components/NewMenu';
import { ThemeApply } from '@/components/Theme';

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const { sb, salon, staff } = await requireCtx();
  const { count } = await sb.from('inbox_items').select('id', { count: 'exact', head: true }).or('unread.eq.true,and(status.eq.new,type.in.(request,reschedule))');
  const dark = (await cookies()).get('theme')?.value === 'dark';
  return (
    <div className="shell">
      <ThemeApply dark={dark} />
      <SideNav slug={salon.slug} unread={count ?? 0} role={staff.app_role} />
      <main className="main">{children}</main>
      <TabBar />
      <NewApptHost />
      <NewMenuHost />
    </div>
  );
}
