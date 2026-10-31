'use client';
// Forms and consultations: what clients fill in before an appointment, which services need which form, how long it stays valid and what happens when one is missing.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../../calendar/pickers';
import { HOW_OPTS, QTYPES, STARTERS, VALID_OPTS, type How, type Miss, type QType, type Tpl } from '@/lib/forms-shared';
import { addStarter, deleteForm, saveForm } from './actions';
import { FormPage } from './FormPage';

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
export type FormsCtl = C;

const SCROLL = 'display:flex;flex-wrap:nowrap;align-items:center;gap:8px;overflow-x:auto;margin:0 -20px;padding:0 20px 2px;scrollbar-width:none;-webkit-overflow-scrolling:touch';
const Section = ({ id, label, children, help, m }: { id: string; label: string; children: React.ReactNode; help?: string; m?: boolean }) => (
  <div style={S('display:flex;flex-direction:column;gap:8px')}>
    <span id={id} style={S('font-size:14px;font-weight:600')}>{label}</span>
    <div role="group" aria-labelledby={id} style={S(m ? SCROLL : 'display:flex;flex-wrap:wrap;gap:8px')}>{children}</div>
    {!!help && <p style={S('margin:0;color:#5E6673;font-size:13.5px')}>{help}</p>}
  </div>
);

const Chevron = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')}><path d="M9 6l6 6-6 6" /></svg>;

/** Phone: a list of forms like Settings, and each one opens as a full-page sheet. */
const FORM_ICON = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3A2BB5" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 9h6M9 13h6M9 17h3" /></svg>;
const TILE = 'flex:0 0 44px;width:44px;height:44px;border-radius:14px;background:#EEEAFE;display:flex;align-items:center;justify-content:center';

/** Phone: a card per form, then ready-made ones. A form opens as its own page. */
function MobileList({ c }: { c: C }) {
  const sub = (d: C['forms'][number]) => (d.catIds.length ? c.cats.filter((x) => d.catIds.includes(x.id)).map((x) => x.name).join(', ') : 'Not needed for any service yet') + ' · ' + d.qs.length + (d.qs.length === 1 ? ' question' : ' questions');
  return (<>
    <button onClick={c.addForm} style={S('height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer')}>New form</button>
    {!!c.error && !c.open && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
    {!!c.notice && !c.open && <span role="status" style={S('align-self:flex-start;padding:6px 14px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:13px;font-weight:500')}>{c.notice}</span>}
    {c.forms.map((d) => (
      <button key={d.id} onClick={() => c.pick(d.id)} aria-label={(d.name || 'Untitled form') + ', ' + sub(d)} style={S('display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;padding:16px;border:1px solid #E6E8EC;border-radius:22px;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
        <span style={S(TILE)}>{FORM_ICON}</span>
        <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:16px;font-weight:600;letter-spacing:-0.01em;overflow-wrap:anywhere')}>{d.name || 'Untitled form'}</span><span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{sub(d)}</span></span><Chevron />
      </button>
    ))}
    {c.forms.length === 0 && <section style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px;display:flex;flex-direction:column;gap:6px')}><h2 style={S('margin:0;font-size:17px;font-weight:600')}>No forms yet</h2><p style={S('margin:0;color:#5E6673;font-size:14px')}>Forms are what clients fill in before a visit. Add a ready-made one below, or make your own.</p></section>}
    {c.unused.length > 0 && (
      <section aria-label="Ready-made forms" style={S('display:flex;flex-direction:column;gap:10px')}>
        <h2 style={S('margin:6px 0 0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Ready-made forms</h2>
        {c.unused.map((s) => (
          <div key={s.key} style={S('display:flex;align-items:center;gap:14px;box-sizing:border-box;padding:14px 16px;border:1px solid #E6E8EC;border-radius:22px;background:#FFFFFF')}>
            <span style={S(TILE)}>{FORM_ICON}</span>
            <span style={S('flex:1 1 auto;min-width:0;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{s.name}</span>
            <button onClick={() => c.starter(s.key)} disabled={c.busy} className="ghost" aria-label={'Add ' + s.name} style={S('flex:0 0 auto;height:40px;padding:0 18px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14px;font-weight:500;cursor:pointer')}>Add</button>
          </div>
        ))}
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
        <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:14px')}><MobileList c={c} /></main>
        <MobileTabs active="more" />
        {c.open && c.cur && <FormPage key={c.cur.id} c={c} />}
      </div>
    )}
    {c.narrow !== true && (
      <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:24px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
        <div>{back}</div>
        <PageHeader title="Forms and consultations" subtitle="What clients fill in before an appointment. Set which services need which form, how long it stays valid, and what happens when one is missing." showSearch={false} showAction={false} />
        <div style={S('width:100%;max-width:760px;display:flex;flex-direction:column;gap:14px')}><MobileList c={c} /></div>
        {c.open && c.cur && <div className="m-cal cal-root m-drawer"><FormPage key={c.cur.id} c={c} /></div>}
      </div>
    )}
  </>);
}
