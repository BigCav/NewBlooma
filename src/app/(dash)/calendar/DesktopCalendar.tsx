'use client';
// 1:1 conversion of the prototype's Main.dc.html (+ PageHeader). Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { ClientMatches } from './ClientMatches';
import { DiscountPick } from './DiscountPick';
import { BLOCK_KINDS, dayInfo, fmtMin, initials, addDaysYmd } from '@/lib/cal';
import { cancelBooking, deleteBlock } from './actions';
import { S, ServicePicker, TeamPicker } from './pickers';
import { first, usd, m2, BLOCK_DURS_M, METHODS, TIP_OPTS, slotCss, note, STEP } from './calUi';
import type { useCalendar } from './useCalendar';
import type { Props } from './calUi';

const chipD = (on: boolean, off = false) => 'flex:0 0 auto;height:40px;padding:0 16px;border-radius:999px;font-size:13.5px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : (off ? '#F4F5F7' : '#FFFFFF')) + ';color:' + (on ? '#FFFFFF' : (off ? '#8A93A0' : '#0E1116')) + (off ? ';cursor:default' : '');
const dayD = (on: boolean, closed: boolean) => 'flex:0 0 64px;height:72px;box-sizing:border-box;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:inherit;border:1px solid ' + (on ? '#0E1116' : '#E6E8EC') + ';background:' + (on ? '#0E1116' : (closed ? '#F4F5F7' : '#FFFFFF')) + ';color:' + (on ? '#FFFFFF' : (closed ? '#8A93A0' : '#0E1116')) + (closed ? ';cursor:default' : '');
const BTN = 'flex:1 1 0;height:44px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500';
const BTN2 = 'flex:1 1 0;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500';
const H2D = 'margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em';
const SUBD = 'margin:4px 0 0;color:#5E6673;font-size:14px;overflow-wrap:anywhere';
const LBL = 'font-size:14px;font-weight:600';
const INPUT = 'box-sizing:border-box;width:100%;height:44px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF';
const ERRD = 'margin:0;color:#B42318;font-size:13.5px;font-weight:500';
const DL = 'display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3';
const HATCH = 'repeating-linear-gradient(135deg,#F7F8FA 0,#F7F8FA 8px,#ECEEF2 8px,#ECEEF2 16px)';
const CHECK = <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19 7.5" /></svg>;
const hr = (h: number) => ((h + 11) % 12 + 1) + ':00' + (h >= 12 ? 'pm' : 'am');
const inp = (css: string) => ({ ...S(css), minHeight: 0 });

