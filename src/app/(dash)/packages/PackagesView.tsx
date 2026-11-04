'use client';
import { BLACK, BLACK_SM, Chip, FIELD_IN, Field, FilterChip, Icon, KV_ROW, Note, Notice, OUTLINE, Stat, StatCard, dim } from '@/components/ui';
import { dayInfo } from '@/lib/cal';
import { plural } from '@/lib/display';
import { TONE, type ToneName } from '@/lib/tones';
import { BottomSheet } from '@/components/BottomSheet';
import { dollars, toCents } from '@/lib/format';
import { rootCls } from '@/components/drawer';
import { decimalInput } from '@/lib/numeric';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { CLOSE_BTN, CloseX } from '../calendar/calUi';
import { ClientCard, ClientStep, DetailRows, ICONS, ROW, StepShell, TICK, Tiles, useSteps } from '../calendar/wizardUi';
import { savePackage, sellPackage, setPackageActive } from './actions';

export type PkgType = { id: string; name: string; serviceId: string; service: string; servicePriceCents: number; uses: number; priceCents: number; validDays: number | null; active: boolean; sold: number };
export type PkgSold = { id: string; clientId: string; client: string; packageId: string; name: string; uses: number; left: number; priceCents: number; status: 'Active' | 'Unpaid' | 'Used up' | 'Expired' | 'Refunded'; bought: string; expires: string; used: string[] };
type Props = { types: PkgType[]; sold: PkgSold[]; services: { id: string; name: string; priceCents: number }[]; recent: { id: string; name: string; phone?: string }[]; canEdit: boolean; month: string };
type Form = { name: string; serviceId: string; uses: string; price: string; validDays: number | null };

/** Dates in the one house style; the year is added only when it is not this year (month is this month, "2026-11"). */
const withYear = (s: string, text: string, month: string) => (s.slice(0, 4) !== month.slice(0, 4) ? text + ' ' + s.slice(0, 4) : text);
const dShort = (s: string, month: string) => withYear(s, dayInfo(s).short, month);
const dLong = (s: string, month: string) => withYear(s, dayInfo(s).full, month);
const VALID: [number | null, string][] = [[null, 'No expiry'], [90, '3 months'], [180, '6 months'], [365, '1 year']];
const validText = (d: number | null) => VALID.find((v) => v[0] === d)?.[1] ?? d + ' days';
/** The chip colour of each package state: active is green, unpaid is amber, refunded and expired are red. */
const TONE_OF: Record<string, ToneName> = { Active: 'green', Unpaid: 'amber', 'Used up': 'grey', Expired: 'red', Refunded: 'red', Archived: 'grey' };
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
  const [notice, setNotice] = useState('');
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
  const pick = (id: string) => { setSelId(id); setMode('view'); setError(''); setNotice(''); setOpen(true); };
  const openNew = () => { setPf(BLANK); setTypeId(null); setMode('new'); setError(''); setNotice(''); setOpen(true); };
  const openEdit = (t: PkgType) => { setNotice(''); setPf({ name: t.name, serviceId: t.serviceId, uses: String(t.uses), price: String(t.priceCents / 100), validDays: t.validDays }); setTypeId(t.id); setMode('edit'); setError(''); setOpen(true); };
  const openSell = () => { setNotice(''); setSf({ client: '', clientId: null, packageId: null }); setMode('sell'); setError(''); setOpen(true); };
  const save = () => {
    const svc = props.services.find((x) => x.id === pf.serviceId);
    const uses = parseInt(pf.uses, 10);
    const name = pf.name.trim() || (svc && uses ? uses + ' x ' + svc.name : '');
    startT(async () => {
      const r = await savePackage({ id: mode === 'edit' ? typeId ?? undefined : undefined, name, serviceId: pf.serviceId, uses, price: pf.price, validDays: pf.validDays });
      if (r.error) { setError(r.error); return; }
      setTab('types'); close(); setNotice('Package saved'); router.refresh();
    });
  };
  const archive = (t: PkgType) => startT(async () => { const r = await setPackageActive(t.id, !t.active); if (r.error) { setError(r.error); return; } close(); setNotice(t.active ? 'No longer offering this package' : 'Offering this package again'); router.refresh(); });
  const sell = () => {
    if (!sf.client.trim()) { setError("Add the client's name."); return; }
    if (!sf.packageId) { setError('Choose a package.'); return; }
    startT(async () => {
      const r = await sellPackage(sf.client, sf.clientId, sf.packageId!);
      if (r.error || !r.saleId) { setError(r.error ?? 'Could not start the sale.'); return; }
      router.push(`/sales?sale=${r.saleId}&pay=1`);
    });
  };
  return { ...props, allTypes: props.types, allSold: props.sold, busy, narrow, tab, setTab, query, setQuery, mode, open, sel, typeId, error, setError, notice, pf, setPf, sf, setSf, sold, types, live, visitsLeft, owed, soldM, activeTypes, close, pick, openNew, openEdit, openSell, save, archive, sell };
}
type C = ReturnType<typeof usePackages>;

