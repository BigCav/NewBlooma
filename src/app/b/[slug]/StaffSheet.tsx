'use client';
// A team member's profile on the public salon page: the same right-hand drawer on a computer and full-page sheet on a phone as every other detail page in the app.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { plural } from '@/lib/display';
import { firstName } from '@/lib/people';
import { Avatar, BAR, BLACK, PAGE, ScreenHeader } from '@/components/ui';
import { S } from '../../(dash)/calendar/pickers';
import { nextAvailable } from './book/actions';
import { CARD, H2, ReviewCard, ServiceRow, Stars, bookHref, type Review, type Svc } from './parts';

export type Member = { id: string; name: string; role: string; photo: string | null; svc: string[]; rating: { avg: number; count: number }; reviews: Review[] };

export function StaffSheet({ t, slug, salon, services, bookable, drawer, onClose }: { t: Member; slug: string; salon: string; services: Svc[]; bookable: boolean; drawer: boolean; onClose: () => void }) {
  const mine = services.filter((s) => t.svc.includes(s.id));
  const canBook = bookable && mine.length > 0;
  const [next, setNext] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    if (!canBook) { setNext(null); return; }
    setNext(undefined);
    nextAvailable(slug, [], t.id).then((l) => { if (live) setNext(l); }).catch(() => { if (live) setNext(null); });
    return () => { live = false; };
  }, [slug, t.id, canBook]);
  const stars = Math.round(t.rating.avg);
  return (
    <div role="dialog" aria-label={t.name + ', profile'} style={S(PAGE)}>
      <ScreenHeader title={t.name} sub={t.role} onBack={onClose} backLabel="Back" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 24px;display:flex;flex-direction:column;gap:14px')}>
        <section aria-label="About this team member" style={S(CARD(20, 16))}>
          <div style={S('display:flex;align-items:center;gap:16px')}>
            <Avatar name={t.name} photo={t.photo} size="xxl" />
            <div style={S('min-width:0')}>
              <div style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{t.name}</div>
              <div style={S('margin-top:2px;font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{t.role}</div>
              {t.rating.count > 0 && <div style={S('margin-top:6px;display:flex;align-items:center;gap:8px;font-size:13.5px;color:#5E6673')}><Stars n={stars} size={15} label={t.rating.avg.toFixed(1) + ' out of 5 stars'} /><span>{t.rating.avg.toFixed(1)} · {plural(t.rating.count, 'review')}</span></div>}
            </div>
          </div>
          {canBook && <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;border-radius:18px;background:#F4F5F7;padding:14px 16px')}>
            <span style={S('color:#5E6673;font-size:13.5px')}>Next available</span>
            <span style={S('font-size:15px;font-weight:600;text-align:right')}>{next === undefined ? 'Checking…' : next ?? 'No online times right now'}</span>
          </div>}
        </section>

        <section aria-label="Services" style={S(CARD(20, 16))}>
          <h2 style={S(H2)}>Services</h2>
          {mine.length === 0 && <span style={S('color:#5E6673;font-size:14px')}>No services are open for online booking yet.</span>}
          <ul style={S('margin:0 -20px -20px;padding:0;list-style:none;border-top:1px solid #EEF0F3')}>
            {mine.map((s, i) => <ServiceRow key={s.id} s={s} m={!drawer} last={i === mine.length - 1} href={bookable ? bookHref(slug, s.id, t.id) : undefined} />)}
          </ul>
        </section>

        {t.rating.count > 0 && (
          <section aria-label="Reviews" style={S(CARD(20, 14))}>
            <h2 style={S(H2)}>Reviews</h2>
            <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px')}>
              {t.reviews.map((r, i) => <ReviewCard key={i} r={r} from={salon} />)}
            </ul>
          </section>
        )}
      </main>
      {canBook && <div style={S(BAR)}><Link href={bookHref(slug, undefined, t.id)} style={S(BLACK + ';flex:0 0 auto')}>Book with {firstName(t.name)}</Link></div>}
    </div>
  );
}
