'use client';
import { rootCls } from '@/components/drawer';
import { decimalInput } from '@/lib/numeric';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { CLOSE_BTN, CloseX } from '../calendar/calUi';
import { ClientCard, ClientStep, DetailRows, ICONS, ROW, StepShell, TICK, useSteps } from '../calendar/wizardUi';
import { savePackage, sellPackage, setPackageActive } from './actions';

export type PkgType = { id: string; name: string; serviceId: string; service: string; servicePriceCents: number; uses: number; priceCents: number; validDays: number | null; active: boolean; sold: number };
export type PkgSold = { id: string; clientId: string; client: string; packageId: string; name: string; uses: number; left: number; priceCents: number; status: 'Active' | 'Unpaid' | 'Used up' | 'Expired' | 'Refunded'; bought: string; expires: string; used: string[] };
type Props = { types: PkgType[]; sold: PkgSold[]; services: { id: string; name: string; priceCents: number }[]; recent: { id: string; name: string; phone?: string }[]; canEdit: boolean; month: string };
type Form = { name: string; serviceId: string; uses: string; price: string; validDays: number | null };

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const money = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const dShort = (s: string) => parseInt(s.slice(8), 10) + ' ' + MON[parseInt(s.slice(5, 7), 10) - 1];
const dLong = (s: string) => dShort(s) + ' ' + s.slice(0, 4);
const VALID: [number | null, string][] = [[null, 'No expiry'], [90, '3 months'], [180, '6 months'], [365, '1 year']];
const validText = (d: number | null) => VALID.find((v) => v[0] === d)?.[1] ?? d + ' days';
const chip = (on: boolean, m: boolean) => `flex:0 0 auto;height:${m ? 44 : 40}px;padding:0 14px;border-radius:999px;font:inherit;font-size:13.5px;font-weight:500;cursor:pointer;border:1px solid ` + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
const PILL: Record<string, [string, string]> = { Active: ['#DDF3EA', '#14624A'], Unpaid: ['#FFEBD0', '#7A4204'], 'Used up': ['#EEF0F3', '#4A525E'], Expired: ['#EEF0F3', '#4A525E'], Refunded: ['#FDECEA', '#B42318'], Archived: ['#EEF0F3', '#4A525E'] };
const pill = (s: string) => 'display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + PILL[s][0] + ';color:' + PILL[s][1];
const FIELD = 'box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF';
const BLANK: Form = { name: '', serviceId: '', uses: '5', price: '', validDays: null };

function usePackages(props: Props) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const [tab, setTab] = useState<'sold' | 'types'>('sold');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'view' | 'new' | 'edit' | 'sell'>('view');
  const [open, setOpen] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pf, setPf] = useState<Form>(BLANK);
  const [sf, setSf] = useState<{ client: string; clientId: string | null; packageId: string | null }>({ client: '', clientId: null, packageId: null });

  const q = query.trim().toLowerCase();
  const sold = props.sold.filter((s) => !q || (s.client + ' ' + s.name).toLowerCase().includes(q));
  const types = props.types.filter((t) => !q || (t.name + ' ' + t.service).toLowerCase().includes(q));
  const live = props.sold.filter((s) => s.status === 'Active');
  const visitsLeft = live.reduce((a, s) => a + s.left, 0);
  const owed = live.reduce((a, s) => a + s.left * Math.round(s.priceCents / s.uses), 0);
  const soldM = props.sold.filter((s) => s.status !== 'Unpaid' && s.status !== 'Refunded' && s.bought.slice(0, 7) === props.month).reduce((a, s) => a + s.priceCents, 0);
  const sel = props.sold.find((s) => s.id === selId) ?? null;
  const activeTypes = props.types.filter((t) => t.active);

  const close = () => { setOpen(false); setMode('view'); setError(''); };
  const pick = (id: string) => { setSelId(id); setMode('view'); setError(''); setOpen(true); };
  const openNew = () => { setPf(BLANK); setTypeId(null); setMode('new'); setError(''); setOpen(true); };
  const openEdit = (t: PkgType) => { setPf({ name: t.name, serviceId: t.serviceId, uses: String(t.uses), price: String(t.priceCents / 100), validDays: t.validDays }); setTypeId(t.id); setMode('edit'); setError(''); setOpen(true); };
  const openSell = () => { setSf({ client: '', clientId: null, packageId: null }); setMode('sell'); setError(''); setOpen(true); };
  const save = () => {
    const svc = props.services.find((x) => x.id === pf.serviceId);
    const uses = parseInt(pf.uses, 10);
    const name = pf.name.trim() || (svc && uses ? uses + ' x ' + svc.name : '');
    startT(async () => {
      const r = await savePackage({ id: mode === 'edit' ? typeId ?? undefined : undefined, name, serviceId: pf.serviceId, uses, price: pf.price, validDays: pf.validDays });
      if (r.error) { setError(r.error); return; }
      setTab('types'); close(); router.refresh();
    });
  };
  const archive = (t: PkgType) => startT(async () => { const r = await setPackageActive(t.id, !t.active); if (r.error) { setError(r.error); return; } close(); router.refresh(); });
  const sell = () => {
    if (!sf.client.trim()) { setError("Add the client's name."); return; }
    if (!sf.packageId) { setError('Choose a package.'); return; }
    startT(async () => {
      const r = await sellPackage(sf.client, sf.clientId, sf.packageId!);
      if (r.error || !r.saleId) { setError(r.error ?? 'Could not start the sale.'); return; }
      router.push(`/sales?sale=${r.saleId}&pay=1`);
    });
  };
  return { ...props, allTypes: props.types, allSold: props.sold, busy, narrow, tab, setTab, query, setQuery, mode, open, sel, typeId, error, setError, pf, setPf, sf, setSf, sold, types, live, visitsLeft, owed, soldM, activeTypes, close, pick, openNew, openEdit, openSell, save, archive, sell };
}
type C = ReturnType<typeof usePackages>;

