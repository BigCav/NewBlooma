'use client';
// The booking a message is about: a card under the header to tap, and its details in the same sheet the calendar and Sales use.
import Link from 'next/link';
import { BottomSheet } from '@/components/BottomSheet';
import { STATUS_LABEL } from '@/lib/format';
import { PRIMARY, SECOND, chipTone, kindOf } from '../calendar/calUi';
import { S } from '../calendar/pickers';
import { ICON_PERSON, ICON_TIME, VisitSheet } from '../calendar/VisitSheet';
import { initialsOf, type InboxBooking } from './shared';

const statusTone = (st: string) => (st === 'cancelled' || st === 'no_show' ? { bg: '#FCE3E3', fg: '#9B1C1C' } : chipTone[kindOf(st as Parameters<typeof kindOf>[0])]);
const chipCss = (st: string, big = false) => 'flex:0 0 auto;display:inline-block;border-radius:999px;font-weight:500;white-space:nowrap;background:' + statusTone(st).bg + ';color:' + statusTone(st).fg + (big ? ';font-size:14px;padding:8px 16px' : ';font-size:12.5px;padding:4px 12px');
const BTN = ';display:flex;align-items:center;justify-content:center;text-decoration:none;height:52px';

export function BookingCard({ b, onOpen }: { b: InboxBooking; onOpen: () => void }) {
  const what = b.lines.map((l) => l.name).join(' + ') || 'Appointment';
  return (
    <button onClick={onOpen} aria-haspopup="dialog" aria-label={`Booking ${b.ref}, ${what}, ${b.day}. Quick view`} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:12px 14px 12px 16px;border:1px solid #E6E8EC;border-radius:22px;background:#FFFFFF;font:inherit;text-align:left;color:#0E1116;cursor:pointer')}>
      <span style={S('flex:1 1 auto;min-width:0')}>
        <span style={S('display:flex;align-items:center;gap:8px')}>
          <span style={S('font-size:14.5px;font-weight:600')}>{b.ref ? 'Booking ' + b.ref : 'Booking'}</span>
          <span style={S(chipCss(b.status))}>{STATUS_LABEL[b.status] ?? b.status}</span>
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
        status={<span style={S(chipCss(b.status, true))}>{STATUS_LABEL[b.status] ?? b.status}</span>}
        tags={(b.paid || b.refunded) && <div style={S('display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:-6px')}>
          {b.paid && <span style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{b.paidText}</span>}
          {b.refunded && <span style={S('padding:4px 12px;border-radius:999px;background:#F1F2F4;color:#4A525E;font-size:12.5px;font-weight:500')}>Refunded</span>}
        </div>}
        avatar={initialsOf(client)} name={client} sub={b.ref ? 'Booking ' + b.ref : 'Booking'}
        details={[{ label: 'Time', value: b.time, icon: ICON_TIME }, { label: 'With', value: b.staff, icon: ICON_PERSON, photo: b.photo }]}
        lines={b.lines.map((l) => ({ key: l.key, name: l.name, sub: l.dur, price: l.price }))}
        total={b.total} label={b.label}
        actions={<div style={S('display:flex;gap:10px')}>
          {b.clientId && <Link href={`/clients/${b.clientId}`} className="ghost" style={S(SECOND + BTN)}>Open profile</Link>}
          {b.calendarHref ? <Link href={b.calendarHref} style={S(PRIMARY + BTN)}>View in calendar</Link> : <button onClick={onClose} style={S(PRIMARY + BTN)}>Close</button>}
        </div>}
      />
    </BottomSheet>
  );
}
