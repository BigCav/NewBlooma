'use client';
import { useState } from 'react';
import { decimalInput, digitsInput } from '@/lib/numeric';
import { S } from '../calendar/pickers';
import { CLOSE_BTN as RING_BTN, CloseX } from '../calendar/calUi';
import { AV, ROW, TICK, ICONS, StepShell, useSteps, Tiles, DetailRows } from '../calendar/wizardUi';
import type { ServicesCtl } from './ServicesView';

const money = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const durLabel = (m: number) => (m < 60 ? m + ' min' : m === 60 ? '1 hour' : m % 60 === 0 ? m / 60 + ' hours' : m % 60 === 30 ? Math.floor(m / 60) + '.5 hours' : Math.floor(m / 60) + ' hr ' + (m % 60) + ' min');
const FIELD_IN = { ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), minHeight: 0, borderRadius: 0 } as const;
const BARE = { ...S('flex:1 1 auto;min-width:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), padding: 0, minHeight: 0, width: 'auto', borderRadius: 0 } as const;

function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} style={S('display:block;box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{label}</span>{children}</label>;
}

/**
 * The phone's service editor as steps: details, category, length, price, who does it, online booking, then a summary.
 * A new service goes through them in order. An existing one opens on the summary, and a row there jumps to that step.
 */
export function ServiceFlow({ c }: { c: ServicesCtl }) {
  const { draft: d, set, cats, team, mains, mode, confirm, setConfirm, error, setError, nc, setNc, ce, setCe, canEdit, busy } = c;
  const isNew = mode === 'new';
  const kinds = ['details', ...(d.addon ? [] : ['category']), 'duration', 'price', d.addon ? 'with' : 'who', 'online', 'summary'] as const;
  const last = kinds.length - 1;
  const { step, go, jump, forward, back } = useSteps(last, () => setError(''), isNew ? 0 : last);
  const [custom, setCustom] = useState(false);
  const [ctext, setCtext] = useState('');
  const [menu, setMenu] = useState(false);
  const kind = kinds[Math.min(step, last)];
  const at = (k: string) => (kinds as readonly string[]).indexOf(k);
  const titles: Record<string, string> = { details: 'Details', category: 'Category', duration: 'Length', price: 'Price', who: 'Who does it', with: 'Offered with', online: 'Online booking', summary: isNew ? 'Summary' : 'Edit service' };
  const isCustom = custom || !c.durs.includes(d.dur);
  const priceNum = parseFloat(d.price);
  const catName = c.catName(d.catId);

  const ready = () => {
    if (kind === 'details') return d.name.trim() ? '' : 'Give the service a name.';
    if (kind === 'category') return d.catId ? '' : 'Choose a category.';
    if (kind === 'duration') return d.dur > 0 ? '' : 'Enter how many minutes it takes.';
    if (kind === 'price') return !isNaN(priceNum) && priceNum > 0 ? '' : 'Enter a price above zero, like 45 or 45.50.';
    if (kind === 'who') return d.staff.length ? '' : 'Choose who does this service, so clients can book it.';
    if (kind === 'with') return d.parents.length ? '' : 'Choose at least one service this add-on goes with.';
    return '';
  };
  const next = () => { const e = ready(); if (e) { setError(e); return; } forward(); };
  const people = (!d.addon ? team.filter((t) => d.staff.includes(t.id)).map((t) => t.name) : mains.filter((p) => d.parents.includes(p.id)).map((p) => p.name)).join(', ');

  const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((i) => i !== id) : [...arr, id]);
  const input = 'box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF';
  const small = 'flex:0 0 auto;height:48px;padding:0 18px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500';

  const summaryBar = (
    <div style={S('display:flex;gap:10px')}>
      {!isNew && <button type="button" onClick={() => setMenu(true)} aria-label="More actions" aria-haspopup="dialog" style={S(RING_BTN + ';flex:0 0 52px;width:52px;height:52px')}><svg width="20" height="20" viewBox="0 0 24 24" fill="#0E1116"><circle cx="12" cy="5.5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="18.5" r="1.6" /></svg></button>}
      <button type="button" onClick={c.save} disabled={busy} style={S('flex:1 1 0;height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;cursor:pointer')}>{isNew ? 'Create service' : 'Save changes'}</button>
    </div>
  );

  return (<>
    <StepShell step={step} titles={kinds.map((k) => titles[k])} onBack={back} onClose={() => c.setOpen(false)} error={error}
      actions={!canEdit || kind === 'summary' ? [] : [{ label: 'Continue', onClick: next }]}
      bar={kind === 'summary' && canEdit ? summaryBar : undefined}>
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, ...S('display:flex;flex-direction:column;gap:14px') }}>
        {kind === 'details' && (<>
          <Tiles label="Type" options={[['service', 'Service'], ['addon', 'Add-on']] as const} value={d.addon ? 'addon' : 'service'} onPick={(v) => set('addon', v === 'addon')} />
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>{d.addon ? 'An extra offered with other services, such as a gloss or a scalp treatment.' : 'Something clients book on its own.'}</p>
          <Field label="Name" htmlFor="sv-name"><input id="sv-name" type="text" value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="For example, Cut & finish" style={FIELD_IN} /></Field>
          <Field label="Description (optional)" htmlFor="sv-desc"><textarea id="sv-desc" value={d.desc} onChange={(e) => set('desc', e.target.value)} placeholder="What is included, in a sentence or two" rows={4} style={{ ...FIELD_IN, resize: 'none' }} /></Field>
        </>)}

        {kind === 'category' && (<>
          <div role="group" aria-label="Category" style={S('display:flex;flex-direction:column')}>
            {cats.map((x) => { const on = d.catId === x.id; return (
              <button key={x.id} type="button" onClick={() => set('catId', x.id)} aria-pressed={on} style={S(ROW(on))}>
                <span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{x.name}</span>{on && TICK}
              </button>
            ); })}
            <button type="button" onClick={() => setNc({ ...nc, open: !nc.open })} aria-expanded={nc.open} style={S(ROW(false) + ';border-style:dashed')}>
              <span style={S('flex:1 1 auto;font-size:15px;font-weight:500')}>+ New category</span>
            </button>
          </div>
          {nc.open && (
            <div style={S('display:flex;gap:8px')}>
              <input type="text" aria-label="New category name" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); c.createCat(); } }} placeholder="Category name" style={{ ...S(input), minHeight: 0 }} />
              <button type="button" onClick={c.createCat} disabled={busy} style={S(small)}>Add</button>
            </div>
          )}
          {canEdit && !nc.open && !!d.catId && cats.some((x) => x.id === d.catId) && (ce.mode === '' ? (
            <div style={S('display:flex;gap:10px')}>
              <button type="button" className="ghost" onClick={() => setCe({ mode: 'rename', name: catName })} style={S('flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500;cursor:pointer')}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>Rename
              </button>
              <button type="button" className="ghost" onClick={() => setCe({ mode: 'delete', name: '' })} style={S('flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border:1px solid #F3C6C3;border-radius:999px;background:#FFFFFF;color:#B42318;font-size:14px;font-weight:500;cursor:pointer')}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B42318" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l.8 12h9.4l.8-12M10 11v5M14 11v5" /></svg>Delete
              </button>
            </div>
          ) : ce.mode === 'rename' ? (
            <div style={S('display:flex;gap:8px')}>
              <input type="text" aria-label="Category name" value={ce.name} onChange={(e) => setCe({ mode: 'rename', name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); c.renameCat(); } }} style={{ ...S(input), minHeight: 0 }} />
              <button type="button" onClick={c.renameCat} disabled={busy} style={S(small)}>Save</button>
              <button type="button" className="ghost" onClick={() => setCe({ mode: '', name: '' })} style={S('flex:0 0 auto;height:48px;padding:0 16px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500')}>Cancel</button>
            </div>
          ) : (
            <div style={S('display:flex;flex-direction:column;gap:8px;padding:14px;border:1px solid #F3C6C3;border-radius:16px;background:#FEF3F2')}>
              <span style={S('font-size:14px;font-weight:600')}>Delete {catName}?</span>
              <span style={S('font-size:13px;color:#5E6673')}>Only works when it has no services in it.</span>
              <div style={S('display:flex;gap:8px')}>
                <button type="button" onClick={c.removeCat} disabled={busy} style={S('flex:1 1 0;height:48px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font-size:14px;font-weight:500')}>Delete category</button>
                <button type="button" className="ghost" onClick={() => setCe({ mode: '', name: '' })} style={S('flex:1 1 0;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500')}>Keep</button>
              </div>
            </div>
          ))}
        </>)}

        {kind === 'duration' && (<>
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>{d.addon ? 'The extra time this add-on takes.' : 'How long the appointment takes.'}</p>
          <Tiles label="Length" options={[...c.durs.map((x) => [x, durLabel(x)] as const), ['custom', 'Custom'] as const]} value={isCustom ? 'custom' : d.dur}
            onPick={(v) => { if (v === 'custom') { setCustom(true); setCtext(String(d.dur || '')); } else { setCustom(false); set('dur', v as number); } }} />
          {isCustom && (
            <Field label="Minutes" htmlFor="sv-custom"><input id="sv-custom" type="text" inputMode="numeric" value={custom ? ctext : String(d.dur || '')} onChange={(e) => { const t = digitsInput(e.target.value).slice(0, 3); setCustom(true); setCtext(t); set('dur', parseInt(t, 10) || 0); }} placeholder="For example, 50" style={FIELD_IN} /></Field>
          )}
        </>)}

        {kind === 'price' && (
          <Field label="Price" htmlFor="sv-price">
            <span style={S('display:flex;align-items:center;gap:6px;margin-top:2px;font-size:16px')}><span style={S('color:#5E6673')}>$</span><input id="sv-price" type="text" inputMode="decimal" value={d.price} onChange={(e) => set('price', decimalInput(e.target.value))} placeholder="0" style={BARE} /></span>
          </Field>
        )}

        {kind === 'who' && (<>
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>Only these team members can be booked for it.</p>
          <div role="group" aria-label="Who does it" style={S('display:flex;flex-direction:column')}>
            {team.map((t) => { const on = d.staff.includes(t.id); return (
              <button key={t.id} type="button" onClick={() => set('staff', toggle(d.staff, t.id))} aria-pressed={on} style={S(ROW(on))}>
                <span style={S(AV)}>{t.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                <span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{t.name}</span>{on && TICK}
              </button>
            ); })}
            {!team.length && <span style={S('color:#5E6673;font-size:13px')}>Add team members first.</span>}
          </div>
        </>)}

        {kind === 'with' && (<>
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>Clients can tick this extra after choosing one of these services. Whoever does the service does the add-on.</p>
          <div role="group" aria-label="Offered with" style={S('display:flex;flex-direction:column')}>
            {mains.map((p) => { const on = d.parents.includes(p.id); return (
              <button key={p.id} type="button" onClick={() => set('parents', toggle(d.parents, p.id))} aria-pressed={on} style={S(ROW(on))}>
                <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{p.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{durLabel(p.dur) + ', ' + money(p.priceCents)}</span></span>{on && TICK}
              </button>
            ); })}
            {!mains.length && <span style={S('color:#5E6673;font-size:13px')}>Add a regular service first.</span>}
          </div>
        </>)}

        {kind === 'online' && (<>
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>Hidden services can still be added to the calendar by you.</p>
          <Tiles label="Online booking" options={[['yes', 'Bookable online'], ['no', 'Hidden']] as const} value={d.online ? 'yes' : 'no'} onPick={(v) => set('online', v === 'yes')} />
        </>)}

        {kind === 'summary' && (<>
          {d.online ? (
            <div aria-label="How clients see this service online" style={S('display:flex;align-items:center;gap:12px;box-sizing:border-box;padding:14px 16px;border:1px solid #E6E8EC;border-radius:20px;background:#FAFAFB')}>
              <div style={S('flex:1 1 auto;min-width:0')}>
                <div style={S('font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{d.name.trim() || 'Service name'}</div>
                <div style={S('font-size:12.5px;color:#5E6673')}>{durLabel(d.dur || 0) + (d.addon ? ', add-on' : ', ' + catName)}</div>
              </div>
              <div style={S('flex:0 0 auto;font-size:15px;font-weight:600')}>{isNaN(priceNum) ? '$0' : money(Math.round(priceNum * 100))}</div>
              <span style={S('flex:0 0 auto;padding:7px 14px;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:13px;font-weight:500')}>Book</span>
            </div>
          ) : (
            <div style={S('box-sizing:border-box;padding:14px 16px;border:1px dashed #D5D9E0;border-radius:20px;color:#5E6673;font-size:13.5px')}>Hidden from online booking. You can still add it to the calendar yourself.</div>
          )}
          <DetailRows go={canEdit ? jump : () => {}} rows={[
            { icon: ICONS.scissors, text: (d.name.trim() || 'No name') + (d.addon ? ' (add-on)' : ''), step: canEdit ? at('details') : undefined },
            ...(d.addon ? [] : [{ icon: ICONS.tag, text: catName || 'No category', step: canEdit ? at('category') : undefined }]),
            { icon: ICONS.time, text: durLabel(d.dur || 0), step: canEdit ? at('duration') : undefined },
            { icon: ICONS.tag, text: isNaN(priceNum) ? '$0' : money(Math.round(priceNum * 100)), step: canEdit ? at('price') : undefined },
            { icon: d.addon ? ICONS.scissors : ICONS.person, text: d.addon ? (people ? 'Offered with ' + people : 'No services chosen') : (people || 'No one chosen'), step: canEdit ? at(d.addon ? 'with' : 'who') : undefined },
            { icon: ICONS.day, text: d.online ? 'Bookable online' : 'Hidden online', step: canEdit ? at('online') : undefined },
          ]} />
          {!canEdit && <p style={S('margin:0;color:#5E6673;font-size:13.5px')}>Only the owner can change services.</p>}
        </>)}
      </fieldset>
    </StepShell>
    {menu && (
      <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:6')}>
        <button onClick={() => { setMenu(false); setConfirm(false); }} aria-label="Close" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
        <div className="sheet" role="dialog" aria-label="More actions" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column')}>
          <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0;margin-bottom:12px')} />
          <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>More actions</h2><button onClick={() => { setMenu(false); setConfirm(false); }} aria-label="Close" style={S(RING_BTN)}><CloseX /></button></div>
          {!confirm ? (
            <div style={S('display:flex;flex-direction:column;padding:4px 0;border-top:1px solid #EEF0F3')}>
              <button type="button" onClick={() => setConfirm(true)} style={S('display:flex;align-items:center;width:100%;min-height:54px;box-sizing:border-box;padding:0;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;color:#B42318;cursor:pointer')}>Delete service</button>
            </div>
          ) : (
            <div role="alertdialog" aria-label="Confirm delete" style={S('display:flex;flex-direction:column;gap:12px;box-sizing:border-box;padding:16px;border:1px solid #F3C6C3;border-radius:20px;background:#FEF3F2')}>
              <div><div style={S('font-size:14.5px;font-weight:600')}>Delete this service?</div><div style={S('margin-top:2px;font-size:13px;color:#5E6673')}>It will no longer be available to book. This can&apos;t be undone.</div></div>
              {!!error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{error}</p>}
              <div style={S('display:flex;gap:10px')}>
                <button type="button" className="ghost" onClick={() => { setConfirm(false); setMenu(false); }} style={S('flex:1 1 0;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500')}>Keep</button>
                <button type="button" onClick={c.remove} disabled={busy} style={S('flex:1 1 0;height:48px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font-size:14px;font-weight:500')}>Delete service</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  </>);
}