/** Create or change a package, one question at a time, ending in a summary. A package being changed opens on the summary. */
function PackageForm({ c }: { c: C }) {
  const { pf, setPf } = c;
  const editing = c.mode === 'edit';
  const edit = editing ? c.allTypes.find((t) => t.id === c.typeId) : undefined;
  const kinds = ['service', 'visits', 'price', 'valid', 'name', 'summary'] as const;
  const last = kinds.length - 1;
  const { step, jump, forward, back } = useSteps(last, () => c.setError(''), editing ? last : 0);
  const kind = kinds[step];
  const at = (k: string) => (kinds as readonly string[]).indexOf(k);
  const titles: Record<string, string> = { service: 'Which service?', visits: 'Number of visits', price: 'Price', valid: 'Valid for', name: 'Name', summary: 'Summary' };
  const svc = c.services.find((x) => x.id === pf.serviceId);
  const uses = parseInt(pf.uses, 10) || 0;
  const price = toCents(pf.price);
  const normal = svc && uses ? svc.priceCents * uses : 0;
  const saves = normal > price && price > 0 ? normal - price : 0;
  const autoName = svc && uses ? uses + ' x ' + svc.name : '';
  const [custom, setCustom] = useState(() => !['3', '5', '10'].includes(pf.uses));
  const set = (p: Partial<Form>) => { setPf({ ...pf, ...p }); c.setError(''); };
  const next = () => {
    const e = kind === 'service' && !pf.serviceId ? 'Choose a service.' : kind === 'visits' && (uses < 2 || uses > 100) ? 'Choose between 2 and 100 visits.' : kind === 'price' && price < 1 ? 'Enter a price above zero, like 200 or 199.50.' : '';
    if (e) { c.setError(e); return; }
    forward();
  };
  const validKey = pf.validDays === null ? 'none' : String(pf.validDays);
  return (
    <StepShell step={step} titles={kinds.map((k) => titles[k])} onBack={step === 0 || (editing && step === last) ? c.close : back} onClose={c.close} error={c.error}
      actions={kind === 'summary' ? [{ label: c.busy ? 'Saving…' : editing ? 'Save changes' : 'Add package', onClick: c.save, disabled: c.busy }] : [{ label: 'Continue', onClick: next }]}>
      {kind === 'service' && (
        <div role="group" aria-label="Service" style={S('display:flex;flex-direction:column')}>
          {c.services.map((x) => { const on = pf.serviceId === x.id; return (
            <button key={x.id} onClick={() => set({ serviceId: on ? '' : x.id })} aria-pressed={on} style={S(ROW(on))}>
              <span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600;overflow-wrap:anywhere;text-align:left')}>{x.name}</span>
              <span style={S('flex:0 0 auto;font-size:14px;color:#5E6673')}>{dollars(x.priceCents)}</span>
              {on && TICK}
            </button>
          ); })}
        </div>
      )}
      {kind === 'visits' && (<>
        <Tiles label="Number of visits" options={[['3', '3 visits'], ['5', '5 visits'], ['10', '10 visits'], ['custom', 'Custom']] as const} value={custom ? 'custom' : pf.uses}
          onPick={(v) => { if (v === 'custom') { setCustom(true); set({ uses: '' }); } else { setCustom(false); set({ uses: v }); } }} />
        {custom && <Field label="Number of visits" htmlFor="pk-uses"><input id="pk-uses" inputMode="numeric" value={pf.uses} onChange={(e) => set({ uses: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} placeholder="Between 2 and 100" style={FIELD_IN} /></Field>}
      </>)}
      {kind === 'price' && (<>
        <Field label="Price for the whole package" htmlFor="pk-price"><input id="pk-price" inputMode="decimal" value={pf.price} onChange={(e) => set({ price: decimalInput(e.target.value) })} placeholder="For example, 200" style={FIELD_IN} /></Field>
        {normal > 0 && <p style={S('margin:0;font-size:13.5px;color:#5E6673')}>{uses} visits at the usual price come to {dollars(normal)}.{saves > 0 ? ' Clients save ' + dollars(saves) + '.' : ''}</p>}
      </>)}
      {kind === 'valid' && (<>
        <Tiles label="Valid for" options={VALID.map(([d, l]) => [d === null ? 'none' : String(d), l] as const)} value={validKey} onPick={(v) => set({ validDays: v === 'none' ? null : parseInt(v, 10) })} />
        <p style={S('margin:0;font-size:13.5px;color:#5E6673')}>Counted from the day the package is paid for.</p>
      </>)}
      {kind === 'name' && (<>
        <Field label="Name" htmlFor="pk-name"><input id="pk-name" maxLength={80} value={pf.name} onChange={(e) => set({ name: e.target.value })} placeholder={autoName || 'For example, 5 blow dries'} style={FIELD_IN} /></Field>
        <p style={S('margin:0;font-size:13.5px;color:#5E6673')}>Leave it empty to call it {autoName ? '"' + autoName + '"' : 'by its visits and service'}.</p>
      </>)}
      {kind === 'summary' && (<>
        <DetailRows go={jump} rows={[
          { icon: ICONS.scissors, text: svc ? svc.name : 'No service', step: at('service') },
          { icon: ICONS.tag, text: plural(uses, 'visit'), step: at('visits') },
          { icon: ICONS.tag, text: price ? dollars(price) : 'No price', step: at('price') },
          { icon: ICONS.time, text: pf.validDays === null ? 'No expiry' : 'Valid ' + validText(pf.validDays), step: at('valid') },
          { icon: ICONS.person, text: pf.name.trim() || autoName || 'No name', step: at('name') },
        ]} />
        {edit && edit.sold > 0 && <p style={S('margin:0;font-size:13.5px;color:#5E6673')}>{edit.sold} {edit.sold === 1 ? 'client has' : 'clients have'} bought this. Changes only affect new sales.</p>}
        {edit && <button className="ghost" onClick={() => c.archive(edit)} disabled={c.busy} style={S(OUTLINE + ';flex:0 0 auto' + dim(c.busy))}>{edit.active ? 'Stop offering this package' : 'Offer this package again'}</button>}
      </>)}
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
          {!c.activeTypes.length && <Note>{c.canEdit ? 'No packages yet. Close this and create one first.' : 'No packages yet. Ask the owner to set one up.'}</Note>}
          {c.activeTypes.map((t) => { const on = sf.packageId === t.id; return (
            <button key={t.id} onClick={() => { setSf({ ...sf, packageId: on ? null : t.id }); c.setError(''); }} aria-pressed={on} style={S(ROW(on))}>
              <span style={S('flex:1 1 auto;min-width:0;text-align:left')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{t.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{t.uses + ' x ' + t.service}</span></span>
              <span style={S('flex:0 0 auto;font-size:14px;color:#5E6673')}>{dollars(t.priceCents)}</span>
              {on && TICK}
            </button>
          ); })}
        </div>
      )}
      {kind === 'summary' && (<>
        <ClientCard name={sf.client} existing={!!sf.clientId} onChange={() => jump(0)} />
        <DetailRows go={jump} rows={[{ icon: ICONS.tag, text: pk ? pk.name + ', ' + pk.uses + ' visits' : 'No package', step: 1 }]} />
        <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:4px 4px 0')}><span style={S('font-size:15px;font-weight:600')}>Total</span><span style={S('font-size:24px;font-weight:600;letter-spacing:-0.02em')}>{pk ? dollars(pk.priceCents) : '$0'}</span></div>
        <p style={S('margin:0;font-size:13px;color:#5E6673')}>Next you choose how they pay. The visits can be used once it is paid.</p>
      </>)}
    </StepShell>
  );
}

/** What a client has left on a package they bought. */
function Detail({ c }: { c: C }) {
  const s = c.sel;
  if (!s) return null;
  const rowCss = KV_ROW;
  const pct = s.uses ? Math.round(s.left / s.uses * 100) : 0;
  return (
    <div style={S('display:flex;flex-direction:column;gap:20px')}>
      <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
        <Chip tone={TONE_OF[s.status]}>{s.status}</Chip>
        <button onClick={c.close} aria-label="Close" style={S(CLOSE_BTN)}><CloseX /></button>
      </div>
      <div style={S('box-sizing:border-box;border-radius:20px;background:#0E1116;color:#FFFFFF;padding:22px;display:flex;flex-direction:column;gap:20px')}>
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><span style={S('font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{s.name}</span><span style={S('flex:0 0 auto;font-size:12.5px;color:#C4C9D2')}>Package</span></div>
        <div><div style={S('font-size:12.5px;color:#C4C9D2')}>Visits left</div><div style={S('margin-top:2px;font-size:36px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{s.left} <span style={S('font-size:18px;color:#C4C9D2')}>of {s.uses}</span></div></div>
        <span style={S('display:block;height:6px;border-radius:999px;background:#2A3039')}><span style={S('display:block;height:6px;border-radius:999px;background:#FFFFFF;width:' + pct + '%')} /></span>
      </div>
      {s.status === 'Unpaid' && <p style={S('margin:0;padding:12px 14px;border-radius:14px;background:' + TONE.amber.bg + ';color:' + TONE.amber.fg + ';font-size:13.5px')}>This package has not been paid for yet. Take payment on the Sales page and the visits will be ready to use.</p>}
      <dl style={S('margin:0;display:flex;flex-direction:column')}>
        <div style={S(rowCss)}><dt style={S('color:#5E6673')}>Client</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{s.client}</dd></div>
        <div style={S(rowCss)}><dt style={S('color:#5E6673')}>Bought</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{dLong(s.bought, c.month)}</dd></div>
        <div style={S(rowCss)}><dt style={S('color:#5E6673')}>Expires</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{s.expires ? dLong(s.expires, c.month) : 'Never'}</dd></div>
        <div style={S(rowCss + ';border-bottom:1px solid #EEF0F3')}><dt style={S('color:#5E6673')}>Paid</dt><dd style={S('margin:0;font-weight:500;text-align:right')}>{dollars(s.priceCents)}</dd></div>
      </dl>
      <section aria-label="Visits used" style={S('display:flex;flex-direction:column;gap:4px')}>
        <h3 style={S('margin:0 0 4px;font-size:15px;font-weight:600')}>Visits used</h3>
        {!s.used.length && <Note>None yet.</Note>}
        <ul style={S('margin:0;padding:0;list-style:none')}>{s.used.map((d, i) => <li key={i} style={S('padding:10px 0;border-top:1px solid #EEF0F3;font-size:14px;font-weight:500')}>{dLong(d, c.month)}</li>)}</ul>
      </section>
    </div>
  );
}

const barOf = (left: number, uses: number) => <span style={S('display:block;margin-top:6px;height:6px;border-radius:999px;background:#EEF0F3')}><span style={S('display:block;height:6px;border-radius:999px;background:#0E1116;width:' + (uses ? Math.round(left / uses * 100) : 0) + '%')} /></span>;
const expText = (s: PkgSold, month: string) => (s.status === 'Unpaid' || s.status === 'Refunded' ? s.status : s.expires ? (s.status === 'Expired' ? 'Expired ' : 'Until ') + dShort(s.expires, month) : 'No expiry');

function TypeCard({ t, c }: { t: PkgType; c: C }) {
  const normal = t.servicePriceCents * t.uses, save = normal > t.priceCents ? normal - t.priceCents : 0;
  const body = (<>
    <span style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><span style={S('font-size:16px;font-weight:600;overflow-wrap:anywhere;text-align:left')}>{t.name}</span>{!t.active && <Chip tone={TONE_OF.Archived}>Archived</Chip>}</span>
    <span style={S('font-size:13.5px;color:#5E6673;text-align:left')}>{t.uses + ' x ' + t.service + ', ' + (t.validDays ? 'valid ' + validText(t.validDays) : 'no expiry')}</span>
    <span style={S('display:flex;align-items:baseline;justify-content:space-between;gap:12px')}><span style={S('font-size:22px;font-weight:600;letter-spacing:-0.02em')}>{dollars(t.priceCents)}</span><span style={S('font-size:12.5px;color:#5E6673')}>{save ? 'Saves ' + dollars(save) + ', ' : ''}{t.sold + ' sold'}</span></span>
  </>);
  const css = 'display:flex;flex-direction:column;gap:8px;width:100%;box-sizing:border-box;padding:16px 18px;border:1px solid #E6E8EC;border-radius:20px;background:#FFFFFF;font:inherit;color:#0E1116;opacity:' + (t.active ? 1 : 0.7);
  return c.canEdit ? <button className="ghost" onClick={() => c.openEdit(t)} aria-label={'Edit ' + t.name} style={S(css + ';cursor:pointer')}>{body}</button> : <div style={S(css)}>{body}</div>;
}

const noneSold = (c: C) => (c.allSold.length === 0 ? 'No packages sold yet.' : 'No packages match.');

function Desktop({ c }: { c: C }) {
  const stat = (l: string, v: string) => <Stat key={l} label={l} value={v} />;
  const th = (l: string, f: string) => <div key={l} style={S('flex:' + f + ' 1 0;min-width:0')}>{l}</div>;
  const rowCss = 'display:flex;align-items:center;gap:16px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 20px;border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;color:#0E1116;background:transparent';
  const count = c.tab === 'sold' ? plural(c.sold.length, 'package') : plural(c.types.length, 'type');
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 32px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Packages" subtitle="Prepaid bundles of a service" query={c.query} onQuery={c.setQuery} placeholder="Search client or package" actionLabel="Sell package" onAction={c.openSell} />
      <section aria-label="Packages at a glance" style={S('display:flex;flex-wrap:wrap;gap:20px 64px')}>
        {stat('Active packages', String(c.live.length))}{stat('Visits left', String(c.visitsLeft))}{stat('Prepaid value left', dollars(c.owed))}{stat('Sold this month', dollars(c.soldM))}
      </section>
      {!!c.notice && <Notice>{c.notice}</Notice>}
      <section aria-label="Packages" style={S('background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
        <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E6E8EC')}>
          <div role="group" aria-label="Packages view" style={S('display:flex;flex-wrap:wrap;gap:8px')}>{([['sold', 'Sold to clients'], ['types', 'Your packages']] as const).map(([id, l]) => <FilterChip key={id} on={c.tab === id} onClick={() => c.setTab(id)}>{l}</FilterChip>)}</div>
          <div style={S('display:flex;align-items:center;gap:16px')}>
            <span style={S('color:#5E6673;font-size:13.5px')}>{count}</span>
            {c.canEdit && c.tab === 'types' && <button onClick={c.openNew} style={S(BLACK_SM)}>New package</button>}
          </div>
        </div>
        <div style={S('overflow-x:auto')}>
          <div style={S('min-width:720px')}>
            {c.tab === 'sold' ? (<>
              <div style={S('display:flex;align-items:center;gap:16px;padding:12px 20px;border-bottom:1px solid #EEF0F3;color:#5E6673;font-size:12.5px;font-weight:500')}>{th('Client', '1.6')}{th('Package', '1.6')}{th('Visits left', '1.4')}{th('Bought', '1')}{th('Expires', '1.2')}{th('Status', '0.9')}</div>
              <ul style={S('margin:0;padding:0;list-style:none')}>
                {c.sold.map((s) => (
                  <li key={s.id}><button className="row" onClick={() => c.pick(s.id)} aria-label={`${s.client}, ${s.name}, ${s.left} of ${s.uses} left, ${s.status}`} style={S(rowCss + ';cursor:pointer')}>
                    <span style={S('flex:1.6 1 0;min-width:0;font-weight:500;overflow-wrap:anywhere')}>{s.client}</span>
                    <span style={S('flex:1.6 1 0;min-width:0;overflow-wrap:anywhere')}>{s.name}</span>
                    <span style={S('flex:1.4 1 0;min-width:0')}><span style={S('display:block;font-weight:600')}>{s.left} of {s.uses}</span>{barOf(s.left, s.uses)}</span>
                    <span style={S('flex:1 1 0;min-width:0;color:#5E6673')}>{dShort(s.bought, c.month)}</span>
                    <span style={S('flex:1.2 1 0;min-width:0;color:#5E6673')}>{expText(s, c.month)}</span>
                    <span style={S('flex:0.9 1 0;min-width:0')}><Chip tone={TONE_OF[s.status]}>{s.status}</Chip></span>
                  </button></li>
                ))}
              </ul>
            </>) : (<>
              <div style={S('display:flex;align-items:center;gap:16px;padding:12px 20px;border-bottom:1px solid #EEF0F3;color:#5E6673;font-size:12.5px;font-weight:500')}>{th('Package', '1.8')}{th('Service', '1.6')}{th('Visits', '0.8')}{th('Price', '1')}{th('Valid for', '1')}{th('Sold', '0.7')}{th('Status', '0.9')}</div>
              <ul style={S('margin:0;padding:0;list-style:none')}>
                {c.types.map((t) => {
                  const cells = (<>
                    <span style={S('flex:1.8 1 0;min-width:0;font-weight:500;overflow-wrap:anywhere')}>{t.name}</span>
                    <span style={S('flex:1.6 1 0;min-width:0;overflow-wrap:anywhere;color:#5E6673')}>{t.service}</span>
                    <span style={S('flex:0.8 1 0;min-width:0')}>{t.uses}</span>
                    <span style={S('flex:1 1 0;min-width:0;font-weight:600')}>{dollars(t.priceCents)}</span>
                    <span style={S('flex:1 1 0;min-width:0;color:#5E6673')}>{t.validDays ? validText(t.validDays) : 'No expiry'}</span>
                    <span style={S('flex:0.7 1 0;min-width:0;color:#5E6673')}>{t.sold}</span>
                    <span style={S('flex:0.9 1 0;min-width:0')}><Chip tone={TONE_OF[t.active ? 'Active' : 'Archived']}>{t.active ? 'Offered' : 'Archived'}</Chip></span>
                  </>);
                  return <li key={t.id}>{c.canEdit ? <button className="row" onClick={() => c.openEdit(t)} aria-label={'Edit ' + t.name} style={S(rowCss + ';cursor:pointer')}>{cells}</button> : <div style={S(rowCss)}>{cells}</div>}</li>;
                })}
              </ul>
            </>)}
          </div>
        </div>
        {c.tab === 'sold' && c.sold.length === 0 && <p style={S('margin:0;padding:28px 20px;color:#5E6673;font-size:14px')}>{noneSold(c)}</p>}
        {c.tab === 'types' && c.types.length === 0 && <p style={S('margin:0;padding:28px 20px;color:#5E6673;font-size:14px')}>{c.canEdit ? 'No packages yet. Create your first one.' : 'No packages yet.'}</p>}
      </section>
      {c.open && <Mobile c={c} drawer />}
    </div>
  );
}

function Mobile({ c, drawer }: { c: C; drawer?: boolean }) {
  const stat = (l: string, v: string) => <StatCard key={l} label={l} value={v} />;
  return (
    <div className={rootCls(drawer)} style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Packages" subtitle="Prepaid bundles of a service" query={c.query} onQuery={c.setQuery} placeholder="Search client or package" />
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <section aria-label="Packages at a glance" style={S('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px')}>
          {stat('Active packages', String(c.live.length))}{stat('Visits left', String(c.visitsLeft))}{stat('Prepaid value left', dollars(c.owed))}{stat('Sold this month', dollars(c.soldM))}
        </section>
        {!!c.notice && <Notice>{c.notice}</Notice>}
        <div style={S('display:flex;gap:10px')}>
          <button onClick={c.openSell} style={S(BLACK + ';gap:8px')}><Icon name="plus" color="#FFFFFF" />Sell package</button>
          {c.canEdit && c.tab === 'types' && <button className="ghost" onClick={c.openNew} style={S(OUTLINE)}>New package</button>}
        </div>
        <div role="group" aria-label="Packages view" className="hscroll" style={S('display:flex;gap:8px')}>{([['sold', 'Sold to clients'], ['types', 'Your packages']] as const).map(([id, l]) => <FilterChip key={id} on={c.tab === id} phone onClick={() => c.setTab(id)}>{l}</FilterChip>)}</div>
        {c.tab === 'sold' ? (<>
          {c.sold.length === 0 && <Note>{noneSold(c)}</Note>}
          <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px')}>
            {c.sold.map((s) => (
              <li key={s.id}><button className="ghost" onClick={() => c.pick(s.id)} aria-label={`${s.client}, ${s.name}, ${s.left} of ${s.uses} left, ${s.status}`} style={S('display:flex;flex-direction:column;gap:10px;width:100%;box-sizing:border-box;padding:16px 18px;border:1px solid #E6E8EC;border-radius:20px;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
                <span style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><span style={S('font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{s.client}</span><Chip tone={TONE_OF[s.status]}>{s.status}</Chip></span>
                <span style={S('font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{s.name}</span>
                <span style={S('display:flex;align-items:baseline;justify-content:space-between;gap:12px')}><span style={S('font-size:18px;font-weight:600;letter-spacing:-0.01em')}>{s.left} of {s.uses} left</span><span style={S('font-size:12.5px;color:#5E6673')}>{expText(s, c.month)}</span></span>
                {barOf(s.left, s.uses)}
              </button></li>
            ))}
          </ul>
        </>) : (
          <div style={S('display:flex;flex-direction:column;gap:12px')}>
            {c.types.map((t) => <TypeCard key={t.id} t={t} c={c} />)}
            {c.types.length === 0 && <Note>{c.canEdit ? 'No packages yet. Create your first one.' : 'No packages yet.'}</Note>}
          </div>
        )}
      </main>
      <MobileTabs active="more" />
      {c.open && (
        <BottomSheet label="Package" onClose={c.close} maxHeight="90%" gap={18}>
            {c.mode === 'new' || c.mode === 'edit' ? <PackageForm c={c} /> : c.mode === 'sell' ? <SellFlow c={c} /> : <Detail c={c} />}
          </BottomSheet>
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
