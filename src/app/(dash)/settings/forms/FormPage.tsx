'use client';
import Link from 'next/link';
import { useState } from 'react';
import { S } from '../../calendar/pickers';
import { HOW_OPTS, QTYPES, VALID_OPTS, type Miss, type QType } from '@/lib/forms-shared';
import type { FormsCtl } from './FormsView';

const RING = 'flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0';
const BACK = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6l-6 6 6 6" /></svg>;
const DOTS = <svg width="20" height="20" viewBox="0 0 24 24" fill="#0E1116"><circle cx="12" cy="5.5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="18.5" r="1.6" /></svg>;
const CLOSE = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;
const CHEV = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true"><path d="M9.5 6l6 6-6 6" /></svg>;
const UP = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 14l6-6 6 6" /></svg>;
const DOWN = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 10l6 6 6-6" /></svg>;
const TRASH = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>;
const PAGE = "position:absolute;left:0;right:0;top:0;bottom:0;z-index:5;display:flex;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4";
const BAR = 'flex:0 0 auto;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px';
const CARD = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:4px 18px';
const FIELD_IN = { ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), minHeight: 0, borderRadius: 0 } as const;
const MINI = { ...S('box-sizing:border-box;height:36px;padding:0 10px;border:1px solid #E1E4E9;border-radius:999px;font:inherit;font-size:13px;color:#0E1116;background:#FFFFFF'), minHeight: 0, width: 'auto' } as const;
const ICON_BTN = 'flex:0 0 auto;width:36px;height:36px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;';

