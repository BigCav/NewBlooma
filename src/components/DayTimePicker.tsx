'use client';
// Picking a day and a time, drawn once: the row of days and the grid of times under it. The dashboard's booking wizards, the client
// "Book appointment" panel, the public booking page and the Manage page's reschedule all use these, so a day and a time look the same everywhere.
import { S } from '@/app/(dash)/calendar/s';
import { clock12 } from '@/lib/display';

export type PickDay = { ymd: string; abbr: string; num: string | number; month: string; full: string; closed: boolean };

const dayCss = (on: boolean, closed: boolean, width: number) =>
  `flex:0 0 ${width}px;height:76px;box-sizing:border-box;padding:0;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:inherit;border:1px solid ${on ? '#0E1116' : '#E6E8EC'};background:${on ? '#0E1116' : closed ? '#F4F5F7' : '#FFFFFF'};color:${on ? '#FFFFFF' : closed ? '#8A93A0' : '#0E1116'};cursor:${closed && !on ? 'default' : 'pointer'}`;

/**
 * A scrolling row of days. A closed day is greyed out; by default it cannot be picked, but pass pickClosed where choosing it should
 * explain why there are no times (the public pages say "We are closed on Sundays").
 */
export function DayStrip({ days, selected, onPick, width = 60, pickClosed, label, labelledBy }: {
  days: PickDay[]; selected: string; onPick: (ymd: string) => void; width?: number; pickClosed?: boolean; label?: string; labelledBy?: string;
}) {
  return (
    <div role="group" className="hscroll" aria-label={labelledBy ? undefined : label ?? 'Day'} aria-labelledby={labelledBy} style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
      {days.map((d) => {
        const on = selected === d.ymd;
        const sub = on ? '#D5D9E0' : d.closed ? '#8A93A0' : '#5E6673';
        return (
          <button key={d.ymd} onClick={() => { if (!d.closed || pickClosed) onPick(d.ymd); }} disabled={d.closed && !pickClosed} aria-pressed={on} aria-label={d.full + (d.closed ? ', closed' : '')} style={S(dayCss(on, d.closed, width))}>
            <span style={S(`font-size:12.5px;color:${sub}`)}>{d.abbr}</span>
            <span style={S('font-size:17px;font-weight:600')}>{d.num}</span>
            <span style={S(`font-size:11.5px;color:${sub}`)}>{d.month.slice(0, 3)}</span>
          </button>
        );
      })}
    </div>
  );
}

const slotCss = (on: boolean, ok: boolean, current: boolean) =>
  `width:100%;height:44px;padding:0;border-radius:14px;font-size:14px;font-weight:500;font-family:inherit;border:1px solid ${on ? '#0E1116' : ok ? (current ? '#5E6673' : '#E1E4E9') : '#EEF0F3'};background:${on ? '#0E1116' : ok ? '#FFFFFF' : '#F4F5F7'};color:${on ? '#FFFFFF' : ok ? '#0E1116' : '#8A93A0'}${ok ? ';cursor:pointer' : ';text-decoration:line-through;cursor:default'}`;

/** The times of a day (minutes after midnight). A time that cannot be booked is struck through; `current` marks the time a booking already has. */
export function TimeGrid({ times, selected, onPick, cols = 'repeat(4,minmax(0,1fr))', current, label, labelledBy }: {
  times: { min: number; ok: boolean }[]; selected: number | null; onPick: (min: number) => void; cols?: string; current?: number | null; label?: string; labelledBy?: string;
}) {
  return (
    <div role="group" aria-label={labelledBy ? undefined : label ?? 'Time'} aria-labelledby={labelledBy} style={S(`display:grid;grid-template-columns:${cols};gap:8px`)}>
      {times.map(({ min, ok }) => {
        const on = selected === min && ok;
        const isCurrent = current === min;
        return (
          <button key={min} onClick={() => { if (ok) onPick(min); }} disabled={!ok} aria-pressed={on} aria-label={clock12(min) + (ok ? '' : ', unavailable') + (isCurrent ? ', your current time' : '')} style={S(slotCss(on, ok, isCurrent))}>{clock12(min)}</button>
        );
      })}
    </div>
  );
}
