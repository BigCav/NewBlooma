'use client';
// 1:1 conversion of the prototype's Services.dc.html and MobileServices.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions. Added for production: who performs a service, new categories.
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { toneFor } from '@/lib/cal';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../calendar/pickers';
import { decimalInput, digitsInput } from '@/lib/numeric';
import { ServiceFlow } from './ServiceFlow';
import { ActiveFilter, FilterButton, FilterSheet } from '@/components/FilterBits';
import { addCategory, deleteCategory, deleteService, renameCategory, saveService } from './actions';

export type SvcRow = { id: string; name: string; desc: string; catId: string; cat: string; catIdx: number; dur: number; priceCents: number; online: boolean; staffIds: string[]; addon: boolean; parentIds: string[] };
type Props = { services: SvcRow[]; cats: { id: string; name: string }[]; team: { id: string; name: string }[]; canEdit: boolean };
type Draft = { name: string; catId: string; dur: number; price: string; desc: string; online: boolean; staff: string[]; addon: boolean; parents: string[] };

const DURS = [15, 30, 45, 60, 75, 90, 120, 150, 180];
const money = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const draftOf = (s: SvcRow): Draft => ({ name: s.name, catId: s.catId, dur: s.dur, price: String(s.priceCents / 100), desc: s.desc, online: s.online, staff: s.staffIds.slice(), addon: s.addon, parents: s.parentIds.slice() });

function useServices(props: Props) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const { services, team } = props;
  const [extraCats, setExtraCats] = useState<{ id: string; name: string }[]>([]);
  const cats = [...props.cats, ...extraCats.filter((e) => !props.cats.some((c) => c.id === e.id))];
  const blank = (): Draft => ({ name: '', catId: cats[0]?.id ?? '', dur: 60, price: '', desc: '', online: true, staff: [], addon: false, parents: [] });
  const [selectedId, setSelectedId] = useState<string | null>(services[0]?.id ?? null);
  const [mode, setMode] = useState<'edit' | 'new'>(services.length ? 'edit' : 'new');
  const [draft, setDraft] = useState<Draft>(services[0] ? draftOf(services[0]) : blank());
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [nc, setNc] = useState<{ open: boolean; name: string }>({ open: false, name: '' });
  const [ce, setCe] = useState<{ mode: '' | 'rename' | 'delete'; name: string }>({ mode: '', name: '' });
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setDraft((d) => ({ ...d, [k]: v })); setError(''); setNotice(''); };
  const select = (id: string) => { const s = services.find((x) => x.id === id); if (!s) return; setSelectedId(id); setMode('edit'); setDraft(draftOf(s)); setConfirm(false); setError(''); setNotice(''); setOpen(true); setNc({ open: false, name: '' }); };
  const startNew = () => { setSelectedId(null); setMode('new'); setDraft(blank()); setConfirm(false); setError(''); setNotice(''); setOpen(true); setNc({ open: false, name: '' }); };
  const cancelNew = () => { const f = services[0]; if (narrow || !f) { setOpen(false); setError(''); return; } select(f.id); };
  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? '';

  const save = () => {
    const name = draft.name.trim(); const price = parseFloat(draft.price);
    if (!name) { setError('Give the service a name.'); return; }
    if (isNaN(price) || price <= 0) { setError('Enter a price above zero, like 45 or 45.50.'); return; }
    if (!draft.addon && !draft.catId) { setError('Choose a category.'); return; }
    if (!(draft.dur > 0)) { setError('Enter how many minutes it takes.'); return; }
    if (draft.addon && !draft.parents.length) { setError('Choose at least one service this add-on goes with.'); return; }
    if (!draft.addon && !draft.staff.length) { setError('Choose who does this service, so clients can book it.'); return; }
    startT(async () => {
      const r = await saveService({ id: mode === 'edit' ? selectedId ?? undefined : undefined, name, categoryId: draft.catId, dur: draft.dur, price: draft.price, desc: draft.desc, online: draft.online, staffIds: draft.staff, addon: draft.addon, parentIds: draft.parents });
      if (r.error) { setError(r.error); return; }
      setError(''); setConfirm(false); setFilter('all');
      if (r.created) { setSelectedId(r.id!); setMode('edit'); setNotice('Service created'); } else setNotice('Changes saved');
      setDraft((d) => ({ ...d, name, price: String(Math.round(price * 100) / 100) }));
      if (narrow) setOpen(false);
      router.refresh();
    });
  };
  const remove = () => {
    if (!selectedId) return;
    const id = selectedId;
    startT(async () => {
      const r = await deleteService(id);
      if (r.error) { setError(r.error); setConfirm(false); return; }
      const rest = services.filter((s) => s.id !== id);
      setConfirm(false); setError('');
      if (narrow) { setSelectedId(null); setOpen(false); setNotice(''); }
      else if (rest.length) { setSelectedId(rest[0].id); setMode('edit'); setDraft(draftOf(rest[0])); setNotice('Service deleted'); }
      else { setSelectedId(null); setMode('new'); setDraft(blank()); setNotice('Service deleted'); }
      router.refresh();
    });
  };
  const createCat = () => {
    const name = nc.name.trim(); if (!name) { setError('Enter a category name.'); return; }
    startT(async () => {
      const r = await addCategory(name);
      if (r.error) { setError(r.error); return; }
      setExtraCats((e) => [...e, { id: r.id!, name: r.name! }]); set('catId', r.id!); setNc({ open: false, name: '' }); router.refresh();
    });
  };

  const renameCat = () => {
    if (!draft.catId) return;
    startT(async () => {
      const r = await renameCategory(draft.catId, ce.name);
      if (r.error) { setError(r.error); return; }
      setError(''); setCe({ mode: '', name: '' }); setNotice('Category renamed'); router.refresh();
    });
  };
  const removeCat = () => {
    if (!draft.catId) return;
    const id = draft.catId;
    startT(async () => {
      const r = await deleteCategory(id);
      if (r.error) { setError(r.error); setCe({ mode: '', name: '' }); return; }
      setExtraCats((e) => e.filter((x) => x.id !== id)); setError(''); setCe({ mode: '', name: '' });
      setDraft((d) => ({ ...d, catId: props.cats.find((x) => x.id !== id)?.id ?? '' })); setNotice('Category deleted'); router.refresh();
    });
  };

  const sq = query.trim().toLowerCase();
  const rows = services.filter((s) => (filter === 'all' || s.catId === filter) && (!sq || (s.name + ' ' + s.cat + ' ' + s.desc).toLowerCase().includes(sq)));
  const durs = DURS;
  const mains = services.filter((s) => !s.addon);
  return { busy, cats, services, mains, team, narrow, canEdit: props.canEdit, selectedId, mode, draft, set, filter, setFilter, query, setQuery, confirm, setConfirm, error, notice, open, setOpen, nc, setNc, ce, setCe, renameCat, removeCat,
    select, startNew, cancelNew, save, remove, createCat, rows, durs, catName, setError };
}
type C = ReturnType<typeof useServices>;
export type ServicesCtl = C;

