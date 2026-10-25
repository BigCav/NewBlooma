'use client';
// Forms and consultations: what clients fill in before an appointment, which services need which form, how long it stays valid and what happens when one is missing.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../../calendar/pickers';
import { HOW_OPTS, QTYPES, STARTERS, VALID_OPTS, type How, type Miss, type QType, type Tpl } from '@/lib/forms-shared';
import { addStarter, deleteForm, saveForm } from './actions';

type DQ = { id: string; label: string; type: QType; required: boolean; options: string; detail: string };
type Draft = { id: string; isNew: boolean; name: string; catIds: string[]; validMonths: number; how: How; miss: Miss; consentText: string; askPhotos: boolean; isPatch: boolean; qs: DQ[] };
type Props = { templates: Tpl[]; cats: { id: string; name: string }[]; initial?: string };

const draftOf = (t: Tpl): Draft => ({ id: t.id, isNew: false, name: t.name, catIds: t.catIds.slice(), validMonths: t.validMonths, how: t.how, miss: t.miss, consentText: t.consentText ?? '', askPhotos: t.askPhotos, isPatch: t.isPatch,
  qs: t.questions.map((q) => ({ id: q.id, label: q.label, type: q.type, required: q.required, options: q.options.join(', '), detail: q.detailPrompt ?? '' })) });
let UID = 0;
const chip = (on: boolean) => 'flex:0 0 auto;height:44px;padding:0 18px;border-radius:999px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
const tick = (on: boolean) => 'flex:0 0 auto;display:flex;align-items:center;gap:8px;height:44px;padding:0 18px 0 12px;border-radius:999px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;border:1px solid ' + (on ? '#5B3DF5' : '#E1E4E9') + ';background:' + (on ? '#EFEBFF' : '#FFFFFF') + ';color:' + (on ? '#3B2BB5' : '#0E1116');
const INPUT = 'box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF';
const noMin = { minHeight: 0 } as const;
const ICON = 'flex:0 0 auto;width:36px;height:36px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;';

