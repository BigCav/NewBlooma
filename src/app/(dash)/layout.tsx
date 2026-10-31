import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { requireCtx } from '@/lib/session';
import { SideNav, TabBar } from '@/components/Nav';
import { NewApptHost } from '@/components/NewApptHost';
import { NewMenuHost } from '@/components/NewMenu';
import { DrawerKeys } from '@/components/DrawerKeys';
import { ThemeApply } from '@/components/Theme';

type Ctx = Awaited<ReturnType<typeof requireCtx>>;

/** The unread badge streams in on its own, so it never holds the page back. */
async function LiveNav({ ctx }: { ctx: Ctx }) {
  const { count } = await ctx.sb.from('inbox_items').select('id', { count: 'exact', head: true }).or('unread.eq.true,and(status.eq.new,type.in.(request,reschedule))');
  return <SideNav slug={ctx.salon.slug} unread={count ?? 0} role={ctx.staff.app_role} />;
}

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const dark = (await cookies()).get('theme')?.value === 'dark';
  return (
    <div className="shell">
      <ThemeApply dark={dark} />
      <Suspense fallback={<SideNav slug={ctx.salon.slug} unread={0} role={ctx.staff.app_role} />}><LiveNav ctx={ctx} /></Suspense>
      <main className="main">{children}</main>
      <TabBar />
      <NewApptHost />
      <NewMenuHost />
      <DrawerKeys />
    </div>
  );
}
