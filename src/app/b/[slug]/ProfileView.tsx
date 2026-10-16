'use client';
// 1:1 conversion of the prototype's SalonProfile.dc.html and MobileSalonProfile.dc.html (the public salon page).
// Markup and style strings are kept as written; the {{ }} holes are the salon's real data.
import { AcctChip } from './AcctChip';
import { clockStr } from '@/lib/display';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { S } from '../../(dash)/calendar/pickers';
import { ART } from './art';

type Svc = { id: string; name: string; desc: string; cat: string; dur: number; price: string };
type Props = {
  slug: string; name: string; headline: string; intro: string; about: string; address: string; phone: string; email: string;
  services: Svc[]; cats: string[]; team: { name: string; role: string; photo: string | null }[]; hours: ({ from: string; to: string } | null)[];
  today: number; nowMin: number; cancel: string; bookable: boolean; next: string | null; account: { name: string } | null;
};
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const fmtDur = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return h ? h + ' hr' + (r ? ' ' + r + ' min' : '') : m + ' min'; };
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const TILES: [string, string][] = [['hair', 'Hair'], ['colour', 'Colour'], ['nails', 'Nails'], ['barber', 'Barber']];
const initialsOf = (n: string) => n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const LABEL = 'position:absolute;left:14px;bottom:14px;padding:6px 14px;border-radius:999px;background:rgba(255,255,255,0.92);color:#0E1116;font-size:13px;font-weight:500';
const CARD = (pad: number, gap: number) => `box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:${pad}px;display:flex;flex-direction:column;gap:${gap}px`;

function Tile({ k, label, style }: { k: string; label: string; style: string }) {
  return <div role="img" aria-label={label + ', illustration'} style={S('position:relative;overflow:hidden;border-radius:24px;' + style)}><div style={S('width:100%;height:100%')} dangerouslySetInnerHTML={{ __html: ART[k].replace('<svg ', '<svg width="100%" height="100%" aria-hidden="true" preserveAspectRatio="xMidYMid slice" style="display:block" ') }} /><span style={S(LABEL)}>{label}</span></div>;
}

