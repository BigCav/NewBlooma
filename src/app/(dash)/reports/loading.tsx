import { PageSkeleton } from '@/components/Skeleton';

export default function Loading() {
  return <PageSkeleton kind="report" stats={4} />;
}
