'use client';
// 1:1 conversion of the prototype's Main.dc.html (+ PageHeader). Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { MobileCalendar } from './MobileCalendar';
import { BLOCK_KINDS, dayInfo, fmtMin, addDaysYmd } from '@/lib/cal';
import { S } from './pickers';
import { STEP, NoticeBar } from './calUi';
import { dollars } from '@/lib/format';
import { plural } from '@/lib/display';
import { firstName } from '@/lib/people';
import { Avatar, BLACK_ACTION, BLACK_SM, FieldError, FilterChip, Icon, Note, OUTLINE_SM, RING_SM, Stat } from '@/components/ui';
import type { useCalendar } from './useCalendar';
import type { Props } from './calUi';

const H2D = 'margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em';
const SUBD = 'margin:4px 0 0;color:#5E6673;font-size:14px;overflow-wrap:anywhere';
const HATCH = 'repeating-linear-gradient(135deg,#F7F8FA 0,#F7F8FA 8px,#ECEEF2 8px,#ECEEF2 16px)';
const CHECK = <Icon name="tick" size={10} color="#FFFFFF" w={3.4} />;

export function DesktopCalendar({ c, props }: { c: ReturnType<typeof useCalendar>; props: Props }) {
  const {
    blockId, blocks, bookings, cur, day, di, error, go, hasError,
    hrsOf, mode, notice, now, openBlock, openBooking, openNew, pageTitle,
    query, services, setBf, setError, setMode, setNotice, setOpen, setQuery, setStaffSel,
    setWi, sres, staffName, staffSel, team, today, view, weekDays, wkRange, wkStaff,
    gHours, gStart, HOUR_PX, nowTop, vm,
    openLate,
  } = c;

  const sq = query.trim();
  const dayB = bookings.filter((b) => b.dayYmd === day);
  const events = (view === 'week' ? bookings.filter((b) => b.staffId === wkStaff) : dayB).slice().sort((a, b) => a.dayYmd.localeCompare(b.dayYmd) || a.start - b.start);
  const cols = view === 'week' ? [] : team.filter((m) => staffSel === 'all' || m.id === staffSel);
  const pool = view === 'week' ? team.filter((m) => m.id === wkStaff) : staffSel === 'all' ? team : team.filter((m) => m.id === staffSel);
  const colH = gHours.length * HOUR_PX;
  const dayHrs = hrsOf(day);
  const dayClosed = view === 'day' && !dayHrs?.open;
  const subtitle = view === 'week' ? wkRange + ', ' + staffName(wkStaff) : di.full;

  let nextOpening = dayHrs?.open ? 'None left' : 'Closed';
  if (dayHrs?.open) {
    for (let t = Math.max(dayHrs.from, day === today ? Math.ceil(now / STEP) * STEP : 0); t + STEP <= dayHrs.to; t += STEP) {
      if (pool.some((m) => !dayB.some((b) => b.staffId === m.id && t < b.end && b.start < t + STEP) && !blocks.some((b) => b.staffId === m.id && b.dayYmd === day && t < b.end && b.start < t + STEP))) { nextOpening = fmtMin(t); break; }
    }
  }
  const revenue = dollars(events.reduce((a, b) => a + b.priceCents, 0));

  const topOf = (start: number, px = 2) => (start / 60 - gStart) * HOUR_PX + px;
  const evStyle = (b: (typeof bookings)[number], weekCol: boolean) => {
    const v = vm(b), tone = v.tone, compact = b.end - b.start <= 30, selected = c.open && mode === 'view' && cur?.id === b.id;
    const h = (b.end - b.start) / 60 * HOUR_PX - 4;
    const accent = tone.fg.toUpperCase() === '#FFFFFF' ? '#5B3DF5' : tone.fg;
    const out = selected ? 'box-shadow:inset 4px 0 0 ' + accent + ',0 8px 18px -8px ' + accent + ';z-index:2;' : '';
    if (weekCol) return 'position:absolute;left:3px;right:3px;top:' + topOf(b.start) + 'px;height:' + h + 'px;box-sizing:border-box;border:0;border-radius:10px;text-align:left;overflow:hidden;font:inherit;background:' + tone.bg + ';color:' + tone.fg + ';padding:' + (compact ? '0 8px' : '6px 8px') + ';display:flex;flex-direction:column;justify-content:' + (compact ? 'center' : 'flex-start') + ';gap:1px;' + out;
    return 'position:absolute;left:5px;right:5px;top:' + topOf(b.start) + 'px;height:' + h + 'px;box-sizing:border-box;border:0;border-radius:12px;text-align:left;overflow:hidden;font:inherit;background:' + tone.bg + ';color:' + tone.fg + ';padding:' + (compact ? '0 10px' : '7px 10px') + ';display:flex;flex-direction:' + (compact ? 'row' : 'column') + ';align-items:' + (compact ? 'center' : 'flex-start') + ';gap:' + (compact ? 8 : 1) + 'px;' + out;
  };
  const blStyle = (b: (typeof blocks)[number]) => 'position:absolute;left:5px;right:5px;top:' + topOf(b.start) + 'px;height:' + ((b.end - b.start) / 60 * HOUR_PX - 4) + 'px;box-sizing:border-box;border:1px solid #DDE0E6;border-radius:12px;background:' + HATCH + ';color:#4A525E;font:inherit;text-align:left;padding:6px 10px;overflow:hidden;display:flex;flex-direction:column;gap:1px;outline:' + (mode === 'blockview' && blockId === b.id ? '1.5px solid rgba(14,17,22,0.35)' : 'none') + ';outline-offset:1px';
  const kindName = (k: string) => BLOCK_KINDS.find((x) => x[0] === k)?.[1] ?? 'Blocked';
  const showNow = day === today && now >= gStart * 60 && now <= (gStart + gHours.length) * 60;
      const stepDay = (dir: number) => go(addDaysYmd(day, dir * (view === 'week' ? 7 : 1)));
  const openWalkin = () => { if (day !== today || view !== 'day') go(today, 'day'); /* a walk-in is always for today, so show today */ setMode('walkin'); setOpen(true); setWi({ name: '', clientId: null, svc: null, pro: 'any', cat: '' }); setError(''); setNotice(''); };
  const openBlockForm = () => { setMode('block'); setOpen(true); setBf({ s: team[0]?.id ?? '', kind: 'lunch', day: day < today ? today : day, dur: 60, start: null }); setError(''); setNotice(''); };
  const hits = sres;

  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 32px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>

      {/* PageHeader */}
      <header style={S("display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;font-family:'Geist',system-ui,sans-serif;color:#0E1116")}>
        <div style={S('min-width:0')}>
          <h1 style={S('margin:0;font-size:34px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{pageTitle}</h1>
          <p style={S('margin:6px 0 0;color:#5E6673;font-size:15px')}>{subtitle}</p>
        </div>
        <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px')}>
          <label className="search" style={S('display:flex;align-items:center;gap:10px;height:44px;box-sizing:border-box;padding:0 16px;border-radius:999px;background:#FFFFFF;border:1px solid #E6E8EC;color:#5E6673')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search client, phone or service" aria-label="Search appointments" style={{ ...S('border:0;outline:none;background:transparent;font:inherit;color:#0E1116;width:210px'), padding: '1px 2px', minHeight: 0, borderRadius: 0 }} />
          </label>
          <button onClick={openNew} style={S(BLACK_ACTION)}>
            <Icon name="plus" color="#FFFFFF" />
            New appointment
          </button>
        </div>
      </header>

      {!c.open && (!!notice || hasError) && (
        <div style={S('display:flex;flex-direction:column;gap:8px')}>
          {!!notice && <NoticeBar text={notice} onDismiss={() => setNotice('')} />}
          {hasError && <FieldError>{error}</FieldError>}
        </div>
      )}

      <section aria-label="Today at a glance" style={S('display:flex;flex-wrap:wrap;gap:20px 64px')}>
        <Stat label="Appointments" value={String(events.length)} />
        <Stat label="Booked revenue" value={revenue} />
        <Stat label="Next opening" value={nextOpening} />
      </section>

      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>

        <section aria-label="Schedule" style={S('flex:999 1 520px;min-width:0;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>

          <div style={S('border-bottom:1px solid #E6E8EC;padding:16px 20px;display:flex;flex-direction:column;gap:12px')}>
            <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:12px')}>
            <div style={S('display:flex;align-items:center;gap:8px;flex:1 1 220px;min-width:0')}>
              <button className="ghost" onClick={() => stepDay(-1)} aria-label={view === 'week' ? 'Previous week' : 'Previous day'} style={S(RING_SM)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6 8.5 12l6 6" /></svg>
              </button>
              <button className="ghost" onClick={() => stepDay(1)} aria-label={view === 'week' ? 'Next week' : 'Next day'} style={S(RING_SM)}>
                <Icon name="next" size={18} color="#0E1116" w={1.8} />
              </button>
              <span style={S('margin-left:8px;font-size:16px;font-weight:600;letter-spacing:-0.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{view === 'week' ? wkRange : di.short}</span>
              {dayClosed && <span style={S('color:#5E6673;font-size:13.5px')}>{c.closedWhy(day) !== undefined ? 'Closed' + (c.closedWhy(day) ? ': ' + c.closedWhy(day) : '') : 'Closed'}</span>}
            </div>
              <div style={S('display:flex;align-items:center;gap:8px;flex:0 0 auto;margin-left:auto')}>
              <div role="group" aria-label="Calendar view" style={S('display:flex;gap:2px;padding:3px;border-radius:999px;background:#F4F5F7')}>
              {([['day', 'Day'], ['week', 'Week']] as const).map(([v, l]) => (
                <button key={v} onClick={() => { if (v === 'week' && staffSel === 'all') setStaffSel(team[0]?.id ?? 'all'); setMode('view'); setError(''); go(day, v); }} aria-pressed={view === v}
                  style={S('height:34px;padding:0 16px;border:0;border-radius:999px;font-size:13.5px;font-weight:500;background:' + (view === v ? '#0E1116' : 'transparent') + ';color:' + (view === v ? '#FFFFFF' : '#0E1116'))}>{l}</button>
              ))}
            </div>
            <div style={S('display:flex;gap:8px')}>
              <button onClick={openWalkin} style={S(BLACK_SM)}>Walk-in</button>
              <button className="ghost" onClick={openLate} style={S(OUTLINE_SM)}>Running late</button>
              <button className="ghost" onClick={openBlockForm} style={S(OUTLINE_SM)}>Block time</button>
            </div>
              </div>
            </div>
            {team.length > 1 && <div role="group" aria-label="Filter by team member" className="hscroll tb-chips" style={S('display:flex;gap:8px;overflow-x:auto')}>
              {(view === 'week' ? [] : [{ id: 'all', label: 'Whole team' }]).concat(team.map((x) => ({ id: x.id, label: firstName(x.name, '') }))).map((ch) => {
                const on = (view === 'week' ? wkStaff : staffSel) === ch.id;
                return <FilterChip key={ch.id} on={on} onClick={() => setStaffSel(ch.id)}>{ch.label}</FilterChip>;
              })}
            </div>}
          </div>

          {view === 'day' && (
            <div style={S('overflow-x:auto')}>
              <div style={S('min-width:' + Math.max(760, 68 + cols.length * 170) + 'px')}>
                <div style={S('display:flex;border-bottom:1px solid #E6E8EC')}>
                  <div style={S('flex:0 0 68px')} />
                  {cols.map((m) => (
                    <div key={m.id} style={S('flex:1 1 0;min-width:0;box-sizing:border-box;min-height:72px;display:flex;align-items:center;gap:10px;padding:14px 16px;border-left:1px solid #EEF0F3')}>
                      <Avatar name={m.name} photo={m.photo} size="md" />
                      <div style={S('min-width:0')}>
                        <div style={S('font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{m.name}</div>
                        <div style={S('font-size:12.5px;color:#5E6673')}>{m.role}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={S('position:relative;display:flex')}>
                  <div style={S('flex:0 0 68px')}>
                    {gHours.map((h) => <div key={h} style={S('height:72px;box-sizing:border-box;padding:6px 0 0;text-align:center;font-size:12px;color:#5E6673')}>{fmtMin(h * 60)}</div>)}
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
                        const k = kindName(b.kind), sub = firstName(m.name, '') + ', ' + fmtMin(b.start) + ' to ' + fmtMin(b.end);
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
                      <button key={d.ymd} onClick={() => go(d.ymd, 'day')} aria-label={d.full + (closed ? ', closed' : '') + '. Open this day'} style={S('flex:1 1 0;min-width:0;box-sizing:border-box;min-height:72px;justify-content:center;display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;border:0;border-left:1px solid #EEF0F3;background:transparent;font:inherit;color:#0E1116;cursor:pointer')}>
                        <span style={S('font-size:12.5px;color:#5E6673')}>{d.abbr}</span>
                        <span style={S('display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:999px;font-size:16px;font-weight:600;' + (isToday ? 'background:#0E1116;color:#FFFFFF' : 'color:#0E1116'))}>{d.num}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={S('position:relative;display:flex')}>
                  <div style={S('flex:0 0 68px')}>
                    {gHours.map((h) => <div key={h} style={S('height:72px;box-sizing:border-box;padding:6px 0 0;text-align:center;font-size:12px;color:#5E6673')}>{fmtMin(h * 60)}</div>)}
                  </div>
                  {weekDays.map((d) => {
                    const closed = !hrsOf(d.ymd)?.open;
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
                          return <button key={b.id} onClick={() => openBlock(b.id)} aria-label={k + ', ' + firstName(staffName(b.staffId), '') + ', ' + fmtMin(b.start) + ' to ' + fmtMin(b.end)} style={S(blStyle(b))}><span style={S('font-size:12.5px;font-weight:600')}>{k}</span></button>;
                        })}
                      </div>
                    );
                  })}
                  {weekDays.some((d) => d.ymd === today) && now >= gStart * 60 && now <= (gStart + gHours.length) * 60 && (
                    <div style={S('position:absolute;left:68px;right:0;top:' + nowTop + 'px;height:0;border-top:2px solid #5B3DF5;pointer-events:none;z-index:2')}>
                      <span style={S('position:absolute;left:-5px;top:-6px;width:10px;height:10px;border-radius:999px;background:#5B3DF5')} />
                      <span style={S('position:absolute;left:-62px;top:-11px;padding:2px 7px;border-radius:999px;background:#5B3DF5;color:#FFFFFF;font-size:11.5px;font-weight:500')}>{fmtMin(now)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {!!sq && <aside aria-label="Search results" style={S('flex:1 1 400px;max-width:520px;min-width:0;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:22px')}>
          {!!sq && (
            <div style={S('display:flex;flex-direction:column;gap:14px')}>
              <div><h2 style={S(H2D)}>Search results</h2><p style={S(SUBD)}>{(hits ? plural(hits.length, 'appointment') : 'Searching') + ' for "' + sq + '"'}</p></div>
              {hits && hits.length === 0 && <Note>Nothing matches that yet. Try a client name, phone number, service or booking number.</Note>}
              <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px')}>
                {(hits ?? []).map((h) => {
                  const f = firstName(h.staff, ''), when = dayInfo(h.dayYmd).short + ', ' + fmtMin(h.start);
                  return (
                    <li key={h.id}><button className="ghost" onClick={() => { setQuery(''); if (h.dayYmd !== day || view === 'week') go(h.dayYmd, 'day'); openBooking(h.id); }} aria-label={h.client + ', ' + h.services + ', ' + when} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:56px;padding:8px 10px;border:0;border-radius:14px;background:transparent;text-align:left;color:#0E1116')}>
                      <Avatar name={h.client} size="md" />
                      <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{h.client}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{h.services + ' with ' + f}</span></span>
                      <span style={S('flex:0 0 auto;font-size:12.5px;color:#5E6673')}>{when}</span>
                    </button></li>
                  );
                })}
              </ul>
            </div>
          )}

        </aside>}
      </div>
      {c.open && <MobileCalendar c={c} props={props} drawer />}
    </div>
  );
}
