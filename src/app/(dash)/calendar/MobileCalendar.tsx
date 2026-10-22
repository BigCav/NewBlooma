'use client';
// 1:1 conversion of the prototype's Mobile.dc.html (+ MobileHeader, MobileTabs). Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { ClientMatches } from './ClientMatches';
import { NewApptForm } from './NewApptForm';
import { MessageBox } from './MessageBox';
import { DiscountPick } from './DiscountPick';
import Link from 'next/link';
import { dayInfo, fmtMin, initials, addDaysYmd, BLOCK_KINDS } from '@/lib/cal';
import { cancelBooking, deleteBlock } from './actions';
import { S, ServicePicker, TeamPicker } from './pickers';
import { HATCH, first, usd, m2, BLOCK_DURS_M, METHODS, TIP_OPTS, chip, slotCss, dayCss, note, PRIMARY, SECOND, CLOSE_BTN, H2S, ERR, DLROW, CloseX, Mag } from './calUi';
import type { useCalendar } from './useCalendar';
import type { Props } from './calUi';

export function MobileCalendar({ c, props }: { c: ReturnType<typeof useCalendar>; props: Props }) {
  const { HOUR_PX, act, activeCards, addWalkin, amap, av, avail, availKey, backToView, bf, bfDur, blank, blockId, blockRows, blocks, bookings, busy, bvB, cards, cfg, charge, chk, close, co, coMath, createNew, cur, day, dayB, dayHrs, days14, di, doneBk, ed, editPlan, error, firstOpenDay, gEnd, gHours, gStart, go, hasError, hours, hrsOf, later, laterBk, minutesFromIso, mode, moveBooking, nFirstSvc, nKeyStr, nKeys, nOffers, nPickSvc, nPlan, nSlots, nWhy, nf, notice, now, nowTop, offered, offers, open, openBlock, openBooking, openDays, openNew, pageSubtitle, pageTitle, pendingSel, plan, primary, query, reason, refresh, router, row, rs, saveBlock, saveEdit, searchOpen, seg, sel, selId, services, setAmap, setAvail, setBf, setBlockId, setCo, setEd, setError, setMode, setNf, setNotice, setNow, setOpen, setPendingSel, setPlan, setQuery, setRs, setSearchOpen, setSelId, setSres, setStaffSel, setWi, setWkOpen, slotsFor, sq, sres, staffName, staffSel, startCheckout, startResched, startT, statCount, statRevenue, statNext, strip, svcMap, team, today, todayList, tz, upcoming, view, viewEvents, vm, weekDays, wi, wiPlanText, wiPlanCss, wiSvc, wkCards, wkOpen, wkRange, wkStaff, wkTitle, ws, nLock, edLock, lockFor } = c;
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
      <header style={S("display:flex;flex-direction:column;gap:12px;padding:28px 20px 16px;font-family:'Geist',system-ui,sans-serif;color:#0E1116")}>
        <div style={S('display:flex;align-items:flex-end;justify-content:space-between;gap:12px')}>
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
            <input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search appointments" aria-label="Search appointments"
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
          <section aria-label="Today at a glance" style={S('display:flex;justify-content:space-between;gap:12px')}>
            <div><div style={S('color:#5E6673;font-size:13px')}>Appointments</div><div style={S('margin-top:2px;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{statCount}</div></div>
            <div><div style={S('color:#5E6673;font-size:13px')}>Booked revenue</div><div style={S('margin-top:2px;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{statRevenue}</div></div>
            <div><div style={S('color:#5E6673;font-size:13px')}>Next opening</div><div style={S('margin-top:2px;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{statNext}</div></div>
          </section>

          {!!sq && todayList.length === 0 && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:14px')}>{'No appointments today match "' + query.trim() + '".'}</p>}

          {cards.length > 0 && (
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

          <section aria-label="Later today" style={S('display:flex;flex-direction:column;gap:10px')}>
            <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
              <h2 style={S('margin:0;font-size:16px;font-weight:600')}>{day === today ? 'Later today' : 'Later'}</h2>
              <span style={S('display:flex;gap:8px')}>
                <button onClick={() => { setOpen(true); setMode('walkin'); setWi({ name: '', svc: null, pro: 'any', cat: '' }); setError(''); setNotice(''); }} style={S('height:36px;padding:0 14px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:13px;font-weight:500;cursor:pointer')}>Walk-in</button>
                <button onClick={() => { setOpen(true); setMode('block'); setBf({ s: team[0]?.id ?? '', kind: 'lunch', day: day < today ? today : day, dur: 60, start: null }); setError(''); setNotice(''); }} style={S('height:36px;padding:0 14px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:13px;font-weight:500;cursor:pointer')}>Block time</button>
              </span>
            </div>
            {later.map((b) => (
              <div key={b.id} style={S('display:flex;align-items:center;gap:12px')}>
                <span style={S('flex:0 0 40px;font-size:13px;color:#5E6673')}>{b.startText}</span>
                <button onClick={() => (b.isBlock ? openBlock(b.id) : openBooking(b.id))} aria-label={b.label}
                  style={S(b.isBlock ? 'flex:1 1 0;min-width:0;min-height:64px;box-sizing:border-box;padding:10px 16px;border:1px solid #DDE0E6;border-radius:18px;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;font:inherit;color:#4A525E;background:' + HATCH : (b as any).style)}>
                  <span style={S('min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.client}</span><span style={S('display:block;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.sub}</span></span>
                  <span style={S('flex:0 0 auto;font-size:13.5px;font-weight:500')}>{b.priceText}</span>
                </button>
              </div>
            ))}
          </section>
        </>)}

        {view === 'week' && wkCards.map(({ d, hrs, rows, shown, util, isOpen, limit, summary }) => (
          <section key={d.ymd} style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:16px;display:flex;flex-direction:column;gap:12px')}>
            <div style={S('display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px')}><h2 style={S('margin:0;font-size:16px;font-weight:600')}>{d.abbr + ' ' + d.num + (d.ymd === today ? ', today' : '')}</h2><span style={S('color:#5E6673;font-size:13px')}>{summary}</span></div>
            {hrs?.open && <div style={S('display:flex;align-items:center;gap:10px')}><div style={S('flex:1 1 auto;background:#EEF0F3;border-radius:999px')}><div style={S('height:6px;border-radius:999px;background:#0E1116;width:' + util + '%')} /></div><span style={S('flex:0 0 auto;font-size:12px;color:#5E6673')}>{util + '% booked'}</span></div>}
            {rows.length === 0 && hrs?.open && <p style={S('margin:0;color:#5E6673;font-size:13.5px')}>Nothing booked yet.</p>}
            {shown.map((r, i) => (
              <div key={i} style={S('display:flex;align-items:center;gap:8px')}><span style={S('flex:0 0 40px;font-size:12.5px;color:#5E6673')}>{r.startText}</span>
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
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
                <div style={S('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}><span style={S(sel.chipStyle)}>{sel.chipText}</span>
                  {sel.b.paid && <span style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{sel.b.paidText}</span>}
                  {!!notice && <span role="status" style={S('padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{notice}</span>}</div>
                <button onClick={close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button>
              </div>
              <div style={S('display:flex;align-items:center;gap:14px')}>
                <div style={S(sel.avatarStyle)}>{initials(sel.b.client)}</div>
                <div style={S('min-width:0')}>
                  <div style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;overflow-wrap:anywhere')}>{sel.b.client}</div>
                  <div style={S('font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{sel.b.services}</div>
                </div>
              </div>
              <dl style={S('margin:0;display:flex;flex-direction:column')}>
                <div style={S(DLROW)}><dt style={S('color:#5E6673')}>Booking</dt><dd style={S('margin:0;font-weight:500;text-align:right;white-space:nowrap')}>{'B-' + sel.b.ref}</dd></div>
                <div style={S(DLROW)}><dt style={S('color:#5E6673')}>Time</dt><dd style={S('margin:0;font-weight:500;text-align:right;white-space:nowrap')}>{sel.time}</dd></div>
                <div style={S(DLROW)}><dt style={S('color:#5E6673')}>With</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{staffName(sel.b.staffId)}</dd></div>
                <div style={S(DLROW + ';border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Price</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{sel.priceText}</dd></div>
              </dl>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={() => primary(sel.b)} style={S(PRIMARY)}>{sel.primaryLabel}</button>
                <button onClick={() => startResched(sel.b, sel.k === 'done')} style={S(SECOND)}>{sel.secondaryLabel}</button>
              </div>
              {sel.canEdit && <button onClick={() => { setEd({ ids: sel.b.serviceIds.slice(), start: null }); setMode('edit'); setError(''); setNotice(''); }} style={S('height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500;cursor:pointer')}>Edit booking</button>}
              <button onClick={c.startMessage} style={S('height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500;cursor:pointer')}>{'Message ' + first(sel.b.client)}</button>
            </>)}

            {mode === 'checkout' && sel && (() => {
              const cm = coMath(sel.b.priceCents);
              return (<>
                <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
                  <div style={S('min-width:0')}><h2 style={S(H2S)}>Checkout</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{sel.b.client + ', ' + sel.b.services}</p></div>
                  <button onClick={close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button>
                </div>
                <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="co-method-label" style={S('font-size:14px;font-weight:600')}>Payment method</span><div role="group" className="hscroll" aria-labelledby="co-method-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
                  {METHODS.filter(([m]) => (m === 'card' ? cfg.acceptCard : m === 'cash' ? cfg.acceptCash : cfg.acceptGift)).map(([m, l]) => <button key={m} onClick={() => setCo({ ...co, method: m })} aria-pressed={co.method === m} style={S(chip(co.method === m))}>{l}</button>)}</div></div>
                {co.method === 'gift_card' && <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="co-code" style={S('font-size:14px;font-weight:600')}>Gift card code</label><input id="co-code" type="text" value={co.code} onChange={(e) => setCo({ ...co, code: e.target.value })} placeholder="Code" style={{ ...S('box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF'), minHeight: 0 }} /></div>}
                {cfg.canDiscount && <DiscountPick mobile value={co.disc} onChange={(d) => setCo({ ...co, disc: d })} />}
                {cfg.askTip && <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="co-tip-label" style={S('font-size:14px;font-weight:600')}>Tip</span><div role="group" className="hscroll" aria-labelledby="co-tip-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
                  {TIP_OPTS.map(([p, l]) => <button key={p} onClick={() => setCo({ ...co, tip: p })} aria-pressed={co.tip === p} style={S(chip(co.tip === p))}>{l}</button>)}</div></div>}
                <dl style={S('margin:0;display:flex;flex-direction:column')}>
                  <div style={S(DLROW)}><dt style={S('color:#5E6673')}>Service</dt><dd style={S('margin:0;text-align:right;font-weight:500;white-space:nowrap')}>{m2(sel.b.priceCents)}</dd></div>
                  {cm.disc > 0 && <div style={S(DLROW)}><dt style={S('color:#5E6673')}>Discount</dt><dd style={S('margin:0;text-align:right;font-weight:500;white-space:nowrap')}>{'-' + m2(cm.disc)}</dd></div>}
                  <div style={S(DLROW)}><dt style={S('color:#5E6673')}>Tip</dt><dd style={S('margin:0;text-align:right;font-weight:500;white-space:nowrap')}>{cm.tip ? m2(cm.tip) : 'None'}</dd></div>
                  <div style={S(DLROW)}><dt style={S('color:#5E6673')}>{cm.taxLabel}</dt><dd style={S('margin:0;text-align:right;font-weight:500;white-space:nowrap')}>{m2(cm.taxAmt)}</dd></div>
                  <div style={S(DLROW + ';border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Total</dt><dd style={S('margin:0;text-align:right;font-weight:600;white-space:nowrap')}>{m2(cm.total)}</dd></div>
                </dl>
                {errP()}
                <div style={S('display:flex;gap:10px')}>
                  <button onClick={charge} disabled={busy} style={S(PRIMARY)}>{'Charge ' + m2(cm.total)}</button>
                  <button onClick={backToView} style={S(SECOND)}>Cancel</button>
                </div>
              </>);
            })()}

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
                {sel && sel.canEdit && sel.k !== 'live' && <button onClick={() => act(() => cancelBooking(cur.id), first(cur.client) + "'s booking cancelled", () => { setOpen(false); setMode('view'); })} style={S('height:48px;border:0;border-radius:999px;background:transparent;color:#B42318;font-size:14.5px;font-weight:500;cursor:pointer')}>Cancel this booking</button>}
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

            {mode === 'block' && (<>
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><div style={S('min-width:0')}><h2 style={S(H2S)}>Block time</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>Clients cannot book blocked time.</p></div><button onClick={close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX sw={2} /></button></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-who" style={S('font-size:14px;font-weight:600')}>Team member</span><TeamPicker team={team} selected={bf.s} onPick={(id) => { setBf({ ...bf, s: id, start: null }); setError(''); }} /></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-kind" style={S('font-size:14px;font-weight:600')}>Reason</span><div role="group" aria-labelledby="bk-kind" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>
                {BLOCK_KINDS.map(([k, l]) => <button key={k} onClick={() => setBf({ ...bf, kind: k })} aria-pressed={bf.kind === k} style={S(chip(bf.kind === k))}>{l}</button>)}</div></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-dur" style={S('font-size:14px;font-weight:600')}>Length</span><div role="group" aria-labelledby="bk-dur" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>
                {BLOCK_DURS_M.map(([m, l]) => <button key={m} onClick={() => { setBf({ ...bf, dur: m, start: null }); setError(''); }} aria-pressed={bf.dur === m} style={S(chip(bf.dur === m))}>{l}</button>)}</div></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-day" style={S('font-size:14px;font-weight:600')}>Day</span><div role="group" className="hscroll" aria-labelledby="bk-day" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>
                {days14.map((d) => <button key={d.ymd} onClick={() => { if (!d.closed) { setBf({ ...bf, day: d.ymd, start: null }); setError(''); } }} disabled={d.closed} aria-pressed={bf.day === d.ymd} aria-label={d.full + (d.closed ? ', closed' : '')} style={S(dayCss(bf.day === d.ymd, d.closed))}><span style={S('font-size:12.5px')}>{d.abbr}</span><span style={S('font-size:17px;font-weight:600')}>{d.num}</span></button>)}</div></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="bk-time" style={S('font-size:14px;font-weight:600')}>Starts at</span><div role="group" aria-labelledby="bk-time" style={S('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px')}>
                {slotsFor.map((t) => { const why = reason(bf.day, t, bfDur); const on = bf.start === t && !why; return <button key={t} onClick={() => { if (!why) { setBf({ ...bf, start: t }); setError(''); } }} disabled={!!why} aria-pressed={on} aria-label={fmtMin(t) + (why ? ', unavailable' : '')} style={S(slotCss(on, !!why))}>{fmtMin(t)}</button>; })}</div></div>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={saveBlock} disabled={busy} style={S(PRIMARY)}>Block time</button>
                <button onClick={close} style={S(SECOND)}>Cancel</button>
              </div>
            </>)}

            {mode === 'walkin' && (<>
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><div style={S('min-width:0')}><h2 style={S(H2S)}>Walk-in</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>We will find the first free time today.</p></div><button onClick={close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><label htmlFor="wi-name" style={S('font-size:14px;font-weight:600')}>Client name</label><input id="wi-name" type="text" value={wi.name} onChange={(e) => { setWi({ ...wi, name: e.target.value }); setError(''); }} placeholder="Full name" style={{ ...S('box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF'), minHeight: 0 }} /></div>
              <div style={S('display:flex;flex-direction:column;gap:10px')}><span id="wi-svc" style={S('font-size:14px;font-weight:600')}>Service</span>
                <ServicePicker extras={false} lock={lockFor([])} services={services} selected={wi.svc ? [wi.svc] : []} initialCat={wiSvc?.cat || wi.cat || undefined} chipHeight={44} onCat={(c) => setWi({ ...wi, cat: c })}
                  onPick={(id) => { const sv = svcMap.get(id)!; const pro = wi.pro !== 'any' && !offered(id, wi.pro) ? 'any' : wi.pro; setWi(wi.svc === id ? { ...wi, svc: null } : { ...wi, svc: id, cat: sv.cat, pro }); setError(''); }} /></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="wi-pro" style={S('font-size:14px;font-weight:600')}>Team member</span>
                <TeamPicker team={team} selected={wi.pro} anyLabel="First available" offers={wi.svc ? (sid) => offered(wi.svc!, sid) : undefined} onPick={(id) => { setWi({ ...wi, pro: id || 'any' }); setError(''); }} /></div>
              <div role="status" style={S(wiPlanCss)}>{wiPlanText}</div>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={() => addWalkin(true)} disabled={busy} style={S(PRIMARY)}>Add &amp; check out</button>
                <button onClick={() => addWalkin(false)} disabled={busy} style={S(SECOND)}>Add to calendar</button>
              </div>
            </>)}

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
    </div>
  );
}
