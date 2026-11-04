// Pieces the public salon page and a team member's sheet both show, so a review or a service looks the same in either place.
import Link from 'next/link';
import { duration } from '@/lib/display';
import { Avatar, BOOK_TAG, Icon } from '@/components/ui';
import { S } from '../../(dash)/calendar/pickers';

export type Review = { name: string; stars: number; text: string; reply: string; date: string };
export type Svc = { id: string; name: string; desc: string; cat: string; dur: number; price: string };

/** The booking page, optionally with a service and/or a team member already chosen. */
export const bookHref = (slug: string, service?: string, staff?: string) => {
  const q = [service && 'service=' + service, staff && 'staff=' + staff].filter(Boolean).join('&');
  return `/b/${slug}/book` + (q ? '?' + q : '');
};

export const STARS = '★★★★★';
export const H2 = 'margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em';
export const CARD = (pad: number, gap: number) => `box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:${pad}px;display:flex;flex-direction:column;gap:${gap}px`;

/** Gold stars, with the empty ones in grey. */
export function Stars({ n, size = 15, label }: { n: number; size?: number; label?: string }) {
  return <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={S('flex:0 0 auto;font-size:' + size + 'px;letter-spacing:1px')}><span style={S('color:#E8A317')}>{STARS.slice(0, n)}</span><span style={S('color:#D5D9E0')}>{STARS.slice(n)}</span></span>;
}

export function ReviewCard({ r, from }: { r: Review; from: string }) {
  return (
    <li style={S('display:flex;flex-direction:column;gap:10px;padding:16px;border:1px solid #E6E8EC;border-radius:18px;min-width:0')}>
      <div style={S('display:flex;align-items:center;gap:12px')}>
        <Avatar name={r.name.replace('.', '')} size="md" />
        <div style={S('flex:1 1 auto;min-width:0')}><div style={S('font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{r.name}</div><div style={S('font-size:12.5px;color:#5E6673')}>{r.date}</div></div>
        <Stars n={r.stars} label={r.stars + ' out of 5 stars'} />
      </div>
      {!!r.text && <p style={S('margin:0;font-size:15px;line-height:1.5;overflow-wrap:anywhere')}>{r.text}</p>}
      {!!r.reply && <div style={S('border-radius:14px;background:#F4F5F7;padding:10px 12px;font-size:14px;overflow-wrap:anywhere')}><div style={S('font-size:12.5px;font-weight:600;color:#5E6673;margin-bottom:2px')}>{'Reply from ' + from}</div>{r.reply}</div>}
    </li>
  );
}

/** One bookable service: name, length, price, and a Book tag (an arrow on a phone). `href` is missing when online booking is off. */
export function ServiceRow({ s, href, m, last, side = 20 }: { s: Svc; href?: string; m: boolean; last: boolean; side?: number }) {
  const row = 'display:flex;align-items:center;gap:16px;min-height:80px;box-sizing:border-box;padding:14px ' + side + 'px;' + (last ? '' : 'border-bottom:1px solid #EEF0F3;') + 'text-decoration:none;color:#0E1116';
  const inner = (<>
    <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{s.name}</span>{!!s.desc && <span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{s.desc}</span>}<span style={S('display:block;margin-top:4px;font-size:13px;color:#5E6673')}>{duration(s.dur)}</span></span>
    <span style={S('flex:0 0 auto;font-size:15px;font-weight:600')}>{s.price}</span>
    {m ? <Icon name="next" size={18} color="#5E6673" w={1.9} style={S('flex:0 0 auto')} />
      : <span style={S(BOOK_TAG)}>Book</span>}
  </>);
  return <li>{href ? <Link href={href} aria-label={s.name + ', ' + duration(s.dur) + ', ' + s.price + '. Book'} style={S(row)}>{inner}</Link> : <div style={S(row)}>{inner}</div>}</li>;
}
