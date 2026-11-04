'use client';
import { BottomSheet } from '@/components/BottomSheet';
import { S } from '@/app/(dash)/calendar/pickers';
import { CLOSE, Icon, RING } from '@/components/ui';
import { TONE } from '@/lib/tones';

/** 52px on purpose: this button sits beside the 52px main button of the page (and its 52px search box), so the row lines up. */
const FILTER_RING = 'flex:0 0 52px;width:52px;height:52px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;position:relative';

/** The filter button (a filter icon, not the three dots of More actions) that sits left of a page's main button and opens its filter. A dot shows while a filter is on. */
export function FilterButton({ onClick, active, label = 'Filter' }: { onClick: () => void; active: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-haspopup="dialog" style={S(FILTER_RING)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6.5h16M7 12h10M10 17.5h4" /></svg>
      {active && <span aria-hidden="true" style={S('position:absolute;top:10px;right:10px;width:10px;height:10px;border-radius:999px;background:#5B3DF5;border:2px solid #FFFFFF')} />}
    </button>
  );
}

/** Shown under the buttons while a filter is on, so it is clear the list is not complete. Tapping it clears the filter. */
export function ActiveFilter({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button type="button" onClick={onClear} aria-label={'Showing ' + label + '. Clear filter'} style={S('align-self:flex-start;display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 8px 0 14px;border:0;border-radius:999px;background:' + TONE.purple.bg + ';color:' + TONE.purple.fg + ';font:inherit;font-size:13.5px;font-weight:500;cursor:pointer')}>
      {label}
      <Icon name="close" size={14} w={2.2} decorative />
    </button>
  );
}

/** The filter as a full-page sheet, like the other quick-action sheets. One option is ticked. */
export function FilterSheet({ title, options, value, onPick, onClose }: { title: string; options: { id: string; label: string }[]; value: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <BottomSheet label={title} onClose={onClose} z={6} gap={0} handleGap={12}>
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}>
          <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{title}</h2>
          <button onClick={onClose} aria-label="Close" data-close="" style={S(RING)}>{CLOSE}</button>
        </div>
        <div role="group" aria-label={title} style={S('display:flex;flex-direction:column;padding:4px 0;border-top:1px solid #EEF0F3')}>
          {options.map((o) => {
            const on = value === o.id;
            return (
              <button key={o.id} onClick={() => { onPick(o.id); onClose(); }} aria-pressed={on} style={S('display:flex;align-items:center;gap:12px;width:100%;min-height:56px;box-sizing:border-box;padding:0;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;color:#0E1116;cursor:pointer;font-weight:' + (on ? 600 : 400))}>
                <span style={S('flex:1 1 auto;min-width:0')}>{o.label}</span>
                {on && <Icon name="tick" size={22} color="#0E1116" decorative />}
              </button>
            );
          })}
        </div>
      </BottomSheet>
  );
}