function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} style={S('display:block;box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{label}</span>{children}</label>;
}

type Opt = { id: string; label: string; off?: boolean };

/** A full-page choice list, like the filter sheets. `multi` keeps it open and shows Done. */
function PickSheet({ title, options, values, multi, help, onPick, onClose }: { title: string; options: Opt[]; values: string[]; multi?: boolean; help?: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:8')}>
      <button onClick={onClose} aria-label="Close" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
      <div className="sheet" role="dialog" aria-label={title} style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column')}>
        <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0;margin-bottom:12px')} />
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}>
          <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={S(RING)}>{CLOSE}</button>
        </div>
        {!!help && <p style={S('margin:0 0 6px;font-size:13.5px;color:#5E6673')}>{help}</p>}
        <div role="group" aria-label={title} style={S('display:flex;flex-direction:column;padding:4px 0;border-top:1px solid #EEF0F3')}>
          {options.length === 0 && <p style={S('margin:12px 0;font-size:14px;color:#5E6673')}>Nothing to choose yet.</p>}
          {options.map((o) => {
            const on = values.includes(o.id);
            return (
              <button key={o.id} disabled={o.off} onClick={() => { onPick(o.id); if (!multi) onClose(); }} aria-pressed={on} style={S('display:flex;align-items:center;gap:12px;width:100%;min-height:56px;box-sizing:border-box;padding:0;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;color:#0E1116;cursor:pointer;opacity:' + (o.off ? 0.45 : 1) + ';font-weight:' + (on ? 600 : 400))}>
                <span style={S('flex:1 1 auto;min-width:0')}>{o.label}</span>
                {on && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
              </button>
            );
          })}
        </div>
        {multi && <button onClick={onClose} style={S('margin-top:14px;height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer')}>Done</button>}
      </div>
    </div>
  );
}

/** One line in the settings card: what it is, what it is set to, and a way in. */
function SettingRow({ label, value, onClick, last }: { label: string; value: string; onClick: () => void; last?: boolean }) {
  return (
    <button onClick={onClick} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:60px;padding:10px 0;border:0;border-bottom:' + (last ? '0' : '1px solid #EEF0F3') + ';background:transparent;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
      <span style={S('flex:0 0 auto;font-size:15px;font-weight:500')}>{label}</span>
      <span style={S('flex:1 1 auto;min-width:0;text-align:right;font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{value}</span>
      {CHEV}
    </button>
  );
}

/** A form on the phone as its own page: name, settings as rows that open a choice, the questions, and a Save bar. */
export function FormPage({ c }: { c: FormsCtl }) {
  const d = c.cur!;
  const [sheet, setSheet] = useState<null | 'cats' | 'valid' | 'how' | 'miss' | 'more'>(null);
  const staff = d.how === 'staff';
  const missOn: Miss = staff && d.miss === 'ask' ? 'warn' : d.miss;
  const validName = VALID_OPTS.find((v) => v[0] === d.validMonths)?.[1] ?? '';
  const howName = HOW_OPTS.find((h) => h[0] === d.how)?.[1] ?? '';
  const catNames = c.cats.filter((x) => d.catIds.includes(x.id)).map((x) => x.name);
  const mv = (i: number, dir: number) => c.patch((x) => { const t = x.qs[i + dir]; x.qs[i + dir] = x.qs[i]; x.qs[i] = t; });
  const close = () => c.setOpen(false);
  const missHelp = staff ? 'Staff-recorded forms cannot be asked for online, so staff are warned on the calendar.' : missOn === 'ask' ? 'Clients are asked to complete it as soon as they book online. Staff still see a warning.' : 'Staff see a warning on the appointment in the calendar. Booking still goes through.';
  const validHelp = d.validMonths === 0 ? 'Clients complete this form again at every visit.' : 'After it is completed, it stays valid for ' + validName + '. Then clients are asked again.';
  const rowCss = 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:58px;padding:0 4px;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;color:#0E1116;cursor:pointer;text-decoration:none';

  return (
    <div role="dialog" aria-label="Edit form" style={S(PAGE)}>
      <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px;border-bottom:1px solid #E6E8EC')}>
        <button onClick={close} aria-label="Back" style={S(RING)}>{BACK}</button>
        <div style={S('flex:1 1 auto;min-width:0;font-size:18px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{d.name || 'Untitled form'}</div>
        <button onClick={() => { c.setConfirmDel(false); setSheet('more'); }} aria-label="More actions" aria-haspopup="dialog" style={S(RING)}>{DOTS}</button>
      </header>
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 24px;display:flex;flex-direction:column;gap:16px')}>
        <Field label="Form name" htmlFor="fm-name"><input id="fm-name" type="text" maxLength={80} value={d.name} onChange={(e) => c.patch((x) => { x.name = e.target.value; })} style={FIELD_IN} /></Field>

        <section style={S(CARD)} aria-label="Settings">
          <SettingRow label="Needed for" value={catNames.length ? catNames.join(', ') : 'No services'} onClick={() => setSheet('cats')} />
          <SettingRow label="Valid for" value={validName} onClick={() => setSheet('valid')} />
          <SettingRow label="Completed by" value={howName} onClick={() => setSheet('how')} />
          <SettingRow label="If it is missing" value={missOn === 'ask' ? 'Ask client when booking' : 'Warn staff'} onClick={() => setSheet('miss')} />
          {staff && <SettingRow label="Patch test" value={d.isPatch ? 'Yes' : 'No'} onClick={() => c.patch((x) => { x.isPatch = !x.isPatch; })} last />}
          {!staff && <SettingRow label="Ask permission for photos" value={d.askPhotos ? 'Yes' : 'No'} onClick={() => c.patch((x) => { x.askPhotos = !x.askPhotos; })} last />}
        </section>
        {staff && d.isPatch && <p style={S('margin:-6px 0 0;font-size:13px;color:#5E6673')}>A patch test is recorded with a date and a result. A reaction puts a warning on the appointment and on the client.</p>}

        {!staff && (
          <Field label="Consent statement (optional)" htmlFor="fm-consent"><textarea id="fm-consent" rows={4} maxLength={1000} value={d.consentText} onChange={(e) => c.patch((x) => { x.consentText = e.target.value; })} placeholder="Clients tick to agree and type their name to sign" style={{ ...FIELD_IN, resize: 'none' }} /></Field>
        )}

        <div>
          <h3 style={S('margin:6px 0 0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Questions</h3>
          <p style={S('margin:2px 0 0;font-size:13px;color:#5E6673')}>{staff && d.isPatch ? 'A patch test is recorded as a date, a result and notes. These questions are shown with the answers.' : 'Clients see these in this order.'}</p>
        </div>
        {d.qs.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>{d.consentText.trim() ? 'No questions. Clients only see the consent statement.' : 'No questions yet. Add the first one below.'}</p>}
        {d.qs.map((q, i) => (
          <section key={q.id} style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:22px;padding:14px;display:flex;flex-direction:column;gap:10px')}>
            <Field label={'Question ' + (i + 1)}><input type="text" maxLength={200} value={q.label} onChange={(e) => c.patch((x) => { x.qs[i].label = e.target.value; })} style={FIELD_IN} /></Field>
            <div className="hscroll" style={S('display:flex;align-items:center;gap:8px;overflow-x:auto')}>
              <select aria-label={'Answer type for question ' + (i + 1)} value={q.type} onChange={(e) => c.patch((x) => { x.qs[i].type = e.target.value as QType; })} style={MINI}>
                {QTYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button type="button" aria-pressed={q.required} onClick={() => c.patch((x) => { x.qs[i].required = !x.qs[i].required; })} style={S('flex:0 0 auto;height:36px;padding:0 14px;border-radius:999px;font:inherit;font-size:13px;font-weight:500;cursor:pointer;border:1px solid ' + (q.required ? '#14624A' : '#E1E4E9') + ';background:' + (q.required ? '#DDF3EA' : '#FFFFFF') + ';color:' + (q.required ? '#14624A' : '#5E6673'))}>{q.required ? 'Required' : 'Optional'}</button>
              <button type="button" onClick={() => mv(i, -1)} disabled={i === 0} aria-label="Move up" style={S(ICON_BTN + 'opacity:' + (i > 0 ? 1 : 0.35))}>{UP}</button>
              <button type="button" onClick={() => mv(i, 1)} disabled={i === d.qs.length - 1} aria-label="Move down" style={S(ICON_BTN + 'opacity:' + (i < d.qs.length - 1 ? 1 : 0.35))}>{DOWN}</button>
              <button type="button" onClick={() => c.patch((x) => { x.qs.splice(i, 1); })} aria-label="Remove question" style={S(ICON_BTN + 'color:#B42318')}>{TRASH}</button>
            </div>
            {(q.type === 'one' || q.type === 'many') && <Field label="Options, separated by commas"><input type="text" value={q.options} onChange={(e) => c.patch((x) => { x.qs[i].options = e.target.value; })} style={FIELD_IN} /></Field>}
            {q.type === 'yesno' && <Field label="If they say yes, ask (optional)"><input type="text" maxLength={120} value={q.detail} onChange={(e) => c.patch((x) => { x.qs[i].detail = e.target.value; })} placeholder="For example, What are you allergic to?" style={FIELD_IN} /></Field>}
          </section>
        ))}

        <section style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:22px;padding:14px;display:flex;flex-direction:column;gap:10px')} aria-label="Add a question">
          <Field label="Add a question" htmlFor="fm-new"><input id="fm-new" type="text" maxLength={200} value={c.nq.label} onChange={(e) => { c.setNq({ ...c.nq, label: e.target.value }); c.setError(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); c.addQ(); } }} placeholder="For example, Are you pregnant or breastfeeding?" style={FIELD_IN} /></Field>
          <div style={S('display:flex;gap:10px;align-items:center')}>
            <select aria-label="Answer type" value={c.nq.type} onChange={(e) => c.setNq({ ...c.nq, type: e.target.value as QType })} style={{ ...MINI, height: 48, flex: '1 1 0', minWidth: 0, borderRadius: 16, padding: '0 12px', fontSize: 14 }}>
              {QTYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button type="button" onClick={c.addQ} className="ghost" style={S('flex:1 1 0;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer')}>Add</button>
          </div>
        </section>
      </main>
      <div style={S(BAR)}>
        {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
        {!!c.notice && <p role="status" style={S('margin:0;color:#14624A;font-size:13.5px;font-weight:500')}>{c.notice}</p>}
        <button type="button" onClick={c.save} disabled={c.busy || !c.isDirty} style={S('height:52px;border:0;border-radius:999px;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer;background:' + (c.isDirty ? '#0E1116' : '#E9ECF0') + ';color:' + (c.isDirty ? '#FFFFFF' : '#5E6673'))}>{c.busy ? 'Saving' : c.isDirty ? 'Save changes' : 'Saved'}</button>
      </div>

      {sheet === 'cats' && <PickSheet title="Needed for" multi help={c.cats.length ? 'Pick the service categories that need this form.' : 'Add a service category under Services first.'} options={c.cats.map((o) => ({ id: o.id, label: o.name }))} values={d.catIds} onPick={(id) => c.patch((x) => { x.catIds = x.catIds.includes(id) ? x.catIds.filter((y) => y !== id) : x.catIds.concat(id); })} onClose={() => setSheet(null)} />}
      {sheet === 'valid' && <PickSheet title="Valid for" help={validHelp} options={VALID_OPTS.map(([v, l]) => ({ id: String(v), label: l }))} values={[String(d.validMonths)]} onPick={(id) => c.patch((x) => { x.validMonths = Number(id); })} onClose={() => setSheet(null)} />}
      {sheet === 'how' && <PickSheet title="Completed by" options={HOW_OPTS.map(([v, l]) => ({ id: v, label: l }))} values={[d.how]} onPick={(id) => c.patch((x) => { x.how = id as typeof x.how; if (id === 'staff' && x.miss === 'ask') x.miss = 'warn'; })} onClose={() => setSheet(null)} />}
      {sheet === 'miss' && <PickSheet title="If it is missing" help={missHelp} options={[{ id: 'warn', label: 'Warn staff' }, { id: 'ask', label: 'Ask client when booking', off: staff }]} values={[missOn]} onPick={(id) => c.patch((x) => { x.miss = id as Miss; })} onClose={() => setSheet(null)} />}
      {sheet === 'more' && (
        <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:8')}>
          <button onClick={() => setSheet(null)} aria-label="Close" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
          <div className="sheet" role="dialog" aria-label="More actions" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column')}>
            <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0;margin-bottom:12px')} />
            <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}>
              <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>More actions</h2>
              <button onClick={() => setSheet(null)} aria-label="Close" style={S(RING)}>{CLOSE}</button>
            </div>
            {!c.confirmDel ? (
              <div style={S('display:flex;flex-direction:column')}>
                {!d.isNew && !c.isDirty && <Link href={`/settings/forms/preview?f=${d.id}`} style={S(rowCss)}>See what clients see</Link>}
                <button onClick={() => (d.isNew ? c.remove() : c.setConfirmDel(true))} style={S(rowCss + ';color:#B42318')}>{d.isNew ? 'Discard form' : 'Delete form'}</button>
              </div>
            ) : (
              <div style={S('display:flex;flex-direction:column;gap:12px;padding:16px;border:1px solid #F3C6C3;border-radius:20px;background:#FEF3F2')}>
                <span style={S('font-size:14.5px;font-weight:600')}>Delete {d.name}?</span>
                <span style={S('font-size:13.5px;color:#5E6673')}>Clients stop being asked for it. Answers already given stay on their record.</span>
                {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
                <div style={S('display:flex;gap:10px')}>
                  <button type="button" onClick={c.remove} disabled={c.busy} style={S('flex:1 1 0;height:48px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font:inherit;font-size:14px;font-weight:500;cursor:pointer')}>Delete form</button>
                  <button type="button" className="ghost" onClick={() => { c.setConfirmDel(false); setSheet(null); }} style={S('flex:1 1 0;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14px;font-weight:500;cursor:pointer')}>Keep</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
