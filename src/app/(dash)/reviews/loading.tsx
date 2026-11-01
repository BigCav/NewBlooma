import { PageSkeleton } from '@/components/Skeleton';

export default function Loading() {
  return <PageSkeleton kind="grid" action search={false} />;
}
