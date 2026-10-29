'use client';
// 1:1 conversion of the prototype's Mobile.dc.html (+ MobileHeader, MobileTabs). Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { useState } from 'react';
import { ClientMatches } from './ClientMatches';
import { NewApptForm } from './NewApptForm';
import { LateWizard, BlockWizard, WalkInWizard, CheckoutWizard } from './QuickWizards';
import { MessageBox } from './MessageBox';
import { DiscountPick } from './DiscountPick';
import Link from 'next/link';
import { dayInfo, fmtMin, initials, addDaysYmd, BLOCK_KINDS } from '@/lib/cal';
import { cancelBooking, checkoutBooking, deleteBlock, setBookingStatus } from './actions';
import { STATUS_LABEL } from '@/lib/format';
import { CancelPick } from './CancelPick';
import { S, ServicePicker, TeamPicker } from './pickers';
import { chipTone, HATCH, first, usd, m2, BLOCK_DURS_M, METHODS, TIP_OPTS, chip, slotCss, dayCss, note, PRIMARY, SECOND, CLOSE_BTN, H2S, ERR, DLROW, CloseX, Mag } from './calUi';
import type { useCalendar } from './useCalendar';
import type { Props } from './calUi';

export function MobileCalendar({ c, props }: { c: ReturnType<typeof useCalendar>; props: Props }) {
  const { HOUR_PX, act, activeCards, addWalkin, amap, av, avail, availKey, backToView, bf, bfDur, blank, blockId, blockRows, blocks, bookings, busy, bvB, cards, cfg, charge, chk, close, co, coMath, createNew, cur, day, dayB, dayHrs, days14, di, doneBk, ed, editPlan, error, firstOpenDay, gEnd, gHours, gStart, go, hasError, hours, hrsOf, later, laterBk, minutesFromIso, mode, moveBooking, nFirstSvc, nKeyStr, nKeys, nOffers, nPickSvc, nPlan, nSlots, nWhy, nf, notice, now, nowTop, offered, offers, open, openBlock, openBooking, openDays, openNew, pageSubtitle, pageTitle, pendingSel, plan, primary, query, reason, refresh, router, row, rs, saveBlock, saveEdit, searchOpen, seg, sel, selId, services, setAmap, setAvail, setBf, setBlockId, setCo, setEd, setError, setMode, setNf, setNotice, setNow, setOpen, setPendingSel, setPlan, setQuery, setRs, setSearchOpen, setSelId, setSres, setStaffSel, setWi, setWkOpen, slotsFor, sq, sres, staffName, staffSel, startCheckout, startResched, startT, statCount, statRevenue, statNext, strip, svcMap, team, today, todayList, tz, upcoming, view, viewEvents, vm, weekDays, wi, wiPlanText, wiPlanCss, wiSvc, wkCards, wkOpen, wkRange, wkStaff, wkTitle, ws, nLock, edLock, lockFor, lf, setLf, openLate, lateList, saveLate } = c;
  const [qa, setQa] = useState(false);
  const [st, setSt] = useState<'' | 'list' | 'cancel'>('');
  const renderLater = (b: (typeof later)[number]) => (
              <div key={b.id} style={S('display:flex;align-items:center;gap:12px')}>
                <span style={S('flex:0 0 60px;white-space:nowrap;font-size:13px;color:#5E6673')}>{b.startText}</span>
                <button onClick={() => (b.isBlock ? openBlock(b.id) : openBooking(b.id))} aria-label={b.label}
                  style={S(b.isBlock ? 'flex:1 1 0;min-width:0;min-height:64px;box-sizing:border-box;padding:10px 16px;border:1px solid #DDE0E6;border-radius:18px;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;font:inherit;color:#4A525E;background:' + HATCH : (b as any).style)}>
                  <span style={S('min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.client}</span><span style={S('display:block;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.sub}</span></span>
                  <span style={S('flex:0 0 auto;font-size:13.5px;font-weight:500')}>{b.priceText}</span>
                </button>
              </div>
  );
  const errP = () => hasError ? <p role="alert" style={S(ERR)}>{error}</p> : null;
  const tabsA = (id: string, href: string, label: string, on: boolean, svg: React.ReactNode) => (
    <Link key={id} href={href} aria-current={on ? 'page' : 'false'} style={S('width:100%;min-height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-decoration:none;font-size:12px;font-weight:' + (on ? 600 : 500) + ';color:' + (on ? '#0E1116' : '#5E6673'))}>
      {svg}{label}
    </Link>
  );
  const ic = (color: string, children: React.ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;

  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>

      {/* MobileHeader */}
      <header style={S("display:flex;flex-direction:column;gap:12px;padding:28px 20px 18px;margin-bottom:20px;border-bottom:1px solid #E6E8EC;font-family:'Geist',system-ui,sans-serif;color:#0E1116")}>
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
          <div style={S('min-width:0')}>
            <h1 style={S('margin:0;font-size:30px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{pageTitle}</h1>
            <p style={S('margin:4px 0 0;color:#5E6673;font-size:14.5px')}>{pageSubtitle}</p>
          </div>
          <button onClick={() => { if (searchOpen) setQuery(''); setSearchOpen(!searchOpen); }} aria-label={searchOpen ? 'Close search' : 'Search'} aria-expanded={searchOpen}
            style={S('flex:0 0 44px;width:44px;height:44px;border:1px solid ' + (searchOpen ? '#0E1116' : '#E1E4E9') + ';border-radius:999px;background:' + (searchOpen ? '#0E1116' : '#FFFFFF') + ';display:flex;align-items:center;justify-content:center;cursor:pointer')}>
            <Mag size={20} color={searchOpen ? '#FFFFFF' : '#0E1116'} />
          </button>
        </div>
        {searchOpen && (
          <label style={S('display:flex;align-items:center;gap:10px;height:48px;box-sizing:border-box;padding:0 16px;border-radius:999px;background:#FFFFFF;border:1px solid #E6E8EC')}>
            <Mag size={18} color="#5E6673" />
            <input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search client, phone or service" aria-label="Search appointments"
              style={{ ...S('flex:1 1 auto;min-width:0;border:0;outline:none;background:transparent;font:inherit;color:#0E1116'), padding: '1px 2px', minHeight: 0, width: 'auto', borderRadius: 0, margin: 0 }} />
          </label>
        )}
      </header>

      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <div role="tablist" aria-label="Calendar view" style={S('flex:0 0 auto;display:flex;gap:4px;padding:4px;margin:0 0 -8px;border-radius:999px;background:#E9ECF0')}>
          {([['day', 'Day'], ['week', 'Week']] as const).map(([v, l]) => (
            <button key={v} role="tab" onClick={() => { setNotice(''); go(day, v); }} aria-selected={view === v} style={S(seg(view === v))}>{l}</button>
          ))}
        </div>

        {view === 'day' && (
          <div style={S('flex:0 0 auto;display:flex;gap:8px;overflow-x:auto;padding:0 20px;margin:0 -20px')}>
            {strip.map((d) => {
              const on = d.ymd === day;
              return (
                <button key={d.ymd} onClick={() => go(d.ymd, 'day')} aria-label={d.weekday + ' ' + d.num + (on ? ', selected' : '')} aria-current={on ? 'date' : undefined}
                  style={S('flex:0 0 52px;height:72px;border:1px solid ' + (on ? '#0E1116' : '#E6E8EC') + ';border-radius:18px;background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116') + ';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px')}>
                  <span style={S('font-size:12.5px;color:' + (on ? '#D5D9E0' : '#5E6673'))}>{d.abbr}</span><span style={S('font-size:17px;font-weight:600')}>{d.num}</span>
                </button>
              );
            })}
          </div>
        )}
        {view === 'week' && (
          <div role="group" aria-label="Week" style={S('flex:0 0 auto;display:flex;align-items:center;gap:8px;margin:0;padding:8px;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:999px')}>
            <button onClick={() => go(addDaysYmd(day, -7), 'week')} aria-label="Previous week" style={S('flex:0 0 44px;width:44px;height:44px;border-radius:999px;border:0;background:#F4F5F7;font-size:20px;color:#0E1116')}>‹</button>
            <div style={S('flex:1 1 auto;min-width:0;text-align:center;white-space:nowrap')}><div style={S('font-size:15px;font-weight:600')}>{wkTitle}</div><div style={S('font-size:12.5px;color:#5E6673')}>{wkRange}</div></div>
            <button onClick={() => go(addDaysYmd(day, 7), 'week')} aria-label="Next week" style={S('flex:0 0 44px;width:44px;height:44px;border-radius:999px;border:0;background:#F4F5F7;font-size:20px;color:#0E1116')}>›</button>
          </div>
        )}

        {!!notice && (
          <div role="status" style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box;padding:12px 16px;border-radius:18px;background:#DDF3EA;color:#14624A;font-size:14px;font-weight:500')}>
            <span style={S('min-width:0;overflow-wrap:anywhere')}>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Dismiss message" style={S('flex:0 0 44px;width:44px;height:44px;margin:-8px -8px -8px 0;border:0;border-radius:999px;background:transparent;display:flex;align-items:center;justify-content:center')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14624A" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </div>
        )}

        {view === 'day' && (<>
          <div style={S('display:flex;flex-direction:column;gap:12px')}>
            <section aria-label="Today at a glance" style={S('display:flex;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:16px 0')}>
              {([['Bookings', statCount], ['Revenue', statRevenue], ['Next free', statNext]] as const).map(([l, v], i) => (
                <div key={l} style={S('flex:1 1 0;min-width:0;padding:0 12px 0 14px;' + (i ? 'border-left:1px solid #EEF0F3' : ''))}>
                  <div style={S('color:#5E6673;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{l}</div>
                  <div style={S('margin-top:4px;font-size:20px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{v}</div>
                </div>
              ))}
            </section>
            <div style={S('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px')}>
              <button onClick={() => { if (day !== today || view !== 'day') go(today, 'day'); setOpen(true); setMode('walkin'); setWi({ name: '', clientId: null, svc: null, pro: 'any', cat: '' }); setError(''); setNotice(''); }} style={S('height:46px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500;cursor:pointer;white-space:nowrap')}>Walk-in</button>
              <button onClick={openLate} style={S('height:46px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500;cursor:pointer;white-space:nowrap')}>Late</button>
              <button onClick={() => { setOpen(true); setMode('block'); setBf({ s: team[0]?.id ?? '', kind: 'lunch', day: day < today ? today : day, dur: 60, start: null }); setError(''); setNotice(''); }} style={S('height:46px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500;cursor:pointer;white-space:nowrap')}>Block time</button>
            </div>
          </div>

          {!!sq && (
            <section aria-label="Search results" style={S('display:flex;flex-direction:column;gap:10px')}>
              <h2 style={S('margin:0;font-size:16px;font-weight:600')}>Search results</h2>
              <p style={S('margin:0;color:#5E6673;font-size:13.5px')}>{(c.sres ? c.sres.length + (c.sres.length === 1 ? ' appointment' : ' appointments') : 'Searching') + ' for "' + query.trim() + '"'}</p>
              {c.sres && c.sres.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>Nothing matches that yet. Try a client name, phone number, service or booking number.</p>}
              {(c.sres ?? []).map((h) => { const when = dayInfo(h.dayYmd).short + ', ' + fmtMin(h.start); return (
                <button key={h.id} onClick={() => { c.setSelId(h.id); c.setQuery(''); c.setSearchOpen(false); c.setOpen(true); c.setMode('view'); if (h.dayYmd !== day) go(h.dayYmd, 'day'); }} aria-label={h.client + ', ' + h.services + ', ' + when} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:60px;padding:10px 14px;border:1px solid #E6E8EC;border-radius:18px;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
                  <span style={S('min-width:0;flex:1 1 auto')}><span style={S('display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{h.client}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{h.services + ' with ' + first(h.staff)}</span></span>
                  <span style={S('flex:0 0 auto;font-size:12.5px;color:#5E6673')}>{when}</span>
                </button>); })}
            </section>
          )}

          {!sq && cards.length > 0 && (
            <section aria-label="Current and next appointments" style={S('display:flex;flex-direction:column;gap:10px')}>
              {activeCards.length > 0 && <h2 style={S('margin:0 0 2px;font-size:16px;font-weight:600')}>{'In progress, ' + activeCards.length}</h2>}
              <div className="hscroll" style={S('display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 20px;margin:0 -20px;padding:0 20px')}>
                {cards.map((c) => (
                  <div key={c.b.id} style={S((activeCards.length > 1 ? 'flex:0 0 300px;' : 'flex:1 1 100%;min-width:0;') + 'box-sizing:border-box;scroll-snap-align:start;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px;display:flex;flex-direction:column;gap:14px')}>
                    <button onClick={() => openBooking(c.b.id)} aria-label={c.label} style={S('display:flex;flex-direction:column;align-items:flex-start;gap:14px;width:100%;padding:0;border:0;background:transparent;text-align:left;font:inherit;color:inherit;cursor:pointer')}>
                      <span style={S('display:flex;flex-wrap:wrap;gap:8px')}><span style={S(c.chipStyle)}>{c.chipText}</span>{c.b.paid && <span style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.b.paidText}</span>}</span>
                      <span style={S('display:block;min-width:0;max-width:100%')}>
                        <span style={S('display:block;font-size:21px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{c.b.client}</span>
                        <span style={S('display:block;margin-top:4px;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{c.line}</span>
                      </span>
                    </button>
                    <button onClick={() => primary(c.b)} style={S('height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;cursor:pointer')}>{c.primaryLabel}</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {c.laterLate.length > 0 && !sq && (
            <section aria-label="Not checked in" style={S('display:flex;flex-direction:column;gap:10px')}>
              <h2 style={S('margin:0;font-size:16px;font-weight:600')}>Not checked in</h2>
              {c.laterLate.map(renderLater)}
            </section>
          )}

          <section aria-label="Later today" style={S('flex-direction:column;gap:12px;display:' + (sq || (c.laterUp.length === 0 && cards.length > 0) ? 'none' : 'flex'))}>
            <div style={S('display:flex;align-items:baseline;justify-content:space-between;gap:12px')}>
              <h2 style={S('margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>{day === today ? 'Later today' : 'Appointments'}</h2>
              <span style={S('color:#5E6673;font-size:13px')}>{c.laterUp.length === 0 ? '' : c.laterUp.length + (c.laterUp.length === 1 ? ' appointment' : ' appointments')}</span>
            </div>
            {c.laterUp.length === 0 && <p style={S('margin:0;padding:18px 16px;border:1px dashed #D5D9E0;border-radius:18px;text-align:center;color:#5E6673;font-size:14px')}>{day === today ? 'Nothing else booked for today.' : 'Nothing booked for this day.'}</p>}
            {c.laterUp.map(renderLater)}
          </section>
          {c.laterDone.length > 0 && !sq && (
            <section aria-label="Done" style={S('display:flex;flex-direction:column;gap:10px')}>
              <h2 style={S('margin:0;font-size:16px;font-weight:600')}>{day === today ? 'Done today' : 'Done'}</h2>
              {c.laterDone.map(renderLater)}
            </section>
          )}
        </>)}

        {view === 'week' && wkCards.map(({ d, hrs, rows, shown, util, isOpen, limit, summary }) => (
          <section key={d.ymd} style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:16px;display:flex;flex-direction:column;gap:12px')}>
            <div style={S('display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px')}><h2 style={S('margin:0;font-size:16px;font-weight:600')}>{d.abbr + ' ' + d.num + (d.ymd === today ? ', today' : '')}</h2><span style={S('color:#5E6673;font-size:13px')}>{summary}</span></div>
            {hrs?.open && <div style={S('display:flex;align-items:center;gap:10px')}><div style={S('flex:1 1 auto;background:#EEF0F3;border-radius:999px')}><div style={S('height:6px;border-radius:999px;background:#0E1116;width:' + util + '%')} /></div><span style={S('flex:0 0 auto;font-size:12px;color:#5E6673')}>{util + '% booked'}</span></div>}
            {rows.length === 0 && hrs?.open && <p style={S('margin:0;color:#5E6673;font-size:13.5px')}>Nothing booked yet.</p>}
            {shown.map((r, i) => (
              <div key={i} style={S('display:flex;align-items:center;gap:8px')}><span style={S('flex:0 0 60px;white-space:nowrap;font-size:12.5px;color:#5E6673')}>{r.startText}</span>
                <button onClick={r.pick} aria-label={r.startText + ', ' + r.client + ', ' + r.sub}
                  style={S('width:100%;box-sizing:border-box;min-height:52px;padding:8px 12px;border-radius:14px;border:' + (r.isBlock ? '1px solid #DDE0E6' : '0') + ';display:flex;align-items:center;gap:10px;text-align:left;font:inherit;color:#0E1116;background:' + (r.isBlock ? HATCH : '#F7F8FA') + ';cursor:pointer')}>
                  <span style={S('flex:0 0 8px;width:8px;height:8px;border-radius:999px;background:' + r.dot)} />
                  <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.client}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.sub}</span></span>
                  <span style={S('flex:0 0 auto;font-size:13px;font-weight:500')}>{r.priceText}</span>
                </button>
              </div>
            ))}
            {!isOpen && rows.length > limit && <button onClick={() => setWkOpen({ ...wkOpen, [d.ymd]: true })} style={S('height:40px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:13.5px;font-weight:500;cursor:pointer')}>{'Show ' + (rows.length - limit) + ' more'}</button>}
            {isOpen && rows.length > limit && <button onClick={() => setWkOpen({ ...wkOpen, [d.ymd]: false })} style={S('height:40px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:13.5px;font-weight:500;cursor:pointer')}>Show less</button>}
          </section>
        ))}
      </main>

      {/* MobileTabs */}
      <nav aria-label="Main" style={S("box-sizing:border-box;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center;justify-items:center;padding:10px 8px 22px;background:#FFFFFF;border-top:1px solid #E6E8EC;font-family:'Geist',system-ui,sans-serif")}>
        {tabsA('calendar', '/calendar', 'Calendar', true, ic('#0E1116', <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>))}
        {tabsA('services', '/services', 'Services', false, ic('#5E6673', <><circle cx="6" cy="7" r="2.5" /><circle cx="6" cy="17" r="2.5" /><path d="M8 8.5 20 18M8 15.5 20 6" /></>))}
        <button onClick={openNew} aria-label="New appointment" style={S('width:48px;height:48px;padding:0;border:0;border-radius:999px;background:#0E1116;display:flex;align-items:center;justify-content:center;text-decoration:none;cursor:pointer')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        {tabsA('clients', '/clients', 'Clients', false, ic('#5E6673', <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18.5 14.8c1.6.8 2.6 2.4 3 5.2" /></>))}
        {tabsA('more', '/more', 'More', false, ic('#5E6673', <><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></>))}
      </nav>

      {open && (
        <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:5')}>
          <button onClick={close} aria-label="Close details" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
          <div className="sheet" role="dialog" aria-label="Appointment details" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:16px')}>
            <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0')} />

            {mode === 'view' && sel && (<>
              <div style={S('display:flex;justify-content:flex-end;margin-bottom:-8px')}>
                <button onClick={close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button>
              </div>
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
                <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;min-width:0')}>{dayInfo(sel.b.dayYmd).short}</h2>
                {sel.k === 'done'
                  ? <span style={S(sel.chipStyle + ';flex:0 0 auto;font-size:14px;padding:8px 16px')}>{STATUS_LABEL[sel.b.status] ?? sel.chipText}</span>
                  : <button onClick={() => setSt('list')} aria-haspopup="dialog" aria-label={'Status: ' + (STATUS_LABEL[sel.b.status] ?? sel.chipText) + '. Change'} style={S('flex:0 0 auto;display:flex;align-items:center;gap:8px;height:42px;padding:0 14px 0 18px;border:0;border-radius:999px;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer;background:' + chipTone[sel.k].bg + ';color:' + chipTone[sel.k].fg)}>
                    {STATUS_LABEL[sel.b.status] ?? sel.chipText}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </button>}
              </div>
              {sel.b.paid && <div style={S('display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:-6px')}>
                {sel.b.paid && <span style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{sel.b.paidText}</span>}
              </div>}
              <div style={S('display:flex;align-items:center;gap:14px;padding:16px;border:1px solid #E6E8EC;border-radius:22px')}>
                <div style={S(sel.avatarStyle)}>{initials(sel.b.client)}</div>
                <div style={S('flex:1 1 auto;min-width:0')}>
                  <div style={S('font-size:19px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{sel.b.client}</div>
                  <div style={S('margin-top:2px;font-size:13.5px;color:#5E6673;overflow-wrap:anywhere')}>{'Booking B-' + sel.b.ref}</div>
                </div>
                <button onClick={c.startMessage} aria-label={'Message ' + first(sel.b.client)} style={S('flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="3" /><path d="m4.5 7.5 7.5 5.5 7.5-5.5" /></svg>
                </button>
              </div>
              {sel.b.forms && <a href={'/clients/forms?c=' + sel.b.clientId} style={S('display:block;border-radius:16px;text-decoration:none;padding:12px 14px;font-size:13.5px;font-weight:500;background:' + (sel.b.forms.level === 'alert' ? '#FDECEA;color:#B42318' : '#FFF4E5;color:#8A4B00'))}>{sel.b.forms.text}<span style={S('display:block;margin-top:2px;font-size:12.5px;font-weight:600;text-decoration:underline')}>Open forms</span></a>}
              <div className="sum-rows" style={S('padding:2px 16px;border:1px solid #E6E8EC;border-radius:22px')}>
                {([
                  ['Time', sel.time, <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>],
                  ['With', staffName(sel.b.staffId), <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.6-3.4 3.3-5 7-5s6.4 1.6 7 5" /></>],
                ] as const).map(([l, v, icon]) => (
                  <div key={l} style={S('display:flex;align-items:center;gap:12px;padding:14px 0;font-size:15px')}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-label={l}>{icon}</svg>
                    <span style={S('min-width:0;overflow-wrap:anywhere')}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={S('display:flex;flex-direction:column;gap:10px')}>
                <h3 style={S('margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Services</h3>
                {(sel.b.serviceIds.map((id) => svcMap.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof svcMap.get>>[]).map((v) => (
                  <div key={v.id} style={S('display:flex;align-items:center;gap:12px')}>
                    <span style={S('flex:0 0 4px;align-self:stretch;border-radius:999px;background:#B9AEFB')} />
                    <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{v.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{v.dur + ' min'}</span></span>
                    <span style={S('flex:0 0 auto;font-size:14.5px;font-weight:500')}>{usd(v.priceCents)}</span>
                  </div>
                ))}
                {sel.b.serviceIds.every((id) => !svcMap.has(id)) && <div style={S('font-size:14.5px;color:#4A525E')}>{sel.b.services}</div>}
              </div>
              {errP()}
              <div style={S('position:sticky;bottom:-28px;margin:0 -20px -28px;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px')}>
                <div style={S('display:flex;flex-direction:column;gap:2px')}>
                  <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;color:#5E6673;font-size:14px')}><span>Total</span><span>{sel.priceText}</span></div>
                  <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-weight:600')}><span style={S('font-size:15px')}>{sel.b.paid ? 'Paid' : 'To pay'}</span><span style={S('font-size:20px;letter-spacing:-0.02em')}>{sel.priceText}</span></div>
                </div>
                <div style={S('display:flex;gap:10px')}>
                  <button onClick={() => setQa(true)} aria-label="More actions" aria-haspopup="dialog" style={S('flex:0 0 52px;width:52px;height:52px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer')}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#0E1116"><circle cx="12" cy="5.5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="18.5" r="1.6" /></svg>
                  </button>
                  {sel.k === 'done'
                    ? (sel.b.saleId ? <button onClick={() => primary(sel.b)} style={S(PRIMARY + ';height:52px')}>View sale</button> : null)
                    : (<>
                      {cfg.acceptCard && <button disabled={busy} onClick={() => act(async () => { const r = await checkoutBooking(sel.b.id, 'card', cfg.askTip ? cfg.tipDefault : 0); if (!r.error && r.saleId) router.push(`/sales?sale=${r.saleId}&pay=1`); return r; }, '')} style={S(SECOND + ';height:52px')}>Pay now</button>}
                      <button onClick={() => startCheckout(sel.b.id)} style={S(PRIMARY + ';height:52px')}>Checkout</button>
                    </>)}
                </div>
              </div>
            </>)}

            {mode === 'checkout' && sel && <CheckoutWizard c={c} />}

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
              return (<>
                <div style={S('min-width:0')}><h2 style={S(H2S)}>Edit booking</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{summary}</p></div>
                <ServicePicker services={services} selected={ed.ids} initialCat={homeCat} chipHeight={44}
                  lock={edLock} onPick={(id) => { let ids = ed.ids.includes(id) ? ed.ids.filter((i) => i !== id) : [...ed.ids, id]; ids = ids.filter((i) => { const sv = svcMap.get(i); return !sv?.addon || (sv.parents ?? []).some((p) => ids.includes(p)); }); setEd({ ids, start: null }); }}
                  note={(x) => (cur.serviceIds.includes(x.id) || offered(x.id, cur.staffId) ? '' : (offers[x.id] ?? [])[0] ? 'separate booking with ' + first(staffName(offers[x.id][0])) : 'no one offers this')} />
                <div style={S('display:flex;flex-direction:column;border:1px solid #E6E8EC;border-radius:16px;padding:4px 16px')}>
                  <div style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #EEF0F3')}><span style={S('color:#5E6673')}>Length</span><span style={S('font-weight:500;text-align:right')}>{dur}</span></div>
                  <div style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #EEF0F3')}><span style={S('color:#5E6673')}>Finishes</span><span style={S('font-weight:500;text-align:right')}>{end}</span></div>
                  <div style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0')}><span style={S('color:#5E6673')}>Price</span><span style={S('font-weight:500;text-align:right')}>{price}</span></div>
                </div>
                {!!pl.problem && <div role="alert" style={S('border-radius:16px;background:#FDECEA;color:#B42318;padding:12px 14px;font-size:13.5px;font-weight:500')}>{blockText}</div>}
                {pl.alts.length > 0 && (
                  <div style={S('display:flex;flex-direction:column;gap:8px')}><span style={S('font-size:14px;font-weight:600')}>Start earlier or later so it fits</span>
                    <div className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>{pl.alts.map((t) => <button key={t} onClick={() => { setEd({ ids: ed.ids, start: t }); setError(''); }} aria-pressed={pl.start === t} style={S(chip(pl.start === t))}>{fmtMin(t) + ' to ' + fmtMin(t + pl.dur)}</button>)}</div></div>
                )}
                {!pl.problem && (pl.dur > cur.end - cur.start || pl.start !== cur.start) && <div style={S(note('#DDF3EA', '#14624A'))}>{pl.f + ' is free for the full ' + pl.dur + ' min' + (pl.start !== cur.start ? ' from ' + fmtMin(pl.start) : '') + '.'}</div>}
                {pl.extras.map((x) => x.at !== undefined
                  ? <div key={x.svc.id} style={S(note('#ECE8FF', '#3B2BB5'))}>{x.svc.name + ' is a ' + x.svc.cat.toLowerCase() + ' service. It will be booked as a separate appointment with ' + x.f + ' at ' + fmtMin(x.at) + ', ' + x.svc.dur + ' min.'}</div>
                  : <div key={x.svc.id} style={S(note('#FDECEA', '#B42318'))}>{x.sid ? x.f + ' has no free time for ' + x.svc.name + ' on this day.' : 'No one offers ' + x.svc.name + ' yet, so it cannot be added.'}</div>)}
                {errP()}
                <div style={S('display:flex;gap:10px')}>
                  <button onClick={saveEdit} disabled={busy} style={S(PRIMARY)}>Save changes</button>
                  <button onClick={backToView} style={S(SECOND)}>Back</button>
                </div>
                {sel && sel.canEdit && sel.k !== 'live' && (c.cancelAsk
                  ? <CancelPick name={first(cur.client)} mobile busy={busy} onBack={() => c.setCancelAsk(false)} onConfirm={(why) => act(() => cancelBooking(cur.id, why), first(cur.client) + "'s booking cancelled", () => { c.setCancelAsk(false); setOpen(false); setMode('view'); })} />
                  : <button onClick={() => c.setCancelAsk(true)} style={S('height:48px;border:0;border-radius:999px;background:transparent;color:#B42318;font-size:14.5px;font-weight:500;cursor:pointer')}>Cancel this booking</button>)}
              </>);
            })()}

            {mode === 'message' && cur && <MessageBox name={first(cur.client)} context={cur.services + ', ' + dayInfo(cur.dayYmd).short + ' at ' + fmtMin(cur.start)} value={c.msg} onChange={(v) => { c.setMsg(v); setError(''); }} onSend={c.sendMessage} onBack={backToView} busy={busy} error={hasError ? error : ''} />}

            {mode === 'blockview' && bvB && (<>
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><span style={S('display:inline-block;padding:4px 12px;border-radius:999px;background:#EEF0F3;color:#4A525E;font-size:12.5px;font-weight:500')}>Blocked</span><button onClick={close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX sw={2} /></button></div>
              <div><div style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{BLOCK_KINDS.find((k) => k[0] === bvB.kind)?.[1] ?? 'Blocked'}</div><div style={S('font-size:14px;color:#5E6673')}>{staffName(bvB.staffId)}</div></div>
              <dl style={S('margin:0;display:flex;flex-direction:column')}>
                <div style={S(DLROW)}><dt style={S('color:#5E6673')}>Day</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{dayInfo(bvB.dayYmd).full}</dd></div>
                <div style={S(DLROW + ';border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Time</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{fmtMin(bvB.start) + ' – ' + fmtMin(bvB.end)}</dd></div>
              </dl>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={() => act(() => deleteBlock(bvB.id), 'Block removed', () => { setBlockId(null); setOpen(false); setMode('view'); })} style={S(PRIMARY)}>Remove block</button>
                <button onClick={close} style={S(SECOND)}>Close</button>
              </div>
            </>)}

            {mode === 'late' && <LateWizard c={c} />}

            {mode === 'block' && <BlockWizard c={c} />}

            {mode === 'walkin' && <WalkInWizard c={c} props={props} />}

            {mode === 'new' && <NewApptForm c={c} props={props} onCancel={close} />}

            {mode === 'resched' && cur && (<>
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
                <div style={S('min-width:0')}><h2 style={S(H2S)}>{rs.rebook ? 'Rebook' : 'Reschedule'}</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{rs.rebook ? cur.client + ', ' + cur.services + ' with ' + first(staffName(cur.staffId)) + ', ' + (cur.end - cur.start) + ' min, ' + usd(cur.priceCents) + '.' : cur.client + ', ' + cur.services + ' with ' + first(staffName(cur.staffId)) + '.'}</p></div>
                <button onClick={close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button>
              </div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="rs-day-label" style={S('font-size:14px;font-weight:600')}>{rs.rebook ? 'Day' : 'New day'}</span>
                <div role="group" className="hscroll" aria-labelledby="rs-day-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
                  {days14.map((d) => <button key={d.ymd} onClick={() => { if (!d.closed) setRs({ ...rs, day: d.ymd, time: null }); setError(''); }} disabled={d.closed} aria-pressed={rs.day === d.ymd} aria-label={d.full + (d.closed ? ', closed' : '')} style={S(dayCss(rs.day === d.ymd, d.closed))}><span style={S('font-size:12.5px')}>{d.abbr}</span><span style={S('font-size:17px;font-weight:600')}>{d.num}</span></button>)}
                </div></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="rs-time-label" style={S('font-size:14px;font-weight:600')}>{rs.rebook ? 'Time' : 'New time'}</span>
                <div role="group" aria-labelledby="rs-time-label" style={S('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px')}>
                  {slotsFor.map((t) => { const why = reason(rs.day, t, cur.end - cur.start); const on = rs.time === t && !why; return <button key={t} onClick={() => { if (!why) { setRs({ ...rs, time: t }); setError(''); } }} disabled={!!why} aria-pressed={on} aria-label={fmtMin(t) + (why ? ', unavailable' : '')} style={S(slotCss(on, !!why))}>{fmtMin(t)}</button>; })}
                </div></div>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={moveBooking} disabled={busy} style={S(PRIMARY)}>{rs.rebook ? 'Book again' : 'Move appointment'}</button>
                <button onClick={backToView} style={S(SECOND)}>Cancel</button>
              </div>
            </>)}
          </div>
        </div>
      )}

      {qa && open && mode === 'view' && sel && (
        <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:6')}>
          <button onClick={() => setQa(false)} aria-label="Close quick actions" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
          <div className="sheet" role="dialog" aria-label="Quick actions" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column')}>
            <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0;margin-bottom:12px')} />
            <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}><h2 style={S(H2S)}>Quick actions</h2><button onClick={() => setQa(false)} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button></div>
            {(() => {
              const ITEM = 'display:flex;align-items:center;width:100%;min-height:54px;box-sizing:border-box;padding:0;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;text-decoration:none;color:#0E1116;cursor:pointer';
              const grp = 'display:flex;flex-direction:column;padding:4px 0;border-top:1px solid #EEF0F3';
              return (<>
                <div style={S('display:flex;flex-direction:column;padding:4px 0')}>
                  <button onClick={() => { setQa(false); c.startMessage(); }} style={S(ITEM)}>{'Message ' + first(sel.b.client)}</button>
                  <Link href={'/clients/' + sel.b.clientId} style={S(ITEM)}>Open client profile</Link>
                </div>
                <div style={S(grp)}>
                  {sel.canEdit && <button onClick={() => { setQa(false); setEd({ ids: sel.b.serviceIds.slice(), start: null }); setMode('edit'); setError(''); setNotice(''); }} style={S(ITEM)}>Edit or cancel booking</button>}
                  <button onClick={() => { setQa(false); startResched(sel.b, sel.k === 'done'); }} style={S(ITEM)}>{sel.secondaryLabel}</button>
                </div>
              </>);
            })()}
          </div>
        </div>
      )}

      {st && open && mode === 'view' && sel && (
        <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:6')}>
          <button onClick={() => setSt('')} aria-label="Close status" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
          <div className="sheet" role="dialog" aria-label="Change status" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:6px')}>
            <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0;margin-bottom:12px')} />
            {st === 'cancel'
              ? <CancelPick name={first(sel.b.client)} mobile busy={busy} onBack={() => setSt('list')} onConfirm={(why) => act(() => cancelBooking(sel.b.id, why), first(sel.b.client) + "'s booking cancelled", () => { setSt(''); setOpen(false); setMode('view'); })} />
              : (() => {
                const ITEM = 'display:flex;align-items:center;gap:14px;width:100%;min-height:56px;box-sizing:border-box;padding:0;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;color:#0E1116;cursor:pointer';
                const ico = (children: React.ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true">{children}</svg>;
                const tick = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={S('margin-left:auto;flex:0 0 auto')} aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
                const pick = (t: 'confirmed' | 'checked_in' | 'in_progress', label: string) => {
                  setSt('');
                  if (t !== 'confirmed' && sel.b.dayYmd > today) { setError('You can check someone in on the day of their appointment.'); return; }
                  act(() => setBookingStatus(sel.b.id, t), first(sel.b.client) + ' is now ' + label.toLowerCase());
                };
                const cur = sel.b.status;
                const rows: [string, 'confirmed' | 'checked_in' | 'in_progress', string, React.ReactNode][] = [
                  ['confirmed', 'confirmed', 'Confirmed', ico(<path d="M7 11v8H4v-8zM7 11l4-7c1.5 0 2.5 1 2.2 2.5L12.7 9H18a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 16.9 19H7" />)],
                  ['checked_in', 'checked_in', 'Checked in', ico(<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10" r="2.4" /></>)],
                  ['in_progress', 'in_progress', 'Started', ico(<path d="M7 4.5v15L19 12z" />)],
                ];
                const canNoShow = (cur === 'pending' || cur === 'confirmed') && c.started(sel.b);
                return (<>
                  <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px')}><h2 style={S(H2S)}>Change status</h2><button onClick={() => setSt('')} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button></div>
                  {cur === 'pending' && <div style={S(ITEM + ';cursor:default')}>{ico(<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M12 13v4M10 15h4" /></>)}Needs approval{tick}</div>}
                  {rows.map(([id, t, label, icon]) => <button key={id} onClick={() => pick(t, label)} aria-current={cur === id ? 'true' : undefined} style={S(ITEM)}>{icon}{label}{cur === id && tick}</button>)}
                  {canNoShow && <button onClick={() => { setSt(''); c.markNoShow(sel.b); }} style={S(ITEM + ';color:#B42318')}>{ico(<><path d="M3 12s3.5-6 9-6c1.7 0 3.2.6 4.5 1.4M21 12s-3.5 6-9 6c-1.7 0-3.2-.6-4.5-1.4M4 4l16 16" /></>)}No-show</button>}
                  {sel.canEdit && sel.k !== 'live' && <button onClick={() => setSt('cancel')} style={S(ITEM + ';color:#B42318')}>{ico(<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M10 13.5l4 4M14 13.5l-4 4" /></>)}Cancel booking</button>}
                </>);
              })()}
          </div>
        </div>
      )}
    </div>
  );
}
