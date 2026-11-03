'use client';
// The one card used by the public pages that only say something: a dead or expired link, "online booking is off", an offer.
// It replaces the old class-based .auth/.card screens so these pages look like the rest of the product (grey page, white card, black pill).
import Link from 'next/link';
import type { ReactNode } from 'react';
import { S } from '@/app/(dash)/calendar/pickers';
import { BLACK } from '@/components/ui';

export function PublicCard({ title, brand, children }: { title: string; brand?: string; children?: ReactNode }) {
  return (
    <div className="cal-root" style={S("min-height:100dvh;box-sizing:border-box;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;display:flex;align-items:center;justify-content:center;padding:24px 16px")}>
      <div style={S('width:100%;max-width:420px;box-sizing:border-box;display:flex;flex-direction:column;gap:20px')}>
        {!!brand && <div style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{brand}</div>}
        <section style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:28px;display:flex;flex-direction:column;gap:16px')}>
          <h1 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;overflow-wrap:anywhere')}>{title}</h1>
          {children}
        </section>
      </div>
    </div>
  );
}

/** A paragraph of body text inside the card. */
export function CardText({ children, small }: { children: ReactNode; small?: boolean }) {
  return <p style={S(`margin:0;color:#5E6673;font-size:${small ? 13.5 : 15}px;line-height:1.5`)}>{children}</p>;
}

/** The black pill as a link. */
export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} style={S(BLACK + ';flex:0 0 auto')}>{children}</Link>;
}

/** The black pill as a form submit button. */
export function PrimaryButton({ children }: { children: ReactNode }) {
  return <button type="submit" style={S(BLACK + ';flex:0 0 auto;width:100%')}>{children}</button>;
}