const chipMain = (on: boolean, m: boolean) => (m ? 'flex:0 0 auto;height:44px;padding:0 18px;border-radius:999px;font-size:14px;font-weight:500;' : 'height:40px;padding:0 16px;border-radius:999px;font-size:13.5px;font-weight:500;') + 'border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
const formChip = (on: boolean, m: boolean) => 'flex:0 0 auto;white-space:nowrap;' + (m ? 'height:44px;padding:0 16px;font-size:14px;' : 'height:36px;padding:0 14px;font-size:13px;') + 'border-radius:999px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
const tile = (cIdx: number, cat: string) => { const t = toneFor(cat, cIdx); return 'flex:0 0 40px;width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;background:' + t.bg + ';color:' + t.fg; };
const onlineCss = (on: boolean) => 'display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;white-space:nowrap;background:' + (on ? '#DDF3EA' : '#EEF0F3') + ';color:' + (on ? '#14624A' : '#4A525E');
const ini = (n: string) => n.split(' ').filter((w) => /[A-Za-z0-9]/.test(w[0] ?? '')).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'S';
const rowLabel = (s: SvcRow) => s.name + (s.addon ? ' (add-on)' : '') + ', ' + s.dur + ' minutes, ' + money(s.priceCents) + ', ' + (s.online ? 'bookable online' : 'hidden online');

