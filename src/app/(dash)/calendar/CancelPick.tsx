'use client';
import { useState } from 'react';
import { CANCEL_REASONS } from '@/lib/cal';
import { S } from './s';
import { DANGER, OUTLINE, FilterChip, dim } from '@/components/ui';

/** Asks why a booking is being cancelled, so the reason shows in reports. "Client cancelled" is chosen to begin with, as it is the usual one. */
export function CancelPick({ name, mobile, busy, onConfirm, onBack }: { name: string; mobile: boolean; busy: boolean; onConfirm: (reason: string) => void; onBack: () => void }) {
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  return (
    <div role="group" aria-labelledby="cancel-why" style={S('display:flex;flex-direction:column;gap:12px;padding-top:4px')}>
      <div id="cancel-why" style={S('font-size:14px;font-weight:600')}>Why is {name}&apos;s appointment being cancelled?</div>
      <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>
        {CANCEL_REASONS.map((r) => <FilterChip key={r} on={reason === r} phone={mobile} onClick={() => setReason(r)}>{r}</FilterChip>)}
      </div>
      <div style={S('display:flex;gap:10px')}>
        <button onClick={onBack} disabled={busy} style={S(OUTLINE + dim(busy))}>Keep appointment</button>
        <button onClick={() => onConfirm(reason)} disabled={busy} style={S(DANGER + dim(busy))}>{busy ? 'Cancelling…' : 'Cancel appointment'}</button>
      </div>
    </div>
  );
}
