'use client';
// Takings for a day or a run of days: what was sold, how it was paid, tax, tips, refunds, the team, and the cash drawer.
import { BottomSheet } from '@/components/BottomSheet';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CloseX, CLOSE_BTN } from '../../calendar/calUi';
import { dayInfo } from '@/lib/cal';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../../calendar/pickers';
import { dollars } from '@/lib/format';
import { plural } from '@/lib/display';
import { BACK, BLACK, BLACK_SM, FIELD_IN, Field, FieldError, Icon, RING, StatCard, filterChipCss } from '@/components/ui';
import { TillForm, type Till } from './TillForm';

type Preset = { id: string; label: string; from: string; to: string };
type Summary = {
  sales_count: number; services_cents: number; products_cents: number; discount_cents: number; sales_cents: number; tips_cents: number; tax_cents: number; total_cents: number;
  refund_count: number; refund_cents: number; cash_expected_cents: number; till: Till & { day: string } | null;
  by_method: { method: string; count: number; cents: number; refund_cents: number }[];
  tax_by_rate: { rate: number; inclusive: boolean; sales_cents: number; tax_cents: number }[];
  by_staff: { name: string; count: number; sales_cents: number; tips_cents: number }[];
  gift_cards_sold: { count: number; cents: number };
  appointments: { completed: number; no_shows: number; cancelled: { reason: string; count: number }[] };
};

const METHOD: Record<string, string> = { card: 'Card', cash: 'Cash', gift_card: 'Gift card', package: 'Package' };
/** A date in the one house style; the year only when it is not this year. */
const withYear = (d: string, text: string, today: string) => (d.slice(0, 4) !== today.slice(0, 4) ? text + ' ' + d.slice(0, 4) : text);
const CARD = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:22px 24px;min-width:0';
const NOTE = 'margin:0;padding-top:12px;font-size:13px;line-height:1.5;color:#5E6673';

function Row({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:13px 0;font-size:14.5px;' + (strong ? 'font-weight:600;' : ''))}>
      <span style={S('min-width:0')}>{label}{sub && <span style={S('display:block;margin-top:2px;font-size:12.5px;font-weight:400;color:#5E6673')}>{sub}</span>}</span>
      <span style={S('white-space:nowrap;font-variant-numeric:tabular-nums')}>{value}</span>
    </div>
  );
}

