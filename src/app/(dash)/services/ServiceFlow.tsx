'use client';
import { Avatar, BARE, BLACK, BLACK_MD, BOOK_TAG, CLOSE, DOTS, FIELD_IN, Field, INPUT, MENU_ROW, Notice, OUTLINE, OUTLINE_MD, RING, dim } from '@/components/ui';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmBox } from '@/components/ConfirmBox';
import { dollars, toCents } from '@/lib/format';
import { duration } from '@/lib/display';
import { useState } from 'react';
import { decimalInput, digitsInput } from '@/lib/numeric';
import { S } from '../calendar/pickers';
import { ROW, TICK, ICONS, StepShell, useSteps, Tiles, DetailRows } from '../calendar/wizardUi';
import type { ServicesCtl } from './ServicesView';


/**
 * The phone's service editor as steps: details, category, length, price, who does it, online booking, then a summary.
 * A new service goes through them in order. An existing one opens on the summary, and a row there jumps to that step.
 */
export function ServiceFlow({ c }: { c: ServicesCtl }) {
  const { draft: d, set, cats, team, mains, mode, confirm, setConfirm, error, setError, nc, setNc, ce, setCe, canEdit, busy } = c;
  const isNew = mode === 'new';
  // With one person in the salon there is no one to choose, so "who does it" is not asked.
  const solo = team.length === 1;
  const kinds = ['details', ...(d.addon ? [] : ['category']), 'duration', 'price', ...(d.addon ? ['with'] : solo ? [] : ['who']), 'online', 'summary'] as const;
  const last = kinds.length - 1;
  const { step, go, jump, forward, back } = useSteps(last, () => setError(''), isNew ? 0 : last);
  const [custom, setCustom] = useState(false);
  const [ctext, setCtext] = useState('');
  const [menu, setMenu] = useState(false);
  const kind = kinds[Math.min(step, last)];
  const at = (k: string) => (kinds as readonly string[]).indexOf(k);
  const titles: Record<string, string> = { details: 'Details', category: 'Category', duration: 'Length', price: 'Price', who: 'Who does it', with: 'Offered with', online: 'Online booking', summary: isNew ? 'Summary' : 'Edit service' };
  const isCustom = custom || !c.durs.includes(d.dur);
  const cents = toCents(d.price);
  const catName = c.catName(d.catId);

  const ready = () => {
    if (kind === 'details') return d.name.trim() ? '' : 'Give the service a name.';
    if (kind === 'category') return d.catId ? '' : 'Choose a category.';
    if (kind === 'duration') return d.dur > 0 ? '' : 'Enter how many minutes it takes.';
    if (kind === 'price') return cents > 0 ? '' : 'Enter a price above zero, like 45 or 45.50.';
    if (kind === 'who') return d.staff.length ? '' : 'Choose who does this service, so clients can book it.';
    if (kind === 'with') return d.parents.length ? '' : 'Choose at least one service this add-on goes with.';
    return '';
  };
  const next = () => { const e = ready(); if (e) { setError(e); return; } forward(); };
  const people = (!d.addon ? team.filter((t) => d.staff.includes(t.id)).map((t) => t.name) : mains.filter((p) => d.parents.includes(p.id)).map((p) => p.name)).join(', ');

  const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((i) => i !== id) : [...arr, id]);
  const input = INPUT;
  const small = BLACK_MD;

  const summaryBar = (
    <div style={S('display:flex;gap:10px')}>
      {!isNew && <button type="button" onClick={() => setMenu(true)} aria-label="More actions" aria-haspopup="dialog" style={S(RING + ';flex:0 0 52px;width:52px;height:52px')}>{DOTS}</button>}
      <button type="button" onClick={c.save} disabled={busy} style={S(BLACK + dim(busy))}>{busy ? 'Saving…' : isNew ? 'Add service' : 'Save changes'}</button>
    </div>
  );

  return (<>
    <StepShell step={step} titles={kinds.map((k) => titles[k])} onBack={back} onClose={() => c.setOpen(false)} error={error}
      actions={!canEdit || kind === 'summary' ? [] : [{ label: 'Continue', onClick: next }]}
      bar={kind === 'summary' && canEdit ? summaryBar : undefined}>
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, ...S('display:flex;flex-direction:column;gap:14px') }}>
        {kind === 'details' && (<>
          <Tiles label="Type" options={[['service', 'Service'], ['addon', 'Add-on']] as const} value={d.addon ? 'addon' : 'service'} onPick={(v) => set('addon', v === 'addon')} />
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>{d.addon ? 'An extra offered with other services.' : 'Something clients book on its own.'}</p>
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
              <button type="button" className="ghost" onClick={() => setCe({ mode: 'rename', name: catName })} style={S(OUTLINE + ';gap:8px')}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>Rename
              </button>
              <button type="button" className="ghost" onClick={() => setCe({ mode: 'remove', name: '' })} style={S('flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border:1px solid #F3C6C3;border-radius:999px;background:#FFFFFF;color:#B42318;font-size:14px;font-weight:500;cursor:pointer')}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B42318" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l.8 12h9.4l.8-12M10 11v5M14 11v5" /></svg>Remove
              </button>
            </div>
          ) : ce.mode === 'rename' ? (
            <div style={S('display:flex;gap:8px')}>
              <input type="text" aria-label="Category name" value={ce.name} onChange={(e) => setCe({ mode: 'rename', name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); c.renameCat(); } }} style={{ ...S(input), minHeight: 0 }} />
              <button type="button" onClick={c.renameCat} disabled={busy} style={S(small)}>Save</button>
              <button type="button" className="ghost" onClick={() => setCe({ mode: '', name: '' })} style={S(OUTLINE_MD)}>Cancel</button>
            </div>
          ) : (
            <ConfirmBox label="Confirm removal" title={'Remove ' + catName + '?'} body="Only works when it has no services in it." action="Remove category" keep="Keep category" onAction={c.removeCat} busy={busy} onKeep={() => setCe({ mode: '', name: '' })} />
          ))}
        </>)}

        {kind === 'category' && !!c.notice && <Notice>{c.notice}</Notice>}

        {kind === 'duration' && (<>
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>{d.addon ? 'The extra time this add-on takes.' : 'How long the appointment takes.'}</p>
          <Tiles label="Length" options={[...c.durs.map((x) => [x, duration(x)] as const), ['custom', 'Custom'] as const]} value={isCustom ? 'custom' : d.dur}
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
                <Avatar name={t.name} size="md" />
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
                <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{p.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{duration(p.dur) + ', ' + dollars(p.priceCents)}</span></span>{on && TICK}
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
                <div style={S('font-size:12.5px;color:#5E6673')}>{duration(d.dur || 0) + (d.addon ? ', add-on' : ', ' + catName)}</div>
              </div>
              <div style={S('flex:0 0 auto;font-size:15px;font-weight:600')}>{dollars(cents)}</div>
              <span style={S(BOOK_TAG)}>Book</span>
            </div>
          ) : (
            <div style={S('box-sizing:border-box;padding:14px 16px;border:1px dashed #D5D9E0;border-radius:20px;color:#5E6673;font-size:13.5px')}>Hidden from online booking. You can still add it to the calendar yourself.</div>
          )}
          <DetailRows go={canEdit ? jump : () => {}} rows={[
            { icon: ICONS.scissors, text: (d.name.trim() || 'No name') + (d.addon ? ' (add-on)' : ''), step: canEdit ? at('details') : undefined },
            ...(d.addon ? [] : [{ icon: ICONS.tag, text: catName || 'No category', step: canEdit ? at('category') : undefined }]),
            { icon: ICONS.time, text: duration(d.dur || 0), step: canEdit ? at('duration') : undefined },
            { icon: ICONS.tag, text: dollars(cents), step: canEdit ? at('price') : undefined },
            ...(solo && !d.addon ? [] : [{ icon: d.addon ? ICONS.scissors : ICONS.person, text: d.addon ? (people ? 'Offered with ' + people : 'No services chosen') : (people || 'No one chosen'), step: canEdit ? at(d.addon ? 'with' : 'who') : undefined }]),
            { icon: ICONS.day, text: d.online ? 'Bookable online' : 'Hidden online', step: canEdit ? at('online') : undefined },
          ]} />
          {!canEdit && <p style={S('margin:0;color:#5E6673;font-size:13.5px')}>Only the owner can change services.</p>}
        </>)}
      </fieldset>
    </StepShell>
    {menu && (
      <BottomSheet label="More actions" onClose={() => { setMenu(false); setConfirm(false); }} z={6} gap={0} handleGap={12}>
          <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>More actions</h2><button onClick={() => { setMenu(false); setConfirm(false); }} aria-label="Close" style={S(RING)}>{CLOSE}</button></div>
          {!confirm ? (
            <div style={S('display:flex;flex-direction:column;padding:4px 0;border-top:1px solid #EEF0F3')}>
              <button type="button" onClick={() => setConfirm(true)} style={S(MENU_ROW + ';color:#B42318')}>Remove service</button>
            </div>
          ) : (
            <ConfirmBox label="Confirm removal" title={'Remove ' + (d.name.trim() || 'this service') + '?'} body="It will no longer be available to book. This can't be undone." error={error} action="Remove service" keep="Keep service" onAction={c.remove} busy={busy} onKeep={() => { setConfirm(false); setMenu(false); }} />
          )}
        </BottomSheet>
    )}
  </>);
}
