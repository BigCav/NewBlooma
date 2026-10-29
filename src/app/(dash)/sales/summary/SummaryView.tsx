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
const CARD = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:22px;display:flex;flex-direction:column;gap:6px;min-width:0';
const H3 = 'margin:0 0 6px;font-size:16px;font-weight:600;letter-spacing:-0.01em';
const NOTE = 'margin:0;font-size:13px;color:#5E6673';

function Row({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <div style={S('display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-top:1px solid #EEF0F3;font-size:14px;' + (strong ? 'font-weight:600;' : ''))}>
      <span style={S('min-width:0')}>{label}{sub && <span style={S('display:block;font-size:12.5px;font-weight:400;color:#5E6673')}>{sub}</span>}</span>
      <span style={S('white-space:nowrap')}>{value}</span>
    </div>
  );
}

function Body({ d, from, to, today, presets, m }: { d: Summary; from: string; to: string; today: string; presets: Preset[]; m: boolean }) {
  const one = from === to;
  const added = d.tax_by_rate.filter((t) => !t.inclusive).reduce((a, t) => a + t.tax_cents, 0);
  const net = d.total_cents - d.refund_cents;
  const chip = (on: boolean) => 'display:inline-flex;align-items:center;height:' + (m ? 44 : 40) + 'px;padding:0 16px;border-radius:999px;font-size:13.5px;font-weight:500;text-decoration:none;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
  const stat = (label: string, v: string) => <div><div style={S('color:#5E6673;font-size:13.5px')}>{label}</div><div style={S('margin-top:4px;font-size:' + (m ? 30 : 38) + 'px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div></div>;
  const input = 'box-sizing:border-box;height:44px;padding:0 10px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:14px;color:#0E1116;background:#FFFFFF';
  return (<>
    <section aria-label="Choose days" style={S('display:flex;flex-direction:column;gap:12px')}>
      <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>
        {presets.map((p) => <Link key={p.id} href={`/sales/summary?from=${p.from}&to=${p.to}`} aria-current={p.from === from && p.to === to ? 'true' : undefined} style={S(chip(p.from === from && p.to === to))}>{p.label}</Link>)}
      </div>
      <form method="get" action="/sales/summary" style={S('display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px')}>
        <label style={S('display:flex;flex-direction:column;gap:4px;font-size:12.5px;font-weight:600')}>From<input type="date" name="from" defaultValue={from} max={today} required style={S(input)} /></label>
        <label style={S('display:flex;flex-direction:column;gap:4px;font-size:12.5px;font-weight:600')}>To<input type="date" name="to" defaultValue={to} max={today} required style={S(input)} /></label>
        <button type="submit" style={S('height:44px;padding:0 18px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:13.5px;font-weight:500;cursor:pointer')}>Show</button>
      </form>
      <p style={S('margin:0;font-size:14px;color:#5E6673')}>{one ? dayText(from) : dayText(from) + ' to ' + dayText(to)}</p>
    </section>

    <section aria-label="At a glance" style={S('display:flex;flex-wrap:wrap;gap:20px ' + (m ? 36 : 64) + 'px')}>
      {stat('Taken', fmt(d.total_cents))}{stat('Refunded', fmt(d.refund_cents))}{stat('Net', fmt(net))}{stat('Sales', String(d.sales_count))}
    </section>

    <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
      <section aria-label="Takings" style={S(CARD + ';flex:1 1 320px')}>
        <h3 style={S(H3)}>Takings</h3>
        <Row label="Services" value={fmt(d.services_cents)} />
        {d.products_cents > 0 && <Row label="Products" value={fmt(d.products_cents)} />}
        {d.discount_cents > 0 && <Row label="Discounts" value={'-' + fmt(d.discount_cents)} />}
        <Row label="Sales" value={fmt(d.sales_cents)} strong sub="Before tips, and before any tax added on top" />
        {d.tips_cents > 0 && <Row label="Tips" value={fmt(d.tips_cents)} />}
        {added > 0 && <Row label="Tax added at checkout" value={fmt(added)} />}
        <Row label="Total taken" value={fmt(d.total_cents)} strong />
        {d.refund_cents > 0 && <Row label={`Refunds (${d.refund_count})`} value={'-' + fmt(d.refund_cents)} />}
        <Row label="Net takings" value={fmt(net)} strong />
      </section>

      <section aria-label="Payments" style={S(CARD + ';flex:1 1 320px')}>
        <h3 style={S(H3)}>How it was paid</h3>
        {d.by_method.length === 0 && <p style={S(NOTE)}>No payments in this time.</p>}
        {d.by_method.map((x) => <Row key={x.method} label={METHOD[x.method] ?? x.method} value={fmt(x.cents - x.refund_cents)} sub={`${x.count} sale${x.count === 1 ? '' : 's'}${x.refund_cents ? `, ${fmt(x.refund_cents)} refunded` : ''}`} />)}
        {d.by_method.length > 0 && <Row label="Net takings" value={fmt(net)} strong />}
        {d.gift_cards_sold.count > 0 && <p style={S(NOTE + ';padding-top:8px')}>{d.gift_cards_sold.count} gift card{d.gift_cards_sold.count === 1 ? '' : 's'} sold for {fmt(d.gift_cards_sold.cents)}. Gift card sales are not in the figures above, because how they were paid is not recorded.</p>}
      </section>

      <section aria-label="Cash drawer" style={S(CARD + ';flex:1 1 320px')}>
        <h3 style={S(H3)}>Cash drawer</h3>
        <Row label="Cash that should be in the drawer" value={fmt(d.cash_expected_cents)} strong sub="Cash taken, less cash refunded" />
        {one
          ? <div style={S('padding-top:12px;border-top:1px solid #EEF0F3')}><TillForm key={d.till?.closed_at ?? 'open'} day={from} expected={d.cash_expected_cents} till={d.till} mobile={m} /></div>
          : <p style={S(NOTE + ';padding-top:8px')}>Choose a single day to count the drawer and close the till.</p>}
      </section>

      <section aria-label="Tax" style={S(CARD + ';flex:1 1 320px')}>
        <h3 style={S(H3)}>Tax</h3>
        {d.tax_by_rate.length === 0 && <p style={S(NOTE)}>No tax in this time.</p>}
        {d.tax_by_rate.map((t, i) => <Row key={i} label={`${t.rate}% ${t.inclusive ? 'included in prices' : 'added at checkout'}`} value={fmt(t.tax_cents)} sub={`On ${fmt(t.sales_cents)} of sales`} />)}
        {d.tax_by_rate.length > 0 && <Row label="Tax collected" value={fmt(d.tax_cents)} strong />}
      </section>

      <section aria-label="Team" style={S(CARD + ';flex:1 1 320px')}>
        <h3 style={S(H3)}>Team</h3>
        {d.by_staff.length === 0 && <p style={S(NOTE)}>No sales in this time.</p>}
        {d.by_staff.map((x, i) => <Row key={i} label={x.name} value={fmt(x.sales_cents)} sub={`${x.count} sale${x.count === 1 ? '' : 's'}${x.tips_cents ? `, ${fmt(x.tips_cents)} in tips` : ''}`} />)}
      </section>

      <section aria-label="Appointments" style={S(CARD + ';flex:1 1 320px')}>
        <h3 style={S(H3)}>Appointments</h3>
        <Row label="Completed" value={String(d.appointments.completed)} />
        <Row label="No-shows" value={String(d.appointments.no_shows)} />
        {d.appointments.cancelled.length === 0
          ? <Row label="Cancelled" value="0" />
          : <>
            <Row label="Cancelled" value={String(d.appointments.cancelled.reduce((a, x) => a + x.count, 0))} strong />
            {d.appointments.cancelled.map((x) => <Row key={x.reason} label={x.reason} value={String(x.count)} />)}
          </>}
      </section>
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
  const sub = from === to ? dayLabel : 'Several days';
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
