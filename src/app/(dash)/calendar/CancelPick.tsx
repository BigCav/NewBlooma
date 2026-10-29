'use client';
import { useState } from 'react';
import { CANCEL_REASONS } from '@/lib/cal';
import { S } from './pickers';

/** Asks why a booking is being cancelled, so the reason shows in reports. "Client cancelled" is chosen to begin with, as it is the usual one. */
export function CancelPick({ name, mobile, busy, onConfirm, onBack }: { name: string; mobile: boolean; busy: boolean; onConfirm: (reason: string) => void; onBack: () => void }) {
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  const h = mobile ? 48 : 44;
  const chip = (on: boolean) => 'flex:0 0 auto;height:' + (mobile ? 44 : 40) + 'px;padding:0 16px;border-radius:999px;font-size:' + (mobile ? 14 : 13.5) + 'px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116') + ';cursor:pointer';
  return (
    <div role="group" aria-labelledby="cancel-why" style={S('display:flex;flex-direction:column;gap:12px;padding-top:4px')}>
      <div id="cancel-why" style={S('font-size:14px;font-weight:600')}>Why is {name}&apos;s booking being cancelled?</div>
      <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>
        {CANCEL_REASONS.map((r) => <button key={r} onClick={() => setReason(r)} aria-pressed={reason === r} style={S(chip(reason === r))}>{r}</button>)}
      </div>
      <div style={S('display:flex;gap:10px')}>
        <button onClick={() => onConfirm(reason)} disabled={busy} style={S('flex:1 1 0;height:' + h + 'px;border:0;border-radius:999px;background:#B42318;color:#FFFFFF;font-size:14px;font-weight:500;cursor:pointer')}>Cancel booking</button>
        <button onClick={onBack} disabled={busy} style={S('flex:1 1 0;height:' + h + 'px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500;cursor:pointer')}>Keep booking</button>
      </div>
    </div>
  );
}
