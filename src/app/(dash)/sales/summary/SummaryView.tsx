'use client';
// Takings for a day or a run of days: what was sold, how it was paid, tax, tips, refunds, the team, and the cash drawer.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../../calendar/pickers';
import { fmt } from '../shared';
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

const METHOD: Record<string, string> = { card: 'Card', cash: 'Cash', gift_card: 'Gift card' };
const dayText = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
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

function Body({ d, from, to, today, presets, m }: { d: Summary; from: string; to: string; today: string; presets: Preset[]; m: boolean }) {
  const one = from === to;
  const added = d.tax_by_rate.filter((t) => !t.inclusive).reduce((a, t) => a + t.tax_cents, 0);
  const net = d.total_cents - d.refund_cents;
  const chip = (on: boolean) => 'display:inline-flex;align-items:center;height:' + (m ? 44 : 40) + 'px;padding:0 18px;border-radius:999px;font-size:13.5px;font-weight:500;text-decoration:none;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
  const stat = (label: string, v: string, last?: boolean) => (
    <div style={S('flex:1 1 ' + (m ? '40%' : '0') + ';min-width:0;padding:' + (m ? '4px 0' : '2px 28px') + ';' + (!m && !last ? 'border-right:1px solid #EEF0F3;' : ''))}>
      <div style={S('color:#5E6673;font-size:13.5px')}>{label}</div>
      <div style={S('margin-top:6px;font-size:' + (m ? 28 : 34) + 'px;line-height:1.1;font-weight:500;letter-spacing:-0.03em;font-variant-numeric:tabular-nums')}>{v}</div>
    </div>
  );
  const input = 'box-sizing:border-box;height:' + (m ? 44 : 40) + 'px;padding:0 12px;border:1px solid #E1E4E9;border-radius:999px;font:inherit;font-size:13.5px;color:#0E1116;background:#FFFFFF;min-height:0;width:auto';
  const col = 'flex:1 1 ' + (m ? '100%' : '420px') + ';min-width:0;display:flex;flex-direction:column;gap:20px';
  return (<>
    <section aria-label="Choose days" style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px')}>
      <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>
        {presets.map((p) => <Link key={p.id} href={`/sales/summary?from=${p.from}&to=${p.to}`} aria-current={p.from === from && p.to === to ? 'true' : undefined} style={S(chip(p.from === from && p.to === to))}>{p.label}</Link>)}
      </div>
      <form method="get" action="/sales/summary" style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px')}>
        <input type="date" name="from" aria-label="From" defaultValue={from} max={today} required style={S(input)} />
        <span style={S('color:#5E6673;font-size:13.5px')}>to</span>
        <input type="date" name="to" aria-label="To" defaultValue={to} max={today} required style={S(input)} />
        <button type="submit" style={S('height:' + (m ? 44 : 40) + 'px;padding:0 20px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:13.5px;font-weight:500;cursor:pointer')}>Show</button>
      </form>
    </section>

    <section aria-label="At a glance" style={S(CARD + ';display:flex;flex-wrap:wrap;gap:' + (m ? '16px 12px' : '0') + ';padding:' + (m ? '20px' : '24px 0'))}>
      {stat('Taken', fmt(d.total_cents))}{stat('Refunded', fmt(d.refund_cents))}{stat('Net', fmt(net))}{stat('Sales', String(d.sales_count), true)}
    </section>

    <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
      <div style={S(col)}>
        <Card title="Takings" label="Takings">
          <div className="sum-rows">
            <Row label="Services" value={fmt(d.services_cents)} />
            {d.products_cents > 0 && <Row label="Products" value={fmt(d.products_cents)} />}
            {d.discount_cents > 0 && <Row label="Discounts" value={'-' + fmt(d.discount_cents)} />}
            <Row label="Sales" value={fmt(d.sales_cents)} strong sub="Before tips, and before any tax added on top" />
            {d.tips_cents > 0 && <Row label="Tips" value={fmt(d.tips_cents)} />}
            {added > 0 && <Row label="Tax added at checkout" value={fmt(added)} />}
            <Row label="Total taken" value={fmt(d.total_cents)} strong />
            {d.refund_cents > 0 && <Row label={`Refunds (${d.refund_count})`} value={'-' + fmt(d.refund_cents)} />}
            <Row label="Net takings" value={fmt(net)} strong />
          </div>
        </Card>
        <Card title="Team" label="Team">
          {d.by_staff.length === 0 ? <p style={S(NOTE)}>No sales in this time.</p>
            : <div className="sum-rows">{d.by_staff.map((x, i) => <Row key={i} label={x.name} value={fmt(x.sales_cents)} sub={`${x.count} sale${x.count === 1 ? '' : 's'}${x.tips_cents ? `, ${fmt(x.tips_cents)} in tips` : ''}`} />)}</div>}
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
              {d.by_method.map((x) => <Row key={x.method} label={METHOD[x.method] ?? x.method} value={fmt(x.cents - x.refund_cents)} sub={`${x.count} sale${x.count === 1 ? '' : 's'}${x.refund_cents ? `, ${fmt(x.refund_cents)} refunded` : ''}`} />)}
              <Row label="Net takings" value={fmt(net)} strong />
            </div>}
          {d.gift_cards_sold.count > 0 && <p style={S(NOTE)}>{d.gift_cards_sold.count} gift card{d.gift_cards_sold.count === 1 ? '' : 's'} sold for {fmt(d.gift_cards_sold.cents)}. Gift card sales are not in the figures above, because how they were paid is not recorded.</p>}
        </Card>
        <Card title="Cash drawer" label="Cash drawer">
          <div className="sum-rows">
            <Row label="Cash that should be in the drawer" value={fmt(d.cash_expected_cents)} strong sub="Cash taken, less cash refunded" />
            {one
              ? <div style={S('padding-top:16px')}><TillForm key={d.till?.closed_at ?? 'open'} day={from} expected={d.cash_expected_cents} till={d.till} mobile={m} /></div>
              : <p style={S(NOTE)}>Choose a single day to count the drawer and close the till.</p>}
          </div>
        </Card>
        <Card title="Tax" label="Tax">
          {d.tax_by_rate.length === 0 ? <p style={S(NOTE)}>No tax in this time.</p>
            : <div className="sum-rows">
              {d.tax_by_rate.map((t, i) => <Row key={i} label={`${t.rate}% ${t.inclusive ? 'included in prices' : 'added at checkout'}`} value={fmt(t.tax_cents)} sub={`On ${fmt(t.sales_cents)} of sales`} />)}
              <Row label="Tax collected" value={fmt(d.tax_cents)} strong />
            </div>}
        </Card>
      </div>
    </div>
  </>);
}

const BACK = <Link href="/sales" style={S('display:inline-flex;align-items:center;height:40px;padding:0 16px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:13.5px;font-weight:500;text-decoration:none')}>Back to sales</Link>;

export function SummaryView({ data, from, to, today, presets, dayLabel }: { data: Summary | null; from: string; to: string; today: string; presets: Preset[]; dayLabel: string }) {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const sub = from === to ? dayLabel : dayText(from) + ' to ' + dayText(to);
  const fail = <p role="alert" style={S('margin:0;color:#B42318;font-size:14px;font-weight:500')}>Could not load the summary. Try again in a moment.</p>;
  return (<>
    {narrow !== false && (
      <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
        <MobileHeader title="Daily summary" subtitle={sub} showSearch={false} />
        <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px;align-items:stretch')}>
          <div>{BACK}</div>
          {data ? <Body d={data} from={from} to={to} today={today} presets={presets} m /> : fail}
        </main>
        <MobileTabs active="more" />
      </div>
    )}
    {narrow !== true && (
      <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
        <PageHeader title="Daily summary" subtitle={sub} showSearch={false} showAction={false} />
        {data ? <Body d={data} from={from} to={to} today={today} presets={presets} m={false} /> : fail}
      </div>
    )}
  </>);
}
