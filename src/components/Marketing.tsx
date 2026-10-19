'use client';
// Converted from the prototype's Landing/MobileLanding and Pricing/MobilePricing pages. Markup and style strings follow the prototype;
// "Get started" links go to the register route instead of using a browser-storage flag.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { S } from '@/app/(dash)/calendar/pickers';

const REGISTER = '/sign-up';
const ROOT = "box-sizing:border-box;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;min-height:100vh";
const NAVLINK = 'display:flex;align-items:center;height:44px;padding:0 14px;color:#0E1116;font-size:14.5px;font-weight:500;text-decoration:none';
const CARD = (r: number, p: number) => `box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:${r}px;padding:${p}px;display:flex;flex-direction:column;gap:14px`;

const LANDING_FAQ = [
  { q: 'How much does Aster cost?', a: 'One stylist pays $24 a month. With two or more stylists, each stylist is $19 a month. Every feature is included at both prices.' },
  { q: 'Do I need a card to start?', a: 'No. Create your account, set up your salon and try it before you pay.' },
  { q: 'Can I bring my clients from another system?', a: 'Yes. Export a CSV from your current system and import your clients, services and upcoming appointments in a few minutes.' },
  { q: 'Will my clients be able to book online?', a: 'Yes. You get a booking page to share on Instagram, Google and your front desk. Clients choose a service, a stylist and a time, and can change or cancel from their confirmation email.' },
  { q: 'How do payments work?', a: 'Take card payments at checkout, add tips and products, and see every sale in one place.' },
  { q: 'Can I cancel any time?', a: 'Yes. There is no contract, and you can export your clients whenever you like.' },
];
const PRICING_FAQ = [
  { q: 'How is my price worked out?', a: 'One stylist pays $24 a month. With two or more stylists, each stylist is $19 a month, so a team of three is $57 a month.' },
  { q: 'What do I get for that?', a: 'Every feature is included: calendar, online booking, reminders, waitlist, gift cards, memberships and packages, sales, reports and payroll.' },
  { q: 'What counts as a stylist?', a: 'Anyone who takes bookings and has their own column in the calendar. Front desk staff who do not take bookings are not counted.' },
  { q: 'Can I add or remove stylists later?', a: 'Yes. Your price follows the number of stylists you have each month.' },
  { q: 'Can I bring my clients from another system?', a: 'Yes. Export a CSV from your current system and import your clients, services and upcoming appointments in a few minutes.' },
];
const FEATURES: { t: string; d: string; bg: string; fg: string; icon: React.ReactNode }[] = [
  { t: 'One calendar for the team', d: "Everyone's day in one view. Drag to move, tap to check out.", bg: '#EFEBFF', fg: '#5B3DF5', icon: <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></> },
  { t: 'Online booking', d: 'A booking page clients can use any time, with the services and team you choose.', bg: '#E4F1FF', fg: '#1D6FC4', icon: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></> },
  { t: 'Reminders and waitlist', d: 'Automatic email reminders cut no-shows. Cancelled times are offered to your waitlist.', bg: '#FFF4E5', fg: '#8A4B00', icon: <path d="M6 16v-5a6 6 0 0112 0v5l1.5 2h-15zM10 21h4" /> },
  { t: 'Gift cards, packages and memberships', d: 'Sell prepaid bundles and monthly plans, and track every balance.', bg: '#FDE8F1', fg: '#B3226B', icon: <><rect x="3.5" y="9" width="17" height="11" rx="2" /><path d="M12 9v11M3.5 13h17M12 9c-3 0-4-5-1-5 2 0 1 5 1 5zM12 9c3 0 4-5 1-5-2 0-1 5-1 5z" /></> },
  { t: 'Checkout and sales', d: 'Take payment, add tips and products, and see every sale in one place.', bg: '#DDF3EA', fg: '#14624A', icon: <><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10.5h18M7 15h3" /></> },
  { t: 'Reports and payroll', d: 'See what is working, and work out team pay and commission without a spreadsheet.', bg: '#EFEBFF', fg: '#5B3DF5', icon: <path d="M4 20V10M10 20V4M16 20v-7M2 20h20" /> },
];
const STEPS = [
  { t: 'Create your account', d: 'Add your salon name and opening hours.' },
  { t: 'Add services and team', d: 'Set prices, durations and who does what.' },
  { t: 'Share your booking link', d: 'Put it on Instagram, Google and your front desk.' },
];
const INCLUDED = ['Calendar for the whole team', 'Online booking page', 'Email reminders and waitlist', 'Gift cards, packages and memberships', 'Checkout, sales and products', 'Reports and payroll'];

function useNarrow() {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return narrow;
}

function Faq({ items, m, title, sub }: { items: { q: string; a: string }[]; m: boolean; title?: string; sub?: string }) {
  const [open, setOpen] = useState(0);
  const list = (
    <ul style={S('margin:0;padding:0;list-style:none;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
      {items.map((f, i) => {
        const on = open === i;
        return (
          <li key={f.q} style={S('border-top:1px solid #EEF0F3')}>
            <button type="button" onClick={() => setOpen(on ? -1 : i)} aria-expanded={on} style={S(`display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;box-sizing:border-box;min-height:64px;padding:12px ${m ? 18 : 24}px;border:0;background:transparent;text-align:left;font:inherit;font-size:${m ? 15.5 : 16}px;font-weight:600;color:#0E1116`)}>
              <span>{f.q}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" style={S('flex:0 0 auto')}><path d={on ? 'M6 12h12' : 'M6 12h12M12 6v12'} /></svg>
            </button>
            {on && <p style={S(`margin:0;padding:0 ${m ? 18 : 24}px 20px;color:#5E6673;font-size:15px;line-height:1.5`)}>{f.a}</p>}
          </li>
        );
      })}
    </ul>
  );
  if (m || !title) return list;
  return (
    <section id="faq" aria-label="Questions" style={S('display:flex;flex-wrap:wrap;gap:40px;align-items:flex-start')}>
      <div style={S('flex:1 1 280px;min-width:0;display:flex;flex-direction:column;gap:10px')}><h2 style={S('margin:0;font-size:40px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{title}</h2><p style={S('margin:0;color:#5E6673;font-size:17px')}>{sub}</p></div>
      <div style={S('flex:2 1 480px;min-width:0')}>{list}</div>
    </section>
  );
}

function Header({ m, current }: { m: boolean; current?: 'pricing' }) {
  const home = <Link href="/" aria-label="Aster home" style={S('display:flex;align-items:center;color:#0E1116;text-decoration:none')}><span style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Aster</span></Link>;
  if (m) return <header style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>{home}<Link href="/sign-in" style={S('display:flex;align-items:center;height:44px;padding:0 18px;box-sizing:border-box;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500;text-decoration:none')}>Sign in</Link></header>;
  return (
    <header style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px')}>{home}
      <nav aria-label="Main" style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px')}>
        <Link href="/#features" style={S(NAVLINK)}>Features</Link>
        <Link href="/pricing" aria-current={current === 'pricing' ? 'page' : undefined} style={S(NAVLINK)}>Pricing</Link>
        <Link href="/sign-in" style={S(NAVLINK)}>Sign in</Link>
        <Link href={REGISTER} style={S('display:flex;align-items:center;height:44px;padding:0 22px;box-sizing:border-box;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;text-decoration:none')}>Get started</Link>
      </nav>
    </header>
  );
}

function PlanCards({ m }: { m: boolean }) {
  const pad = m ? 24 : 32;
  return (
    <div style={S('display:flex;flex-wrap:wrap;gap:20px;align-items:stretch')}>
      <div style={S(`flex:1 1 300px;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:${pad}px;display:flex;flex-direction:column;gap:12px`)}><span style={S('font-size:15px;font-weight:600')}>Solo</span><div style={S('display:flex;align-items:baseline;gap:6px')}><span style={S('font-size:48px;line-height:1;font-weight:600;letter-spacing:-0.03em')}>$24</span><span style={S('color:#5E6673')}>a month</span></div></div>
      <div style={S(`flex:1 1 300px;box-sizing:border-box;background:#0E1116;color:#FFFFFF;border-radius:24px;padding:${pad}px;display:flex;flex-direction:column;gap:12px`)}><span style={S('font-size:15px;font-weight:600')}>Team of 2 or more</span><div style={S('display:flex;align-items:baseline;gap:6px')}><span style={S('font-size:48px;line-height:1;font-weight:600;letter-spacing:-0.03em')}>$19</span><span style={S('color:#C4C9D2')}>per stylist, a month</span></div></div>
    </div>
  );
}

export function LandingView() {
  const narrow = useNarrow();
  const m = narrow === true;
  const wrap = m ? 'padding:20px 20px 32px;gap:56px' : 'max-width:1180px;margin:0 auto;padding:24px 32px 0;gap:96px';
  const h2 = (t: string) => <h2 style={S(m ? 'margin:0;font-size:28px;line-height:1.1;font-weight:600;letter-spacing:-0.03em' : 'margin:0;font-size:40px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{t}</h2>;
  return (
    <div style={S(ROOT)}>
      <div style={S('box-sizing:border-box;display:flex;flex-direction:column;' + wrap)}>
        <Header m={m} />
        <section aria-label="Intro" style={S(m ? 'display:flex;flex-direction:column;gap:20px' : 'display:flex;flex-wrap:wrap;align-items:center;gap:48px')}>
          <div style={S(m ? 'display:flex;flex-direction:column;gap:20px' : 'flex:1 1 360px;min-width:0;display:flex;flex-direction:column;gap:24px')}>
            <h1 style={S(m ? 'margin:0;font-size:36px;line-height:1.08;font-weight:600;letter-spacing:-0.04em' : 'margin:0;font-size:56px;line-height:1.05;font-weight:600;letter-spacing:-0.04em')}>Less admin, more time for clients.</h1>
            <p style={S(m ? 'margin:0;color:#4A525E;font-size:16.5px;line-height:1.5' : 'margin:0;max-width:520px;color:#4A525E;font-size:19px;line-height:1.5')}>Calendar, online booking, reminders and checkout in one simple app for independent salons and barbers.</p>
            <div style={S(m ? 'display:flex;flex-direction:column;gap:10px' : 'display:flex;flex-wrap:wrap;gap:12px')}>
              <Link href={REGISTER} style={S('display:flex;align-items:center;justify-content:center;height:52px;padding:0 28px;box-sizing:border-box;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:15.5px;font-weight:500;text-decoration:none')}>Get started</Link>
              <Link className="ghost" href="/pricing" style={S('display:flex;align-items:center;justify-content:center;height:52px;padding:0 28px;box-sizing:border-box;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:15.5px;font-weight:500;text-decoration:none')}>See pricing</Link>
            </div>
          </div>
          {!m && <div style={S('flex:1 1 520px;min-width:0;max-width:700px')}><div style={S('border-radius:24px;overflow:hidden;border:1px solid #E6E8EC;background:#FFFFFF;box-shadow:0 24px 56px rgba(14,17,22,0.12)')}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/landing-dashboard.jpg" alt="The Aster calendar showing a day of appointments for the whole team" width={2880} height={1800} style={{ display: 'block', width: '100%', height: 'auto' }} /></div></div>}
        </section>

        <section id="features" aria-label="Features" style={S(`display:flex;flex-direction:column;gap:${m ? 16 : 32}px`)}>
          <div style={S('display:flex;flex-direction:column;gap:12px;max-width:640px')}>{h2('Everything the day needs, nothing it does not.')}{!m && <p style={S('margin:0;color:#5E6673;font-size:17px')}>Built for salons with one chair or ten.</p>}</div>
          <div style={S(m ? 'display:flex;flex-direction:column;gap:12px' : 'display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px')}>
            {FEATURES.map((f) => (
              <div key={f.t} style={S(CARD(m ? 20 : 24, m ? 20 : 28))}>
                <span aria-hidden="true" style={S(`width:44px;height:44px;border-radius:14px;background:${f.bg};color:${f.fg};display:flex;align-items:center;justify-content:center`)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg></span>
                <div style={S('display:flex;flex-direction:column;gap:6px')}><h3 style={S(`margin:0;font-size:${m ? 17 : 19}px;font-weight:600;letter-spacing:-0.02em`)}>{f.t}</h3><p style={S('margin:0;color:#5E6673;font-size:14.5px;line-height:1.5')}>{f.d}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="How it works" style={S(`display:flex;flex-direction:column;gap:${m ? 20 : 32}px`)}>
          {h2('Live in an afternoon.')}
          <ol style={S(m ? 'margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:18px' : 'margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px')}>
            {STEPS.map((s, i) => m ? (
              <li key={s.t} style={S('display:flex;gap:14px;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:20px;padding:16px 18px')}><span aria-hidden="true" style={S('flex:0 0 36px;width:36px;height:36px;border-radius:999px;background:#0E1116;color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600')}>{i + 1}</span><span><span style={S('display:block;font-size:16px;font-weight:600')}>{s.t}</span><span style={S('display:block;color:#5E6673;font-size:14.5px')}>{s.d}</span></span></li>
            ) : (
              <li key={s.t} style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:12px')}><span aria-hidden="true" style={S('width:40px;height:40px;border-radius:999px;background:#0E1116;color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600')}>{i + 1}</span><h3 style={S('margin:0;font-size:19px;font-weight:600;letter-spacing:-0.02em')}>{s.t}</h3><p style={S('margin:0;color:#5E6673;font-size:15px')}>{s.d}</p></li>
            ))}
          </ol>
          <Link href={REGISTER} style={S(m ? 'display:flex;flex-direction:column;gap:4px;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:20px;padding:18px 20px;text-decoration:none;color:#0E1116' : 'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px 28px;text-decoration:none;color:#0E1116')}>
            <span><span style={S(`display:block;font-size:${m ? 16 : 17}px;font-weight:600`)}>Already using another system?</span><span style={S(`display:block;color:#5E6673;font-size:${m ? 14 : 14.5}px`)}>Bring your clients, services and upcoming appointments across from a CSV file.</span></span>
            <span style={S(`margin-top:${m ? 4 : 0}px;font-size:14.5px;font-weight:600;color:#5B3DF5`)}>See how importing works →</span>
          </Link>
        </section>

        <section aria-label="Pricing" style={S(`display:flex;flex-direction:column;gap:${m ? 20 : 32}px`)}>
          <div style={S('display:flex;flex-direction:column;gap:12px;max-width:640px')}>{h2('Simple pricing.')}<p style={S(`margin:0;color:#5E6673;font-size:${m ? 15.5 : 17}px`)}>Every feature is included. You only choose how many stylists you have.</p></div>
          <PlanCards m={m} />
        </section>

        {m ? (
          <section id="faq" aria-label="Questions" style={S('display:flex;flex-direction:column;gap:20px')}>{h2('Questions, answered.')}<Faq items={LANDING_FAQ} m /></section>
        ) : <Faq items={LANDING_FAQ} m={false} title="Questions, answered." sub="Anything else, we are happy to help." />}

        <section aria-label="Get started" style={S(m ? 'box-sizing:border-box;border-radius:28px;background:#0E1116;color:#FFFFFF;padding:28px 24px;display:flex;flex-direction:column;gap:16px' : 'box-sizing:border-box;border-radius:32px;background:#0E1116;color:#FFFFFF;padding:56px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:24px')}>
          <div style={S('max-width:560px')}><h2 style={S(m ? 'margin:0;font-size:26px;line-height:1.1;font-weight:600;letter-spacing:-0.03em' : 'margin:0;font-size:40px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>Ready to spend less time on admin?</h2><p style={S(`margin:10px 0 0;color:#C4C9D2;font-size:${m ? 15 : 17}px`)}>Set up in minutes and share your booking link today.</p></div>
          <Link href={REGISTER} style={S('display:flex;align-items:center;justify-content:center;height:52px;padding:0 28px;box-sizing:border-box;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:15.5px;font-weight:600;text-decoration:none')}>Get started</Link>
        </section>

        <footer style={S(m ? 'display:flex;flex-direction:column;gap:6px;color:#5E6673;font-size:13px' : 'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:0 0 48px;color:#5E6673;font-size:13.5px')}>
          <span>Aster. Booking software for salons and barbers.</span>
          {!m && <span style={S('display:flex;gap:20px')}><Link href="/pricing" style={S('color:#5E6673;text-decoration:none')}>Pricing</Link><Link href="/sign-in" style={S('color:#5E6673;text-decoration:none')}>Sign in</Link></span>}
        </footer>
      </div>
    </div>
  );
}

export function PricingView() {
  const narrow = useNarrow();
  const m = narrow === true;
  const [n, setN] = useState(3);
  const per = n >= 2 ? 19 : 24, total = per * n;
  const step = (d: number) => setN((v) => Math.max(1, Math.min(30, v + d)));
  const btn = (off: boolean) => 'flex:0 0 48px;width:48px;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:22px;line-height:1;opacity:' + (off ? '0.4' : '1');
  const calc = (
    <div style={S(`box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:${m ? 20 : 32}px;display:flex;flex-direction:column;gap:24px`)}>
      <div style={S('display:flex;flex-direction:column;gap:10px')}><span id="pc-l" style={S('font-size:15px;font-weight:600')}>How many stylists?</span>
        <div role="group" aria-labelledby="pc-l" style={S('display:flex;align-items:center;gap:16px')}>
          <button type="button" onClick={() => step(-1)} disabled={n <= 1} aria-label="One fewer stylist" style={S(btn(n <= 1))}>&minus;</button>
          <span aria-live="polite" style={S('min-width:48px;text-align:center;font-size:32px;font-weight:600;letter-spacing:-0.02em')}>{n}</span>
          <button type="button" onClick={() => step(1)} disabled={n >= 30} aria-label="One more stylist" style={S(btn(n >= 30))}>+</button>
        </div></div>
      <div style={S('border-radius:20px;background:#0E1116;color:#FFFFFF;padding:24px;display:flex;flex-direction:column;gap:6px')}><span style={S('font-size:13.5px;color:#C4C9D2')}>{n === 1 ? 'Solo' : 'Team of ' + n}</span><div style={S('display:flex;align-items:baseline;gap:8px;flex-wrap:wrap')}><span aria-live="polite" style={S(`font-size:${m ? 44 : 56}px;line-height:1;font-weight:600;letter-spacing:-0.04em`)}>{'$' + total}</span><span style={S('color:#C4C9D2')}>a month</span></div><span style={S('font-size:14.5px;color:#C4C9D2')}>{n === 1 ? 'One stylist at $24 a month' : n + ' stylists at $19 each a month'}</span></div>
      <p style={S('margin:0;color:#5E6673;font-size:14px')}>{n >= 2 ? 'Teams save $5 per stylist compared with the solo price.' : 'Add a second stylist and every stylist drops to $19.'}</p>
      <Link href={REGISTER} style={S('display:flex;align-items:center;justify-content:center;height:52px;box-sizing:border-box;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:15.5px;font-weight:500;text-decoration:none')}>Get started</Link>
    </div>
  );
  const included = (
    <div style={S(CARD(24, m ? 24 : 28))}><h2 style={S(`margin:0;font-size:${m ? 18 : 19}px;font-weight:600;letter-spacing:-0.02em`)}>Included in every plan</h2>
      <ul style={S(m ? 'margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px' : 'margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px')}>
        {INCLUDED.map((t) => <li key={t} style={S('display:flex;gap:10px;align-items:center;font-size:15px')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#14624A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')}><path d="M5 12.5 10 17.5 19 7.5" /></svg><span>{t}</span></li>)}
      </ul>
    </div>
  );
  const faq = (
    <section aria-label="Questions" style={S(`display:flex;flex-direction:column;gap:${m ? 16 : 24}px;max-width:820px`)}><h2 style={S(`margin:0;font-size:${m ? 26 : 36}px;line-height:1.1;font-weight:600;letter-spacing:-0.03em`)}>Questions</h2><Faq items={PRICING_FAQ} m={m} /></section>
  );
  return (
    <div style={S(ROOT)}>
      <div style={S('box-sizing:border-box;display:flex;flex-direction:column;' + (m ? 'padding:20px 20px 32px;gap:32px' : 'max-width:1180px;margin:0 auto;padding:24px 32px 64px;gap:64px'))}>
        <Header m={m} current="pricing" />
        <section aria-label="Pricing" style={S(`display:flex;flex-direction:column;gap:${m ? 10 : 12}px;max-width:720px`)}>
          <h1 style={S(m ? 'margin:0;font-size:36px;line-height:1.05;font-weight:600;letter-spacing:-0.04em' : 'margin:0;font-size:56px;line-height:1.05;font-weight:600;letter-spacing:-0.04em')}>Simple pricing.</h1>
          <p style={S(m ? 'margin:0;color:#4A525E;font-size:16px;line-height:1.5' : 'margin:0;color:#4A525E;font-size:19px;line-height:1.5')}>$24 a month for one stylist. $19 per stylist a month for teams of two or more. Every feature included.</p>
        </section>
        {m ? <>{calc}<PlanCards m />{included}{faq}</> : <>
          <section aria-label="Plans" style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:24px')}>
            <div style={S('flex:1 1 440px;min-width:0;display:flex;flex-direction:column;gap:20px')}><PlanCards m={false} />{included}</div>
            <div style={S('flex:1 1 400px;min-width:0')}>{calc}</div>
          </section>
          {faq}
        </>}
      </div>
    </div>
  );
}