function Editor({ c, m }: { c: C; m: boolean }) {
  const { draft: d, set, cats, team, mode, confirm, error, nc, setNc, ce, canEdit, busy } = c;
  const [custom, setCustom] = useState(false);
  const [ctext, setCtext] = useState('');
  useEffect(() => { setCustom(false); }, [c.selectedId, c.mode]);
  const isCustom = custom || !DURS.includes(d.dur);
  const H = m ? 48 : 44;
  const priceNum = parseFloat(d.price);
  const isNew = mode === 'new';
  const inputCss = 'box-sizing:border-box;width:100%;height:' + H + 'px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF';
  const BTN = 'flex:1 1 0;height:' + H + 'px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500';
  const BTN2 = 'flex:1 1 0;height:' + H + 'px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500';
  return (
    <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, ...S('display:flex;flex-direction:column;gap:18px') }}>
      <div aria-label="How clients see this service online" style={S('display:flex;flex-direction:column;gap:8px')}>
        <span style={S('font-size:14px;font-weight:600')}>How clients see it</span>
        {d.online ? (
          <div style={S('display:flex;align-items:center;gap:12px;box-sizing:border-box;padding:14px 16px;border:1px solid #E6E8EC;border-radius:18px;background:#FAFAFB')}>
            <div style={S('flex:1 1 auto;min-width:0')}>
              <div style={S('font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{d.name.trim() || 'Service name'}</div>
              <div style={S('font-size:12.5px;color:#5E6673')}>{d.dur + ' min, ' + c.catName(d.catId)}</div>
            </div>
            <div style={S('flex:0 0 auto;font-size:14.5px;font-weight:600')}>{isNaN(priceNum) ? '$0' : money(Math.round(priceNum * 100))}</div>
            <span style={S('flex:0 0 auto;padding:7px 14px;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:13px;font-weight:500')}>Book</span>
          </div>
        ) : (
          <div style={S('box-sizing:border-box;padding:14px 16px;border:1px dashed #D5D9E0;border-radius:18px;color:#5E6673;font-size:13.5px')}>Hidden from online booking. You can still add it to the calendar yourself.</div>
        )}
      </div>

      <div style={S('display:flex;flex-direction:column;gap:8px')}>
        <label htmlFor="svc-name" style={S('font-size:14px;font-weight:600')}>Name</label>
        <input id="svc-name" type="text" value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="For example, Cut & finish" style={{ ...S(inputCss), minHeight: 0 }} />
      </div>

      {!d.addon && (
      <div style={S('display:flex;flex-direction:column;gap:8px')}>
        <span id="svc-cat-label" style={S('font-size:14px;font-weight:600')}>Category</span>
        <div role="group" className="hscroll" aria-labelledby="svc-cat-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
          {cats.map((x) => <button key={x.id} type="button" onClick={() => set('catId', x.id)} aria-pressed={d.catId === x.id} style={S(formChip(d.catId === x.id, m))}>{x.name}</button>)}
          <button type="button" onClick={() => setNc({ ...nc, open: !nc.open })} aria-expanded={nc.open} style={S(formChip(nc.open, m))}>+ New category</button>
        </div>
        {c.canEdit && !nc.open && !!d.catId && cats.some((x) => x.id === d.catId) && (ce.mode === '' ? (
          <div style={S('display:flex;gap:16px')}>
            <button type="button" className="ghost" onClick={() => c.setCe({ mode: 'rename', name: c.catName(d.catId) })} style={S('border:0;background:transparent;padding:0;color:#4A525E;font-size:13.5px;font-weight:500;text-decoration:underline;cursor:pointer')}>Rename category</button>
            <button type="button" className="ghost" onClick={() => c.setCe({ mode: 'delete', name: '' })} style={S('border:0;background:transparent;padding:0;color:#B42318;font-size:13.5px;font-weight:500;text-decoration:underline;cursor:pointer')}>Delete category</button>
          </div>
        ) : ce.mode === 'rename' ? (
          <div style={S('display:flex;gap:8px')}>
            <input type="text" aria-label="Category name" value={ce.name} onChange={(e) => c.setCe({ mode: 'rename', name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); c.renameCat(); } }} autoFocus style={{ ...S(inputCss), minHeight: 0 }} />
            <button type="button" onClick={c.renameCat} disabled={busy} style={S('flex:0 0 auto;height:' + H + 'px;padding:0 18px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500')}>Save</button>
            <button type="button" className="ghost" onClick={() => c.setCe({ mode: '', name: '' })} style={S('flex:0 0 auto;height:' + H + 'px;padding:0 16px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500')}>Cancel</button>
          </div>
        ) : (
          <div style={S('display:flex;flex-direction:column;gap:8px;padding:12px 14px;border:1px solid #F3C6C3;border-radius:14px;background:#FEF3F2')}>
            <span style={S('font-size:14px;font-weight:600')}>Delete {c.catName(d.catId)}?</span>
            <span style={S('font-size:13px;color:#5E6673')}>Only works when it has no services in it.</span>
            <div style={S('display:flex;gap:8px')}>
              <button type="button" onClick={c.removeCat} disabled={busy} style={S('flex:1 1 0;height:' + H + 'px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font-size:14px;font-weight:500')}>Delete category</button>
              <button type="button" className="ghost" onClick={() => c.setCe({ mode: '', name: '' })} style={S('flex:1 1 0;height:' + H + 'px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500')}>Keep</button>
            </div>
          </div>
        ))}
        {nc.open && (
          <div style={S('display:flex;gap:8px')}>
            <input type="text" aria-label="New category name" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); c.createCat(); } }} placeholder="Category name" autoFocus style={{ ...S(inputCss), minHeight: 0 }} />
            <button type="button" onClick={c.createCat} disabled={busy} style={S('flex:0 0 auto;height:' + H + 'px;padding:0 18px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500')}>Add</button>
          </div>
        )}
      </div>
      )}

      <div style={S('display:flex;flex-direction:column;gap:8px')}>
        <span id="svc-dur-label" style={S('font-size:14px;font-weight:600')}>{d.addon ? 'Extra time' : 'Duration'}</span>
        <div role="group" className="hscroll" aria-labelledby="svc-dur-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
          <button type="button" onClick={() => { setCustom(true); setCtext(String(d.dur || '')); }} aria-pressed={isCustom} style={S(formChip(isCustom, m))}>Custom</button>
          {c.durs.map((x) => <button key={x} type="button" onClick={() => { setCustom(false); set('dur', x); }} aria-pressed={!isCustom && d.dur === x} style={S(formChip(!isCustom && d.dur === x, m))}>{x + ' min'}</button>)}
        </div>
        {isCustom && (
          <div className="fw" style={S('display:flex;align-items:center;gap:8px;box-sizing:border-box;height:' + H + 'px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;background:#FFFFFF')}>
            <input aria-label="Custom length in minutes" type="text" inputMode="numeric" value={custom ? ctext : String(d.dur || '')} onChange={(e) => { const t = digitsInput(e.target.value).slice(0, 3); setCustom(true); setCtext(t); set('dur', parseInt(t, 10) || 0); }} placeholder="For example, 50" style={{ ...S('flex:1 1 auto;min-width:0;border:0;outline:none;background:transparent;font:inherit;color:#0E1116'), padding: 0, minHeight: 0, width: 'auto', borderRadius: 0 }} />
            <span style={S('color:#5E6673')}>minutes</span>
          </div>
        )}
      </div>

      <div style={S('display:flex;flex-direction:column;gap:8px')}>
        <label htmlFor="svc-price" style={S('font-size:14px;font-weight:600')}>Price</label>
        <div className="fw" style={S('display:flex;align-items:center;gap:6px;box-sizing:border-box;height:' + H + 'px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;background:#FFFFFF')}>
          <span style={S('color:#5E6673')}>$</span>
          <input id="svc-price" type="text" inputMode="decimal" value={d.price} onChange={(e) => set('price', decimalInput(e.target.value))} placeholder="0" style={{ ...S('flex:1 1 auto;min-width:0;border:0;outline:none;background:transparent;font:inherit;color:#0E1116'), padding: 0, minHeight: 0, width: 'auto', borderRadius: 0 }} />
        </div>
      </div>

      <div style={S('display:flex;flex-direction:column;gap:8px')}>
        <label htmlFor="svc-desc" style={S('font-size:14px;font-weight:600')}>Description</label>
        <textarea id="svc-desc" value={d.desc} onChange={(e) => set('desc', e.target.value)} placeholder="What is included, in a sentence or two" style={S('box-sizing:border-box;width:100%;min-height:88px;resize:vertical;padding:12px 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF')} />
      </div>

      {d.addon ? (
        <div style={S('display:flex;flex-direction:column;gap:8px')}>
          <span id="svc-parent-label" style={S('font-size:14px;font-weight:600')}>Offered with</span>
          <div role="group" aria-labelledby="svc-parent-label" style={S('display:flex;flex-wrap:wrap;gap:8px')}>
            {c.mains.map((p) => { const on = d.parents.includes(p.id); return <button key={p.id} type="button" onClick={() => set('parents', on ? d.parents.filter((i) => i !== p.id) : [...d.parents, p.id])} aria-pressed={on} style={S(formChip(on, m))}>{p.name}</button>; })}
            {!c.mains.length && <span style={S('color:#5E6673;font-size:13px')}>Add a regular service first.</span>}
          </div>
          <div style={S('font-size:13px;color:#5E6673')}>Clients can tick this extra after choosing one of these services. Whoever does the service does the add-on.</div>
        </div>
      ) : (
      <div style={S('display:flex;flex-direction:column;gap:8px')}>
        <span id="svc-team-label" style={S('font-size:14px;font-weight:600')}>Who does it</span>
        <div role="group" className="hscroll" aria-labelledby="svc-team-label" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
          {team.map((t) => { const on = d.staff.includes(t.id); return <button key={t.id} type="button" onClick={() => set('staff', on ? d.staff.filter((i) => i !== t.id) : [...d.staff, t.id])} aria-pressed={on} style={S(formChip(on, m))}>{t.name}</button>; })}
          {!team.length && <span style={S('color:#5E6673;font-size:13px')}>Add team members first.</span>}
        </div>
        <div style={S('font-size:13px;color:#5E6673')}>Only these team members can be booked for it.</div>
      </div>
      )}

      <div style={S('display:flex;align-items:center;justify-content:space-between;gap:16px')}>
        <div style={S('min-width:0')}>
          <div id="svc-addon-label" style={S('font-size:14px;font-weight:600')}>Add-on</div>
          <div style={S('font-size:13px;color:#5E6673')}>An extra offered with other services, such as a gloss or a scalp treatment.</div>
        </div>
        <button type="button" role="switch" aria-checked={d.addon} aria-labelledby="svc-addon-label" onClick={() => set('addon', !d.addon)} style={S('position:relative;flex:0 0 52px;width:52px;height:32px;padding:0;border:0;border-radius:999px;background:' + (d.addon ? '#0E1116' : '#D5D9E0'))}>
          <span style={S('position:absolute;top:3px;left:' + (d.addon ? 23 : 3) + 'px;width:26px;height:26px;border-radius:999px;background:#FFFFFF')} />
        </button>
      </div>

      <div style={S('display:flex;align-items:center;justify-content:space-between;gap:16px')}>
        <div style={S('min-width:0')}>
          <div id="svc-online-label" style={S('font-size:14px;font-weight:600')}>Bookable online</div>
          <div style={S('font-size:13px;color:#5E6673')}>Clients can book this service themselves.</div>
        </div>
        <button type="button" role="switch" aria-checked={d.online} aria-labelledby="svc-online-label" onClick={() => set('online', !d.online)} style={S('position:relative;flex:0 0 52px;width:52px;height:32px;padding:0;border:0;border-radius:999px;background:' + (d.online ? '#0E1116' : '#D5D9E0'))}>
          <span style={S('position:absolute;top:3px;left:' + (d.online ? 23 : 3) + 'px;width:26px;height:26px;border-radius:999px;background:#FFFFFF')} />
        </button>
      </div>

      {!!error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{error}</p>}
      {!canEdit && <p style={S('margin:0;color:#5E6673;font-size:13.5px')}>Only the owner can change services.</p>}

      {canEdit && !confirm && (
        <div style={S('display:flex;gap:10px')}>
          <button type="button" onClick={c.save} disabled={busy} style={S(BTN)}>{isNew ? 'Create service' : 'Save changes'}</button>
          <button type="button" className="ghost" onClick={() => (isNew ? c.cancelNew() : c.setConfirm(true))} style={S(BTN2)}>{isNew ? 'Cancel' : 'Delete'}</button>
        </div>
      )}
      {canEdit && confirm && (
        <div role="alertdialog" aria-label="Confirm delete" style={S('display:flex;flex-direction:column;gap:12px;box-sizing:border-box;padding:16px;border:1px solid #F3C6C3;border-radius:18px;background:#FEF3F2')}>
          <div>
            <div style={S('font-size:14.5px;font-weight:600')}>Delete this service?</div>
            <div style={S('margin-top:2px;font-size:13px;color:#5E6673')}>It will no longer be available to book. This can't be undone.</div>
          </div>
          <div style={S('display:flex;gap:10px')}>
            <button type="button" className="ghost" onClick={() => c.setConfirm(false)} style={S(BTN2)}>Cancel</button>
            <button type="button" onClick={c.remove} disabled={busy} style={S('flex:1 1 0;height:' + H + 'px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font-size:14px;font-weight:500')}>Delete service</button>
          </div>
        </div>
      )}
    </fieldset>
  );
}

