'use client';
import { S } from '@/app/(dash)/calendar/pickers';

const RING = 'flex:0 0 52px;width:52px;height:52px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;position:relative';

/** The three-dot button that sits left of a page's main button and opens its filter. A dot shows while a filter is on. */
export function FilterButton({ onClick, active, label = 'Filter' }: { onClick: () => void; active: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-haspopup="dialog" style={S(RING)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#0E1116"><circle cx="12" cy="5.5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="18.5" r="1.6" /></svg>
      {active && <span aria-hidden="true" style={S('position:absolute;top:10px;right:10px;width:10px;height:10px;border-radius:999px;background:#5B3DF5;border:2px solid #FFFFFF')} />}
    </button>
  );
}

/** Shown under the buttons while a filter is on, so it is clear the list is not complete. Tapping it clears the filter. */
export function ActiveFilter({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button type="button" onClick={onClear} aria-label={'Showing ' + label + '. Clear filter'} style={S('align-self:flex-start;display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 8px 0 14px;border:0;border-radius:999px;background:#ECE8FE;color:#3A2BB5;font:inherit;font-size:13.5px;font-weight:500;cursor:pointer')}>
      {label}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  );
}

/** The filter as a full-page sheet, like the other quick-action sheets. One option is ticked. */
export function FilterSheet({ title, options, value, onPick, onClose }: { title: string; options: { id: string; label: string }[]; value: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:6')}>
      <button onClick={onClose} aria-label="Close" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
      <div className="sheet" role="dialog" aria-label={title} style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column')}>
        <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0;margin-bottom:12px')} />
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}>
          <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={S('flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </div>
        <div role="group" aria-label={title} style={S('display:flex;flex-direction:column;padding:4px 0;border-top:1px solid #EEF0F3')}>
          {options.map((o) => {
            const on = value === o.id;
            return (
              <button key={o.id} onClick={() => { onPick(o.id); onClose(); }} aria-pressed={on} style={S('display:flex;align-items:center;gap:12px;width:100%;min-height:56px;box-sizing:border-box;padding:0;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;color:#0E1116;cursor:pointer;font-weight:' + (on ? 600 : 400))}>
                <span style={S('flex:1 1 auto;min-width:0')}>{o.label}</span>
                {on && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
