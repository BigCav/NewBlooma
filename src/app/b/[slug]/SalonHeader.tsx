// The top of every customer page of a salon (its page, booking, appointment and account): the salon's name, an open or closed pill,
// and who is signed in. One component, so they are the same size and in the same place everywhere.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Avatar, RING, BACK } from '@/components/ui';
import { firstName } from '@/lib/people';
import { TONE } from '@/lib/tones';
import { S } from '../../(dash)/calendar/s';

/** The signed-in chip keeps its dark ink look. */
const INK = { bg: '#0E1116', fg: '#FFFFFF' };
const H = 44;

/** The signed-in customer: initials and first name, and the whole chip opens their account. */
export function AcctChip({ slug, name, wide = false }: { slug: string; name: string; wide?: boolean }) {
  return (
    <Link href={`/b/${slug}/account`} aria-label="Your account" style={S(`display:flex;align-items:center;gap:8px;height:${H}px;box-sizing:border-box;padding:0 16px 0 6px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;text-decoration:none;font-size:14px;font-weight:500;${wide ? 'width:100%' : 'flex:0 0 auto'}`)}>
      <Avatar name={name} size="xs" tone={INK} />
      <span style={S('min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{wide ? name : firstName(name, name)}</span>
    </Link>
  );
}

/** "Open now, until 5pm" / "Closed for today": the same height as the account chip beside it. */
export function StatusPill({ open, children }: { open: boolean; children: ReactNode }) {
  const t = TONE[open ? 'green' : 'grey'];
  return <span style={S(`flex:0 0 auto;display:inline-flex;align-items:center;height:${H}px;box-sizing:border-box;padding:0 16px;border-radius:999px;font-size:13.5px;font-weight:500;white-space:nowrap;background:${t.bg};color:${t.fg}`)}>{children}</span>;
}

/**
 * `m` is the phone layout: name and pill on one row, the account chip full width under them.
 * `back` adds the round back button in front of the name; `subtitle` is the small line under it; `action` sits at the far end (Book now).
 */
export function SalonHeader({ slug, name, subtitle, back, status, account, action, m = false }: {
  slug: string; name: string; subtitle?: string; back?: { onClick: () => void; label: string };
  status?: { open: boolean; text: string }; account?: { name: string } | null; action?: ReactNode; m?: boolean;
}) {
  const title = (
    <div style={S('min-width:0')}>
      <Link href={`/b/${slug}`} style={S('display:flex;align-items:center;min-height:' + (subtitle ? 0 : 44) + 'px;font-size:20px;font-weight:600;letter-spacing:-0.02em;color:#0E1116;text-decoration:none;overflow-wrap:anywhere')}>{name}</Link>
      {!!subtitle && <div style={S('font-size:13px;color:#5E6673')}>{subtitle}</div>}
    </div>
  );
  const left = (
    <div style={S('display:flex;align-items:center;gap:12px;min-width:0')}>
      {back && <button className="ghost" onClick={back.onClick} aria-label={back.label} style={S(RING)}>{BACK}</button>}
      {title}
    </div>
  );
  if (m) return (
    <header style={S('display:flex;flex-direction:column;gap:12px')}>
      <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>{left}{status && <StatusPill open={status.open}>{status.text}</StatusPill>}</div>
      {account && <AcctChip slug={slug} name={account.name} wide />}
      {action}
    </header>
  );
  return (
    <header style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 16px')}>
      {left}
      <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px')}>
        {status && <StatusPill open={status.open}>{status.text}</StatusPill>}
        {account && <AcctChip slug={slug} name={account.name} />}
        {action}
      </div>
    </header>
  );
}
