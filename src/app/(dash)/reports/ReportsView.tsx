'use client';
// 1:1 conversion of the prototype's Reports.dc.html and MobileReports.dc.html. Markup and style strings are kept as written;
// the {{ }} holes are real figures from the report_dashboard function.
import { useEffect, useState } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import type { Heat, Period } from './shared';

type Props = { periods: Period[]; heat: Heat; currency: string; error?: string };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const initialsOf = (n: string) => n.split(' ').map((w) => w[0]).join('');
const CARD = (pad: number) => `box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:${pad}px;display:flex;flex-direction:column;gap:18px`;
const HEAD = 'display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px';

function Head({ title, right }: { title: string; right: string }) {
  return <div style={S(HEAD)}><h2 style={S('margin:0;font-size:16px;font-weight:600')}>{title}</h2><span style={S('color:#5E6673;font-size:13.5px')}>{right}</span></div>;
}

function useReports(props: Props) {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const [pid, setPid] = useState('week');
  const p = props.periods.find((x) => x.id === pid) ?? props.periods[0];
  const fmt = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: props.currency || 'NZD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 });
  const money = (n: number) => fmt.format(n);
  return { ...props, narrow, pid, setPid, p, money };
}
type C = ReturnType<typeof useReports>;

function Body({ c, m }: { c: C; m: boolean }) {
  const p = c.p, money = c.money;
  const chipStyle = (on: boolean) => (m ? 'flex:0 0 auto;height:44px;padding:0 18px;font-size:14px;' : 'height:40px;padding:0 16px;font-size:13.5px;') + 'border-radius:999px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
  const barMax = m ? 96 : 140, cellH = m ? 36 : 44, pad = m ? 20 : 24;
  const max = p.bars.reduce((x, b) => Math.max(x, b[1]), 0);
  const peak = p.bars.reduce((best, b) => (b[1] > best[1] ? b : best), p.bars[0] ?? ['', 0]);
  const avg = p.appts ? Math.round(p.revenue / p.appts) : 0;
  const dstyle = (dir: string) => 'font-size:13px;font-weight:500;color:' + (dir === 'up' ? '#14624A' : dir === 'down' ? '#B42318' : '#5E6673');
  const kpis = [
    ['Booked revenue', money(p.revenue), p.d.revenue], ['Appointments', p.appts.toLocaleString('en-US'), p.d.appts],
    ['Average sale', money(avg), p.d.avg], ['Rebook rate', p.rebook + '%', p.d.rebook],
  ] as const;
  const smax = p.services.reduce((x, s) => Math.max(x, s[2]), 0);
  const chips = (
    <div role="group" className={m ? 'hscroll' : undefined} aria-label="Report period" style={S(m ? 'display:flex;gap:8px;overflow-x:auto' : 'display:flex;flex-wrap:wrap;gap:8px')}>
      {c.periods.map((x) => <button key={x.id} onClick={() => c.setPid(x.id)} aria-pressed={x.id === p.id} style={S(chipStyle(x.id === p.id))}>{x.label}</button>)}
    </div>
  );
  const revenue = (
    <section style={S(CARD(pad))}><Head title="Booked revenue" right={money(p.revenue) + ' ' + p.sentence} />
      <div role="group" aria-label="Booked revenue chart" style={S(`display:flex;align-items:flex-end;gap:${m ? 6 : 14}px;height:${m ? 128 : 200}px`)}>
        {p.bars.map((b, i) => (
          <div key={b[0]} role="img" aria-label={b[0] + ', ' + money(b[1])} style={S('flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px')}>
            {!m && <span style={S('font-size:12px;color:#5E6673;white-space:nowrap')}>{money(b[1])}</span>}
            <div style={S('width:100%;height:' + Math.max(4, Math.round(max ? b[1] / max * barMax : 0)) + 'px;border-radius:10px;background:' + (i === p.hi ? '#0E1116' : '#DADDE4'))} />
            <span style={S('font-size:12px;font-weight:500;white-space:nowrap')}>{b[0]}</span>
          </div>
        ))}
      </div>
      <span style={S('color:#5E6673;font-size:13px')}>{max ? 'Best ' + (p.id === 'today' ? 'hour' : 'period') + ': ' + peak[0] + (p.id === 'today' ? ':00' : '') + ', ' + money(peak[1]) : 'No bookings in this period'}</span></section>
  );
  const services = (
    <section style={S(CARD(pad))}><Head title="Top services" right="By revenue" />
      {p.services.length === 0 && <span style={S('color:#5E6673;font-size:13.5px')}>No bookings in this period.</span>}
      <ol style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:16px')}>
        {p.services.map((s) => (
          <li key={s[0]} style={S('display:flex;flex-direction:column;gap:8px')}>
            <div style={S('display:flex;align-items:baseline;justify-content:space-between;gap:12px')}><span style={S('min-width:0;font-size:14.5px;font-weight:600;overflow-wrap:anywhere')}>{s[0]}</span><span style={S('flex:0 0 auto;font-size:14.5px;font-weight:600')}>{money(s[2])}</span></div>
            <div style={S('height:8px;border-radius:999px;background:#EEF0F3;overflow:hidden')}><div style={S('height:100%;border-radius:999px;background:#0E1116;width:' + (smax ? Math.round(s[2] / smax * 100) : 0) + '%')} /></div>
            <span style={S('font-size:12.5px;color:#5E6673')}>{s[1].toLocaleString('en-US') + (s[1] === 1 ? ' booking' : ' bookings')}</span>
          </li>
        ))}
      </ol></section>
  );
  const team = (
    <section style={S(CARD(pad))}><Head title="Team performance" right="Revenue and utilisation" />
      <ol style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:16px')}>
        {p.team.map((t) => (
          <li key={t[0]} style={S('display:flex;align-items:center;gap:12px')}>
            <span style={S('flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:#EEF0F3;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600')}>{initialsOf(t[0])}</span>
            <div style={S('flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:6px')}>
              <div style={S('display:flex;align-items:baseline;justify-content:space-between;gap:12px')}><span style={S('min-width:0;font-size:14.5px;font-weight:600;overflow-wrap:anywhere')}>{t[0]}</span><span style={S('flex:0 0 auto;font-size:14.5px;font-weight:600')}>{money(t[1])}</span></div>
              <div style={S('height:8px;border-radius:999px;background:#EEF0F3;overflow:hidden')}><div style={S('height:100%;border-radius:999px;background:#0E1116;width:' + t[2] + '%')} /></div>
              <span style={S('font-size:12.5px;color:#5E6673')}>{t[2] + '% of available time booked'}</span>
            </div>
          </li>
        ))}
      </ol></section>
  );
  const heat = (
    <section style={S(CARD(pad))}><Head title="Busiest times" right="Typical week" />
      <div role="group" aria-label="Busiest times by day and time of day" style={S('display:flex;flex-direction:column;gap:8px')}>
        <div style={S('display:flex;align-items:center;gap:8px')}><span style={S('flex:0 0 72px')} />{DAYS.map((d) => <span key={d} style={S('flex:1 1 0;min-width:0;text-align:center;font-size:12px;color:#5E6673')}>{d}</span>)}</div>
        {c.heat.map((row) => (
          <div key={row.label} style={S('display:flex;align-items:center;gap:8px')}>
            <span style={S('flex:0 0 72px;font-size:12.5px;color:#5E6673')}>{row.label}</span>
            {row.values.map((v, i) => <span key={i} role="img" aria-label={DAY_FULL[i] + ' ' + row.label.toLowerCase() + ', ' + (v ? v + ' percent busy' : 'closed')} style={S('flex:1 1 0;min-width:0;height:' + cellH + 'px;border-radius:8px;box-sizing:border-box;' + (v ? 'background:rgba(14,17,22,' + (0.07 + v / 100 * 0.78).toFixed(2) + ')' : 'border:1px dashed #D5D9E0'))} />)}
          </div>
        ))}
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;font-size:12px;color:#5E6673')}><span>Quieter</span><span aria-hidden="true" style={S('flex:1 1 auto;max-width:140px;height:8px;border-radius:999px;background:linear-gradient(90deg, rgba(14,17,22,0.07), rgba(14,17,22,0.85))')} /><span>Busier</span></div>
      </div></section>
  );
  const retPct = p.hasClients ? 100 - p.fresh : 0;
  const mix = (
    <section style={S(CARD(pad))}><Head title="Client mix" right={p.label} />
      <div style={S('display:flex;flex-direction:column;gap:14px')}>
        <div role="img" aria-label={p.fresh + ' percent new clients, ' + retPct + ' percent returning clients'} style={S('display:flex;height:12px;border-radius:999px;overflow:hidden;background:#EEF0F3')}>
          <div style={S('height:100%;background:#0E1116;width:' + p.fresh + '%')} /><div style={S('height:100%;background:#D5D9E0;width:' + retPct + '%')} />
        </div>
        <div style={S('display:flex;flex-wrap:wrap;gap:8px 24px;font-size:13.5px')}>
          <span style={S('display:flex;align-items:center;gap:8px')}><span style={S('width:10px;height:10px;border-radius:999px;background:#0E1116')} />New clients, <b style={S('font-weight:600')}>{p.fresh}%</b></span>
          <span style={S('display:flex;align-items:center;gap:8px')}><span style={S('width:10px;height:10px;border-radius:999px;background:#D5D9E0')} />Returning, <b style={S('font-weight:600')}>{retPct}%</b></span>
        </div></div></section>
  );
  if (m) return (<>
    <section aria-label="Key numbers" style={S('display:flex;gap:40px')}>
      {[['Booked revenue', money(p.revenue)], ['Appointments', p.appts.toLocaleString('en-US')]].map(([l, v]) => <div key={l}><div style={S('color:#5E6673;font-size:13px')}>{l}</div><div style={S('margin-top:2px;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div></div>)}
    </section>
    {chips}{revenue}{services}{team}{heat}{mix}
  </>);
  return (<>
    {chips}
    <section aria-label="Key numbers" style={S('display:flex;flex-wrap:wrap;gap:24px 64px')}>
      {kpis.map(([l, v, d]) => (
        <div key={l}><div style={S('color:#5E6673;font-size:13.5px')}>{l}</div><div style={S('margin-top:4px;font-size:38px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div>
          <div style={S('margin-top:6px')}><span style={S(dstyle(d[1]))}>{d[0]}</span> <span style={S('font-size:13px;color:#5E6673')}>vs {p.prev}</span></div></div>
      ))}
    </section>
    <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
      <div style={S('flex:999 1 620px;min-width:0;display:flex;flex-direction:column;gap:20px')}>
        {revenue}
        <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
          <div style={S('flex:1 1 300px;min-width:0')}>{services}</div>
          <div style={S('flex:1 1 300px;min-width:0')}>{team}</div>
        </div>
      </div>
      <div style={S('flex:1 1 440px;max-width:520px;min-width:0;display:flex;flex-direction:column;gap:20px')}>{heat}{mix}</div>
    </div>
  </>);
}

function Err({ text }: { text: string }) { return <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{text}</p>; }

function Desktop({ c }: { c: C }) {
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Reports" subtitle="How the business is doing" showSearch={false} showAction={false} />
      {c.error || !c.p ? <Err text={c.error ?? 'Could not load the report.'} /> : <Body c={c} m={false} />}
    </div>
  );
}
function Mobile({ c }: { c: C }) {
  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Reports" subtitle="How the business is doing" showSearch={false} />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        {c.error || !c.p ? <Err text={c.error ?? 'Could not load the report.'} /> : <Body c={c} m={true} />}
      </main>
      <MobileTabs active="more" />
    </div>
  );
}
export function ReportsView(props: Props) {
  const c = useReports(props);
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
