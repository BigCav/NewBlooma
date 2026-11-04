import { requireCtx } from '@/lib/session';
import { signOut } from '../../auth-actions';
import { MoreView } from './MoreView';

export const metadata = { title: 'More' };

export default async function More() {
  const { salon, staff } = await requireCtx();
  return <MoreView slug={salon.slug} role={staff.app_role} signOut={signOut} />;
}
