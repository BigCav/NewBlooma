'use client';
// 1:1 conversion of the prototype's Mobile.dc.html (+ MobileHeader, MobileTabs). Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import { ConfirmBox } from '@/components/ConfirmBox';
import { BottomSheet } from '@/components/BottomSheet';
import { openNewMenu } from '@/components/NewMenu';
import { rootCls } from '@/components/drawer';
import { useState } from 'react';
import { NewApptForm } from './NewApptForm';
import { LateWizard, BlockWizard, WalkInWizard, CheckoutWizard } from './QuickWizards';
import { ChatPage } from '@/components/ChatPanel';
import Link from 'next/link';
import { dayInfo, fmtMin, addDaysYmd, BLOCK_KINDS } from '@/lib/cal';
import { cancelBooking, deleteBlock, messageBookingClient, setBookingStatus } from './actions';
import { sendReceipt } from '../sales/actions';
import { VisitSheet, MoreButton, QuickActions, QaGroup, QA_ITEM, ICON_TIME, ICON_PERSON } from './VisitSheet';
import { dollars } from '@/lib/format';
import { duration, plural, bookingRef } from '@/lib/display';
import { firstName } from '@/lib/people';
import { bookingStatus, PAYMENT_STATUS } from '@/lib/status';
import { TONE } from '@/lib/tones';
import { Chip, FieldError, FilterChip, Notice, RING, CLOSE, DOTS, DANGER, dim } from '@/components/ui';
import { CancelPick } from './CancelPick';
import { TerminalStatus } from './TerminalStatus';
import { S, ServicePicker } from './pickers';
import { DayStrip, TimeGrid } from '@/components/DayTimePicker';
import { HATCH, noteTone, spanText, NoticeBar, PRIMARY, SECOND, H2S, DLROW, Mag } from './calUi';
import type { useCalendar } from './useCalendar';
import type { Props } from './calUi';