function Body({ p, m, cat, setCat, today }: { p: Props; m: boolean; cat: string; setCat: (c: string) => void; today: number }) {
  const t = p.hours[today];
  const open = !!t && p.nowMin >= toMin(t.from) && p.nowMin < toMin(t.to);
  const openStyle = 'display:inline-block;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:500;background:' + (open ? '#DDF3EA' : '#EEF0F3') + ';color:' + (open ? '#14624A' : '#4A525E');
  const openText = open ? 'Open now, until ' + clockStr(t!.to) : 'Closed now';
  const book = (svc?: string) => `/b/${p.slug}/book` + (svc ? `?service=${svc}` : '');
  const tiles = TILES.filter(([, n]) => p.cats.some((c) => c.toLowerCase() === n.toLowerCase()));
  const chips = ['All', ...p.cats].map((c) => ({ c, label: c === 'All' ? 'All services' : c, on: cat === c }));
  const shown = p.services.filter((s) => cat === 'All' || s.cat === cat);
  const photos = (
    <section aria-label="Photos of the salon and our work" style={S(m ? 'display:flex;gap:12px;overflow-x:auto;flex:0 0 auto;margin:0 -20px;padding:0 20px 4px' : 'display:grid;grid-template-columns:2fr 1fr 1fr;grid-template-rows:repeat(2,minmax(0,1fr));gap:12px;height:440px')}>
      <Tile k="salon" label="The salon" style={m ? 'flex:0 0 260px;height:320px' : 'grid-row:span 2'} />
      {tiles.map(([k, n]) => <Tile key={k} k={k} label={n} style={m ? 'flex:0 0 260px;height:320px' : ''} />)}
    </section>
  );
  const services = (
    <section aria-label="Services" style={S(CARD(m ? 20 : 24, 16))}>
      <h2 style={S('margin:0;font-size:22px;font-weight:600;letter-spacing:-0.02em')}>Services</h2>
      <div role="group" className="hscroll" aria-label="Filter services" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
        {chips.map((x) => <button key={x.c} onClick={() => setCat(x.c)} aria-pressed={x.on} style={S('flex:0 0 auto;height:44px;padding:0 18px;border-radius:999px;font-size:14px;font-weight:500;border:1px solid ' + (x.on ? '#0E1116' : '#E1E4E9') + ';background:' + (x.on ? '#0E1116' : '#FFFFFF') + ';color:' + (x.on ? '#FFFFFF' : '#0E1116'))}>{x.label}</button>)}
      </div>
      {shown.length === 0 && <span style={S('color:#5E6673;font-size:14px')}>No services are open for online booking yet.</span>}
      <ul style={S(`margin:0 -${m ? 20 : 24}px -${m ? 20 : 24}px;padding:0;list-style:none;border-top:1px solid #EEF0F3`)}>
        {shown.map((s, i) => {
          const row = 'display:flex;align-items:center;gap:16px;min-height:80px;box-sizing:border-box;padding:14px 20px;' + (i < shown.length - 1 ? 'border-bottom:1px solid #EEF0F3;' : '') + 'text-decoration:none;color:#0E1116';
          const inner = (<>
            <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{s.name}</span>{!!s.desc && <span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{s.desc}</span>}<span style={S('display:block;margin-top:4px;font-size:13px;color:#5E6673')}>{fmtDur(s.dur)}</span></span>
            <span style={S('flex:0 0 auto;font-size:15px;font-weight:600')}>{s.price}</span>
            {m ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')}><path d="M9.5 6l6 6-6 6" /></svg>
              : <span style={S('flex:0 0 auto;padding:8px 16px;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:13.5px;font-weight:500')}>Book</span>}
          </>);
          return <li key={s.id}>{p.bookable ? <Link href={book(s.id)} aria-label={s.name + ', ' + fmtDur(s.dur) + ', ' + s.price + '. Book'} style={S(row)}>{inner}</Link> : <div style={S(row)}>{inner}</div>}</li>;
        })}
      </ul>
    </section>
  );
  const team = !!p.team.length && (
    <section aria-label="Team" style={S(CARD(m ? 20 : 24, 16))}>
      <h2 style={S('margin:0;font-size:22px;font-weight:600;letter-spacing:-0.02em')}>Team</h2>
      <ul style={S('margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px')}>
        {p.team.map((x) => (
          <li key={x.name} style={S('display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #E6E8EC;border-radius:18px')}><span style={S('flex:0 0 48px;width:48px;height:48px;border-radius:999px;background:#EEF0F3;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600' + (x.photo ? ';background-image:url(' + x.photo + ');background-size:cover;background-position:center' : ''))}>{x.photo ? '' : initialsOf(x.name)}</span><span style={S('min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{x.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{x.role}</span></span></li>
        ))}
      </ul>
    </section>
  );
  const about = !!p.about && (
    <section aria-label="About" style={S(CARD(m ? 20 : 24, 12))}>
      <h2 style={S('margin:0;font-size:22px;font-weight:600;letter-spacing:-0.02em')}>About us</h2>
      <p style={S('margin:0;color:#5E6673;font-size:15px;line-height:1.55;white-space:pre-line')}>{p.about}</p>
    </section>
  );
  const info = (
    <section aria-label="Opening hours and contact" style={S(CARD(m ? 20 : 24, 16))}>
      <h2 style={S('margin:0;font-size:18px;font-weight:600;letter-spacing:-0.01em')}>Opening hours</h2>
      <div style={S('display:flex;flex-direction:column;margin-top:-8px')}>
        {DAYS.map((d, i) => <div key={d} style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #EEF0F3;font-weight:' + (i === today ? 600 : 400) + ';color:' + (i === today ? '#0E1116' : '#5E6673'))}><span>{d}</span><span>{p.hours[i] ? clockStr(p.hours[i]!.from) + ' to ' + clockStr(p.hours[i]!.to) : 'Closed'}</span></div>)}
      </div>
      {!!(p.address || p.phone || p.email) && <>
        <h2 style={S('margin:4px 0 0;font-size:18px;font-weight:600;letter-spacing:-0.01em')}>Find us</h2>
        <dl style={S('margin:-8px 0 0;display:flex;flex-direction:column')}>
          {!!p.address && <div style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Address</dt><dd style={S('margin:0;text-align:right;font-weight:500;overflow-wrap:anywhere')}>{p.address}</dd></div>}
          {!!p.phone && <div style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Phone</dt><dd style={S('margin:0;text-align:right;font-weight:500;white-space:nowrap')}>{p.phone}</dd></div>}
          {!!p.email && <div style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Email</dt><dd style={S('margin:0;text-align:right;font-weight:500;overflow-wrap:anywhere')}>{p.email}</dd></div>}
        </dl></>}
    </section>
  );
  const manage = <p style={S('margin:0;text-align:center;color:#5E6673;font-size:14px')}>Already booked? <Link href="/manage" style={S('color:#0E1116;font-weight:500')}>Manage your booking</Link></p>;
  const BOOKBTN = (h: number, fs: number, pad: string, extra = '') => 'height:' + h + 'px;padding:' + pad + ';box-sizing:border-box;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:' + fs + 'px;font-weight:500;display:flex;align-items:center;text-decoration:none;' + extra;

  if (m) return (<>
    <main className="flow" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:24px 20px 24px;display:flex;flex-direction:column;gap:20px')}>
      <header style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><span style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{p.name}</span><span style={S(openStyle + ';flex:0 0 auto')}>{openText}</span></header>
      {p.account ? <AcctChip slug={p.slug} name={p.account.name || 'Your account'} wide /> : <Link href={`/b/${p.slug}/account`} style={S('align-self:flex-start;color:#5B3DF5;font-size:14px;font-weight:600;text-decoration:none')}>Sign in</Link>}
      {p.bookable && !!p.next && <span style={S('align-self:flex-start;display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:500;background:#F2EFFE;color:#4B34C9')}>Next available: {p.next}</span>}
      {photos}{services}{team}{about}{info}{manage}
    </main>
    {p.bookable && <div style={S('flex:0 0 auto;box-sizing:border-box;padding:12px 20px 24px;background:#FFFFFF;border-top:1px solid #E6E8EC')}><Link href={book()} style={S('height:48px;box-sizing:border-box;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;display:flex;align-items:center;justify-content:center;text-decoration:none')}>Book now</Link></div>}
  </>);
  return (
    <div className="flow" style={S('max-width:1180px;margin:0 auto;box-sizing:border-box;padding:24px 32px 56px;display:flex;flex-direction:column;gap:32px')}>
      <header style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px')}>
        <div style={S('display:flex;align-items:center;gap:12px')}><span style={S('font-size:17px;font-weight:600;letter-spacing:-0.01em')}>{p.name}</span></div>
        <div style={S('display:flex;align-items:center;gap:16px')}>
          {p.account ? <AcctChip slug={p.slug} name={p.account.name || 'Your account'} /> : <Link href={`/b/${p.slug}/account`} style={S('color:#0E1116;font-size:14px;font-weight:500;text-decoration:none')}>Sign in</Link>}
          {p.bookable && <Link href={book()} style={S(BOOKBTN(44, 14, '0 22px'))}>Book now</Link>}
        </div>
      </header>
      <section aria-label="Welcome" style={S('display:flex;flex-direction:column;gap:16px;padding:16px 0 8px')}>
        <span style={S(openStyle + ';align-self:flex-start')}>{openText}</span>
        {p.bookable && !!p.next && <span style={S('align-self:flex-start;display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:500;background:#F2EFFE;color:#4B34C9')}>Next available: {p.next}</span>}
        <h1 style={S('margin:0;font-size:56px;line-height:1.04;font-weight:600;letter-spacing:-0.04em;max-width:760px')}>{p.headline}</h1>
        <p style={S('margin:0;color:#5E6673;font-size:17px;max-width:620px')}>{p.intro}</p>
        <div style={S('display:flex;flex-wrap:wrap;gap:10px;margin-top:8px')}>
          {p.bookable && <Link href={book()} style={S(BOOKBTN(52, 15, '0 28px'))}>Book an appointment</Link>}
          {!!p.address && <span style={S('height:52px;padding:0 4px;display:flex;align-items:center;color:#5E6673;font-size:14px')}>{p.address}</span>}
        </div>
      </section>
      {photos}
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:24px')}>
        <div className="flow" style={S('flex:999 1 560px;min-width:0;display:flex;flex-direction:column;gap:24px')}>{services}{team}{about}</div>
        <aside className="flow" style={S('flex:1 1 320px;max-width:380px;min-width:0;position:sticky;top:24px;display:flex;flex-direction:column;gap:16px')}>
          <div style={S(CARD(24, 12))}>
            <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Book an appointment</h2>
            <p style={S('margin:0;color:#5E6673;font-size:14px')}>{p.bookable ? `Free cancellation up to ${p.cancel} before. You pay at the salon.` : 'Online booking is not available right now. Please contact the salon.'}</p>
            {p.bookable && <Link href={book()} style={S('height:48px;box-sizing:border-box;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;display:flex;align-items:center;justify-content:center;text-decoration:none')}>Book now</Link>}
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
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return (<>
    {narrow !== false && <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}><Body p={p} m={true} cat={cat} setCat={setCat} today={p.today} /></div>}
    {narrow !== true && <div className="only-d d-cal cal-root" style={S("box-sizing:border-box;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;min-height:100vh")}><Body p={p} m={false} cat={cat} setCat={setCat} today={p.today} /></div>}
  </>);
}