function Desktop({ c }: { c: C }) {
  const { services, rows, cats, mode, selectedId, filter, setFilter, notice } = c;
  const online = services.filter((s) => s.online).length;
  const catCount = cats.filter((x) => services.some((s) => s.catId === x.id)).length;
  const chips = [{ id: 'all', label: 'All services' }, ...cats.map((x) => ({ id: x.id, label: x.name }))];
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <PageHeader title="Services" subtitle="What clients can book" query={c.query} onQuery={c.setQuery} placeholder="Search services" actionLabel="New service" onAction={c.startNew} showAction={c.canEdit} />

      <section aria-label="Services at a glance" style={S('display:flex;flex-wrap:wrap;gap:20px 64px')}>
        {([['Services', services.length], ['Categories', catCount], ['Bookable online', online]] as const).map(([l, v]) => (
          <div key={l}><div style={S('color:#5E6673;font-size:13.5px')}>{l}</div><div style={S('margin-top:4px;font-size:38px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{String(v)}</div></div>
        ))}
      </section>

      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}>
        <section aria-label="Service list" style={S('flex:999 1 620px;min-width:0;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;overflow:hidden')}>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E6E8EC')}>
            <div role="group" aria-label="Filter services" style={S('display:flex;flex-wrap:wrap;gap:8px')}>
              {chips.map((x) => <button key={x.id} onClick={() => setFilter(x.id)} aria-pressed={filter === x.id} style={S(chipMain(filter === x.id, false))}>{x.label}</button>)}
            </div>
            <span style={S('color:#5E6673;font-size:13.5px')}>{'Showing ' + rows.length + ' of ' + services.length}</span>
          </div>
          <div style={S('overflow-x:auto')}>
            <div style={S('min-width:760px')}>
              <div style={S('display:flex;align-items:center;gap:16px;padding:12px 20px;border-bottom:1px solid #EEF0F3;color:#5E6673;font-size:12.5px;font-weight:500')}>
                <div style={S('flex:3 1 0;min-width:0')}>Service</div><div style={S('flex:1 1 0;min-width:0')}>Category</div><div style={S('flex:0.9 1 0;min-width:0')}>Duration</div><div style={S('flex:0.8 1 0;min-width:0')}>Price</div><div style={S('flex:1 1 0;min-width:0')}>Online</div>
              </div>
              {rows.map((s) => (
                <button key={s.id} className="s-row" onClick={() => c.select(s.id)} aria-label={rowLabel(s)} style={S('display:flex;align-items:center;gap:16px;width:100%;box-sizing:border-box;min-height:64px;padding:8px 20px;border:0;border-bottom:1px solid #EEF0F3;text-align:left;font:inherit;font-size:14px;color:#0E1116;background:' + (mode === 'edit' && selectedId === s.id ? '#F4F5F7' : 'transparent'))}>
                  <span style={S('flex:3 1 0;min-width:0;display:flex;align-items:center;gap:12px')}>
                    <span style={S(tile(s.catIdx, s.cat))}>{ini(s.name)}</span>
                    <span style={S('min-width:0')}>
                      <span style={S('display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{s.name}{s.addon && <span style={S('margin-left:8px;padding:2px 8px;border-radius:999px;background:#F2EFFE;color:#4B34C9;font-size:11.5px;font-weight:500')}>Add-on</span>}</span>
                      <span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{s.desc}</span>
                    </span>
                  </span>
                  <span style={S('flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{s.cat}</span>
                  <span style={S('flex:0.9 1 0;min-width:0')}>{s.dur + ' min'}</span>
                  <span style={S('flex:0.8 1 0;min-width:0;font-weight:500')}>{money(s.priceCents)}</span>
                  <span style={S('flex:1 1 0;min-width:0')}><span style={S(onlineCss(s.online))}>{s.online ? 'Online' : 'Hidden'}</span></span>
                </button>
              ))}
            </div>
          </div>
          {rows.length === 0 && <p style={S('margin:0;padding:24px 20px;color:#5E6673;font-size:14px;border-top:1px solid #EEF0F3')}>{services.length === 0 ? (c.canEdit ? 'No services yet. Add a category, then your first service.' : 'No services yet.') : 'Nothing matches "' + c.query.trim() + '".'}</p>}
        </section>

        <aside aria-label="Service editor" style={S('flex:1 1 440px;max-width:520px;min-width:0;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:20px')}>
          <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
            <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{mode === 'new' ? 'New service' : 'Edit service'}</h2>
            {!!notice && <span role="status" style={S('flex:0 0 auto;padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{notice}</span>}
          </div>
          <Editor c={c} m={false} />
        </aside>
      </div>
    </div>
  );
}

function Mobile({ c }: { c: C }) {
  const { services, rows, cats, open, filter, setFilter, mode } = c;
  const [fopen, setFopen] = useState(false);
  const online = services.filter((s) => s.online).length;
  const chips = [{ id: 'all', label: 'All services' }, ...cats.map((x) => ({ id: x.id, label: x.name }))];
  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <MobileHeader title="Services" subtitle="What clients can book" query={c.query} onQuery={c.setQuery} placeholder="Search services" />

      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <section aria-label="Services at a glance" style={S('display:flex;gap:40px')}>
          <div><div style={S('color:#5E6673;font-size:13px')}>Services</div><div style={S('margin-top:2px;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{String(services.length)}</div></div>
          <div><div style={S('color:#5E6673;font-size:13px')}>Bookable online</div><div style={S('margin-top:2px;font-size:30px;line-height:1.1;font-weight:500;letter-spacing:-0.03em')}>{String(online)}</div></div>
        </section>

        <div style={S('display:flex;gap:10px')}>
          <FilterButton onClick={() => setFopen(true)} active={filter !== 'all'} label="Filter services" />
          {c.canEdit && (
            <button onClick={c.startNew} style={S('flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              New service
            </button>
          )}
        </div>
        {filter !== 'all' && <ActiveFilter label={chips.find((x) => x.id === filter)?.label ?? ''} onClear={() => setFilter('all')} />}

        <ul style={S('margin:0;padding:4px 0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px')}>
          {rows.map((s) => (
            <li key={s.id}>
              <button onClick={() => c.select(s.id)} aria-label={rowLabel(s)} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 16px;border:0;border-bottom:1px solid #EEF0F3;background:transparent;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
                <span style={S(tile(s.catIdx, s.cat))}>{ini(s.name)}</span>
                <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{s.name}{s.addon && <span style={S('margin-left:8px;padding:2px 8px;border-radius:999px;background:#F2EFFE;color:#4B34C9;font-size:11.5px;font-weight:500')}>Add-on</span>}</span><span style={S('display:block;font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{s.dur + ' min, ' + s.cat}</span></span>
                <span style={S('flex:0 0 auto;text-align:right')}><span style={S('display:block;font-size:14.5px;font-weight:600')}>{money(s.priceCents)}</span><span style={S('display:block;margin-top:2px')}><span style={S(onlineCss(s.online))}>{s.online ? 'Online' : 'Hidden'}</span></span></span>
              </button>
            </li>
          ))}
        </ul>
        {rows.length === 0 && <p style={S('margin:0;text-align:center;color:#5E6673;font-size:14px')}>{services.length === 0 ? (c.canEdit ? 'No services yet. Add a category, then your first service.' : 'No services yet.') : 'Nothing matches "' + c.query.trim() + '".'}</p>}
      </main>

      <MobileTabs active="services" />
      {fopen && <FilterSheet title="Filter services" options={chips} value={filter} onPick={setFilter} onClose={() => setFopen(false)} />}

      {open && (
        <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:5')}>
          <button onClick={() => c.setOpen(false)} aria-label="Close editor" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
          <div className="sheet" role="dialog" aria-label="Service editor" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:18px')}>
            <ServiceFlow key={mode + (c.selectedId ?? 'new')} c={c} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ServicesView(props: Props) {
  const c = useServices(props);
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