export function DesktopCalendar({ c, props }: { c: ReturnType<typeof useCalendar>; props: Props }) {
  const {
    act, addWalkin, backToView, bf, bfDur, blockId, blocks, bookings, busy, bvB, charge, close, co, coMath, createNew, cur, day, days14, di, ed, editPlan, error, go, hasError,
    hours, hrsOf, mode, moveBooking, nSlots, nWhy, nf, nFirstSvc, nOffers, nPickSvc, notice, now, offered, offers, openBlock, openBooking, openNew, pageSubtitle: _ps, pageTitle,
    plan, primary, query, reason, rs, saveBlock, saveEdit, services, setBf, setCo, setEd, setError, setMode, setNf, setNotice, setOpen, setQuery, setRs, setSelId, setStaffSel,
    setWi, slotsFor, sres, staffName, staffSel, startResched, svcMap, team, today, view, weekDays, wi, wiPlanCss, wiPlanText, wiSvc, wkRange, wkStaff, cfg,
    gHours, gStart, HOUR_PX, nowTop, setBlockId, vm, wkOpen: _wo, ws: _ws,
  } = c;

  const sq = query.trim();
  const dayB = bookings.filter((b) => b.dayYmd === day);
  const events = (view === 'week' ? bookings.filter((b) => b.staffId === wkStaff) : dayB).slice().sort((a, b) => a.dayYmd.localeCompare(b.dayYmd) || a.start - b.start);
  const selB = cur ?? events.find((b) => vm(b).k === 'live') ?? events.find((b) => b.dayYmd !== today || b.start > now) ?? events[0] ?? null;
  const sel = selB ? vm(selB) : null;
  const cols = view === 'week' ? [] : team.filter((m) => staffSel === 'all' || m.id === staffSel);
  const pool = view === 'week' ? team.filter((m) => m.id === wkStaff) : staffSel === 'all' ? team : team.filter((m) => m.id === staffSel);
  const colH = gHours.length * HOUR_PX;
  const dayHrs = hrsOf(day);
  const dayClosed = view === 'day' && !dayHrs?.open;
  const subtitle = view === 'week' ? wkRange + ', ' + staffName(wkStaff) : di.weekday + ', ' + di.num + ' ' + di.month;

  let nextOpening = dayHrs?.open ? 'None left' : 'Closed';
  if (dayHrs?.open) {
    for (let t = Math.max(dayHrs.from, day === today ? Math.ceil(now / STEP) * STEP : 0); t + STEP <= dayHrs.to; t += STEP) {
      if (pool.some((m) => !dayB.some((b) => b.staffId === m.id && t < b.end && b.start < t + STEP) && !blocks.some((b) => b.staffId === m.id && b.dayYmd === day && t < b.end && b.start < t + STEP))) { nextOpening = fmtMin(t); break; }
    }
  }
  const revenue = usd(events.reduce((a, b) => a + b.priceCents, 0));
  const upNext = events.filter((b) => b.dayYmd !== today || b.start > now).slice(0, 4);

  const topOf = (start: number, px = 2) => (start / 60 - gStart) * HOUR_PX + px;
  const evStyle = (b: (typeof bookings)[number], weekCol: boolean) => {
    const v = vm(b), tone = v.tone, compact = b.end - b.start <= 30, selected = mode === 'view' && selB?.id === b.id;
    const h = (b.end - b.start) / 60 * HOUR_PX - 4;
    const out = selected ? '1.5px solid rgba(14,17,22,0.35)' : 'none';
    if (weekCol) return 'position:absolute;left:3px;right:3px;top:' + topOf(b.start) + 'px;height:' + h + 'px;box-sizing:border-box;border:0;border-radius:10px;text-align:left;overflow:hidden;font:inherit;background:' + tone.bg + ';color:' + tone.fg + ';padding:' + (compact ? '0 8px' : '6px 8px') + ';display:flex;flex-direction:column;justify-content:' + (compact ? 'center' : 'flex-start') + ';gap:1px;outline:' + out + ';outline-offset:' + (selected ? 1 : 0) + 'px';
    return 'position:absolute;left:5px;right:5px;top:' + topOf(b.start) + 'px;height:' + h + 'px;box-sizing:border-box;border:0;border-radius:12px;text-align:left;overflow:hidden;font:inherit;background:' + tone.bg + ';color:' + tone.fg + ';padding:' + (compact ? '0 10px' : '7px 10px') + ';display:flex;flex-direction:' + (compact ? 'row' : 'column') + ';align-items:' + (compact ? 'center' : 'flex-start') + ';gap:' + (compact ? 8 : 1) + 'px;outline:' + out + ';outline-offset:' + (selected ? 1 : 0) + 'px';
  };
  const blStyle = (b: (typeof blocks)[number]) => 'position:absolute;left:5px;right:5px;top:' + topOf(b.start) + 'px;height:' + ((b.end - b.start) / 60 * HOUR_PX - 4) + 'px;box-sizing:border-box;border:1px solid #DDE0E6;border-radius:12px;background:' + HATCH + ';color:#4A525E;font:inherit;text-align:left;padding:6px 10px;overflow:hidden;display:flex;flex-direction:column;gap:1px;outline:' + (mode === 'blockview' && blockId === b.id ? '1.5px solid rgba(14,17,22,0.35)' : 'none') + ';outline-offset:1px';
  const kindName = (k: string) => BLOCK_KINDS.find((x) => x[0] === k)?.[1] ?? 'Blocked';
  const showNow = day === today && now >= gStart * 60 && now <= (gStart + gHours.length) * 60;
  const errP = () => hasError ? <p role="alert" style={S(ERRD)}>{error}</p> : null;
  const BackBtn = ({ label = 'Cancel' }: { label?: string }) => <button className="ghost" onClick={backToView} style={S(BTN2)}>{label}</button>;
  const stepDay = (dir: number) => go(addDaysYmd(day, dir * (view === 'week' ? 7 : 1)));
  const openWalkin = () => { setMode('walkin'); setOpen(true); setWi({ name: '', svc: null, pro: 'any', cat: '' }); setError(''); setNotice(''); };
  const openBlockForm = () => { setMode('block'); setOpen(true); setBf({ s: team[0]?.id ?? '', kind: 'lunch', day: day < today ? today : day, dur: 60, start: null }); setError(''); setNotice(''); };
  const hits = sres;

  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>

      {/* PageHeader */}
      <header style={S("display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;font-family:'Geist',system-ui,sans-serif;color:#0E1116")}>
        <div style={S('min-width:0')}>
          <h1 style={S('margin:0;font-size:34px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{pageTitle}</h1>
          <p style={S('margin:6px 0 0;color:#5E6673;font-size:15px')}>{subtitle}</p>
        </div>
        <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px')}>
          <label className="search" style={S('display:flex;align-items:center;gap:10px;height:44px;box-sizing:border-box;padding:0 16px;border-radius:999px;background:#FFFFFF;border:1px solid #E6E8EC;color:#5E6673')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients" aria-label="Search clients" style={{ ...S('border:0;outline:none;background:transparent;font:inherit;color:#0E1116;width:150px'), padding: '1px 2px', minHeight: 0, borderRadius: 0 }} />
          </label>
          <button onClick={openNew} style={S('display:flex;align-items:center;gap:8px;height:44px;padding:0 20px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            New appointment
          </button>
        </div>
      </header>

      <section aria-label="Today at a glance" style={S('display:flex;flex-wrap:wrap;gap:20px 64px')}>
        <div><div style={S('color:#5E6673;font-size:13.5px')}>Appointments</div><div style={S('margin-top:4px;font-size:38px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{String(events.length)}</div></div>
        <div><div style={S('color:#5E6673;font-size:13.5px')}>Booked revenue</div><div style={S('margin-top:4px;font-size:38px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{revenue}</div></div>
        <div>
          <div style={S('color:#5E6673;font-size:13.5px')}>Next opening</div>
          <div style={S('margin-top:4px;font-size:38px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{nextOpening}</div>
        </div>
      </section>

      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>

        <section aria-label="Schedule" style={S('flex:999 1 620px;min-width:0;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>

          <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E6E8EC')}>
            <div style={S('display:flex;align-items:center;gap:8px')}>
              <button className="ghost" onClick={() => stepDay(-1)} aria-label={view === 'week' ? 'Previous week' : 'Previous day'} style={S('width:40px;height:40px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6 8.5 12l6 6" /></svg>
              </button>
              <button className="ghost" onClick={() => stepDay(1)} aria-label={view === 'week' ? 'Next week' : 'Next day'} style={S('width:40px;height:40px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 6l6 6-6 6" /></svg>
              </button>
              <span style={S('margin-left:8px;font-size:16px;font-weight:600;letter-spacing:-0.01em')}>{view === 'week' ? wkRange : di.short}</span>
              {dayClosed && <span style={S('color:#5E6673;font-size:13.5px')}>Closed</span>}
            </div>
            <div style={S('display:flex;gap:8px')}>
              <button onClick={openWalkin} style={S('height:40px;padding:0 16px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:13.5px;font-weight:500')}>Walk-in</button>
              <button className="ghost" onClick={openBlockForm} style={S('height:40px;padding:0 16px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:13.5px;font-weight:500')}>Block time</button>
            </div>
            <div role="group" aria-label="Calendar view" style={S('display:flex;gap:2px;padding:3px;border-radius:999px;background:#F4F5F7')}>
              {([['day', 'Day'], ['week', 'Week']] as const).map(([v, l]) => (
                <button key={v} onClick={() => { if (v === 'week' && staffSel === 'all') setStaffSel(team[0]?.id ?? 'all'); setMode('view'); setError(''); go(day, v); }} aria-pressed={view === v}
                  style={S('height:34px;padding:0 16px;border:0;border-radius:999px;font-size:13.5px;font-weight:500;background:' + (view === v ? '#0E1116' : 'transparent') + ';color:' + (view === v ? '#FFFFFF' : '#0E1116'))}>{l}</button>
              ))}
            </div>
            <div role="group" aria-label="Filter by team member" style={S('display:flex;flex-wrap:wrap;gap:8px')}>
              {(view === 'week' ? [] : [{ id: 'all', label: 'Whole team' }]).concat(team.map((x) => ({ id: x.id, label: first(x.name) }))).map((ch) => {
                const on = (view === 'week' ? wkStaff : staffSel) === ch.id;
                return <button key={ch.id} onClick={() => setStaffSel(ch.id)} aria-pressed={on} style={S('height:40px;padding:0 16px;border-radius:999px;font-size:13.5px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116'))}>{ch.label}</button>;
              })}
            </div>
          </div>

          {view === 'day' && (
            <div style={S('overflow-x:auto')}>
              <div style={S('min-width:760px')}>
                <div style={S('display:flex;border-bottom:1px solid #E6E8EC')}>
                  <div style={S('flex:0 0 68px')} />
                  {cols.map((m) => (
                    <div key={m.id} style={S('flex:1 1 0;min-width:0;box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:14px 16px;border-left:1px solid #EEF0F3')}>
                      <div style={S('flex:0 0 34px;width:34px;height:34px;border-radius:999px;background:#EEF0F3;color:#0E1116;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600')}>{initials(m.name)}</div>
                      <div style={S('min-width:0')}>
                        <div style={S('font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{m.name}</div>
                        <div style={S('font-size:12.5px;color:#5E6673')}>{m.role}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={S('position:relative;display:flex')}>
                  <div style={S('flex:0 0 68px')}>
                    {gHours.map((h) => <div key={h} style={S('height:72px;box-sizing:border-box;padding:6px 0 0;text-align:center;font-size:12px;color:#5E6673')}>{hr(h)}</div>)}
                  </div>
                  {cols.map((m) => (
                    <div key={m.id} style={S('flex:1 1 0;min-width:0;position:relative;height:' + colH + 'px;border-left:1px solid #EEF0F3;background-image:linear-gradient(#EEF0F3 1px, transparent 1px);background-size:100% 72px')}>
                      {dayB.filter((b) => b.staffId === m.id).map((b) => {
                        const v = vm(b), compact = b.end - b.start <= 30;
                        return (
                          <button key={b.id} onClick={() => openBooking(b.id)} aria-label={v.label + (b.paid ? ', paid' : '')} style={S(evStyle(b, false))}>
                            {b.paid && <span aria-hidden="true" style={S('position:absolute;top:6px;right:6px;width:16px;height:16px;border-radius:999px;background:#14624A;display:flex;align-items:center;justify-content:center')}>{CHECK}</span>}
                            {compact && (<>
                              <span style={S('flex:0 1 auto;min-width:0;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.client}</span>
                              <span style={S('flex:0 100000 auto;min-width:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.services}</span>
                            </>)}
                            {!compact && (<>
                              <span style={S('max-width:100%;font-size:13px;font-weight:600;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.client}</span>
                              <span style={S('max-width:100%;font-size:12px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.services}</span>
                              {b.end - b.start >= 60 && <span style={S('font-size:12px;line-height:1.25;margin-top:2px')}>{v.time}</span>}
                            </>)}
                          </button>
                        );
                      })}
                      {blocks.filter((b) => b.dayYmd === day && b.staffId === m.id).map((b) => {
                        const k = kindName(b.kind), sub = first(m.name) + ', ' + fmtMin(b.start) + ' to ' + fmtMin(b.end);
                        return <button key={b.id} onClick={() => openBlock(b.id)} aria-label={k + ', ' + sub} style={S(blStyle(b))}><span style={S('font-size:13px;font-weight:600')}>{k}</span>{b.end - b.start >= 60 && <span style={S('font-size:12px')}>{sub}</span>}</button>;
                      })}
                    </div>
                  ))}
                  {showNow && (
                    <div style={S('position:absolute;left:68px;right:0;top:' + nowTop + 'px;height:0;border-top:2px solid #5B3DF5;pointer-events:none;z-index:2')}>
                      <span style={S('position:absolute;left:-5px;top:-6px;width:10px;height:10px;border-radius:999px;background:#5B3DF5')} />
                      <span style={S('position:absolute;left:-62px;top:-11px;padding:2px 7px;border-radius:999px;background:#5B3DF5;color:#FFFFFF;font-size:11.5px;font-weight:500')}>{fmtMin(now)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {view === 'week' && (
            <div style={S('overflow-x:auto')}>
              <div style={S('min-width:760px')}>
                <div style={S('display:flex;border-bottom:1px solid #E6E8EC')}>
                  <div style={S('flex:0 0 68px')} />
                  {weekDays.map((d) => {
                    const closed = !hrsOf(d.ymd)?.open, isToday = d.ymd === today;
                    return (
                      <button key={d.ymd} onClick={() => go(d.ymd, 'day')} aria-label={d.full + (closed ? ', closed' : '') + '. Open this day'} style={S('flex:1 1 0;min-width:0;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;border:0;border-left:1px solid #EEF0F3;background:transparent;font:inherit;color:#0E1116;cursor:pointer')}>
                        <span style={S('font-size:12.5px;color:#5E6673')}>{d.abbr}</span>
                        <span style={S('display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:999px;font-size:16px;font-weight:600;' + (isToday ? 'background:#0E1116;color:#FFFFFF' : 'color:#0E1116'))}>{d.num}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={S('position:relative;display:flex')}>
                  <div style={S('flex:0 0 68px')}>
                    {gHours.map((h) => <div key={h} style={S('height:72px;box-sizing:border-box;padding:6px 0 0;text-align:center;font-size:12px;color:#5E6673')}>{hr(h)}</div>)}
                  </div>
                  {weekDays.map((d) => {
                    const closed = !hrsOf(d.ymd)?.open, isToday = d.ymd === today;
                    return (
                      <div key={d.ymd} style={S('flex:1 1 0;min-width:0;position:relative;height:' + colH + 'px;border-left:1px solid #EEF0F3;background-color:' + (closed ? '#F7F8FA' : '#FFFFFF') + ';background-image:linear-gradient(#EEF0F3 1px, transparent 1px);background-size:100% 72px')}>
                        {closed && <span style={S('position:absolute;left:0;right:0;top:12px;text-align:center;font-size:12.5px;color:#8A93A0')}>Closed</span>}
                        {bookings.filter((b) => b.dayYmd === d.ymd && b.staffId === wkStaff).map((b) => {
                          const v = vm(b), compact = b.end - b.start <= 30;
                          return (
                            <button key={b.id} onClick={() => openBooking(b.id)} aria-label={v.label + (b.paid ? ', paid' : '')} style={S(evStyle(b, true))}>
                              {b.paid && <span aria-hidden="true" style={S('position:absolute;top:6px;right:6px;width:16px;height:16px;border-radius:999px;background:#14624A;display:flex;align-items:center;justify-content:center')}>{CHECK}</span>}
                              <span style={S('max-width:100%;font-size:12.5px;font-weight:600;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.client}</span>
                              {!compact && <span style={S('max-width:100%;font-size:11.5px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.services}</span>}
                            </button>
                          );
                        })}
                        {blocks.filter((b) => b.dayYmd === d.ymd && b.staffId === wkStaff).map((b) => {
                          const k = kindName(b.kind);
                          return <button key={b.id} onClick={() => openBlock(b.id)} aria-label={k + ', ' + first(staffName(b.staffId)) + ', ' + fmtMin(b.start) + ' to ' + fmtMin(b.end)} style={S(blStyle(b))}><span style={S('font-size:12.5px;font-weight:600')}>{k}</span></button>;
                        })}
                        {isToday && now >= gStart * 60 && <div style={S('position:absolute;left:0;right:0;top:' + nowTop + 'px;height:0;border-top:2px solid #5B3DF5;pointer-events:none;z-index:2')}><span style={S('position:absolute;left:-4px;top:-5px;width:8px;height:8px;border-radius:999px;background:#5B3DF5')} /></div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside aria-label="Appointment details" style={S('flex:1 1 440px;max-width:520px;min-width:0;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:22px')}>

          {mode === 'view' && !sq && sel && selB && (<>
            <div style={S('display:flex;flex-direction:column;gap:16px')}>
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
                <span style={S(sel.chipStyle)}>{sel.chipText}</span>
                {selB.paid && <span style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{selB.paidText}</span>}
                {!!notice && <span role="status" style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{notice}</span>}
              </div>
              <div style={S('display:flex;align-items:center;gap:14px')}>
                <div style={S('flex:0 0 48px;width:48px;height:48px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;background:' + sel.tone.bg + ';color:' + sel.tone.fg)}>{initials(selB.client)}</div>
                <div style={S('min-width:0')}>
                  <div style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{selB.client}</div>
                  <div style={S('font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{selB.services}</div>
                </div>
              </div>
              <dl style={S('margin:0;display:flex;flex-direction:column')}>
                <div style={S(DL)}><dt style={S('color:#5E6673')}>Booking</dt><dd style={S('margin:0;font-weight:500;text-align:right;white-space:nowrap')}>{'B-' + selB.ref}</dd></div>
                <div style={S(DL)}><dt style={S('color:#5E6673')}>Time</dt><dd style={S('margin:0;font-weight:500;text-align:right;white-space:nowrap')}>{sel.time}</dd></div>
                <div style={S(DL)}><dt style={S('color:#5E6673')}>With</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{staffName(selB.staffId)}</dd></div>
                <div style={S(DL + ';border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Price</dt><dd style={S('margin:0;font-weight:500')}>{sel.priceText}</dd></div>
              </dl>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={() => primary(selB)} style={S(BTN)}>{sel.primaryLabel}</button>
                <button className="ghost" onClick={() => startResched(selB, sel.k === 'done')} style={S(BTN2)}>{sel.secondaryLabel}</button>
              </div>
              {sel.canEdit && <button className="ghost" onClick={() => { setSelId(selB.id); setEd({ ids: selB.serviceIds.slice(), start: null }); setMode('edit'); setError(''); setNotice(''); }} style={S('height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500')}>Edit booking</button>}
            </div>

            <div style={S('display:flex;flex-direction:column;gap:6px')}>
              <h2 style={S('margin:0 0 6px;font-size:15px;font-weight:600')}>Up next</h2>
              {upNext.map((b) => {
                const v = vm(b);
                return (
                  <button key={b.id} className="ghost" onClick={() => { if (b.dayYmd !== day) { setSelId(b.id); go(b.dayYmd, view); } else openBooking(b.id); }} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:52px;padding:8px 10px;border:0;border-radius:14px;background:transparent;text-align:left;color:#0E1116')}>
                    <span style={S('flex:0 0 10px;width:10px;height:10px;border-radius:999px;background:' + v.tone.dot)} />
                    <span style={S('flex:1 1 auto;min-width:0')}>
                      <span style={S('display:block;font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.client}</span>
                      <span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.services + ' with ' + v.f}</span>
                    </span>
                    <span style={S('flex:0 0 auto;font-size:13px;color:#5E6673')}>{(view === 'week' ? dayInfo(b.dayYmd).short + ', ' : '') + fmtMin(b.start)}</span>
                  </button>
                );
              })}
            </div>
          </>)}

          {mode === 'view' && !sq && !selB && (
            <div style={S('display:flex;flex-direction:column;gap:14px')}>
              <h2 style={S(H2D)}>Nothing booked</h2>
              <p style={S('margin:0;color:#5E6673;font-size:14px')}>{view === 'day' && !dayHrs?.open ? 'The salon is closed on ' + di.weekday + 's.' : 'No appointments on ' + di.short + ' yet.'}</p>
              {!!notice && <span role="status" style={S('align-self:flex-start;padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{notice}</span>}
              <button onClick={openNew} style={S('height:44px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500')}>New appointment</button>
            </div>
          )}

          {mode === 'edit' && cur && (() => {
            const pl = editPlan()!;
            const homeCat = svcMap.get(cur.serviceIds[0])?.cat;
            const summary = cur.client + ' with ' + pl.f + ', ' + dayInfo(cur.dayYmd).short + ' at ' + fmtMin(cur.start) + '.';
            const oldDur = cur.end - cur.start;
            const dur = pl.dur === oldDur ? pl.dur + ' min' : oldDur + ' min to ' + pl.dur + ' min';
            const end = fmtMin(pl.mainEnd) + (pl.dur !== oldDur || pl.start !== cur.start ? ' (was ' + fmtMin(cur.end) + ')' : '');
            const price = pl.priceC === cur.priceCents ? usd(pl.priceC) : usd(cur.priceCents) + ' to ' + usd(pl.priceC);
            let blockText = '';
            if (pl.problem) {
              blockText = pl.problem.kind === 'late' ? 'That would run past closing at ' + fmtMin(hrsOf(cur.dayYmd)?.to ?? 1080) + '.' : pl.f + ' is booked with ' + pl.problem.with.who + ' from ' + fmtMin(pl.problem.with.s) + ', so ' + pl.dur + ' min from ' + fmtMin(pl.start) + ' does not fit.';
              if (!pl.alts.length) blockText += ' ' + pl.f + ' has no gap long enough today. Remove a service or reschedule to another day.';
            }
            return (
              <div style={S('display:flex;flex-direction:column;gap:18px')}>
                <div><h2 style={S(H2D)}>Edit booking</h2><p style={S(SUBD)}>{summary}</p></div>
                <div style={S('display:flex;flex-direction:column;gap:14px')}>
                  <ServicePicker services={services} selected={ed.ids} initialCat={homeCat} chipHeight={40}
                    onPick={(id) => setEd({ ids: ed.ids.includes(id) ? ed.ids.filter((i) => i !== id) : [...ed.ids, id], start: null })}
                    note={(x) => (cur.serviceIds.includes(x.id) || offered(x.id, cur.staffId) ? '' : (offers[x.id] ?? [])[0] ? 'separate booking with ' + first(staffName(offers[x.id][0])) : 'no one offers this')} />
                </div>
                <div style={S('display:flex;flex-direction:column;border:1px solid #E6E8EC;border-radius:16px;padding:4px 16px')}>
                  <div style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #EEF0F3')}><span style={S('color:#5E6673')}>Length</span><span style={S('font-weight:500;text-align:right')}>{dur}</span></div>
                  <div style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #EEF0F3')}><span style={S('color:#5E6673')}>Finishes</span><span style={S('font-weight:500;text-align:right')}>{end}</span></div>
                  <div style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0')}><span style={S('color:#5E6673')}>Price</span><span style={S('font-weight:500;text-align:right')}>{price}</span></div>
                </div>
                {!!pl.problem && <div role="alert" style={S('border-radius:16px;background:#FDECEA;color:#B42318;padding:12px 14px;font-size:13.5px;font-weight:500')}>{blockText}</div>}
                {pl.alts.length > 0 && (
                  <div style={S('display:flex;flex-direction:column;gap:8px')}>
                    <span style={S(LBL)}>Start earlier or later so it fits</span>
                    <div className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>{pl.alts.map((t) => <button key={t} onClick={() => { setEd({ ids: ed.ids, start: t }); setError(''); }} aria-pressed={pl.start === t} style={S(chipD(pl.start === t))}>{fmtMin(t) + ' to ' + fmtMin(t + pl.dur)}</button>)}</div>
                  </div>
                )}
                {!pl.problem && (pl.dur > cur.end - cur.start || pl.start !== cur.start) && <div style={S(note('#DDF3EA', '#14624A'))}>{pl.f + ' is free for the full ' + pl.dur + ' min' + (pl.start !== cur.start ? ' from ' + fmtMin(pl.start) : '') + '.'}</div>}
                {pl.extras.map((x) => x.at !== undefined
                  ? <div key={x.svc.id} style={S(note('#ECE8FF', '#3B2BB5'))}>{x.svc.name + ' is a ' + x.svc.cat.toLowerCase() + ' service. It will be booked as a separate appointment with ' + x.f + ' at ' + fmtMin(x.at) + ', ' + x.svc.dur + ' min.'}</div>
                  : <div key={x.svc.id} style={S(note('#FDECEA', '#B42318'))}>{x.sid ? x.f + ' has no free time for ' + x.svc.name + ' on this day.' : 'No one offers ' + x.svc.name + ' yet, so it cannot be added.'}</div>)}
                {errP()}
                <div style={S('display:flex;gap:10px')}>
                  <button onClick={saveEdit} disabled={busy} style={S(BTN)}>Save changes</button>
                  <BackBtn label="Back" />
                </div>
                {sel && sel.canEdit && sel.k !== 'live' && <button onClick={() => act(() => cancelBooking(cur.id), first(cur.client) + "'s booking cancelled", () => { setMode('view'); })} style={S('height:44px;border:0;border-radius:999px;background:transparent;color:#B42318;font-size:14px;font-weight:500')}>Cancel this booking</button>}
              </div>
            );
          })()}

          {mode === 'blockview' && bvB && (
            <div style={S('display:flex;flex-direction:column;gap:16px')}>
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><span style={S('display:inline-block;padding:4px 12px;border-radius:999px;background:#EEF0F3;color:#4A525E;font-size:12.5px;font-weight:500')}>Blocked</span></div>
              <div>
                <div style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em;line-height:1.2')}>{kindName(bvB.kind)}</div>
                <div style={S('font-size:14px;color:#5E6673')}>{staffName(bvB.staffId)}</div>
              </div>
              <dl style={S('margin:0;display:flex;flex-direction:column')}>
                <div style={S(DL)}><dt style={S('color:#5E6673')}>Day</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{dayInfo(bvB.dayYmd).full}</dd></div>
                <div style={S(DL + ';border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Time</dt><dd style={S('margin:0;font-weight:500;text-align:right;white-space:nowrap')}>{fmtMin(bvB.start) + ' – ' + fmtMin(bvB.end)}</dd></div>
              </dl>
              <p style={S('margin:0;color:#5E6673;font-size:13.5px')}>{'Clients cannot book ' + first(staffName(bvB.staffId)) + ' during this time.'}</p>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={() => act(() => deleteBlock(bvB.id), 'Block removed', () => { setBlockId(null); setMode('view'); })} style={S(BTN)}>Remove block</button>
                <BackBtn label="Close" />
              </div>
            </div>
          )}

          {mode === 'walkin' && (
            <div style={S('display:flex;flex-direction:column;gap:18px')}>
              <div><h2 style={S(H2D)}>Walk-in</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>We will find the first free time today.</p></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="wi-name" style={S(LBL)}>Client name</label><input id="wi-name" type="text" value={wi.name} onChange={(e) => { setWi({ ...wi, name: e.target.value }); setError(''); }} placeholder="Full name" style={inp(INPUT)} /></div>
              <div style={S('display:flex;flex-direction:column;gap:10px')}><span id="wi-svc" style={S(LBL)}>Service</span>
                <ServicePicker services={services} selected={wi.svc ? [wi.svc] : []} initialCat={wiSvc?.cat || wi.cat || undefined} chipHeight={40} onCat={(ct) => setWi({ ...wi, cat: ct })}
                  onPick={(id) => { const sv = svcMap.get(id)!; const pro = wi.pro !== 'any' && !offered(id, wi.pro) ? 'any' : wi.pro; setWi(wi.svc === id ? { ...wi, svc: null } : { ...wi, svc: id, cat: sv.cat, pro }); setError(''); }} /></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="wi-pro" style={S(LBL)}>Team member</span>
                <TeamPicker team={team} selected={wi.pro} anyLabel="First available" offers={wi.svc ? (sid) => offered(wi.svc!, sid) : undefined} onPick={(id) => { setWi({ ...wi, pro: id || 'any' }); setError(''); }} /></div>
              <div role="status" style={S(wiPlanCss)}>{wiPlanText}</div>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={() => addWalkin(true)} disabled={busy} style={S(BTN)}>Add &amp; check out</button>
                <button className="ghost" onClick={() => addWalkin(false)} disabled={busy} style={S(BTN2)}>Add to calendar</button>
              </div>
              <button className="ghost" onClick={backToView} style={S('height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500')}>Cancel</button>
            </div>
          )}

          {mode === 'block' && (
            <div style={S('display:flex;flex-direction:column;gap:18px')}>
              <div><h2 style={S(H2D)}>Block time</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>Lunch, breaks or time off. Clients cannot book blocked time.</p></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-who" style={S(LBL)}>Team member</span><TeamPicker team={team} selected={bf.s} onPick={(id) => { setBf({ ...bf, s: id, start: null }); setError(''); }} /></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-kind" style={S(LBL)}>Reason</span><div role="group" aria-labelledby="bk-kind" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>
                {BLOCK_KINDS.map(([k, l]) => <button key={k} onClick={() => setBf({ ...bf, kind: k })} aria-pressed={bf.kind === k} style={S(chipD(bf.kind === k))}>{l}</button>)}</div></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-dur" style={S(LBL)}>Length</span><div role="group" aria-labelledby="bk-dur" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>
                {BLOCK_DURS_M.map(([m, l]) => <button key={m} onClick={() => { setBf({ ...bf, dur: m, start: null }); setError(''); }} aria-pressed={bf.dur === m} style={S(chipD(bf.dur === m))}>{l}</button>)}</div></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-day" style={S(LBL)}>Day</span>
                <div role="group" className="hscroll" aria-labelledby="bk-day" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
                  {days14.map((d) => <button key={d.ymd} onClick={() => { if (!d.closed) { setBf({ ...bf, day: d.ymd, start: null }); setError(''); } }} disabled={d.closed} aria-pressed={bf.day === d.ymd} aria-label={d.full + (d.closed ? ', closed' : '')} style={S(dayD(bf.day === d.ymd, d.closed))}><span style={S('font-size:12.5px')}>{d.abbr}</span><span style={S('font-size:17px;font-weight:600')}>{d.num}</span></button>)}</div></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-time" style={S(LBL)}>Starts at</span>
                <div role="group" aria-labelledby="bk-time" style={S('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px')}>
                  {slotsFor.map((t) => { const why = reason(bf.day, t, bfDur); const on = bf.start === t && !why; return <button key={t} onClick={() => { if (!why) { setBf({ ...bf, start: t }); setError(''); } }} disabled={!!why} aria-pressed={on} aria-label={fmtMin(t) + (why ? ', unavailable' : '')} style={S(slotCss(on, !!why))}>{fmtMin(t)}</button>; })}</div></div>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={saveBlock} disabled={busy} style={S(BTN)}>Block time</button>
                <BackBtn />
              </div>
            </div>
          )}

          {mode === 'resched' && cur && (
            <div style={S('display:flex;flex-direction:column;gap:18px')}>
              <div>
                <h2 style={S(H2D)}>{rs.rebook ? 'Rebook' : 'Reschedule'}</h2>
                <p style={S(SUBD)}>{rs.rebook ? cur.client + ', ' + cur.services + ' with ' + first(staffName(cur.staffId)) + ', ' + (cur.end - cur.start) + ' min, ' + usd(cur.priceCents) + '.' : cur.client + ', ' + cur.services + ' with ' + first(staffName(cur.staffId)) + '. Now ' + dayInfo(cur.dayYmd).short + ', ' + fmtMin(cur.start) + '.'}</p>
              </div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}>
                <span id="rs-day-label" style={S(LBL)}>{rs.rebook ? 'Day' : 'New day'}</span>
                <div role="group" className="hscroll" aria-labelledby="rs-day-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
                  {days14.map((d) => <button key={d.ymd} onClick={() => { if (!d.closed) setRs({ ...rs, day: d.ymd, time: null }); setError(''); }} disabled={d.closed} aria-pressed={rs.day === d.ymd} aria-label={d.full + (d.closed ? ', closed' : '')} style={S(dayD(rs.day === d.ymd, d.closed))}><span style={S('font-size:12.5px')}>{d.abbr}</span><span style={S('font-size:17px;font-weight:600')}>{d.num}</span></button>)}
                </div>
              </div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}>
                <span id="rs-time-label" style={S(LBL)}>{rs.rebook ? 'Time' : 'New time'}</span>
                <div role="group" aria-labelledby="rs-time-label" style={S('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px')}>
                  {slotsFor.map((t) => { const why = reason(rs.day, t, cur.end - cur.start); const on = rs.time === t && !why; return <button key={t} onClick={() => { if (!why) { setRs({ ...rs, time: t }); setError(''); } }} disabled={!!why} aria-pressed={on} aria-label={fmtMin(t) + (why ? ', unavailable' : '')} style={S(slotCss(on, !!why))}>{fmtMin(t)}</button>; })}
                </div>
              </div>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={moveBooking} disabled={busy} style={S(BTN)}>{rs.rebook ? 'Book again' : 'Move appointment'}</button>
                <BackBtn />
              </div>
            </div>
          )}

          {mode === 'checkout' && cur && (() => {
            const cm = coMath(cur.priceCents);
            return (
              <div style={S('display:flex;flex-direction:column;gap:18px')}>
                <div><h2 style={S(H2D)}>Checkout</h2><p style={S(SUBD)}>{cur.client + ', ' + cur.services}</p></div>
                <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="co-method-label" style={S(LBL)}>Payment method</span><div role="group" className="hscroll" aria-labelledby="co-method-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
                  {METHODS.filter(([m]) => (m === 'card' ? cfg.acceptCard : m === 'cash' ? cfg.acceptCash : cfg.acceptGift)).map(([m, l]) => <button key={m} onClick={() => setCo({ ...co, method: m })} aria-pressed={co.method === m} style={S(chipD(co.method === m))}>{l}</button>)}</div></div>
                {co.method === 'gift_card' && <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="co-code" style={S(LBL)}>Gift card code</label><input id="co-code" type="text" value={co.code} onChange={(e) => setCo({ ...co, code: e.target.value })} placeholder="Code" style={inp(INPUT)} /></div>}
                {cfg.canDiscount && <DiscountPick value={co.disc} onChange={(d) => setCo({ ...co, disc: d })} />}
                {cfg.askTip && <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="co-tip-label" style={S(LBL)}>Tip</span><div role="group" className="hscroll" aria-labelledby="co-tip-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
                  {TIP_OPTS.map(([p, l]) => <button key={p} onClick={() => setCo({ ...co, tip: p })} aria-pressed={co.tip === p} style={S(chipD(co.tip === p))}>{l}</button>)}</div></div>}
                <dl style={S('margin:0;display:flex;flex-direction:column')}>
                  <div style={S(DL)}><dt style={S('color:#5E6673')}>Service</dt><dd style={S('margin:0;text-align:right;font-weight:500;white-space:nowrap')}>{m2(cur.priceCents)}</dd></div>
                  {cm.disc > 0 && <div style={S(DL)}><dt style={S('color:#5E6673')}>Discount</dt><dd style={S('margin:0;text-align:right;font-weight:500;white-space:nowrap')}>{'-' + m2(cm.disc)}</dd></div>}
                  <div style={S(DL)}><dt style={S('color:#5E6673')}>Tip</dt><dd style={S('margin:0;text-align:right;font-weight:500;white-space:nowrap')}>{cm.tip ? m2(cm.tip) : 'None'}</dd></div>
                  <div style={S(DL)}><dt style={S('color:#5E6673')}>{cm.taxLabel}</dt><dd style={S('margin:0;text-align:right;font-weight:500;white-space:nowrap')}>{m2(cm.taxAmt)}</dd></div>
                  <div style={S(DL + ';border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Total</dt><dd style={S('margin:0;text-align:right;font-weight:600;white-space:nowrap')}>{m2(cm.total)}</dd></div>
                </dl>
                {errP()}
                <div style={S('display:flex;gap:10px')}>
                  <button onClick={charge} disabled={busy} style={S(BTN)}>{'Charge ' + m2(cm.total)}</button>
                  <BackBtn />
                </div>
              </div>
            );
          })()}

          {mode === 'view' && !!sq && (
            <div style={S('display:flex;flex-direction:column;gap:14px')}>
              <div><h2 style={S(H2D)}>Search results</h2><p style={S(SUBD)}>{(hits ? hits.length + (hits.length === 1 ? ' appointment' : ' appointments') : 'Searching') + ' for "' + sq + '"'}</p></div>
              {hits && hits.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>Nothing matches that yet. Try a client name, a service or a team member.</p>}
              <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px')}>
                {(hits ?? []).map((h) => {
                  const tone = vmTone(h.cat);
                  const f = first(h.staff), when = dayInfo(h.dayYmd).short + ', ' + fmtMin(h.start);
                  return (
                    <li key={h.id}><button className="ghost" onClick={() => { setSelId(h.id); setQuery(''); setMode('view'); setNotice(''); setError(''); if (h.dayYmd !== day || view === 'week') go(h.dayYmd, 'day'); }} aria-label={h.client + ', ' + h.services + ', ' + when} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:56px;padding:8px 10px;border:0;border-radius:14px;background:transparent;text-align:left;color:#0E1116')}>
                      <span style={S('flex:0 0 40px;width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;background:' + tone.bg + ';color:' + tone.fg)}>{initials(h.client)}</span>
                      <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{h.client}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{h.services + ' with ' + f}</span></span>
                      <span style={S('flex:0 0 auto;font-size:12.5px;color:#5E6673')}>{when}</span>
                    </button></li>
                  );
                })}
              </ul>
            </div>
          )}

          {mode === 'new' && (
            <div style={S('display:flex;flex-direction:column;gap:18px')}>
              <h2 style={S(H2D)}>New appointment</h2>
              <div style={S('display:flex;flex-direction:column;gap:8px')}>
                <label htmlFor="ap-client" style={S(LBL)}>Client</label>
                <input id="ap-client" type="text" value={nf.client} onChange={(e) => { setNf({ ...nf, client: e.target.value, clientId: null }); setError(''); }} placeholder="Search or type a client name" style={inp(INPUT)} autoComplete="off" />
                <ClientMatches query={nf.client} pickedId={nf.clientId} onPick={(h) => { setNf({ ...nf, client: h.name, clientId: h.id }); setError(''); }} />
                {!nf.client.trim() && props.recent.length > 0 && <div role="group" className="hscroll" aria-label="Recent clients" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
                  {props.recent.map((r) => <button key={r.id} onClick={() => { setNf({ ...nf, client: r.name, clientId: r.id }); setError(''); }} aria-pressed={nf.client.trim() === r.name} style={S(chipD(nf.client.trim() === r.name))}>{r.name}</button>)}</div>}
              </div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}>
                <span id="ap-service-label" style={S(LBL)}>Service</span>
                <ServicePicker services={services} selected={nf.services} initialCat={nFirstSvc?.cat} chipHeight={40} onPick={nPickSvc} note={(x) => (nf.staff && !offered(x.id, nf.staff) ? ((offers[x.id] ?? [])[0] ? 'separate booking with ' + first(staffName(offers[x.id][0])) : 'no one offers this') : '')} />
              </div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}>
                <span id="ap-staff-label" style={S(LBL)}>Team member</span>
                <TeamPicker team={team} selected={nf.staff} offers={nOffers} onPick={(id) => { setNf({ ...nf, staff: id, time: null }); setError(''); }} />
              </div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}>
                <span id="ap-day-label" style={S(LBL)}>Day</span>
                <div role="group" className="hscroll" aria-labelledby="ap-day-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
                  {days14.map((d) => <button key={d.ymd} onClick={() => { if (!d.closed) { setNf({ ...nf, day: d.ymd, time: null }); setError(''); } }} disabled={d.closed} aria-pressed={nf.day === d.ymd} aria-label={d.full + (d.closed ? ', closed' : '')} style={S(dayD(nf.day === d.ymd, d.closed))}><span style={S('font-size:12.5px')}>{d.abbr}</span><span style={S('font-size:17px;font-weight:600')}>{d.num}</span></button>)}
                </div>
              </div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}>
                <span id="ap-time-label" style={S(LBL)}>Time</span>
                <div role="group" aria-labelledby="ap-time-label" style={S('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px')}>
                  {nSlots.map((t) => { const why = nWhy(t); const on = nf.time === t && !why; return <button key={t} onClick={() => { if (!why) { setNf({ ...nf, time: t }); setError(''); } }} disabled={!!why} aria-pressed={on} aria-label={fmtMin(t) + (why ? ', unavailable' : '')} style={S(slotCss(on, !!why))}>{fmtMin(t)}</button>; })}
                </div>
              </div>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={createNew} disabled={busy} style={S(BTN)}>Create appointment</button>
                <BackBtn />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

import { toneFor } from '@/lib/cal';
function vmTone(cat: string) { return toneFor(cat); }
