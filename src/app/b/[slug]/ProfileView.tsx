'use client';
// 1:1 conversion of the prototype's SalonProfile.dc.html and MobileSalonProfile.dc.html (the public salon page).
// Markup and style strings are kept as written; the {{ }} holes are the salon's real data.
import { SalonHeader } from './SalonHeader';
import { clockStr, plural, timeRange } from '@/lib/display';
import { WEEKDAYS_FULL } from '@/lib/cal';
import { firstName } from '@/lib/people';
import { Avatar, BLACK, CHEV, KV_ROW, Note, OUTLINE, filterChipCss } from '@/components/ui';
import { DrawerKeys } from '@/components/DrawerKeys';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { S } from '../../(dash)/calendar/pickers';
import { ART } from './art';
import type { BookingRow } from './account/AccountView';
import { CARD, H2, ReviewCard, ServiceRow, Stars, bookHref, type Review, type Svc } from './parts';
import { StaffSheet, type Member } from './StaffSheet';

type Props = {
  /** The salon's own pictures, first one large. Any gaps are filled with the illustrations. */
  photos: string[];
  reviews: Review[]; rating: { avg: number; count: number; dist: number[] };
  slug: string; name: string; headline: string; intro: string; about: string; address: string; phone: string; email: string;
  services: Svc[]; cats: string[]; team: Member[]; hours: ({ from: string; to: string } | null)[];
  today: number; nowMin: number; cancel: string; bookable: boolean; next: string | null; account: { name: string; email: string; phone: string } | null; visits: { upcoming: BookingRow[]; past: BookingRow[] };
};
const DAYS = [...WEEKDAYS_FULL.slice(1), WEEKDAYS_FULL[0]];
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const TILES: [string, string][] = [['hair', 'Hair'], ['colour', 'Colour'], ['nails', 'Nails'], ['barber', 'Barber']];
const LABEL = 'position:absolute;left:14px;bottom:14px;padding:6px 14px;border-radius:999px;background:rgba(255,255,255,0.92);color:#0E1116;font-size:13px;font-weight:500';

