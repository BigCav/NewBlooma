'use client';
// The booking a message is about: a card under the header to tap, and its details in the same sheet the calendar and Sales use.
import Link from 'next/link';
import { BottomSheet } from '@/components/BottomSheet';
import { BLACK, Chip, OUTLINE } from '@/components/ui';
import { PAYMENT_STATUS, bookingStatus } from '@/lib/status';
import { S } from '../calendar/pickers';
import { ICON_PERSON, ICON_TIME, VisitSheet } from '../calendar/VisitSheet';
import type { InboxBooking } from './shared';

export function BookingCard({ b, onOpen }: { b: InboxBooking; onOpen: () => void }) {
  const what = b.lines.map((l) => l.name).join(' + ') || 'Appointment';
  return (
    <button onClick={onOpen} aria-haspopup="dialog" aria-label={`Booking ${b.ref}, ${what}, ${b.day}. Quick view`} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:12px 14px 12px 16px;border:1px solid #E6E8EC;border-radius:22px;background:#FFFFFF;font:inherit;text-align:left;color:#0E1116;cursor:pointer')}>
      <span style={S('flex:1 1 auto;min-width:0')}>
        <span style={S('display:flex;align-items:center;gap:8px')}>
          <span style={S('font-size:14.5px;font-weight:600')}>{b.ref ? 'Booking ' + b.ref : 'Booking'}</span>
          <Chip tone={bookingStatus(b.status).tone}>{bookingStatus(b.status).label}</Chip>
        </span>
        <span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{what}, {b.day}, {b.time.split(' to ')[0]}</span>
      </span>
      <span style={S('flex:0 0 auto;display:flex;align-items:center;gap:4px;font-size:13.5px;font-weight:500')}>
        Quick view
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
      </span>
    </button>
  );
}

export function BookingQuickView({ b, client, onClose }: { b: InboxBooking; client: string; onClose: () => void }) {
  return (
    <BottomSheet label="Booking details" onClose={onClose} backdropLabel="Close details" z={7}>
      <VisitSheet onClose={onClose} title={b.day}
        status={<Chip tone={bookingStatus(b.status).tone} size="lg">{bookingStatus(b.status).label}</Chip>}
        tags={(b.paid || b.refunded) && <div style={S('display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:-6px')}>
          {b.paid && <Chip tone={PAYMENT_STATUS.paid.tone}>{b.paidText}</Chip>}
          {b.refunded && <Chip tone={PAYMENT_STATUS.refunded.tone}>{PAYMENT_STATUS.refunded.label}</Chip>}
        </div>}
        name={client} sub={b.ref ? 'Booking ' + b.ref : 'Booking'}
        details={[{ label: 'Time', value: b.time, icon: ICON_TIME }, { label: 'With', value: b.staff, icon: ICON_PERSON, photo: b.photo }]}
        lines={b.lines.map((l) => ({ key: l.key, name: l.name, sub: l.dur, price: l.price }))}
        total={b.total} label={b.label}
        actions={<div style={S('display:flex;gap:10px')}>
          {b.clientId && <Link href={`/clients/${b.clientId}`} className="ghost" style={S(OUTLINE)}>Open profile</Link>}
          {b.calendarHref ? <Link href={b.calendarHref} style={S(BLACK)}>View in calendar</Link> : <button onClick={onClose} style={S(BLACK)}>Close</button>}
        </div>}
      />
    </BottomSheet>
  );
}
