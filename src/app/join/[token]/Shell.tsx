'use client';
// Team invite layout, following the prototype's TeamInvite: dark panel on desktop, banner on phones, one primary action and a sign-in line.
import Link from 'next/link';
import { S } from '@/app/(dash)/calendar/pickers';

const BULLET = <span aria-hidden="true" style={S('width:8px;height:8px;border-radius:999px;background:#8F7CFF;flex:0 0 8px')}></span>;
const DARK = 'height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:15px;font-weight:500;padding:0 24px;display:flex;align-items:center;justify-content:center;text-decoration:none;box-sizing:border-box;width:100%';
const LIGHT = 'height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:15px;font-weight:500;padding:0 24px;display:flex;align-items:center;justify-content:center;text-decoration:none;box-sizing:border-box;width:100%';

export function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="cal-root si-root" style={S("display:flex;width:100%;min-height:100vh;box-sizing:border-box;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <aside className="si-aside" style={S('flex:0 0 44%;max-width:640px;box-sizing:border-box;background:#0E1116;color:#FFFFFF;padding:56px;display:flex;flex-direction:column;justify-content:space-between;gap:40px')}>
        <Link href="/" aria-label="Aster home" style={S('align-self:flex-start;display:flex;align-items:center;min-height:44px;color:#FFFFFF;text-decoration:none;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Aster</Link>
        <div style={S('display:flex;flex-direction:column;gap:28px;max-width:440px')}>
          <h2 style={S('margin:0;font-size:44px;line-height:1.08;font-weight:600;letter-spacing:-0.03em')}>You are invited to join the team.</h2>
          <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:14px;color:#C9CDD5;font-size:16px')}>
            {['See your own appointments and shifts', 'Get notified when clients book you', 'Check out clients in a couple of taps'].map((t) => <li key={t} style={S('display:flex;gap:12px;align-items:center')}>{BULLET}{t}</li>)}
          </ul>
        </div>
        <div aria-hidden="true" style={S('color:#8A93A0;font-size:13px')}>{' '}</div>
      </aside>
      <main className="si-main" style={S('flex:1 1 auto;min-width:0;display:flex;align-items:center;justify-content:center;padding:56px 32px;box-sizing:border-box')}>
        <div style={S('width:100%;max-width:420px;display:flex;flex-direction:column;gap:20px')}>
          <div className="si-mob" style={S('flex-direction:column;gap:20px')}>
            <Link href="/" aria-label="Aster home" style={S('align-self:flex-start;display:flex;align-items:center;min-height:44px;color:#0E1116;text-decoration:none;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Aster</Link>
            <div style={S('padding:20px;border-radius:24px;background:#0E1116;color:#FFFFFF;font-size:22px;font-weight:600;letter-spacing:-0.02em;line-height:1.15')}>You are invited to join the team.</div>
          </div>
          <h1 style={S('margin:0;font-size:30px;line-height:1.15;font-weight:600;letter-spacing:-0.025em;overflow-wrap:anywhere')}>{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}

export const Lead = ({ children }: { children: React.ReactNode }) => <p style={S('margin:-12px 0 0;color:#5E6673;font-size:15px')}>{children}</p>;
export const Note = ({ children }: { children: React.ReactNode }) => <p style={S('margin:0;color:#5E6673;font-size:13.5px;text-align:center')}>{children}</p>;
export const Problem = ({ children }: { children: React.ReactNode }) => <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{children}</p>;
export const PrimaryLink = ({ href, children }: { href: string; children: React.ReactNode }) => <Link href={href} style={S(DARK)}>{children}</Link>;
export const LightLink = ({ href, children }: { href: string; children: React.ReactNode }) => <Link href={href} style={S(LIGHT)}>{children}</Link>;
export const PrimaryButton = ({ children }: { children: React.ReactNode }) => <button style={S(DARK)}>{children}</button>;
export const SignInLine = () => (
  <div style={S('display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px;padding-top:20px;border-top:1px solid #E6E8EC;font-size:14.5px;color:#5E6673')}><span>Already have an account?</span><Link href="/sign-in" style={S('padding:6px 0;color:#5B3DF5;font-weight:600;text-decoration:none')}>Sign in</Link></div>
);
