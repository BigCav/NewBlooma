'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** The + sheet sends people to a page with ?new=1. Open that page's create flow, then drop the flag from the address. */
export function useNewParam(open: () => void) {
  const sp = useSearchParams(), path = usePathname(), router = useRouter();
  const fn = useRef(open);
  fn.current = open;
  const flag = sp.get('new');
  useEffect(() => {
    if (flag !== '1') return;
    fn.current();
    router.replace(path, { scroll: false });
  }, [flag, path, router]);
}
