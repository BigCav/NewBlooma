import { requireCtx } from '@/lib/session';
import { SideNav, TabBar } from '@/components/Nav';

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const { sb, salon } = await requireCtx();
  const { count } = await sb.from('inbox_items').select('id', { count: 'exact', head: true }).or('unread.eq.true,and(status.eq.new,type.in.(request,reschedule))');
  return (
    <div className="shell">
      <SideNav slug={salon.slug} unread={count ?? 0} />
      <main className="main">{children}</main>
      <TabBar />
    </div>
  );
}
