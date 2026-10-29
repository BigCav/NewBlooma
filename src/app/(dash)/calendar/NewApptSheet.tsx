'use client';
import { useEffect, useRef } from 'react';
import { NewApptForm } from './NewApptForm';
import { S } from './pickers';
import { useCalendar } from './useCalendar';
import type { Props } from './calUi';

export type NewApptData = Pick<Props, 'today' | 'nowMin' | 'tz' | 'slug' | 'team' | 'hours' | 'closed' | 'services' | 'offers' | 'cfg' | 'recent'>;

/** The new-appointment sheet on its own, over whatever page the + button was pressed on. */
export default function NewApptSheet({ data, onClose, onCreated }: { data: NewApptData; onClose: () => void; onCreated: (r: { id?: string; day: string }) => void }) {
  const p: Props = { ...data, day: data.today, view: 'day', bookings: [], blocks: [], staffFilter: 'all', initialNew: true, onCreated };
  const c = useCalendar(p);
  // Close once the sheet has been open and is then dismissed.
  const wasOpen = useRef(false);
  useEffect(() => { if (c.open) wasOpen.current = true; else if (wasOpen.current) onClose(); }, [c.open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="m-cal cal-root" style={S("position:fixed;left:0;right:0;top:0;bottom:0;z-index:60;font-family:'Geist',system-ui,sans-serif;color:#0E1116;font-size:14px;line-height:1.4")}>
      <button onClick={c.close} aria-label="Close" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
      <div className="sheet" role="dialog" aria-label="New appointment" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:16px')}>
        <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0')} />
        <NewApptForm c={c} props={p} onCancel={c.close} />
      </div>
    </div>
  );
}