function Card({ title, label, children }: { title: string; label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} style={S(CARD)}>
      <h3 style={S('margin:0 0 6px;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>{title}</h3>
      {children}
    </section>
  );
}


/** Phone: back, then one button showing the days you are looking at. It opens a sheet to pick another run of days. */
function Period({ from, to, today, presets }: { from: string; to: string; today: string; presets: Preset[] }) {
  const [open, setOpen] = useState(false);
  const cur = presets.find((p) => p.from === from && p.to === to);
  const short = (d: string) => withYear(d, dayInfo(d).short, today);
  const label = cur ? cur.label : from === to ? short(from) : short(from) + ' to ' + short(to);
  return (<>
    <div style={S('display:flex;gap:12px')}>
      <Link href="/sales" aria-label="Back to sales" style={S(RING + ';align-self:center')}>{BACK}</Link>
      <button onClick={() => setOpen(true)} aria-haspopup="dialog" style={S('flex:1 1 0;min-width:0;display:flex;align-items:center;gap:10px;height:52px;padding:0 18px;border:1px solid #E6E8EC;border-radius:999px;background:#FFFFFF;font:inherit;font-size:15px;font-weight:500;color:#0E1116;cursor:pointer;text-align:left')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
        <span style={S('flex:1 1 auto;min-width:0')}>{label}</span>
        <Icon name="down" color="#5E6673" decorative />
      </button>
    </div>
    {open && (
      <BottomSheet label="Choose days" onClose={() => setOpen(false)} z={6} gap={0} handleGap={12}>
          <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}>
            <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Choose days</h2>
            <button onClick={() => setOpen(false)} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button>
          </div>
          <div role="group" aria-label="Quick choices" style={S('display:flex;flex-direction:column;padding:4px 0;border-top:1px solid #EEF0F3')}>
            {presets.map((p) => { const on = p.from === from && p.to === to; return (
              <Link key={p.id} href={`/sales/summary?from=${p.from}&to=${p.to}`} aria-current={on ? 'true' : undefined} style={S('display:flex;align-items:center;gap:12px;min-height:56px;font-size:16px;color:#0E1116;text-decoration:none;font-weight:' + (on ? 600 : 400))}>
                <span style={S('flex:1 1 auto')}>{p.label}</span>
                {on && <Icon name="tick" size={22} color="#0E1116" decorative />}
              </Link>
            ); })}
          </div>
          <h3 style={S('margin:14px 0 10px;font-size:15px;font-weight:600;color:#5E6673')}>Or pick the dates</h3>
          <form method="get" action="/sales/summary" style={S('display:flex;flex-direction:column;gap:10px')}>
            <Field label="From"><input type="date" name="from" aria-label="From" defaultValue={from} max={today} required style={FIELD_IN} /></Field>
            <Field label="To"><input type="date" name="to" aria-label="To" defaultValue={to} max={today} required style={FIELD_IN} /></Field>
            <button type="submit" style={S(BLACK + ';flex:0 0 auto')}>Show</button>
          </form>
        </BottomSheet>
    )}
  </>);
}

function Body({ d, from, to, today, presets, m }: { d: Summary; from: string; to: string; today: string; presets: Preset[]; m: boolean }) {
  const one = from === to;
  const added = d.tax_by_rate.filter((t) => !t.inclusive).reduce((a, t) => a + t.tax_cents, 0);
  const net = d.total_cents - d.refund_cents;
  const chip = (on: boolean) => filterChipCss(on, m) + ';display:inline-flex;align-items:center;text-decoration:none';
  const stat = (label: string, v: string, last?: boolean) => (
    <div style={S('flex:1 1 ' + (m ? '40%' : '0') + ';min-width:0;padding:' + (m ? '4px 0' : '2px 28px') + ';' + (!m && !last ? 'border-right:1px solid #EEF0F3;' : ''))}>
      <div style={S('color:#5E6673;font-size:13.5px')}>{label}</div>
      <div style={S('margin-top:6px;font-size:' + (m ? 28 : 34) + 'px;line-height:1.1;font-weight:500;letter-spacing:-0.03em;font-variant-numeric:tabular-nums')}>{v}</div>
    </div>
  );
  const input = 'box-sizing:border-box;height:' + (m ? 44 : 40) + 'px;padding:0 12px;border:1px solid #E1E4E9;border-radius:999px;font:inherit;font-size:13.5px;color:#0E1116;background:#FFFFFF;min-height:0;width:auto';
  const col = 'flex:1 1 ' + (m ? '100%' : '420px') + ';min-width:0;display:flex;flex-direction:column;gap:20px';
  if (m) {
    const stat = (label: string, v: string) => <StatCard key={label} label={label} value={v} />;
    const card = (title: string, label: string, children: React.ReactNode) => <section key={label} aria-label={label} style={S(CARD + ';padding:18px 20px')}><h3 style={S('margin:0 0 4px;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>{title}</h3>{children}</section>;
    return (<>
      <Period from={from} to={to} today={today} presets={presets} />
      <section aria-label="At a glance" style={S('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px')}>
        {stat('Taken', dollars(d.total_cents))}{stat('Refunded', dollars(d.refund_cents))}{stat('Net', dollars(net))}{stat('Sales', String(d.sales_count))}
      </section>
      {card('Takings', 'Takings', (
        <div className="sum-rows">
          <Row label="Services" value={dollars(d.services_cents)} />
          {d.products_cents > 0 && <Row label="Products" value={dollars(d.products_cents)} />}
          {d.discount_cents > 0 && <Row label="Discounts" value={'-' + dollars(d.discount_cents)} />}
          <Row label="Sales" value={dollars(d.sales_cents)} strong sub="Before tips, and before any GST added on top" />
          {d.tips_cents > 0 && <Row label="Tips" value={dollars(d.tips_cents)} />}
          {added > 0 && <Row label="GST added at checkout" value={dollars(added)} />}
          <Row label="Total taken" value={dollars(d.total_cents)} strong />
          {d.refund_cents > 0 && <Row label={`Refunds (${d.refund_count})`} value={'-' + dollars(d.refund_cents)} />}
          <Row label="Net takings" value={dollars(net)} strong />
        </div>
      ))}
      {card('How it was paid', 'Payments', (<>
        {d.by_method.length === 0 ? <p style={S(NOTE)}>No payments in this time.</p>
          : <div className="sum-rows">
            {d.by_method.map((x) => <Row key={x.method} label={METHOD[x.method] ?? x.method} value={dollars(x.cents - x.refund_cents)} sub={`${plural(x.count, 'sale')}${x.refund_cents ? `, ${dollars(x.refund_cents)} refunded` : ''}`} />)}
            <Row label="Net takings" value={dollars(net)} strong />
          </div>}
        {d.gift_cards_sold.count > 0 && <p style={S(NOTE)}>{plural(d.gift_cards_sold.count, 'gift card')} sold for {dollars(d.gift_cards_sold.cents)}. Gift card sales are not in the figures above, because how they were paid is not recorded.</p>}
      </>))}
      {card('Cash drawer', 'Cash drawer', (
        <div>
          <Row label="Cash that should be in the drawer" value={dollars(d.cash_expected_cents)} strong sub="Cash taken, less cash refunded" />
          {one
            ? <div style={S('padding-top:8px')}><TillForm key={d.till?.closed_at ?? 'open'} day={from} expected={d.cash_expected_cents} till={d.till} mobile /></div>
            : <p style={S(NOTE)}>Choose a single day to count the drawer and close the till.</p>}
        </div>
      ))}
      {card('GST', 'GST', (
        d.tax_by_rate.length === 0 ? <p style={S(NOTE)}>No GST in this time.</p>
          : <div className="sum-rows">
            {d.tax_by_rate.map((t, i) => <Row key={i} label={`${t.rate}% ${t.inclusive ? 'included in prices' : 'added at checkout'}`} value={dollars(t.tax_cents)} sub={`On ${dollars(t.sales_cents)} of sales`} />)}
            <Row label="GST collected" value={dollars(d.tax_cents)} strong />
          </div>
      ))}
      {card('Team', 'Team', (
        d.by_staff.length === 0 ? <p style={S(NOTE)}>No sales in this time.</p>
          : <div className="sum-rows">{d.by_staff.map((x, i) => <Row key={i} label={x.name} value={dollars(x.sales_cents)} sub={`${plural(x.count, 'sale')}${x.tips_cents ? `, ${dollars(x.tips_cents)} in tips` : ''}`} />)}</div>
      ))}
      {card('Appointments', 'Appointments', (
        <div className="sum-rows">
          <Row label="Completed" value={String(d.appointments.completed)} />
          <Row label="No-shows" value={String(d.appointments.no_shows)} />
          <Row label="Cancelled" value={String(d.appointments.cancelled.reduce((a, x) => a + x.count, 0))} strong={d.appointments.cancelled.length > 0} />
          {d.appointments.cancelled.map((x) => <Row key={x.reason} label={x.reason} value={String(x.count)} />)}
        </div>
      ))}
    </>);
  }
  return (<>
    <section aria-label="Choose days" style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px')}>
      <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>
        {presets.map((p) => <Link key={p.id} href={`/sales/summary?from=${p.from}&to=${p.to}`} aria-current={p.from === from && p.to === to ? 'true' : undefined} style={S(chip(p.from === from && p.to === to))}>{p.label}</Link>)}
      </div>
      <form method="get" action="/sales/summary" style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px')}>
        <input type="date" name="from" aria-label="From" defaultValue={from} max={today} required style={S(input)} />
        <span style={S('color:#5E6673;font-size:13.5px')}>to</span>
        <input type="date" name="to" aria-label="To" defaultValue={to} max={today} required style={S(input)} />
        <button type="submit" style={S(BLACK_SM + (m ? ';height:44px' : ''))}>Show</button>
      </form>
    </section>

    <section aria-label="At a glance" style={S(CARD + ';display:flex;flex-wrap:wrap;gap:' + (m ? '16px 12px' : '0') + ';padding:' + (m ? '20px' : '24px 0'))}>
      {stat('Taken', dollars(d.total_cents))}{stat('Refunded', dollars(d.refund_cents))}{stat('Net', dollars(net))}{stat('Sales', String(d.sales_count), true)}
    </section>

    <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
      <div style={S(col)}>
        <Card title="Takings" label="Takings">
          <div className="sum-rows">
            <Row label="Services" value={dollars(d.services_cents)} />
            {d.products_cents > 0 && <Row label="Products" value={dollars(d.products_cents)} />}
            {d.discount_cents > 0 && <Row label="Discounts" value={'-' + dollars(d.discount_cents)} />}
            <Row label="Sales" value={dollars(d.sales_cents)} strong sub="Before tips, and before any GST added on top" />
            {d.tips_cents > 0 && <Row label="Tips" value={dollars(d.tips_cents)} />}
            {added > 0 && <Row label="GST added at checkout" value={dollars(added)} />}
            <Row label="Total taken" value={dollars(d.total_cents)} strong />
            {d.refund_cents > 0 && <Row label={`Refunds (${d.refund_count})`} value={'-' + dollars(d.refund_cents)} />}
            <Row label="Net takings" value={dollars(net)} strong />
          </div>
        </Card>
        <Card title="Team" label="Team">
          {d.by_staff.length === 0 ? <p style={S(NOTE)}>No sales in this time.</p>
            : <div className="sum-rows">{d.by_staff.map((x, i) => <Row key={i} label={x.name} value={dollars(x.sales_cents)} sub={`${plural(x.count, 'sale')}${x.tips_cents ? `, ${dollars(x.tips_cents)} in tips` : ''}`} />)}</div>}
        </Card>
        <Card title="Appointments" label="Appointments">
          <div className="sum-rows">
            <Row label="Completed" value={String(d.appointments.completed)} />
            <Row label="No-shows" value={String(d.appointments.no_shows)} />
            <Row label="Cancelled" value={String(d.appointments.cancelled.reduce((a, x) => a + x.count, 0))} strong={d.appointments.cancelled.length > 0} />
            {d.appointments.cancelled.map((x) => <Row key={x.reason} label={x.reason} value={String(x.count)} />)}
          </div>
        </Card>
      </div>

      <div style={S(col)}>
        <Card title="How it was paid" label="Payments">
          {d.by_method.length === 0 ? <p style={S(NOTE)}>No payments in this time.</p>
            : <div className="sum-rows">
              {d.by_method.map((x) => <Row key={x.method} label={METHOD[x.method] ?? x.method} value={dollars(x.cents - x.refund_cents)} sub={`${plural(x.count, 'sale')}${x.refund_cents ? `, ${dollars(x.refund_cents)} refunded` : ''}`} />)}
              <Row label="Net takings" value={dollars(net)} strong />
            </div>}
          {d.gift_cards_sold.count > 0 && <p style={S(NOTE)}>{plural(d.gift_cards_sold.count, 'gift card')} sold for {dollars(d.gift_cards_sold.cents)}. Gift card sales are not in the figures above, because how they were paid is not recorded.</p>}
        </Card>
        <Card title="Cash drawer" label="Cash drawer">
          <div className="sum-rows">
            <Row label="Cash that should be in the drawer" value={dollars(d.cash_expected_cents)} strong sub="Cash taken, less cash refunded" />
            {one
              ? <div style={S('padding-top:16px')}><TillForm key={d.till?.closed_at ?? 'open'} day={from} expected={d.cash_expected_cents} till={d.till} mobile={m} /></div>
              : <p style={S(NOTE)}>Choose a single day to count the drawer and close the till.</p>}
          </div>
        </Card>
        <Card title="GST" label="GST">
          {d.tax_by_rate.length === 0 ? <p style={S(NOTE)}>No GST in this time.</p>
            : <div className="sum-rows">
              {d.tax_by_rate.map((t, i) => <Row key={i} label={`${t.rate}% ${t.inclusive ? 'included in prices' : 'added at checkout'}`} value={dollars(t.tax_cents)} sub={`On ${dollars(t.sales_cents)} of sales`} />)}
              <Row label="GST collected" value={dollars(d.tax_cents)} strong />
            </div>}
        </Card>
      </div>
    </div>
  </>);
}

export function SummaryView({ data, from, to, today, presets, dayLabel }: { data: Summary | null; from: string; to: string; today: string; presets: Preset[]; dayLabel: string }) {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const sub = from === to ? withYear(from, dayLabel, today) : withYear(from, dayInfo(from).full, today) + ' to ' + withYear(to, dayInfo(to).full, today);
  const fail = <FieldError>Could not load the summary. Try again in a moment.</FieldError>;
  return (<>
    {narrow !== false && (
      <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
        <MobileHeader title="Daily summary" subtitle={sub} showSearch={false} />
        <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:14px;align-items:stretch')}>
          {data ? <Body d={data} from={from} to={to} today={today} presets={presets} m /> : fail}
        </main>
        <MobileTabs active="more" />
      </div>
    )}
    {narrow !== true && (
      <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 32px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
        <PageHeader title="Daily summary" subtitle={sub} showSearch={false} showAction={false} />
        {data ? <Body d={data} from={from} to={to} today={today} presets={presets} m={false} /> : fail}
      </div>
    )}
  </>);
}