export function MobileCalendar({ c, props, drawer }: { c: ReturnType<typeof useCalendar>; props: Props; drawer?: boolean }) {
  const { act, activeCards, backToView, bookings, busy, bvB, cards, cfg, close, cur, day, dayB, days14, ed, editPlan, error, go, hasError, hrsOf, later, mode, moveBooking, notice, now, offered, offers, open, openBlock, openBooking, openNew, pageSubtitle, pageTitle, primary, query, reason, rs, saveEdit, searchOpen, seg, sel, services, setBf, setBlockId, setEd, setError, setMode, setNotice, setOpen, setQuery, setRs, setSearchOpen, setSelId, setWi, setWkOpen, slotsFor, sq, sres, staffName, startCheckout, startResched, statCount, statRevenue, statNext, strip, svcMap, team, today, view, wkCards, wkOpen, wkRange, wkTitle, edLock, openLate } = c;
  const [qa, setQa] = useState(false);
  const [askBlock, setAskBlock] = useState(false);
  const [qk, setQk] = useState(false);
  const [sum, setSum] = useState(false);
  const done = dayB.filter((b) => b.status === 'completed').length;
  const live = dayB.filter((b) => b.status === 'in_progress' || b.status === 'checked_in').length;
  const toCome = dayB.filter((b) => b.status === 'pending' || b.status === 'confirmed').length;
  const worth = dayB.reduce((a, b) => a + b.priceCents, 0);
  const paidC = dayB.reduce((a, b) => a + (b.paid ? b.priceCents : 0), 0);
  const sumTitle = day === today ? "Today's summary" : dayInfo(day).short + ' summary';
  const stats: [string, string][] = [
    ['Appointments', String(statCount)], ['Booked revenue', statRevenue],
    ['Next opening', statNext], ['Completed', String(done)],
    ['In progress', String(live)], ['Still to come', String(toCome)],
    ['Paid so far', dollars(paidC)], ['Still to take', dollars(Math.max(0, worth - paidC))],
  ];
  const SHEET_ROW = 'display:flex;align-items:center;width:100%;min-height:56px;box-sizing:border-box;padding:0;border:0;border-bottom:1px solid #EEF0F3;background:transparent;font:inherit;font-size:16px;text-align:left;color:#0E1116;cursor:pointer';
  const fullSheet = (title: string, body: React.ReactNode, onClose: () => void, bg = '#FFFFFF') => (
    <BottomSheet label={title} onClose={onClose} z={6} gap={0} handleGap={12} bg={bg}>
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px')}>
          <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={S(RING)}>{CLOSE}</button>
        </div>
        {body}
      </BottomSheet>
  );
  const startWalkin = () => { if (day !== today || view !== 'day') go(today, 'day'); setOpen(true); setMode('walkin'); setWi({ name: '', clientId: null, svc: null, pro: 'any', cat: '' }); setError(''); setNotice(''); };
  const startBlock = () => { setOpen(true); setMode('block'); setBf({ s: team[0]?.id ?? '', kind: 'lunch', day: day < today ? today : day, dur: 60, start: null }); setError(''); setNotice(''); };
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
  const errP = () => hasError ? <FieldError>{error}</FieldError> : null;
  const tabsA = (id: string, href: string, label: string, on: boolean, svg: React.ReactNode) => (
    <Link key={id} href={href} aria-current={on ? 'page' : 'false'} style={S('width:100%;min-height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-decoration:none;font-size:12px;font-weight:' + (on ? 600 : 500) + ';color:' + (on ? '#0E1116' : '#5E6673'))}>
      {svg}{label}
    </Link>
  );
  const ic = (color: string, children: React.ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;

  return (
    <div className={rootCls(drawer)} style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>

      {qk && fullSheet('More actions', (
        <div style={S('display:flex;flex-direction:column;border-top:1px solid #EEF0F3')}>
          <button onClick={() => { setQk(false); startWalkin(); }} style={S(SHEET_ROW)}>Walk-in</button>
          <button onClick={() => { setQk(false); openLate(); }} style={S(SHEET_ROW)}>Running late</button>
          <button onClick={() => { setQk(false); startBlock(); }} style={S(SHEET_ROW)}>Block time</button>
        </div>
      ), () => setQk(false))}
      {sum && fullSheet(sumTitle, (
        <div style={S('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px')}>
          {stats.map(([l, v]) => (
            <div key={l} style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:20px;padding:16px')}>
              <div style={S('color:#5E6673;font-size:13px')}>{l}</div>
              <div style={S('margin-top:4px;font-size:24px;line-height:1.15;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{v}</div>
            </div>
          ))}
        </div>
      ), () => setSum(false), '#F4F5F7')}

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

        {!!notice && !open && <NoticeBar text={notice} onDismiss={() => setNotice('')} />}
        {hasError && !open && <FieldError>{error}</FieldError>}

        {view === 'day' && (<>
          <div style={S('display:flex;flex-direction:column;gap:12px')}>
            <div style={S('display:flex;gap:10px')}>
              <button onClick={() => setQk(true)} aria-label="More actions" aria-haspopup="dialog" style={S(RING + ';flex:0 0 52px;width:52px;height:52px')}>{DOTS}</button>
              <button onClick={() => setSum(true)} aria-haspopup="dialog" style={S('flex:1 1 0;height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;cursor:pointer')}>{sumTitle}</button>
            </div>
          </div>

          {!!sq && (
            <section aria-label="Search results" style={S('display:flex;flex-direction:column;gap:10px')}>
              <h2 style={S('margin:0;font-size:16px;font-weight:600')}>Search results</h2>
              <p style={S('margin:0;color:#5E6673;font-size:13.5px')}>{(c.sres ? plural(c.sres.length, 'appointment') : 'Searching') + ' for "' + query.trim() + '"'}</p>
              {c.sres && c.sres.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>Nothing matches that yet. Try a client name, phone number, service or booking number.</p>}
              {(c.sres ?? []).map((h) => { const when = dayInfo(h.dayYmd).short + ', ' + fmtMin(h.start); return (
                <button key={h.id} onClick={() => { c.setSelId(h.id); c.setQuery(''); c.setSearchOpen(false); c.setOpen(true); c.setMode('view'); if (h.dayYmd !== day) go(h.dayYmd, 'day'); }} aria-label={h.client + ', ' + h.services + ', ' + when} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:60px;padding:10px 14px;border:1px solid #E6E8EC;border-radius:18px;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
                  <span style={S('min-width:0;flex:1 1 auto')}><span style={S('display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{h.client}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{h.services + ' with ' + firstName(h.staff, '')}</span></span>
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
                      <span style={S('display:flex;flex-wrap:wrap;gap:8px')}><Chip tone={c.status.tone}>{c.status.label}</Chip>{c.b.paid && <Chip tone="green">{c.b.paidText}</Chip>}</span>
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
              <span style={S('color:#5E6673;font-size:13px')}>{c.laterUp.length === 0 ? '' : plural(c.laterUp.length, 'appointment')}</span>
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
        <button onClick={() => openNewMenu(openNew)} aria-label="Create new" aria-haspopup="dialog" style={S('width:48px;height:48px;padding:0;border:0;border-radius:999px;background:#0E1116;display:flex;align-items:center;justify-content:center;text-decoration:none;cursor:pointer')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        {tabsA('clients', '/clients', 'Clients', false, ic('#5E6673', <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18.5 14.8c1.6.8 2.6 2.4 3 5.2" /></>))}
        {tabsA('more', '/more', 'More', false, ic('#5E6673', <><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></>))}
      </nav>

      {open && !(mode === 'message' && cur?.clientId) && (
        <BottomSheet label="Appointment details" onClose={close} backdropLabel="Close details">

            {mode === 'view' && sel && (
              <VisitSheet onClose={close} title={dayInfo(sel.b.dayYmd).short}
                status={sel.k === 'done'
                  ? <Chip tone={sel.status.tone} size="lg">{sel.status.label}</Chip>
                  : <button onClick={() => setSt('list')} aria-haspopup="dialog" aria-label={'Status: ' + sel.status.label + '. Change'} style={S('flex:0 0 auto;display:flex;align-items:center;gap:8px;height:42px;padding:0 14px 0 18px;border:0;border-radius:999px;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer;background:' + TONE[sel.status.tone].bg + ';color:' + TONE[sel.status.tone].fg)}>
                    {sel.status.label}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </button>}
                tags={(sel.b.paid || sel.b.refunded) && <div style={S('display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:-6px')}>
                  {sel.b.paid && <Chip tone={PAYMENT_STATUS.paid.tone}>{sel.b.paidText}</Chip>}
                  {sel.b.refunded && <Chip tone={PAYMENT_STATUS.refunded.tone}>{PAYMENT_STATUS.refunded.label}</Chip>}
                </div>}
                name={sel.b.client} sub={'Booking ' + bookingRef(sel.b.ref)}
                clientAction={<button onClick={c.startMessage} aria-label={'Message ' + firstName(sel.b.client, '')} style={S(RING)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="3" /><path d="m4.5 7.5 7.5 5.5 7.5-5.5" /></svg>
                </button>}
                banner={sel.b.forms && <a href={'/clients/forms?c=' + sel.b.clientId} style={S('display:block;border-radius:16px;text-decoration:none;padding:12px 14px;font-size:13.5px;font-weight:500;background:' + TONE[sel.b.forms.level === 'alert' ? 'red' : 'amber'].bg + ';color:' + TONE[sel.b.forms.level === 'alert' ? 'red' : 'amber'].fg)}>{sel.b.forms.text}<span style={S('display:block;margin-top:2px;font-size:12.5px;font-weight:600;text-decoration:underline')}>Open forms</span></a>}
                details={[
                  { label: 'Time', value: sel.time, icon: ICON_TIME },
                  { label: 'With', value: staffName(sel.b.staffId), icon: ICON_PERSON, photo: c.team.find((t) => t.id === sel.b.staffId)?.photo ?? null },
                ]}
                lines={(sel.b.serviceIds.map((id) => svcMap.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof svcMap.get>>[]).map((v) => ({ key: v.id, name: v.name, sub: duration(v.dur), price: dollars(v.priceCents) }))}
                fallback={sel.b.services}
                total={sel.priceText} label={sel.b.paid ? 'Paid' : sel.b.refunded ? 'Refunded' : 'To pay'}
                message={<>{!!notice && <Notice>{notice}</Notice>}{errP()}</>}
                actions={c.confirmRefund ? (
                  <ConfirmBox label="Confirm refund" title={'Refund ' + dollars(sel.b.saleCents ?? sel.b.priceCents) + '?'} body="The sale is marked as refunded and removed from today's sales." action="Refund" keep="Cancel" onAction={() => c.doRefund()} busy={busy} onKeep={() => c.setConfirmRefund(false)} />
                ) : <>
                  {sel.b.paid && sel.b.saleId && <div style={S('display:flex;gap:10px')}>
                    <button disabled={busy} onClick={() => act(() => sendReceipt(sel.b.saleId!), 'Receipt sent')} style={S(SECOND + ';height:52px' + dim(busy))}>Send receipt</button>
                    <button onClick={() => c.setConfirmRefund(true)} style={S(SECOND + ';height:52px')}>Refund</button>
                  </div>}
                  <div style={S('display:flex;gap:10px')}>
                    <MoreButton onClick={() => setQa(true)} />
                  {sel.k === 'done'
                    ? (sel.b.saleId ? <button onClick={() => primary(sel.b)} style={S(PRIMARY + ';height:52px')}>View sale</button> : null)
                    : (<>
                      {cfg.acceptCard && <button disabled={busy} onClick={() => c.payNow(sel.b.id)} style={S(SECOND + ';height:52px' + dim(busy))}>Pay now</button>}
                      <button onClick={() => startCheckout(sel.b.id)} style={S(PRIMARY + ';height:52px')}>Checkout</button>
                    </>)}
                  </div>
                </>}
              />
            )}

            {mode === 'checkout' && sel && <CheckoutWizard c={c} />}

            {mode === 'refund' && sel && <TerminalStatus t={{ ...c.term.view, onDone: c.finishRefund, onRetry: () => c.doRefund(true), onBack: c.backFromRefund }} amount={dollars(sel.b.saleCents ?? sel.b.priceCents)} refund />}

            {mode === 'edit' && cur && (() => {
              const pl = editPlan()!;
              const homeCat = svcMap.get(cur.serviceIds[0])?.cat;
              const summary = cur.client + ' with ' + pl.f + ', ' + dayInfo(cur.dayYmd).short + ' at ' + fmtMin(cur.start) + '.';
              const oldDur = cur.end - cur.start;
              const dur = pl.dur === oldDur ? duration(pl.dur) : duration(oldDur) + ' to ' + duration(pl.dur);
              const end = fmtMin(pl.mainEnd) + (pl.dur !== oldDur || pl.start !== cur.start ? ' (was ' + fmtMin(cur.end) + ')' : '');
              const price = pl.priceC === cur.priceCents ? dollars(pl.priceC) : dollars(cur.priceCents) + ' to ' + dollars(pl.priceC);
              let blockText = '';
              if (pl.problem) {
                blockText = pl.problem.kind === 'late' ? 'That would run past closing at ' + fmtMin(hrsOf(cur.dayYmd)?.to ?? 1080) + '.' : pl.f + ' is booked with ' + pl.problem.with.who + ' from ' + fmtMin(pl.problem.with.s) + ', so ' + duration(pl.dur) + ' from ' + fmtMin(pl.start) + ' does not fit.';
                if (!pl.alts.length) blockText += ' ' + pl.f + ' has no gap long enough today. Remove a service or reschedule to another day.';
              }
              return (<>
                <div style={S('min-width:0')}><h2 style={S(H2S)}>Edit appointment</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{summary}</p></div>
                <ServicePicker services={services} selected={ed.ids} initialCat={homeCat} chipHeight={44}
                  lock={edLock} onPick={(id) => { let ids = ed.ids.includes(id) ? ed.ids.filter((i) => i !== id) : [...ed.ids, id]; ids = ids.filter((i) => { const sv = svcMap.get(i); return !sv?.addon || (sv.parents ?? []).some((p) => ids.includes(p)); }); setEd({ ids, start: null }); }}
                  note={(x) => (cur.serviceIds.includes(x.id) || offered(x.id, cur.staffId) ? '' : (offers[x.id] ?? [])[0] ? 'separate booking with ' + firstName(staffName(offers[x.id][0]), '') : 'no one offers this')} />
                <div style={S('display:flex;flex-direction:column;border:1px solid #E6E8EC;border-radius:16px;padding:4px 16px')}>
                  <div style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #EEF0F3')}><span style={S('color:#5E6673')}>Length</span><span style={S('font-weight:500;text-align:right')}>{dur}</span></div>
                  <div style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #EEF0F3')}><span style={S('color:#5E6673')}>Finishes</span><span style={S('font-weight:500;text-align:right')}>{end}</span></div>
                  <div style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0')}><span style={S('color:#5E6673')}>Price</span><span style={S('font-weight:500;text-align:right')}>{price}</span></div>
                </div>
                {!!pl.problem && <div role="alert" style={S(noteTone('red'))}>{blockText}</div>}
                {pl.alts.length > 0 && (
                  <div style={S('display:flex;flex-direction:column;gap:8px')}><span style={S('font-size:14px;font-weight:600')}>Start earlier or later so it fits</span>
                    <div className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>{pl.alts.map((t) => <FilterChip key={t} on={pl.start === t} phone onClick={() => { setEd({ ids: ed.ids, start: t }); setError(''); }}>{spanText(t, t + pl.dur)}</FilterChip>)}</div></div>
                )}
                {!pl.problem && (pl.dur > cur.end - cur.start || pl.start !== cur.start) && <div style={S(noteTone('green'))}>{pl.f + ' is free for the full ' + duration(pl.dur) + (pl.start !== cur.start ? ' from ' + fmtMin(pl.start) : '') + '.'}</div>}
                {pl.extras.map((x) => x.at !== undefined
                  ? <div key={x.svc.id} style={S(noteTone('purple'))}>{x.svc.name + ' is a ' + x.svc.cat.toLowerCase() + ' service. It will be booked as a separate appointment with ' + x.f + ' at ' + fmtMin(x.at) + ', ' + duration(x.svc.dur) + '.'}</div>
                  : <div key={x.svc.id} style={S(noteTone('red'))}>{x.sid ? x.f + ' has no free time for ' + x.svc.name + ' on this day.' : 'No one offers ' + x.svc.name + ' yet, so it cannot be added.'}</div>)}
                {errP()}
                <div style={S('display:flex;gap:10px')}>
                  <button onClick={saveEdit} disabled={busy} style={S(PRIMARY + dim(busy))}>{busy ? 'Saving…' : 'Save changes'}</button>
                  <button onClick={backToView} style={S(SECOND)}>Back</button>
                </div>
                {sel && sel.canEdit && sel.k !== 'live' && (c.cancelAsk
                  ? <CancelPick name={firstName(cur.client, '')} mobile busy={busy} onBack={() => c.setCancelAsk(false)} onConfirm={(why) => act(() => cancelBooking(cur.id, why), firstName(cur.client, '') + "'s appointment cancelled", () => { c.setCancelAsk(false); setOpen(false); setMode('view'); })} />
                  : <button onClick={() => c.setCancelAsk(true)} style={S(DANGER + ';flex:0 0 auto;width:100%')}>Cancel appointment</button>)}
              </>);
            })()}

            {mode === 'message' && cur && !cur.clientId && <p style={S('margin:0;color:#5E6673;font-size:14px')}>This appointment has no client to message.</p>}

            {mode === 'blockview' && bvB && (<>
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><Chip tone="grey">Blocked</Chip><button onClick={close} aria-label="Close" style={S(RING)}>{CLOSE}</button></div>
              <div><div style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{BLOCK_KINDS.find((k) => k[0] === bvB.kind)?.[1] ?? 'Blocked'}</div><div style={S('font-size:14px;color:#5E6673')}>{staffName(bvB.staffId)}</div></div>
              <dl style={S('margin:0;display:flex;flex-direction:column')}>
                <div style={S(DLROW)}><dt style={S('color:#5E6673')}>Day</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{dayInfo(bvB.dayYmd).full}</dd></div>
                <div style={S(DLROW + ';border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Time</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{spanText(bvB.start, bvB.end)}</dd></div>
              </dl>
              {errP()}
              {askBlock ? <ConfirmBox label="Confirm removal" title="Remove this block?" body="The time opens up for bookings again." action="Remove block" onAction={() => { setAskBlock(false); act(() => deleteBlock(bvB.id), 'Block removed', () => { setBlockId(null); setOpen(false); setMode('view'); }); }} onKeep={() => setAskBlock(false)} busy={busy} /> : (
              <div style={S('display:flex;gap:10px')}>
                <button onClick={close} style={S(SECOND)}>Close</button>
                <button onClick={() => setAskBlock(true)} style={S(DANGER)}>Remove block</button>
              </div>
              )}
            </>)}

            {mode === 'late' && <LateWizard c={c} />}

            {mode === 'block' && <BlockWizard c={c} />}

            {mode === 'walkin' && <WalkInWizard c={c} props={props} />}

            {mode === 'new' && <NewApptForm c={c} props={props} onCancel={close} />}

            {mode === 'resched' && cur && (<>
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
                <div style={S('min-width:0')}><h2 style={S(H2S)}>{rs.rebook ? 'Book again' : 'Reschedule'}</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{rs.rebook ? cur.client + ', ' + cur.services + ' with ' + firstName(staffName(cur.staffId), '') + ', ' + duration(cur.end - cur.start) + ', ' + dollars(cur.priceCents) + '.' : cur.client + ', ' + cur.services + ' with ' + firstName(staffName(cur.staffId), '') + '.'}</p></div>
                <button onClick={close} aria-label="Close" style={S(RING)}>{CLOSE}</button>
              </div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="rs-day-label" style={S('font-size:14px;font-weight:600')}>{rs.rebook ? 'Day' : 'New day'}</span>
                <DayStrip days={days14} selected={rs.day} onPick={(ymd) => { setRs({ ...rs, day: ymd, time: null }); setError(''); }} labelledBy="rs-day-label" /></div>
              <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="rs-time-label" style={S('font-size:14px;font-weight:600')}>{rs.rebook ? 'Time' : 'New time'}</span>
                <TimeGrid times={slotsFor.map((min) => ({ min, ok: !reason(rs.day, min, cur.end - cur.start) }))} selected={rs.time} onPick={(min) => { setRs({ ...rs, time: min }); setError(''); }} labelledBy="rs-time-label" /></div>
              {errP()}
              <div style={S('display:flex;gap:10px')}>
                <button onClick={moveBooking} disabled={busy} style={S(PRIMARY + dim(busy))}>{busy ? 'Saving…' : rs.rebook ? 'Book again' : 'Move appointment'}</button>
                <button onClick={backToView} style={S(SECOND)}>Cancel</button>
              </div>
            </>)}
          </BottomSheet>
      )}

      {open && mode === 'message' && cur?.clientId && (
        <ChatPage label="Message client" clientId={cur.clientId} name={cur.client} first={firstName(cur.client, '')} context={cur.services + ', ' + dayInfo(cur.dayYmd).short + ' at ' + fmtMin(cur.start)} send={(t) => messageBookingClient(cur.id, t)} onBack={backToView} />
      )}

      {qa && open && mode === 'view' && sel && (
        <QuickActions onClose={() => setQa(false)}>
          <QaGroup first>
            <button onClick={() => { setQa(false); c.startMessage(); }} style={S(QA_ITEM)}>{'Message ' + firstName(sel.b.client, '')}</button>
            <Link href={'/clients/' + sel.b.clientId} style={S(QA_ITEM)}>Open profile</Link>
          </QaGroup>
          <QaGroup>
            {sel.canEdit && <button onClick={() => { setQa(false); setEd({ ids: sel.b.serviceIds.slice(), start: null }); setMode('edit'); setError(''); setNotice(''); }} style={S(QA_ITEM)}>Edit or cancel appointment</button>}
            <button onClick={() => { setQa(false); startResched(sel.b, sel.k === 'done'); }} style={S(QA_ITEM)}>{sel.secondaryLabel}</button>
          </QaGroup>
        </QuickActions>
      )}

      {st && open && mode === 'view' && sel && (
        <BottomSheet label="Change status" onClose={() => setSt('')} backdropLabel="Close status" z={6} gap={6} handleGap={12}>
            {st === 'cancel'
              ? <CancelPick name={firstName(sel.b.client, '')} mobile busy={busy} onBack={() => setSt('list')} onConfirm={(why) => act(() => cancelBooking(sel.b.id, why), firstName(sel.b.client, '') + "'s appointment cancelled", () => { setSt(''); setOpen(false); setMode('view'); })} />
              : (() => {
                const ITEM = 'display:flex;align-items:center;gap:14px;width:100%;min-height:56px;box-sizing:border-box;padding:0;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;color:#0E1116;cursor:pointer';
                const ico = (children: React.ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true">{children}</svg>;
                const tick = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={S('margin-left:auto;flex:0 0 auto')} aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
                const pick = (t: 'confirmed' | 'checked_in' | 'in_progress', label: string) => {
                  setSt('');
                  if (t !== 'confirmed' && sel.b.dayYmd > today) { setError('You can check someone in on the day of their appointment.'); return; }
                  act(() => setBookingStatus(sel.b.id, t), firstName(sel.b.client, '') + ' is now ' + label.toLowerCase());
                };
                const cur = sel.b.status;
                const rows: [string, 'confirmed' | 'checked_in' | 'in_progress', string, React.ReactNode][] = [
                  ['confirmed', 'confirmed', bookingStatus('confirmed').label, ico(<path d="M7 11v8H4v-8zM7 11l4-7c1.5 0 2.5 1 2.2 2.5L12.7 9H18a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 16.9 19H7" />)],
                  ['checked_in', 'checked_in', bookingStatus('checked_in').label, ico(<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10" r="2.4" /></>)],
                  ['in_progress', 'in_progress', bookingStatus('in_progress').label, ico(<path d="M7 4.5v15L19 12z" />)],
                ];
                const canNoShow = (cur === 'pending' || cur === 'confirmed') && c.started(sel.b);
                return (<>
                  <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px')}><h2 style={S(H2S)}>Change status</h2><button onClick={() => setSt('')} aria-label="Close" style={S(RING)}>{CLOSE}</button></div>
                  {cur === 'pending' && <div style={S(ITEM + ';cursor:default')}>{ico(<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M12 13v4M10 15h4" /></>)}{bookingStatus('pending').label}{tick}</div>}
                  {rows.map(([id, t, label, icon]) => <button key={id} onClick={() => pick(t, label)} aria-current={cur === id ? 'true' : undefined} style={S(ITEM)}>{icon}{label}{cur === id && tick}</button>)}
                  {canNoShow && <button onClick={() => { setSt(''); c.markNoShow(sel.b); }} style={S(ITEM + ';color:#B42318')}>{ico(<><path d="M3 12s3.5-6 9-6c1.7 0 3.2.6 4.5 1.4M21 12s-3.5 6-9 6c-1.7 0-3.2-.6-4.5-1.4M4 4l16 16" /></>)}{bookingStatus('no_show').label}</button>}
                  {sel.canEdit && sel.k !== 'live' && <button onClick={() => setSt('cancel')} style={S(ITEM + ';color:#B42318')}>{ico(<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M10 13.5l4 4M14 13.5l-4 4" /></>)}Cancel appointment</button>}
                </>);
              })()}
          </BottomSheet>
      )}
    </div>
  );
}
