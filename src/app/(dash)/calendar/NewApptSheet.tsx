'use client';
import { BottomSheet } from '@/components/BottomSheet';
import { useEffect, useRef } from 'react';
import { NewApptForm } from './NewApptForm';
import { S } from './pickers';
import { useCalendar } from './useCalendar';
import type { Props } from './calUi';

export type NewApptData = Pick<Props, 'today' | 'nowMin' | 'tz' | 'slug' | 'team' | 'hours' | 'closed' | 'services' | 'offers' | 'cfg' | 'recent'>;

/** The new-appointment sheet on its own, over whatever page the + button was pressed on. */
export default function NewApptSheet({ data, client, instant, onClose, onCreated }: { data: NewApptData; /** Replacing a placeholder that was already showing: appear in place without sliding in. */ instant?: boolean; /** An existing client to book (from their profile). */ client?: { id: string; name: string } | null; onClose: () => void; onCreated: (r: { id?: string; day: string }) => void }) {
  const p: Props = { ...data, day: data.today, view: 'day', bookings: [], blocks: [], staffFilter: 'all', initialNew: true, initialClient: client?.name, initialClientId: client?.id, onCreated };
  const c = useCalendar(p);
  // Close once the sheet has been open and is then dismissed.
  const wasOpen = useRef(false);
  useEffect(() => { if (c.open) wasOpen.current = true; else if (wasOpen.current) onClose(); }, [c.open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={'m-cal cal-root m-drawer' + (instant ? ' swap' : '')} style={S("font-family:'Geist',system-ui,sans-serif;color:#0E1116;font-size:14px;line-height:1.4")}>
      <BottomSheet label="New appointment" onClose={c.close} z={60} fixed>
        <NewApptForm c={c} props={p} onCancel={c.close} />
      </BottomSheet>
    </div>
  );
}