function useForms(props: Props) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => { const mq = window.matchMedia('(max-width:900px)'); const f = () => setNarrow(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  const [forms, setForms] = useState<Draft[]>(() => props.templates.map(draftOf));
  const [sel, setSel] = useState<string>(() => props.templates.find((t) => t.id === props.initial)?.id ?? props.templates[0]?.id ?? '');
  const dirty = useRef<Set<string>>(new Set());
  const [, bump] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [nq, setNq] = useState<{ label: string; type: QType }>({ label: '', type: 'short' });
  const [confirmDel, setConfirmDel] = useState(false);
  const [open, setOpen] = useState(false);
  // New data from the server replaces every form except ones with unsaved edits.
  useEffect(() => { setForms((prev) => { const keepNew = prev.filter((d) => d.isNew); const next = props.templates.map((t) => (dirty.current.has(t.id) ? prev.find((d) => d.id === t.id) ?? draftOf(t) : draftOf(t))); return [...next, ...keepNew]; }); }, [props.templates]);
  const cur = forms.find((d) => d.id === sel) ?? forms[0] ?? null;
  const isDirty = !!cur && (cur.isNew || dirty.current.has(cur.id));

  const patch = (fn: (d: Draft) => void) => { if (!cur) return; setForms((all) => all.map((d) => { if (d.id !== cur.id) return d; const n: Draft = { ...d, catIds: d.catIds.slice(), qs: d.qs.map((q) => ({ ...q })) }; fn(n); return n; })); dirty.current.add(cur.id); bump((x) => x + 1); setNotice(''); setError(''); };
  const pick = (id: string) => { setSel(id); setError(''); setNotice(''); setConfirmDel(false); setOpen(true); };
  const addForm = () => { const id = 'new-' + (++UID); setForms((all) => [...all, { id, isNew: true, name: 'Untitled form', catIds: [], validMonths: 12, how: 'client', miss: 'warn', consentText: '', askPhotos: false, isPatch: false, qs: [] }]); setSel(id); setError(''); setNotice(''); setConfirmDel(false); setOpen(true); };
  const save = () => {
    if (!cur) return;
    const d = cur;
    startT(async () => {
      const r = await saveForm({ id: d.isNew ? null : d.id, name: d.name, catIds: d.catIds, validMonths: d.validMonths, how: d.how, miss: d.miss, consentText: d.consentText, askPhotos: d.askPhotos, isPatch: d.isPatch,
        questions: d.qs.map((q) => ({ id: q.id, label: q.label, type: q.type, required: q.required, options: q.options.split(/[,\n]/).map((o) => o.trim()).filter(Boolean), detailPrompt: q.detail })) });
      if (r.error) { setError(r.error); setNotice(''); return; }
      dirty.current.delete(d.id);
      if (d.isNew) { setForms((all) => all.filter((x) => x.id !== d.id)); setSel(r.id!); }
      setError(''); setNotice(r.notice ?? 'Saved'); router.refresh();
    });
  };
  const remove = () => { if (!cur) return; const d = cur; if (d.isNew) { setForms((all) => all.filter((x) => x.id !== d.id)); setSel(forms.find((x) => x.id !== d.id)?.id ?? ''); setOpen(false); return; } startT(async () => { const r = await deleteForm(d.id); if (r.error) { setError(r.error); return; } dirty.current.delete(d.id); setConfirmDel(false); setSel(''); setOpen(false); setNotice(r.notice ?? ''); router.refresh(); }); };
  const starter = (key: string) => startT(async () => { const r = await addStarter(key); if (r.error) { setError(r.error); return; } setSel(r.id!); setOpen(true); setError(''); setNotice('Form added. Check the details, then save any changes.'); router.refresh(); });
  const addQ = () => { const t = nq.label.trim(); if (!t) { setError('Type the question first.'); return; } patch((d) => { d.qs.push({ id: 'q' + (++UID), label: t, type: nq.type, required: false, options: nq.type === 'one' || nq.type === 'many' ? 'Option one, Option two' : '', detail: '' }); }); setNq({ label: '', type: nq.type }); };
  const unused = STARTERS.filter((s) => !forms.some((f) => f.name.trim().toLowerCase() === s.name.toLowerCase()));
  return { ...props, busy, narrow, forms, cur, sel, pick, addForm, patch, save, remove, starter, unused, error, setError, notice, nq, setNq, addQ, isDirty, confirmDel, setConfirmDel, open, setOpen };
}
type C = ReturnType<typeof useForms>;

const SCROLL = 'display:flex;flex-wrap:nowrap;align-items:center;gap:8px;overflow-x:auto;margin:0 -20px;padding:0 20px 2px;scrollbar-width:none;-webkit-overflow-scrolling:touch';
const Section = ({ id, label, children, help, m }: { id: string; label: string; children: React.ReactNode; help?: string; m?: boolean }) => (
  <div style={S('display:flex;flex-direction:column;gap:8px')}>
    <span id={id} style={S('font-size:14px;font-weight:600')}>{label}</span>
    <div role="group" aria-labelledby={id} style={S(m ? SCROLL : 'display:flex;flex-wrap:wrap;gap:8px')}>{children}</div>
    {!!help && <p style={S('margin:0;color:#5E6673;font-size:13.5px')}>{help}</p>}
  </div>
);

function Editor({ c, m }: { c: C; m: boolean }) {
  const d = c.cur;
  if (!d) return (
    <section style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:14px')}>
      <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>No forms yet</h2>
      <p style={S('margin:0;color:#5E6673;font-size:14.5px')}>Forms are what clients fill in before a visit, like a consultation or a consent. Start from a ready-made one and change it, or make your own with New form.</p>
      {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
      <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>{c.unused.map((s) => <button key={s.key} onClick={() => c.starter(s.key)} disabled={c.busy} style={S(chip(false))}>{s.name}</button>)}</div>
    </section>
  );
  const staff = d.how === 'staff';
  const missOn: Miss = staff && d.miss === 'ask' ? 'warn' : d.miss;
  const validName = VALID_OPTS.find((v) => v[0] === d.validMonths)?.[1] ?? '';
  const reqText = d.catIds.length ? 'Needed for ' + c.cats.filter((x) => d.catIds.includes(x.id)).map((x) => x.name.toLowerCase()).join(', ') + ' services' : 'Not needed for any service yet';
  const mv = (i: number, dir: number) => c.patch((x) => { const t = x.qs[i + dir]; x.qs[i + dir] = x.qs[i]; x.qs[i] = t; });
  return (
    <section aria-label="Edit form" style={S('display:flex;flex-direction:column;gap:20px;min-width:0')}>
      <div style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:' + (m ? 20 : 28) + 'px;display:flex;flex-direction:column;gap:22px')}>
        <div><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{d.name || 'Untitled form'}</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>{reqText}</p></div>
        <div style={S('display:flex;flex-direction:column;gap:8px')}>
          <label htmlFor="fm-name" style={S('font-size:14px;font-weight:600')}>Form name</label>
          <input id="fm-name" className="field" type="text" maxLength={80} value={d.name} onChange={(e) => c.patch((x) => { x.name = e.target.value; })} style={{ ...S(INPUT), ...noMin }} />
        </div>
        <Section m={m} id="g-cats" label="Needed for" help={c.cats.length ? undefined : 'Add a service category under Services first.'}>
          {c.cats.map((o) => { const on = d.catIds.includes(o.id); return <button key={o.id} type="button" aria-pressed={on} onClick={() => c.patch((x) => { x.catIds = on ? x.catIds.filter((y) => y !== o.id) : x.catIds.concat(o.id); })} style={S(tick(on))}>
            <span aria-hidden="true" style={S('flex:0 0 20px;width:20px;height:20px;border-radius:6px;border:1.5px solid ' + (on ? '#5B3DF5' : '#B9BFC9') + ';background:#FFFFFF;display:flex;align-items:center;justify-content:center')}>{on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5B3DF5" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}</span>{o.name}</button>; })}
        </Section>
        <Section m={m} id="g-valids" label="Valid for" help={d.validMonths === 0 ? 'Clients complete this form again at every visit.' : 'After it is completed, it stays valid for ' + validName + '. Then clients are asked again.'}>
          {VALID_OPTS.map(([v, l]) => <button key={v} type="button" aria-pressed={d.validMonths === v} onClick={() => c.patch((x) => { x.validMonths = v; })} style={S(chip(d.validMonths === v))}>{l}</button>)}
        </Section>
        <Section m={m} id="g-hows" label="Who completes it">
          {HOW_OPTS.map(([v, l]) => <button key={v} type="button" aria-pressed={d.how === v} onClick={() => c.patch((x) => { x.how = v; if (v === 'staff' && x.miss === 'ask') x.miss = 'warn'; })} style={S(chip(d.how === v))}>{l}</button>)}
        </Section>
        <Section m={m} id="g-miss" label="If it is missing at the appointment" help={staff ? 'Staff-recorded forms cannot be asked for online, so staff are warned on the calendar.' : missOn === 'ask' ? 'Clients are asked to complete it as soon as they book online. Staff still see a warning.' : 'Staff see a warning on the appointment in the calendar. Booking still goes through.'}>
          <button type="button" aria-pressed={missOn === 'warn'} onClick={() => c.patch((x) => { x.miss = 'warn'; })} style={S(chip(missOn === 'warn'))}>Warn staff</button>
          <button type="button" aria-pressed={missOn === 'ask'} disabled={staff} onClick={() => c.patch((x) => { x.miss = 'ask'; })} style={S(chip(missOn === 'ask') + (staff ? ';opacity:0.45;cursor:not-allowed' : ''))}>Ask client when booking</button>
        </Section>
        {staff && (
          <Section m={m} id="g-patch" label="Patch test" help="A patch test is recorded with a date and a result. A reaction puts a warning on the appointment and on the client.">
            <button type="button" aria-pressed={d.isPatch} onClick={() => c.patch((x) => { x.isPatch = !x.isPatch; })} style={S(chip(d.isPatch))}>{d.isPatch ? 'This is a patch test' : 'Treat as a patch test'}</button>
          </Section>
        )}
        {!staff && (<>
          <div style={S('display:flex;flex-direction:column;gap:8px')}>
            <label htmlFor="fm-consent" style={S('font-size:14px;font-weight:600')}>Consent statement (optional)</label>
            <textarea id="fm-consent" className="field" rows={4} maxLength={1000} value={d.consentText} onChange={(e) => c.patch((x) => { x.consentText = e.target.value; })} placeholder="Clients tick to agree and type their name to sign" style={{ ...S('box-sizing:border-box;width:100%;padding:12px 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF;resize:vertical'), ...noMin }} />
          </div>
          <Section m={m} id="g-photos" label="Photos">
            <button type="button" aria-pressed={d.askPhotos} onClick={() => c.patch((x) => { x.askPhotos = !x.askPhotos; })} style={S(chip(d.askPhotos))}>{d.askPhotos ? 'Asking permission for photos' : 'Ask permission for photos'}</button>
          </Section>
        </>)}
      </div>

      <div style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:' + (m ? 20 : 28) + 'px;display:flex;flex-direction:column;gap:16px')}>
        <div><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>Questions</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>{staff && d.isPatch ? 'A patch test is recorded as a date, a result and notes. These questions are shown with the answers.' : 'Clients see these in this order.'}</p></div>
        {d.qs.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>{d.consentText.trim() ? 'No questions. Clients only see the consent statement.' : 'No questions yet. Add the first one below.'}</p>}
        <ul style={S('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:' + (m ? 16 : 12) + 'px')}>
          {d.qs.map((q, i) => (
            <li key={q.id} style={S(m ? 'display:flex;flex-direction:column;gap:10px;padding:' + (i === 0 ? '0' : '16px') + ' 0 0;border-top:' + (i === 0 ? '0' : '1px solid #EEF0F3') : 'display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid #EEF0F3;border-radius:18px;background:#FAFAFB')}>
              <input aria-label={'Question ' + (i + 1)} className="field" type="text" maxLength={200} value={q.label} onChange={(e) => c.patch((x) => { x.qs[i].label = e.target.value; })} style={{ ...S(INPUT), ...noMin }} />
              <div style={S(m ? SCROLL : 'display:flex;flex-wrap:wrap;align-items:center;gap:8px')}>
                <select aria-label={'Answer type for question ' + (i + 1)} value={q.type} onChange={(e) => c.patch((x) => { x.qs[i].type = e.target.value as QType; })} style={{ ...S('flex:0 0 auto;box-sizing:border-box;height:36px;padding:0 10px;border:1px solid #E1E4E9;border-radius:999px;font:inherit;font-size:13px;color:#0E1116;background:#FFFFFF'), ...noMin, width: 'auto' }}>
                  {QTYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button type="button" aria-pressed={q.required} onClick={() => c.patch((x) => { x.qs[i].required = !x.qs[i].required; })} style={S('flex:0 0 auto;height:36px;padding:0 14px;border-radius:999px;font:inherit;font-size:13px;font-weight:500;cursor:pointer;border:1px solid ' + (q.required ? '#14624A' : '#E1E4E9') + ';background:' + (q.required ? '#DDF3EA' : '#FFFFFF') + ';color:' + (q.required ? '#14624A' : '#5E6673'))}>{q.required ? 'Required' : 'Optional'}</button>
                {!m && <span style={S('flex:1 1 auto')} />}
                <button type="button" onClick={() => mv(i, -1)} disabled={i === 0} aria-label="Move up" style={S(ICON + 'opacity:' + (i > 0 ? 1 : 0.35))}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 14l6-6 6 6" /></svg></button>
                <button type="button" onClick={() => mv(i, 1)} disabled={i === d.qs.length - 1} aria-label="Move down" style={S(ICON + 'opacity:' + (i < d.qs.length - 1 ? 1 : 0.35))}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 10l6 6 6-6" /></svg></button>
                <button type="button" onClick={() => c.patch((x) => { x.qs.splice(i, 1); })} aria-label="Remove question" style={S(ICON + 'color:#B42318')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg></button>
              </div>
              {(q.type === 'one' || q.type === 'many') && <input aria-label={'Options for question ' + (i + 1)} className="field" type="text" value={q.options} onChange={(e) => c.patch((x) => { x.qs[i].options = e.target.value; })} placeholder="Options, separated by commas" style={{ ...S(INPUT + ';height:44px'), ...noMin }} />}
              {q.type === 'yesno' && <input aria-label={'Follow-up for question ' + (i + 1)} className="field" type="text" maxLength={120} value={q.detail} onChange={(e) => c.patch((x) => { x.qs[i].detail = e.target.value; })} placeholder="If they say yes, ask (optional), for example What are you allergic to?" style={{ ...S(INPUT + ';height:44px'), ...noMin }} />}
            </li>
          ))}
        </ul>
        <div style={S('display:flex;flex-direction:column;gap:8px')}>
          <label htmlFor="fm-new" style={S('font-size:14px;font-weight:600')}>Add a question</label>
          <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>
            <input id="fm-new" className="field" type="text" maxLength={200} value={c.nq.label} onChange={(e) => { c.setNq({ ...c.nq, label: e.target.value }); c.setError(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); c.addQ(); } }} placeholder="For example, Are you pregnant or breastfeeding?" style={{ ...S(INPUT), ...noMin, flex: '1 1 240px', width: 'auto' }} />
            <select aria-label="Answer type" value={c.nq.type} onChange={(e) => c.setNq({ ...c.nq, type: e.target.value as QType })} style={{ ...S('box-sizing:border-box;height:48px;padding:0 12px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:14px;color:#0E1116;background:#FFFFFF'), ...noMin, width: 'auto' }}>
              {QTYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button type="button" onClick={c.addQ} className="ghost" style={S('height:48px;padding:0 20px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14px;font-weight:500;cursor:pointer')}>Add</button>
          </div>
        </div>
      </div>

      <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:12px')}>
        <button type="button" onClick={c.save} disabled={c.busy || !c.isDirty} style={S('height:48px;padding:0 28px;border:0;border-radius:999px;font:inherit;font-size:15px;font-weight:500;cursor:pointer;background:' + (c.isDirty ? '#0E1116' : '#E9ECF0') + ';color:' + (c.isDirty ? '#FFFFFF' : '#5E6673'))}>{c.busy ? 'Saving' : c.isDirty ? 'Save changes' : 'Saved'}</button>
        {!d.isNew && !c.isDirty && <Link href={`/settings/forms/preview?f=${d.id}`} className="ghost" style={S('display:flex;align-items:center;height:48px;box-sizing:border-box;padding:0 22px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500;text-decoration:none')}>See what clients see</Link>}
        {!c.confirmDel && <button type="button" className="ghost" onClick={() => (d.isNew ? c.remove() : c.setConfirmDel(true))} style={S('height:48px;padding:0 16px;border:0;border-radius:999px;background:transparent;color:#B42318;font:inherit;font-size:14px;font-weight:500;cursor:pointer')}>{d.isNew ? 'Discard' : 'Delete form'}</button>}
        {!!c.error && <span role="alert" style={S('color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</span>}
        {!!c.notice && <span role="status" style={S('color:#14624A;font-size:13.5px;font-weight:500')}>{c.notice}</span>}
      </div>
      {c.confirmDel && (
        <div style={S('display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid #F3C6C3;border-radius:16px;background:#FEF3F2')}>
          <span style={S('font-size:14px;font-weight:600')}>Delete {d.name}?</span>
          <span style={S('font-size:13.5px;color:#5E6673')}>Clients stop being asked for it. Answers already given stay on their record.</span>
          <div style={S('display:flex;gap:10px')}>
            <button type="button" onClick={c.remove} disabled={c.busy} style={S('flex:1 1 0;height:44px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font:inherit;font-size:14px;font-weight:500;cursor:pointer')}>Delete form</button>
            <button type="button" className="ghost" onClick={() => c.setConfirmDel(false)} style={S('flex:1 1 0;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14px;font-weight:500;cursor:pointer')}>Keep</button>
          </div>
        </div>
      )}
    </section>
  );
}

function DeskList({ c }: { c: C }) {
  const sub = (d: C['forms'][number]) => (d.catIds.length ? c.cats.filter((x) => d.catIds.includes(x.id)).map((x) => x.name).join(', ') : 'No services') + ' · ' + d.qs.length + (d.qs.length === 1 ? ' question' : ' questions');
  return (
    <nav aria-label="Forms" style={S('flex:0 0 300px;display:flex;flex-direction:column;gap:10px')}>
      <div style={S('display:flex;flex-direction:column;gap:8px')}>
        {c.forms.map((d) => { const on = d.id === c.cur?.id; return (
          <button key={d.id} type="button" onClick={() => c.pick(d.id)} aria-current={on} style={S('width:100%;box-sizing:border-box;text-align:left;font:inherit;cursor:pointer;padding:14px 16px;border-radius:16px;display:flex;flex-direction:column;gap:2px;border:1px solid ' + (on ? '#0E1116' : '#E6E8EC') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116'))}><span style={S('font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{d.name || 'Untitled form'}</span><span style={S('font-size:12.5px;color:' + (on ? '#C9CDD5' : '#5E6673'))}>{sub(d)}</span></button>); })}
      </div>
      <button type="button" onClick={c.addForm} className="ghost" style={S('height:44px;border:1px dashed #C9CDD5;border-radius:16px;background:transparent;color:#0E1116;font:inherit;font-size:14px;font-weight:500;cursor:pointer')}>+ New form</button>
      {c.forms.length > 0 && c.unused.length > 0 && (
        <div style={S('display:flex;flex-direction:column;gap:8px;padding-top:6px')}>
          <span style={S('font-size:13px;color:#5E6673')}>Add a ready-made form</span>
          <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>{c.unused.map((s) => <button key={s.key} type="button" onClick={() => c.starter(s.key)} disabled={c.busy} className="ghost" style={S('height:36px;padding:0 14px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:13px;font-weight:500;cursor:pointer')}>{s.name}</button>)}</div>
        </div>
      )}
    </nav>
  );
}

const Chevron = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')}><path d="M9 6l6 6-6 6" /></svg>;

/** Phone: a list of forms like Settings, and each one opens as a full-page sheet. */
function MobileList({ c }: { c: C }) {
  const sub = (d: C['forms'][number]) => (d.catIds.length ? c.cats.filter((x) => d.catIds.includes(x.id)).map((x) => x.name).join(', ') : 'Not needed for any service yet') + ' · ' + d.qs.length + (d.qs.length === 1 ? ' question' : ' questions');
  return (<>
    {c.forms.length > 0 && (
      <ul style={S('margin:0;padding:4px 0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px')}>
        {c.forms.map((d, i) => (
          <li key={d.id}>
            <button onClick={() => c.pick(d.id)} aria-label={(d.name || 'Untitled form') + ', ' + sub(d)} style={S('display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:68px;padding:10px 16px;border:0;border-bottom:' + (i === c.forms.length - 1 ? '0' : '1px solid #EEF0F3') + ';background:transparent;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
              <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{d.name || 'Untitled form'}</span><span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673')}>{sub(d)}</span></span><Chevron />
            </button>
          </li>
        ))}
      </ul>
    )}
    {c.forms.length === 0 && <section style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px;display:flex;flex-direction:column;gap:6px')}><h2 style={S('margin:0;font-size:17px;font-weight:600')}>No forms yet</h2><p style={S('margin:0;color:#5E6673;font-size:14px')}>Forms are what clients fill in before a visit. Add a ready-made one below, or make your own.</p></section>}
    <button onClick={c.addForm} style={S('height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:15px;font-weight:500;cursor:pointer')}>New form</button>
    {!!c.error && !c.open && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
    {!!c.notice && !c.open && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{c.notice}</span>}
    {c.unused.length > 0 && (
      <section aria-label="Ready-made forms" style={S('display:flex;flex-direction:column;gap:8px')}>
        <h2 style={S('margin:6px 0 0;font-size:16px;font-weight:600')}>Ready-made forms</h2>
        <ul style={S('margin:0;padding:4px 0;list-style:none;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px')}>
          {c.unused.map((s, i) => (
            <li key={s.key} style={S('display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 16px;border-bottom:' + (i === c.unused.length - 1 ? '0' : '1px solid #EEF0F3'))}>
              <span style={S('flex:1 1 auto;min-width:0;font-size:14.5px;font-weight:500;overflow-wrap:anywhere')}>{s.name}</span>
              <button onClick={() => c.starter(s.key)} disabled={c.busy} className="ghost" aria-label={'Add ' + s.name} style={S('flex:0 0 auto;height:40px;padding:0 18px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14px;font-weight:500;cursor:pointer')}>Add</button>
            </li>
          ))}
        </ul>
      </section>
    )}
  </>);
}

export function FormsView(props: Props) {
  const c = useForms(props);
  const back = <Link href="/settings" style={S('display:inline-flex;align-items:center;min-height:44px;color:#4A525E;font-size:14px;font-weight:500;text-decoration:none')}>&larr; Settings</Link>;
  return (<>
    {c.narrow !== false && (
      <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
        <MobileHeader title="Forms" subtitle="What clients fill in before a visit" showSearch={false} />
        <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>{back}<MobileList c={c} /></main>
        <MobileTabs active="more" />
        {c.open && c.cur && (
          <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:5')}>
            <button onClick={() => c.setOpen(false)} aria-label="Close form" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
            <div className="sheet" role="dialog" aria-label="Edit form" style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;max-height:92%;overflow-y:auto;background:#F4F5F7;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:18px')}>
              <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0')} />
              <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
                <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{c.cur.name || 'Untitled form'}</h2>
                <button onClick={() => c.setOpen(false)} aria-label="Close" style={S('flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
              </div>
              <Editor c={c} m={true} />
            </div>
          </div>
        )}
      </div>
    )}
    {c.narrow !== true && (
      <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:24px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
        <div>{back}</div>
        <PageHeader title="Forms and consultations" subtitle="What clients fill in before an appointment. Set which services need which form, how long it stays valid, and what happens when one is missing." showSearch={false} showAction={false} />
        <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}><DeskList c={c} /><div style={S('flex:999 1 520px;min-width:0')}><Editor c={c} m={false} /></div></div>
      </div>
    )}
  </>);
}