/** A picture the salon uploaded, in the same rounded frame as the illustrations. The large first picture loads at once; the rest load as they scroll into view. */
function Photo({ src, n, style, first }: { src: string; n: number; style: string; first?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <div style={S('position:relative;overflow:hidden;border-radius:24px;background:#EEF0F3;' + style)}><img src={src} alt={`Photo ${n} of the salon`} loading={first ? 'eager' : 'lazy'} decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /></div>;
}

function Tile({ k, label, style }: { k: string; label?: string; style: string }) {
  return <div role="img" aria-label={(label ?? 'Salon') + ', illustration'} style={S('position:relative;overflow:hidden;border-radius:24px;' + style)}><div style={S('width:100%;height:100%')} dangerouslySetInnerHTML={{ __html: ART[k].replace('<svg ', '<svg width="100%" height="100%" aria-hidden="true" preserveAspectRatio="xMidYMid slice" style="display:block" ') }} />{!!label && <span style={S(LABEL)}>{label}</span>}</div>;
}

function Body({ p, m, cat, setCat, today, openMember }: { p: Props; m: boolean; cat: string; setCat: (c: string) => void; today: number; openMember: (id: string) => void }) {
  const t = p.hours[today];
  const open = !!t && p.nowMin >= toMin(t.from) && p.nowMin < toMin(t.to);
  const openText = open ? 'Open now, until ' + clockStr(t!.to) : 'Closed now';
  const book = (svc?: string) => bookHref(p.slug, svc);
  const matched = TILES.filter(([, n]) => p.cats.some((c) => c.toLowerCase() === n.toLowerCase())).map(([k, n]) => [k, n] as [string, string | undefined]);
  // The design always shows four tiles next to the salon picture; a salon with fewer categories gets unlabelled illustrations in the gaps.
  const tiles = matched.concat(TILES.filter(([k]) => !matched.some(([x]) => x === k)).map(([k]) => [k, undefined] as [string, string | undefined])).slice(0, 4);
  const chips = ['All', ...p.cats].map((c) => ({ c, label: c === 'All' ? 'All services' : c, on: cat === c }));
  const shown = p.services.filter((s) => cat === 'All' || s.cat === cat);
  const photos = (
    <section aria-label="Photos of the salon and our work" style={S(m ? 'display:flex;gap:12px;overflow-x:auto;flex:0 0 auto;margin:0 -20px;padding:0 20px 4px' : 'display:grid;grid-template-columns:2fr 1fr 1fr;grid-template-rows:repeat(2,minmax(0,1fr));gap:12px;height:440px')}>
      {p.photos[0] ? <Photo src={p.photos[0]} n={1} first style={m ? 'flex:0 0 260px;height:320px' : 'grid-row:span 2'} /> : <Tile k="salon" label="The salon" style={m ? 'flex:0 0 260px;height:320px' : 'grid-row:span 2'} />}
      {tiles.map(([k, n], i) => p.photos[i + 1] ? <Photo key={k} src={p.photos[i + 1]} n={i + 2} style={m ? 'flex:0 0 260px;height:320px' : ''} /> : <Tile key={k} k={k} label={n} style={m ? 'flex:0 0 260px;height:320px' : ''} />)}
    </section>
  );
  const services = (
    <section aria-label="Services" style={S(CARD(m ? 20 : 24, 16))}>
      <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Services</h2>
      <div role="group" className="hscroll" aria-label="Filter services" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
        {chips.map((x) => <button key={x.c} onClick={() => setCat(x.c)} aria-pressed={x.on} style={S(filterChipCss(x.on, m))}>{x.label}</button>)}
      </div>
      {shown.length === 0 && <span style={S('color:#5E6673;font-size:14px')}>No services are open for online booking yet.</span>}
      <ul style={S(`margin:0 -${m ? 20 : 24}px -${m ? 20 : 24}px;padding:0;list-style:none;border-top:1px solid #EEF0F3`)}>
        {shown.map((s, i) => <ServiceRow key={s.id} s={s} m={m} last={i === shown.length - 1} href={p.bookable ? book(s.id) : undefined} />)}
      </ul>
    </section>
  );
  const team = !!p.team.length && (
    <section aria-label="Team" style={S(CARD(m ? 20 : 24, 16))}>
      <h2 style={S(H2)}>Team</h2>
      <ul style={S('margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px')}>
        {p.team.map((x) => (
          <li key={x.id}><button type="button" onClick={() => openMember(x.id)} aria-haspopup="dialog" aria-label={x.name + ', ' + x.role + '. View profile'} className="s-card" style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:14px;border:1px solid #E6E8EC;border-radius:18px;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}><Avatar name={x.name} photo={x.photo} size="lg" /><span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{x.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{x.role}</span></span>{CHEV}</button></li>
        ))}
      </ul>
    </section>
  );
  const rounded = Math.round(p.rating.avg);
  const reviews = p.rating.count > 0 && (
    <section aria-label="Reviews" style={S(CARD(m ? 20 : 24, 18))}>
      <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Reviews</h2>
      <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:' + (m ? '18px 24px' : '20px 36px') + ';padding:' + (m ? 18 : 22) + 'px;border-radius:20px;background:#F4F5F7')}>
        <div style={S(m ? 'flex:1 1 100%;text-align:center' : 'flex:0 0 auto')}>
          <div style={S('font-size:' + (m ? 44 : 52) + 'px;line-height:1;font-weight:600;letter-spacing:-0.04em')}>{p.rating.avg.toFixed(1)}</div>
          <div style={S('margin-top:6px')}><Stars n={rounded} size={18} /></div>
          <div style={S('margin-top:4px;color:#5E6673;font-size:13.5px')}>{plural(p.rating.count, 'review')}</div>
        </div>
        <div style={S('flex:1 1 200px;min-width:0;display:flex;flex-direction:column;gap:7px')}>
          {[5, 4, 3, 2, 1].map((k, i) => (
            <div key={k} style={S('display:flex;align-items:center;gap:10px;font-size:13px;color:#5E6673')}><span style={S('flex:0 0 46px')}>{plural(k, 'star')}</span><div style={S('flex:1 1 auto;background:#FFFFFF;border-radius:999px')}><div style={S('height:8px;border-radius:999px;background:#0E1116;width:' + Math.round((p.rating.dist[i] ?? 0) / p.rating.count * 100) + '%')} /></div><span style={S('flex:0 0 24px;text-align:right')}>{p.rating.dist[i] ?? 0}</span></div>
          ))}
        </div>
      </div>
      <ul style={S('margin:0;padding:0;list-style:none;display:grid;grid-template-columns:' + (m ? '1fr' : 'repeat(auto-fill,minmax(300px,1fr))') + ';gap:12px')}>
        {p.reviews.map((r, i) => <ReviewCard key={i} r={r} from={p.name} />)}
      </ul>
    </section>
  );
  const about = !!(p.about || p.intro) && (
    <section aria-label="About" style={S(CARD(m ? 20 : 24, 12))}>
      <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>About us</h2>
      <p style={S('margin:0;color:#5E6673;font-size:15px;line-height:1.55;white-space:pre-line')}>{[p.intro, p.about].filter(Boolean).join('\n\n')}</p>
    </section>
  );
  const info = (
    <section aria-label="Opening hours and contact" style={S(CARD(m ? 20 : 24, 16))}>
      <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Opening hours</h2>
      <div style={S('display:flex;flex-direction:column;margin-top:-8px')}>
        {DAYS.map((d, i) => <div key={d} style={S(KV_ROW + ';font-weight:' + (i === today ? 600 : 400) + ';color:' + (i === today ? '#0E1116' : '#5E6673'))}><span>{d}</span><span>{p.hours[i] ? timeRange(clockStr(p.hours[i]!.from), clockStr(p.hours[i]!.to)) : 'Closed'}</span></div>)}
      </div>
      {!!(p.address || p.phone || p.email) && <>
        <h2 style={S('margin:4px 0 0;font-size:18px;font-weight:600;letter-spacing:-0.01em')}>Find us</h2>
        <dl style={S('margin:-8px 0 0;display:flex;flex-direction:column')}>
          {!!p.address && <div style={S(KV_ROW)}><dt style={S('color:#5E6673')}>Address</dt><dd style={S('margin:0;text-align:right;font-weight:500;overflow-wrap:anywhere')}><a href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.address)} target="_blank" rel="noopener noreferrer" style={S('color:inherit;text-decoration:underline;text-underline-offset:3px;display:inline-flex;align-items:center;min-height:44px')}>{p.address}</a></dd></div>}
          {!!p.phone && <div style={S(KV_ROW)}><dt style={S('color:#5E6673')}>Phone</dt><dd style={S('margin:0;text-align:right;font-weight:500;white-space:nowrap')}><a href={'tel:' + p.phone.replace(/[^\d+]/g, '')} style={S('color:inherit;text-decoration:underline;text-underline-offset:3px;display:inline-flex;align-items:center;min-height:44px')}>{p.phone}</a></dd></div>}
          {!!p.email && <div style={S(KV_ROW)}><dt style={S('color:#5E6673')}>Email</dt><dd style={S('margin:0;text-align:right;font-weight:500;overflow-wrap:anywhere')}><a href={'mailto:' + p.email} style={S('color:inherit;text-decoration:underline;text-underline-offset:3px;display:inline-flex;align-items:center;min-height:44px')}>{p.email}</a></dd></div>}
        </dl></>}
    </section>
  );
  const manage = <p style={S('margin:0;text-align:center;color:#5E6673;font-size:14px')}>Already booked? <Link href={p.account ? `/b/${p.slug}/account` : '/manage'} style={S('color:#0E1116;font-weight:500')}>Manage your booking</Link>{!p.account && <> · <Link href={`/b/${p.slug}/account`} style={S('color:#0E1116;font-weight:500')}>Sign in</Link></>}</p>;
  const nextUp = p.visits.upcoming[0] ?? null;
  const first = firstName(p.account?.name);
  const pastList = p.visits.past.slice(0, 3);
  const againBtn = (v: BookingRow) => <Link className="ghost" href={book(v.again ?? undefined)} aria-label={'Book ' + v.what + ' again'} style={S(OUTLINE + ';flex:0 0 auto;height:44px;padding:0 ' + (m ? 16 : 18) + 'px')}>Book again</Link>;
  const pastCard = (
    <div style={S(m ? 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px 20px 8px;display:flex;flex-direction:column;gap:6px' : 'flex:2 1 360px;min-width:0;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:28px 28px 12px;display:flex;flex-direction:column;gap:8px')}>
      <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Past visits</h2>
      {pastList.length ? <ul style={S('margin:0;padding:0;list-style:none')}>{pastList.map((v) => (
        <li key={v.id} style={S('display:flex;align-items:center;gap:12px;padding:' + (m ? 12 : 14) + 'px 0;border-top:1px solid #EEF0F3')}><span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{v.what}</span><span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{v.date}{v.who ? ' with ' + v.who : ''}</span></span>{p.bookable && againBtn(v)}</li>
      ))}</ul> : <p style={S('margin:0 0 16px;color:#5E6673;font-size:14px')}>Your past visits will show here.</p>}
    </div>
  );
  const visits = !!p.account && (
    <section aria-label="Your visits" style={S(m ? 'display:flex;flex-direction:column;gap:16px;flex:0 0 auto' : 'display:flex;flex-wrap:wrap;align-items:stretch;gap:24px')}>
      <div style={S(m ? 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px;display:flex;flex-direction:column;gap:14px' : 'flex:3 1 520px;min-width:0;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:28px;display:flex;flex-direction:column;gap:20px')}>
        <div><h2 style={S('margin:0;font-size:' + (m ? 22 : 26) + 'px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>Welcome back, {first}</h2><p style={S('margin:' + (m ? 4 : 6) + 'px 0 0;color:#5E6673;font-size:' + (m ? 14 : 15) + 'px')}>{m ? 'Your details are saved, so booking is quick.' : 'Your details are saved, so booking takes a few taps.'}</p></div>
        {nextUp ? (
          <div style={S('border-radius:' + (m ? 18 : 20) + 'px;background:#F4F5F7;padding:' + (m ? 16 : 20) + 'px;display:flex;flex-direction:column;gap:' + (m ? 12 : 14) + 'px')}>
            <span style={S('color:#5E6673;font-size:13px;font-weight:500')}>Your next appointment</span>
            <div><div style={S('font-size:' + (m ? 18 : 20) + 'px;font-weight:600;letter-spacing:-0.02em')}>{nextUp.when}</div><div style={S('margin-top:4px;font-size:' + (m ? 14.5 : 15) + 'px;overflow-wrap:anywhere')}>{nextUp.what}{nextUp.who ? ' with ' + nextUp.who : ''}</div><div style={S('margin-top:2px;color:#5E6673;font-size:' + (m ? 13 : 13.5) + 'px')}>{nextUp.meta}, pay at the salon</div></div>
            <div style={S('display:flex;flex-wrap:wrap;gap:10px')}>
              {nextUp.manage && <Link href={nextUp.manage} style={S(BLACK + ';height:' + (m ? 52 : 44) + 'px;padding:0 20px;flex:' + (m ? '1 1 100%' : '0 0 auto'))}>Change or cancel</Link>}
              {!m && p.bookable && <Link href={book()} style={S(OUTLINE + ';flex:0 0 auto;height:44px;padding:0 20px')}>Book again</Link>}
            </div>
          </div>
        ) : (
          <div style={S('border-radius:' + (m ? 18 : 20) + 'px;background:#F4F5F7;padding:' + (m ? 16 : 20) + 'px;display:flex;flex-direction:column;align-items:flex-start;gap:12px')}>
            <span style={S('color:#5E6673;font-size:15px')}>You have nothing booked right now.</span>
            {p.bookable && <Link href={book()} style={S(BLACK + ';flex:0 0 auto;height:44px;padding:0 20px')}>Book now</Link>}
          </div>
        )}
      </div>
      {pastCard}
    </section>
  );
  const upNextM = !!p.account && !!nextUp && (
    <section aria-label="Your next appointment" style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px;display:flex;flex-direction:column;gap:12px;flex:0 0 auto')}>
      <span style={S('color:#5E6673;font-size:13px;font-weight:500')}>Your next appointment</span>
      <div><div style={S('font-size:18px;font-weight:600;letter-spacing:-0.02em')}>{nextUp.when}</div><div style={S('margin-top:4px;font-size:14.5px;overflow-wrap:anywhere')}>{nextUp.what}{nextUp.who ? ' with ' + nextUp.who : ''}</div></div>
      {nextUp.manage && <Link href={nextUp.manage} style={S(BLACK + ';flex:0 0 auto')}>Change or cancel</Link>}
    </section>
  );

  if (m) return (<>
    <main className="flow" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:24px 20px 24px;display:flex;flex-direction:column;gap:20px')}>
      <SalonHeader m slug={p.slug} name={p.name} status={{ open, text: openText }} account={p.account ? { name: p.account.name || 'Your account' } : null} />
      {upNextM}{photos}{services}{team}{reviews}{about}{info}{manage}
    </main>
    {p.bookable && <div style={S('flex:0 0 auto;box-sizing:border-box;padding:12px 20px 24px;background:#FFFFFF;border-top:1px solid #E6E8EC')}><Link href={book()} style={S(BLACK + ';flex:0 0 auto')}>Book now</Link></div>}
  </>);
  return (
    <div className="flow" style={S('max-width:1180px;margin:0 auto;box-sizing:border-box;padding:24px 32px 56px;display:flex;flex-direction:column;gap:32px')}>
      <SalonHeader slug={p.slug} name={p.name} status={{ open, text: openText }} account={p.account ? { name: p.account.name || 'Your account' } : null}
        action={p.bookable ? <Link href={book()} style={S(BLACK + ';flex:0 0 auto;height:44px;padding:0 22px')}>Book now</Link> : undefined} />
      {photos}
      {visits}
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:24px')}>
        <div className="flow" style={S('flex:999 1 400px;min-width:0;display:flex;flex-direction:column;gap:24px')}>{services}{team}{reviews}{about}</div>
        <aside className="flow" style={S('flex:1 1 320px;max-width:380px;min-width:0;position:sticky;top:24px;display:flex;flex-direction:column;gap:16px')}>
          <div style={S(CARD(24, 12))}>
            <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Book an appointment</h2>
            <Note>{p.bookable ? `Free cancellation up to ${p.cancel} before. You pay at the salon.` : 'Online booking is not available right now. Please contact the salon.'}</Note>
            {!!p.account && <dl style={S('margin:0;display:flex;flex-direction:column')}>
              <div style={S(KV_ROW)}><dt style={S('color:#5E6673')}>Booking as</dt><dd style={S('margin:0;text-align:right;font-weight:500;overflow-wrap:anywhere')}>{p.account.name}</dd></div>
              <div style={S(KV_ROW)}><dt style={S('color:#5E6673')}>Email</dt><dd style={S('margin:0;text-align:right;font-weight:500;overflow-wrap:anywhere')}>{p.account.email}</dd></div>
              <div style={S(KV_ROW + ';border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Phone</dt><dd style={S('margin:0;text-align:right;font-weight:500')}>{p.account.phone || 'Not added'}</dd></div>
            </dl>}
            {p.bookable && <Link href={book()} style={S(BLACK + ';flex:0 0 auto')}>Book now</Link>}
          </div>
          {info}
        </aside>
      </div>
      {manage}
    </div>
  );
}

export function ProfileView(p: Props) {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  const [cat, setCat] = useState('All');
  const [who, setWho] = useState<string | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const member = p.team.find((t) => t.id === who);
  const sheet = (drawer: boolean) => member && <StaffSheet key={member.id} t={member} slug={p.slug} salon={p.name} services={p.services} bookable={p.bookable} drawer={drawer} onClose={() => setWho(null)} />;
  return (<>
    {narrow !== false && <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}><Body p={p} m={true} cat={cat} setCat={setCat} today={p.today} openMember={setWho} />{sheet(false)}</div>}
    {narrow !== true && <div className="only-d d-cal cal-root" style={S("box-sizing:border-box;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;min-height:100vh")}><Body p={p} m={false} cat={cat} setCat={setCat} today={p.today} openMember={setWho} />{!!member && <div className="m-cal cal-root m-drawer">{sheet(true)}</div>}<DrawerKeys /></div>}
  </>);
}
