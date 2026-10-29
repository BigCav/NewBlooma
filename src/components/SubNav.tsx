'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type SubItem = { href: string; label: string; /** Paths that count as this item. The first item that matches wins. */ match?: string[]; exact?: boolean };

/** A section's own menu, as a column beside the page on desktop. Mobile hides it, since those pages link to each other themselves. */
export function SubNav({ title, items, children }: { title: string; items: SubItem[]; children: React.ReactNode }) {
  const p = usePathname();
  const hit = (it: SubItem) => (it.match ?? [it.href]).some((m) => (it.exact ? p === m : p === m || p.startsWith(m + '/')));
  // The most specific item wins, so "/sales" does not light up on "/sales/summary".
  const cur = [...items].sort((a, b) => b.href.length - a.href.length).find(hit)?.href;
  return (
    <div className="sub-wrap">
      <nav className="subnav" aria-label={title}>
        <h2 className="subnav-title">{title}</h2>
        {items.map((it) => <Link key={it.href} href={it.href} className="subnav-link" aria-current={cur === it.href ? 'page' : undefined}>{it.label}</Link>)}
      </nav>
      <div className="sub-body">{children}</div>
    </div>
  );
}