function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} style={S('display:block;box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{label}</span>{children}</label>;
}
const FIELD_IN = { ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), minHeight: 0, borderRadius: 0 } as const;

/** Create or change a package. */
function PackageForm({ c }: { c: C }) {
  const { pf, setPf } = c;
  const edit = c.mode === 'edit' ? c.allTypes.find((t) => t.id === c.typeId) : undefined;
  const svc = c.services.find((x) => x.id === pf.serviceId);
  const uses = parseInt(pf.uses, 10) || 0;
  const price = Math.round(parseFloat(pf.price.replace(/[^0-9.]/g, '')) * 100) || 0;
  const normal = svc && uses ? svc.priceCents * uses : 0;
  const save = normal > price && price > 0 ? normal - price : 0;
  const set = (p: Partial<Form>) => { setPf({ ...pf, ...p }); c.setError(''); };
  return (
    <StepShell plain step={0} titles={[c.mode === 'new' ? 'New package' : 'Edit package']} onBack={c.close} onClose={c.close} error={c.error}
      actions={[{ label: 'Save package', onClick: c.save, disabled: c.busy }]}>
      <Field label="Name" htmlFor="pk-name"><input id="pk-name" maxLength={80} value={pf.name} onChange={(e) => set({ name: e.target.value })} placeholder={svc && uses ? uses + ' x ' + svc.name : 'For example, 5 blow dries'} style={FIELD_IN} /></Field>
      <div role="group" aria-label="Service" style={S('display:flex;flex-direction:column;gap:2px')}>
        <span style={S('font-size:14px;font-weight:600;margin-bottom:8px')}>Service</span>
        {c.services.map((x) => { const on = pf.serviceId === x.id; return (
          <button key={x.id} onClick={() => set({ serviceId: x.id })} aria-pressed={on} style={S(ROW(on))}>
            <span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600;overflow-wrap:anywhere;text-align:left')}>{x.name}</span>
            <span style={S('flex:0 0 auto;font-size:14px;color:#5E6673')}>{money(x.priceCents)}</span>
            {on && TICK}
          </button>
        ); })}
      </div>
      <div role="group" aria-label="Visits" style={S('display:flex;flex-direction:column;gap:10px')}>
        <span style={S('font-size:14px;font-weight:600')}>Number of visits</span>
        <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>{[3, 5, 10].map((n) => <button key={n} onClick={() => set({ uses: String(n) })} aria-pressed={uses === n} style={S(chip(uses === n, true))}>{n}</button>)}</div>
        <input aria-label="Custom number of visits" inputMode="numeric" value={pf.uses} onChange={(e) => set({ uses: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} placeholder="Or enter a number" style={{ ...S(FIELD), minHeight: 0 }} />
      </div>
      <Field label="Price for the whole package" htmlFor="pk-price"><input id="pk-price" inputMode="decimal" value={pf.price} onChange={(e) => set({ price: decimalInput(e.target.value) })} placeholder="For example, 200" style={FIELD_IN} /></Field>
      {normal > 0 && <p style={S('margin:-6px 0 0;font-size:13px;color:#5E6673')}>{uses} visits at the usual price come to {money(normal)}.{save > 0 ? ' Clients save ' + money(save) + '.' : ''}</p>}
      <div role="group" aria-label="Valid for" style={S('display:flex;flex-direction:column;gap:10px')}>
        <span style={S('font-size:14px;font-weight:600')}>Valid for</span>
        <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>{VALID.map(([d, l]) => <button key={l} onClick={() => set({ validDays: d })} aria-pressed={pf.validDays === d} style={S(chip(pf.validDays === d, true))}>{l}</button>)}</div>
        <span style={S('font-size:13px;color:#5E6673')}>Counted from the day the package is paid for.</span>
      </div>
      {edit && <button className="ghost" onClick={() => c.archive(edit)} disabled={c.busy} style={S('height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer')}>{edit.active ? 'Stop offering this package' : 'Offer this package again'}</button>}
      {edit && edit.sold > 0 && <p style={S('margin:0;font-size:13px;color:#5E6673')}>{edit.sold} {edit.sold === 1 ? 'client has' : 'clients have'} bought this. Changes only affect new sales.</p>}
    </StepShell>
  );
}

/** Sell a package: client, package, then on to the Sales page to take payment. */
function SellFlow({ c }: { c: C }) {
  const { sf, setSf } = c;
  const kinds = ['client', 'package', 'summary'] as const;
  const last = kinds.length - 1;
  const { step, jump, forward, back } = useSteps(last, () => c.setError(''));
  const kind = kinds[step];
  const titles: Record<string, string> = { client: 'Select client', package: 'Select package', summary: 'Summary' };
  const pk = c.activeTypes.find((t) => t.id === sf.packageId) ?? null;
  const next = () => {
    const e = kind === 'client' && !sf.client.trim() ? "Add the client's name." : kind === 'package' && !sf.packageId ? 'Choose a package.' : '';
    if (e) { c.setError(e); return; }
    forward();
  };
  return (
    <StepShell step={step} titles={kinds.map((k) => titles[k])} onBack={back} onClose={c.close} error={c.error}
      actions={kind === 'summary' ? [{ label: 'Continue to payment', onClick: c.sell, disabled: c.busy }] : [{ label: 'Continue', onClick: next }]}>
      {kind === 'client' && <ClientStep name={sf.client} clientId={sf.clientId} recent={c.recent} onChange={(name, id) => { setSf({ ...sf, client: name, clientId: id }); c.setError(''); }} />}
      {kind === 'package' && (
        <div role="group" aria-label="Package" style={S('display:flex;flex-direction:column')}>
          {!c.activeTypes.length && <p style={S('margin:0;color:#5E6673;font-size:14px')}>{c.canEdit ? 'No packages yet. Close this and create one first.' : 'No packages yet. Ask the owner to set one up.'}</p>}
          {c.activeTypes.map((t) => { const on = sf.packageId === t.id; return (
            <button key={t.id} onClick={() => { setSf({ ...sf, packageId: on ? null : t.id }); c.setError(''); }} aria-pressed={on} style={S(ROW(on))}>
              <span style={S('flex:1 1 auto;min-width:0;text-align:left')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{t.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{t.uses + ' x ' + t.service}</span></span>
              <span style={S('flex:0 0 auto;font-size:14px;color:#5E6673')}>{money(t.priceCents)}</span>
              {on && TICK}
            </button>
          ); })}
        </div>
      )}
      {kind === 'summary' && (<>
        <ClientCard name={sf.client} existing={!!sf.clientId} onChange={() => jump(0)} />
        <DetailRows go={jump} rows={[{ icon: ICONS.tag, text: pk ? pk.name + ', ' + pk.uses + ' visits' : 'No package', step: 1 }]} />
        <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:4px 4px 0')}><span style={S('font-size:15px;font-weight:600')}>Total</span><span style={S('font-size:24px;font-weight:600;letter-spacing:-0.02em')}>{pk ? money(pk.priceCents) : '$0'}</span></div>
        <p style={S('margin:0;font-size:13px;color:#5E6673')}>Next you choose how they pay. The visits can be used once it is paid.</p>
      </>)}
    </StepShell>
  );
}

/** What a client has left on a package they bought. */
function Detail({ c, m }: { c: C; m: boolean }) {
  const s = c.sel;
  if (!s) return null;
  const rowCss = 'display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3';
  const pct = s.uses ? Math.round(s.left / s.uses * 100) : 0;
  return (
    <div style={S('display:flex;flex-direction:column;gap:20px')}>
      <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
        <span style={S(pill(s.status))}>{s.status}</span>
        <button onClick={c.close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button>
      </div>
      <div style={S('box-sizing:border-box;border-radius:20px;background:#0E1116;color:#FFFFFF;padding:' + (m ? 22 : 24) + 'px;display:flex;flex-direction:column;gap:20px')}>
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><span style={S('font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{s.name}</span><span style={S('flex:0 0 auto;font-size:12.5px;color:#C4C9D2')}>Package</span></div>
        <div><div style={S('font-size:12.5px;color:#C4C9D2')}>Visits left</div><div style={S('margin-top:2px;font-size:' + (m ? 36 : 40) + 'px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{s.left} <span style={S('font-size:18px;color:#C4C9D2')}>of {s.uses}</span></div></div>
        <span style={S('display:block;height:6px;border-radius:999px;background:#2A3039')}><span style={S('display:block;height:6px;border-radius:999px;background:#FFFFFF;width:' + pct + '%')} /></span>
      </div>
      {s.status === 'Unpaid' && <p style={S('margin:0;padding:12px 14px;border-radius:14px;background:#FFEBD0;color:#7A4204;font-size:13.5px')}>This package has not been paid for yet. Take payment on the Sales page and the visits will be ready to use.</p>}
      <dl style={S('margin:0;display:flex;flex-direction:column')}>
        <div style={S(rowCss)}><dt style={S('color:#5E6673')}>Client</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{s.client}</dd></div>
        <div style={S(rowCss)}><dt style={S('color:#5E6673')}>Bought</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{dLong(s.bought)}</dd></div>
        <div style={S(rowCss)}><dt style={S('color:#5E6673')}>Expires</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{s.expires ? dLong(s.expires) : 'Never'}</dd></div>
        <div style={S(rowCss + ';border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Paid</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{money(s.priceCents)}</dd></div>
      </dl>
      <section aria-label="Visits used" style={S('display:flex;flex-direction:column;gap:4px')}>
        <h3 style={S('margin:0 0 4px;font-size:15px;font-weight:600')}>Visits used</h3>
        {!s.used.length && <p style={S('margin:0;color:#5E6673;font-size:14px')}>None yet.</p>}
        <ul style={S('margin:0;padding:0;list-style:none')}>{s.used.map((d, i) => <li key={i} style={S('padding:10px 0;border-top:1px solid #EEF0F3;font-size:14px;font-weight:500')}>{dLong(d)}</li>)}</ul>
      </section>
    </div>
  );
}

const barOf = (left: number, uses: number) => <span style={S('display:block;margin-top:6px;height:6px;border-radius:999px;background:#EEF0F3')}><span style={S('display:block;height:6px;border-radius:999px;background:#0E1116;width:' + (uses ? Math.round(left / uses * 100) : 0) + '%')} /></span>;
const expText = (s: PkgSold) => (s.status === 'Unpaid' || s.status === 'Refunded' ? s.status : s.expires ? (s.status === 'Expired' ? 'Expired ' : 'Until ') + dShort(s.expires) : 'No expiry');

function TypeCard({ t, c }: { t: PkgType; c: C }) {
  const normal = t.servicePriceCents * t.uses, save = normal > t.priceCents ? normal - t.priceCents : 0;
  const body = (<>
    <span style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><span style={S('font-size:16px;font-weight:600;overflow-wrap:anywhere;text-align:left')}>{t.name}</span>{!t.active && <span style={S(pill('Archived'))}>Archived</span>}</span>
    <span style={S('font-size:13.5px;color:#5E6673;text-align:left')}>{t.uses + ' x ' + t.service + ', ' + (t.validDays ? 'valid ' + validText(t.validDays) : 'no expiry')}</span>
    <span style={S('display:flex;align-items:baseline;justify-content:space-between;gap:12px')}><span style={S('font-size:22px;font-weight:600;letter-spacing:-0.02em')}>{money(t.priceCents)}</span><span style={S('font-size:12.5px;color:#5E6673')}>{save ? 'Saves ' + money(save) + ', ' : ''}{t.sold + ' sold'}</span></span>
  </>);
  const css = 'display:flex;flex-direction:column;gap:8px;width:100%;box-sizing:border-box;padding:16px 18px;border:1px solid #E6E8EC;border-radius:20px;background:#FFFFFF;font:inherit;color:#0E1116;opacity:' + (t.active ? 1 : 0.7);
  return c.canEdit ? <button className="ghost" onClick={() => c.openEdit(t)} aria-label={'Edit ' + t.name} style={S(css + ';cursor:pointer')}>{body}</button> : <div style={S(css)}>{body}</div>;
}

const noneSold = (c: C) => (c.allSold.length === 0 ? 'No packages sold yet.' : 'No packages match.');

function Desktop({ c }: { c: C }) {
  const stat = (l: string, v: string) => <div key={l}><div style={S('color:#5E6673;font-size:13.5px')}>{l}</div><div style={S('margin-top:4px;font-size:38px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div></div>;
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 32px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Packages" subtitle="Prepaid bundles of a service" query={c.query} onQuery={c.setQuery} placeholder="Search client or package" actionLabel="Sell package" onAction={c.openSell} />
      <section aria-label="Packages at a glance" style={S('display:flex;flex-wrap:wrap;gap:20px 64px')}>
        {stat('Active packages', String(c.live.length))}{stat('Visits left', String(c.visitsLeft))}{stat('Prepaid value left', money(c.owed))}{stat('Sold this month', money(c.soldM))}
      </section>
      <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px')}>
        <div role="tablist" aria-label="Packages view" style={S('display:flex;gap:8px')}>{([['sold', 'Sold to clients'], ['types', 'Your packages']] as const).map(([id, l]) => <button key={id} role="tab" aria-selected={c.tab === id} onClick={() => c.setTab(id)} style={S(chip(c.tab === id, false))}>{l}</button>)}</div>
        {c.canEdit && c.tab === 'types' && <button onClick={c.openNew} style={S('height:44px;padding:0 22px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:14px;font-weight:500;cursor:pointer')}>New package</button>}
      </div>
      {c.tab === 'sold' ? (
        <section aria-label="Packages sold" style={S('background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
          <div style={S('display:flex;align-items:center;gap:16px;padding:12px 20px;border-bottom:1px solid #EEF0F3;color:#5E6673;font-size:12.5px;font-weight:500')}>
            <div style={S('flex:1.6 1 0;min-width:0')}>Client</div><div style={S('flex:1.6 1 0;min-width:0')}>Package</div><div style={S('flex:1.4 1 0;min-width:0')}>Visits left</div><div style={S('flex:1 1 0;min-width:0')}>Bought</div><div style={S('flex:1.2 1 0;min-width:0')}>Expires</div><div style={S('flex:0.9 1 0;min-width:0')}>Status</div>
          </div>
          <ul style={S('margin:0;padding:0;list-style:none')}>
            {c.sold.map((s) => (
              <li key={s.id}><button className="row" onClick={() => c.pick(s.id)} aria-label={`${s.client}, ${s.name}, ${s.left} of ${s.uses} left, ${s.status}`} style={S('display:flex;align-items:center;gap:16px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 20px;border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;color:#0E1116;background:transparent;cursor:pointer')}>
                <span style={S('flex:1.6 1 0;min-width:0;font-weight:500;overflow-wrap:anywhere')}>{s.client}</span>
                <span style={S('flex:1.6 1 0;min-width:0;overflow-wrap:anywhere')}>{s.name}</span>
                <span style={S('flex:1.4 1 0;min-width:0')}><span style={S('display:block;font-weight:600')}>{s.left} of {s.uses}</span>{barOf(s.left, s.uses)}</span>
                <span style={S('flex:1 1 0;min-width:0;color:#5E6673')}>{dShort(s.bought)}</span>
                <span style={S('flex:1.2 1 0;min-width:0;color:#5E6673')}>{expText(s)}</span>
                <span style={S('flex:0.9 1 0;min-width:0')}><span style={S(pill(s.status))}>{s.status}</span></span>
              </button></li>
            ))}
          </ul>
          {c.sold.length === 0 && <p style={S('margin:0;padding:28px 20px;color:#5E6673;font-size:14px')}>{noneSold(c)}</p>}
        </section>
      ) : (
        <section aria-label="Your packages" style={S('display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px')}>
          {c.types.map((t) => <TypeCard key={t.id} t={t} c={c} />)}
          {c.types.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>{c.canEdit ? 'No packages yet. Create your first one.' : 'No packages yet.'}</p>}
        </section>
      )}
      {c.open && <Mobile c={c} drawer />}
    </div>
  );
}

function Mobile({ c, drawer }: { c: C; drawer?: boolean }) {
  const stat = (l: string, v: string) => <div key={l} style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:20px;padding:16px')}><div style={S('color:#5E6673;font-size:13px')}>{l}</div><div style={S('margin-top:4px;font-size:26px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{v}</div></div>;
  return (
    <div className={rootCls(drawer)} style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Packages" subtitle="Prepaid bundles of a service" query={c.query} onQuery={c.setQuery} placeholder="Search client or package" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <section aria-label="Packages at a glance" style={S('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px')}>
          {stat('Active packages', String(c.live.length))}{stat('Visits left', String(c.visitsLeft))}{stat('Prepaid value left', money(c.owed))}{stat('Sold this month', money(c.soldM))}
        </section>
        <div style={S('display:flex;gap:10px')}>
          <button onClick={c.openSell} style={S('flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:14.5px;font-weight:500')}>Sell package</button>
          {c.canEdit && <button className="ghost" onClick={c.openNew} style={S('flex:1 1 0;height:52px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14.5px;font-weight:500')}>New package</button>}
        </div>
        <div role="tablist" aria-label="Packages view" className="hscroll" style={S('display:flex;gap:8px')}>{([['sold', 'Sold to clients'], ['types', 'Your packages']] as const).map(([id, l]) => <button key={id} role="tab" aria-selected={c.tab === id} onClick={() => c.setTab(id)} style={S(chip(c.tab === id, true))}>{l}</button>)}</div>
        {c.tab === 'sold' ? (<>
          {c.sold.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>{noneSold(c)}</p>}
          <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px')}>
            {c.sold.map((s) => (
              <li key={s.id}><button className="ghost" onClick={() => c.pick(s.id)} aria-label={`${s.client}, ${s.name}, ${s.left} of ${s.uses} left, ${s.status}`} style={S('display:flex;flex-direction:column;gap:10px;width:100%;box-sizing:border-box;padding:16px 18px;border:1px solid #E6E8EC;border-radius:20px;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
                <span style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><span style={S('font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{s.client}</span><span style={S(pill(s.status))}>{s.status}</span></span>
                <span style={S('font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{s.name}</span>
                <span style={S('display:flex;align-items:baseline;justify-content:space-between;gap:12px')}><span style={S('font-size:18px;font-weight:600;letter-spacing:-0.01em')}>{s.left} of {s.uses} left</span><span style={S('font-size:12.5px;color:#5E6673')}>{expText(s)}</span></span>
                {barOf(s.left, s.uses)}
              </button></li>
            ))}
          </ul>
        </>) : (
          <div style={S('display:flex;flex-direction:column;gap:12px')}>
            {c.types.map((t) => <TypeCard key={t.id} t={t} c={c} />)}
            {c.types.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>{c.canEdit ? 'No packages yet. Create your first one.' : 'No packages yet.'}</p>}
          </div>
        )}
      </main>
      <MobileTabs active="more" />
      {c.open && (
        <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:5')}>
          <button onClick={c.close} aria-label="Close" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
          <div className="sheet" role="dialog" aria-label="Package" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:90%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:18px')}>
            <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0')} />
            {c.mode === 'new' || c.mode === 'edit' ? <PackageForm c={c} /> : c.mode === 'sell' ? <SellFlow c={c} /> : <Detail c={c} m={true} />}
          </div>
        </div>
      )}
    </div>
  );
}

export function PackagesView(props: Props) {
  const c = usePackages(props);
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
