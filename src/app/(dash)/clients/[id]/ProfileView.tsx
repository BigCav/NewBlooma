'use client';
// The client's profile, on a phone and on a computer. The computer shows the same pages in a drawer on the right.
import { AnswerBox, Avatar, BACK, BAR, BLACK, CHEV, CLOSE, Chip, DOTS, FIELD_IN, Field, FieldError, FilterChip, MENU_ROW, Notice, OUTLINE, PAGE, RING, ScreenHeader, SwitchRow, dim } from '@/components/ui';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmBox } from '@/components/ConfirmBox';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { MobileTabs } from '@/components/Chrome';
import { S } from '../../calendar/pickers';
import { ChatPage, ChatPanel } from '@/components/ChatPanel';
import { QaGroup, QA_ITEM, QuickActions } from '../../calendar/VisitSheet';
import { addNote, deleteClient, recordPatchTest, removeNote, saveFormula, sendClientMessage, setAllergies, setPatchTest, setPreference, updateClient } from '../actions';
import { phoneInput } from '@/lib/phone';
import { PATCH_TONE, TAG_TONE, patchInfo, type Channels, type ClientRow } from '../shared';
import { niceDate } from '@/lib/forms-shared';
import { dollars } from '@/lib/format';
import { plural } from '@/lib/display';
import { firstName } from '@/lib/people';
import { PAYMENT_STATUS, bookingStatus } from '@/lib/status';
import { TONE } from '@/lib/tones';

export type ProfileData = {
  row: ClientRow; since: string; allergies: string[]; patchOn: string | null; formula: string; reminders: boolean; marketing: boolean;
  notes: { id: string; text: string }[];
  forms: { id: string; name: string; date: string; flagged: boolean; answers: { k: string; v: string }[] }[];
  today: string; channels: Channels;
  messages: { id: string; mine: boolean; text: string; day: string; time: string }[];
  appts: { id: string; href: string; month: string; label: string; time: string; status: string; staff: string; services: string; cents: number; pay: string; upcoming: boolean }[];
};

function useProfile(d: ProfileData) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const { row } = d;
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const [notes, setNotes] = useState(d.notes);
  const [allergies, setAl] = useState(d.allergies);
  const [patchOn, setPatchOn] = useState(d.patchOn);
  const [formula, setFormula] = useState(d.formula);
  const [saved, setSaved] = useState(d.formula);
  const [reminders, setReminders] = useState(d.reminders);
  const [marketing, setMarketing] = useState(d.marketing);
  const [noteDraft, setNoteDraft] = useState('');
  const [allergyDraft, setAllergyDraft] = useState('');
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [ed, setEd] = useState({ name: '', email: '', phone: '' });
  const [confirmDel, setConfirmDel] = useState(false);
  const [ask, setAsk] = useState<{ kind: 'note' | 'allergy'; key: string; label: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const first = firstName(row.name);
  const fail = (e?: string) => { setError(e ?? 'Something went wrong. Please try again.'); };
  const run = (fn: () => Promise<{ error?: string }>, ok: () => void) => startT(async () => { const r = await fn(); if (r.error) { fail(r.error); return; } setError(''); ok(); });

  return {
    d, row, first, narrow, busy, notes, allergies, patchOn, formula, setFormula, saved, reminders, marketing, noteDraft, setNoteDraft, allergyDraft, setAllergyDraft, mode, setMode, notice, setNotice, error, setError,
    addNote: () => { const t = noteDraft.trim(); if (!t) return; startT(async () => { const r = await addNote(row.id, t); if (r.error) { fail(r.error); return; } setError(''); setNotes((n) => [...n, { id: r.id!, text: t }]); setNoteDraft(''); setNotice('Note added'); }); },
    removeNote: (id: string) => run(() => removeNote(id), () => { setNotes((n) => n.filter((x) => x.id !== id)); }),
    addAllergy: () => { const t = allergyDraft.trim(); if (!t) return; const next = allergies.includes(t) ? allergies : [...allergies, t]; run(() => setAllergies(row.id, next), () => { setAl(next); setAllergyDraft(''); setNotice('Alert added'); }); },
    removeAllergy: (i: number) => { const next = allergies.filter((_, j) => j !== i); run(() => setAllergies(row.id, next), () => setAl(next)); },
    recordPatch: () => startT(async () => { const r = await recordPatchTest(row.id); if (r.error) { fail(r.error); return; } setPatchOn(r.on!); setNotice('Patch test recorded for today'); }),
    setPatch: (on: string | null) => run(() => setPatchTest(row.id, on), () => { setPatchOn(on); }),
    saveFormula: () => run(() => saveFormula(row.id, formula), () => { setSaved(formula); setNotice('Formula saved'); }),
    toggle: (k: 'reminders' | 'marketing') => { const v = k === 'reminders' ? !reminders : !marketing; run(() => setPreference(row.id, k, v), () => (k === 'reminders' ? setReminders(v) : setMarketing(v))); },
    ed, setEd, confirmDel, setConfirmDel, ask, setAsk,
    startEdit: () => { setEd({ name: row.name, email: row.email, phone: row.phone }); setConfirmDel(false); setMode('edit'); setError(''); setNotice(''); },
    saveEdit: () => { if (!ed.name.trim()) { setError("Add the client's name."); return; } run(() => updateClient(row.id, ed.name, ed.email, ed.phone), () => { setMode('view'); setNotice('Details saved'); router.refresh(); }); },
    removeClient: () => run(() => deleteClient(row.id), () => { router.push('/clients'); router.refresh(); }),
  };
}
type C = ReturnType<typeof useProfile>;

const CARD_M = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px;display:flex;flex-direction:column;gap:14px';
const LIST_CARD = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:8px 20px';
const TXTIN = (h: number) => ({ ...S('box-sizing:border-box;width:100%;height:' + h + 'px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF;flex:1 1 auto;min-width:0'), minHeight: 0 });
const X = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;
const PHONE_P = 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z';
const MAIL_P = 'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm0 1 8 6 8-6';
const CAL_P = 'M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V7A1.5 1.5 0 0 1 5 5.5zM3.5 10h17M8 3.5v4M16 3.5v4';
const ico = (path: string) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true"><path d={path} /></svg>;
const MAIL_ICON = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="3" /><path d="m4.5 7.5 7.5 5.5 7.5-5.5" /></svg>;

/** Asks before a note or an allergy is taken off the client. */
function AskRemove({ c }: { c: C }) {
  const a = c.ask;
  if (!a) return null;
  return <ConfirmBox label="Confirm removal" title={a.kind === 'note' ? 'Remove this note?' : 'Remove ' + a.label + ' from the allergies?'} body={a.kind === 'note' ? a.label : undefined} action="Remove" busy={c.busy}
    onAction={() => { c.setAsk(null); if (a.kind === 'note') c.removeNote(a.key); else c.removeAllergy(Number(a.key)); }} onKeep={() => c.setAsk(null)} />;
}

/** A text box with an Add button beside it (notes, allergies). */
function AddRow({ id, value, onChange, onAdd, placeholder, busy }: { id: string; value: string; onChange: (v: string) => void; onAdd: () => void; placeholder: string; busy: boolean }) {
  return (
    <div style={S('display:flex;gap:8px')}><label htmlFor={id} style={S('position:absolute;left:-9999px')}>{placeholder}</label>
      <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }} placeholder={placeholder} style={TXTIN(48)} />
      <button onClick={onAdd} disabled={busy} style={S(BLACK + ';flex:0 0 auto;height:48px;padding:0 20px' + dim(busy))}>{busy ? 'Adding…' : 'Add'}</button></div>
  );
}

/** The number beside a menu row (how many notes, forms ...). */
const Count = ({ n }: { n: number }) => <span style={S('flex:0 0 auto;min-width:24px;height:24px;padding:0 8px;box-sizing:border-box;border-radius:999px;font-size:12.5px;font-weight:600;display:flex;align-items:center;justify-content:center;background:' + TONE.grey.bg + ';color:' + TONE.grey.fg)}>{n}</span>;

type Sub = 'home' | 'overview' | 'appointments' | 'messages' | 'details' | 'notes' | 'alerts' | 'formula' | 'forms' | 'prefs';
const SUB_TITLE: Record<Sub, string> = { home: '', overview: 'Overview', appointments: 'Appointments', messages: 'Messages', details: 'Client details', notes: 'Notes', alerts: 'Allergies and patch tests', formula: 'Colour formula', forms: 'Client forms', prefs: 'Preferences' };

/** What a visit in the appointments list is called and coloured: the booking status table, plus Refunded for a refunded sale. */
const visitStatus = (s: string) => (s === 'refunded' ? PAYMENT_STATUS.refunded : bookingStatus(s));
/** Visits that did not happen (or were paid back) sit in a faded red card with the text struck through. */
const STRUCK = ['cancelled', 'no_show', 'refunded'];
const CARD_PLAIN = 'background:#FFFFFF;border:1px solid #E6E8EC;color:#0E1116';
const CARD_STRUCK = 'background:color-mix(in srgb, ' + TONE.red.bg + ' 45%, #FFFFFF);border:1px solid ' + TONE.red.bg + ';color:' + TONE.red.fg;

/** The front page of a profile: who it is, the three round actions, contact details and the list of pages. */
function ProfileHome({ c, messages, rec, setRec, onOpen, onMore }: { c: C; messages: number; rec: boolean; setRec: (v: boolean) => void; onOpen: (v: Sub) => void; onMore: () => void }) {
  const { row, d } = c;
  const book = `/calendar?new=1&c=${encodeURIComponent(row.name)}`;
  const ring = RING + ';flex:0 0 52px;width:52px;height:52px';
  const counts: Partial<Record<Sub, number>> = { appointments: d.appts.length, messages, notes: c.notes.length, alerts: c.allergies.length, forms: d.forms.length };
  const menu = (id: Sub, label: string, indent?: boolean) => (
    <button key={id} onClick={() => onOpen(id)} style={S(MENU_ROW + (indent ? ';padding-left:24px' : ''))}>
      <span style={S('flex:1 1 auto;min-width:0')}>{label}</span>
      {!!counts[id] && <Count n={counts[id]!} />}
      {CHEV}
    </button>
  );
  return (<>
    <div style={S('display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 0 4px;text-align:center')}>
      <Avatar name={row.name} size="hero" />
      <h1 style={S('margin:12px 0 0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;overflow-wrap:anywhere')}>{row.name}</h1>
      <div style={S('display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px')}><Chip tone={TAG_TONE[row.tag]}>{row.tag}</Chip>{!!row.email && <span style={S('font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{row.email}</span>}</div>
    </div>
    {!!c.notice && <div style={S('align-self:center')}><Notice>{c.notice}</Notice></div>}
    <div style={S('display:flex;gap:10px')}>
      <button onClick={onMore} aria-label="More actions" aria-haspopup="dialog" style={S(ring)}>{DOTS}</button>
      <button onClick={() => onOpen('messages')} aria-label={'Messages with ' + c.first} style={S(ring)}>{MAIL_ICON}</button>
      <Link href={book} style={S(BLACK)}>Book appointment</Link>
    </div>
    <div style={S(LIST_CARD + ';display:flex;flex-direction:column')} className="sum-rows">
      {[[PHONE_P, row.phone || 'No phone'], [MAIL_P, row.email || 'No email'], [CAL_P, d.since]].map(([p, t]) => <div key={p} style={S('display:flex;align-items:center;gap:12px;padding:14px 0;font-size:15px')}>{ico(p)}<span style={S('min-width:0;overflow-wrap:anywhere')}>{t}</span></div>)}
    </div>
    <div style={S(LIST_CARD + ';display:flex;flex-direction:column')} className="sum-rows">
      {menu('overview', 'Overview')}
      {menu('appointments', 'Appointments')}
      {menu('messages', 'Messages')}
      {menu('details', 'Client details')}
      <button onClick={() => setRec(!rec)} aria-expanded={rec} style={S(MENU_ROW)}><span style={S('flex:1 1 auto')}>Records</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto;transform:rotate(' + (rec ? 180 : 0) + 'deg)')} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
      {rec && <>
        {menu('notes', 'Notes', true)}
        {menu('alerts', 'Allergies and patch tests', true)}
        {menu('formula', 'Colour formula', true)}
        {menu('forms', 'Client forms', true)}
      </>}
      {menu('prefs', 'Preferences')}
    </div>
  </>);
}

/** The pages of a client's profile (overview, appointments, details, notes ...). The phone and the desktop drawer show the same ones. */
function ProfilePages({ c, view, setView, apFilter, setApFilter, openForm, setOpenForm, title }: {
  c: C; view: Sub; setView: (v: Sub) => void; apFilter: 'all' | 'upcoming' | 'past'; setApFilter: (f: 'all' | 'upcoming' | 'past') => void;
  openForm: string; setOpenForm: (id: string) => void; title?: boolean;
}) {
  const { row, d } = c;
  const card = LIST_CARD, rowCss = MENU_ROW;
  const appts = d.appts.filter((a) => (apFilter === 'all' ? true : apFilter === 'upcoming' ? a.upcoming : !a.upcoming));
  const groups: { month: string; items: typeof appts }[] = [];
  appts.forEach((a) => { const g = groups[groups.length - 1]; if (g && g.month === a.month) g.items.push(a); else groups.push({ month: a.month, items: [a] }); });
  const avg = row.visits ? Math.round(row.spentCents / row.visits) : 0;
  const pi = patchInfo(c.patchOn, d.today);
  const greyRow = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;border-radius:16px;background:#F4F5F7';
  const xBtn = 'flex:0 0 36px;width:36px;height:36px;border:0;border-radius:999px;background:transparent;display:flex;align-items:center;justify-content:center';
  return (<>
        {title && view !== 'home' && !openForm && <h2 style={S('margin:8px 0 0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>{SUB_TITLE[view]}</h2>}
        {view !== 'home' && !!c.notice && <Notice>{c.notice}</Notice>}

        {view === 'overview' && (<>
          <section aria-label="Total spent" style={S('box-sizing:border-box;border-radius:24px;background:#0E1116;color:#FFFFFF;padding:22px 22px 20px')}>
            <div style={S('font-size:13.5px;opacity:0.7')}>Total spent</div>
            <div style={S('margin-top:4px;font-size:40px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{dollars(row.spentCents)}</div>
            <div style={S('margin-top:6px;font-size:14px;opacity:0.7')}>{plural(row.visits, 'visit') + (row.visits ? ', ' + dollars(Math.round(avg / 100) * 100) + ' on average' : '')}</div>
          </section>
          <section aria-label="Last and next visit" style={S('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px')}>
            <div style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:20px;padding:16px')}><div style={S('font-size:13px;color:#5E6673')}>Last visit</div><div style={S('margin-top:4px;font-size:18px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{row.last}</div></div>
            <div style={S('box-sizing:border-box;background:' + TONE.purple.bg + ';border-radius:20px;padding:16px;color:' + TONE.purple.fg)}><div style={S('font-size:13px;opacity:0.8')}>Next appointment</div><div style={S('margin-top:4px;font-size:18px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{row.next}</div></div>
          </section>
          <div style={S(card + ';display:flex;flex-direction:column')} className="sum-rows">
            {([
              ['alerts', 'Allergies', c.allergies.length ? c.allergies.join(', ') : 'None recorded'],
              ['alerts', 'Patch test', pi.text],
              ['forms', 'Forms completed', String(d.forms.length)],
              ['notes', 'Notes', String(c.notes.length)],
            ] as [Sub, string, string][]).map(([v, l, t]) => (
              <button key={l} onClick={() => { setOpenForm(''); setView(v); }} style={S(rowCss)}>
                <span style={S('flex:1 1 auto;min-width:0;color:#5E6673')}>{l}</span>
                <span style={S('flex:0 1 auto;min-width:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{t}</span>{CHEV}
              </button>
            ))}
          </div>
        </>)}

        {view === 'appointments' && (<>
          <div role="group" aria-label="Filter appointments" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto')}>
            {([['all', 'All'], ['upcoming', 'Upcoming'], ['past', 'Past']] as const).map(([id, l]) => <FilterChip key={id} phone on={apFilter === id} onClick={() => setApFilter(id)}>{l}</FilterChip>)}
          </div>
          {groups.map((g) => (
            <div key={g.month} style={S('display:flex;flex-direction:column;gap:10px')}>
              <h3 style={S('margin:6px 0 0;font-size:15px;font-weight:600;color:#5E6673')}>{g.month}</h3>
              {g.items.map((a) => {
                const st = visitStatus(a.status), strike = STRUCK.includes(a.status);
                return (
                  <Link key={a.id} href={a.href} aria-label={a.label + ', ' + a.services + ', ' + st.label} style={S('display:block;text-decoration:none;box-sizing:border-box;padding:14px 16px;border-radius:20px;' + (strike ? CARD_STRUCK : CARD_PLAIN))}>
                    <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px')}><span style={S('font-size:16px;font-weight:600')}>{a.label}</span><span style={S('font-size:14.5px;font-weight:500;flex:0 0 auto' + (strike ? ';text-decoration:line-through' : ''))}>{dollars(a.cents)}</span></div>
                    <div style={S('margin-top:2px;font-size:14px;overflow-wrap:anywhere' + (strike ? ';text-decoration:line-through' : ''))}>{(a.time ? a.time + ' · ' : '') + a.services + (a.staff ? ' with ' + a.staff : '')}</div>
                    <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px')}>
                      <Chip tone={st.tone}>{st.label}</Chip>
                      {!!a.pay && <span style={S('font-size:12.5px;opacity:0.85')}>{a.pay}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
          {appts.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>{apFilter === 'upcoming' ? 'Nothing coming up.' : apFilter === 'past' ? 'No past appointments.' : 'No appointments yet.'}</p>}
        </>)}

        {view === 'details' && (<>
          <div style={S(card + ';display:flex;flex-direction:column')} className="sum-rows">
            {([['Name', row.name], ['Phone', row.phone || 'Not added'], ['Email', row.email || 'Not added'], ['Client since', d.since.replace('Client since ', '')]] as [string, string][]).map(([l, v]) => <div key={l} style={S('display:flex;justify-content:space-between;gap:12px;padding:14px 0;font-size:15px')}><span style={S('color:#5E6673')}>{l}</span><span style={S('font-weight:500;text-align:right;overflow-wrap:anywhere')}>{v}</span></div>)}
          </div>
          <button className="ghost" onClick={c.startEdit} style={S(OUTLINE + ';flex:0 0 auto')}>Edit details</button>
        </>)}

        {view === 'notes' && (
          <section style={S(CARD_M)}>
            {c.ask?.kind === 'note' && <AskRemove c={c} />}
            {c.notes.length === 0 && <p style={S('margin:0;font-size:14px;color:#5E6673')}>No notes yet.</p>}
            {c.notes.map((n) => (
              <div key={n.id} style={S(greyRow + ';align-items:flex-start')}>
                <span style={S('font-size:14px;overflow-wrap:anywhere;padding-top:6px')}>{n.text}</span>
                <button className="ghost" onClick={() => c.setAsk({ kind: 'note', key: n.id, label: n.text })} aria-label="Remove note" style={S(xBtn)}>{X}</button>
              </div>
            ))}
            <AddRow id="pf-note" value={c.noteDraft} onChange={c.setNoteDraft} onAdd={c.addNote} placeholder="Add a note" busy={c.busy} />
          </section>
        )}

        {view === 'alerts' && (<>
          <section style={S(CARD_M)}>
            <h3 style={S('margin:0;font-size:16px;font-weight:600')}>Allergies</h3>
            {c.ask?.kind === 'allergy' && <AskRemove c={c} />}
            {c.allergies.length === 0 && <p style={S('margin:0;font-size:14px;color:#5E6673')}>No allergies recorded.</p>}
            {c.allergies.map((a, i) => (
              <div key={a} style={S(greyRow)}>
                <span style={S('font-size:14px;overflow-wrap:anywhere;padding-top:2px')}>{a}</span>
                <button className="ghost" onClick={() => c.setAsk({ kind: 'allergy', key: String(i), label: a })} aria-label={'Remove ' + a} style={S(xBtn)}>{X}</button>
              </div>
            ))}
            <AddRow id="pf-all" value={c.allergyDraft} onChange={c.setAllergyDraft} onAdd={c.addAllergy} placeholder="Add an allergy" busy={c.busy} />
          </section>
          <section style={S(CARD_M)}>
            <h3 style={S('margin:0;font-size:16px;font-weight:600')}>Patch test</h3>
            <div style={S(greyRow)}>
              <Chip tone={PATCH_TONE[pi.tone]}>{pi.text}</Chip>
              {c.patchOn && <span style={S('font-size:13px;color:#5E6673')}>{'Tested ' + niceDate(c.patchOn)}</span>}
            </div>
            <Field label="Test date"><input type="date" value={c.patchOn ?? ''} max={d.today} onChange={(e) => { if (e.target.value) c.setPatch(e.target.value); }} style={FIELD_IN} /></Field>
            <div style={S('display:flex;gap:10px')}>
              <button onClick={c.recordPatch} disabled={c.busy} style={S(BLACK + dim(c.busy))}>Record today</button>
              {c.patchOn && <button className="ghost" onClick={() => c.setPatch(null)} disabled={c.busy} style={S(OUTLINE + ';color:#B42318' + dim(c.busy))}>Remove</button>}
            </div>
          </section>
        </>)}

        {view === 'formula' && (
          <section style={S(CARD_M)}>
            <h3 style={S('margin:0;font-size:16px;font-weight:600')}>Formula</h3>
            <label htmlFor="pf-formula" style={S('position:absolute;left:-9999px')}>Colour formula</label>
            <textarea id="pf-formula" value={c.formula} onChange={(e) => c.setFormula(e.target.value)} placeholder="No formula saved yet" rows={6} style={S('box-sizing:border-box;width:100%;resize:none;padding:12px 14px;border:1px solid #E1E4E9;border-radius:16px;background:#F4F5F7;font:inherit;font-size:14.5px;color:#0E1116')} />
            <button onClick={c.saveFormula} disabled={c.busy || c.formula === c.saved} style={S(BLACK + ';flex:0 0 auto' + dim(c.busy || c.formula === c.saved))}>{c.busy ? 'Saving…' : 'Save formula'}</button>
          </section>
        )}

        {view === 'forms' && !openForm && (<>
          {d.forms.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>No forms completed yet.</p>}
          {d.forms.map((f) => {
            const [when, ...rest] = f.date.split(' · ');
            return (
              <button key={f.id} onClick={() => setOpenForm(f.id)} style={S('display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;padding:16px;border:1px solid #E6E8EC;border-radius:22px;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
                <span style={S('flex:0 0 44px;width:44px;height:44px;border-radius:14px;background:' + TONE.purple.bg + ';display:flex;align-items:center;justify-content:center')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={TONE.purple.fg} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 9h6M9 13h6M9 17h3" /></svg></span>
                <span style={S('flex:1 1 auto;min-width:0')}>
                  <span style={S('display:block;font-size:16px;font-weight:600;letter-spacing:-0.01em;overflow-wrap:anywhere')}>{f.name}</span>
                  <span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{when}</span>
                  {(rest.length > 0 || f.flagged) && <span style={S('display:flex;flex-wrap:wrap;gap:6px;margin-top:8px')}>
                    {rest.map((r) => <Chip key={r} tone="grey">{r}</Chip>)}
                    {f.flagged && <Chip tone="red">Reaction noted</Chip>}
                  </span>}
                </span>
                {CHEV}
              </button>
            );
          })}
          <Link href={'/clients/forms?c=' + row.id} style={S(OUTLINE + ';flex:0 0 auto')}>View forms</Link>
        </>)}
        {view === 'forms' && !!openForm && (() => {
          const f = d.forms.find((x) => x.id === openForm);
          if (!f) return null;
          const [when, ...rest] = f.date.split(' · ');
          // Unanswered questions and the signature are left out: the client was signed in to make the booking.
          const answers = f.answers.filter((a) => !/^signed$/i.test(a.k) && a.v !== 'No answer');
          return (<>
            <div>
              <h2 style={S('margin:8px 0 0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;overflow-wrap:anywhere')}>{f.name}</h2>
              <p style={S('margin:6px 0 0;font-size:14px;color:#5E6673')}>{'Completed ' + when + (rest.length ? ' · ' + rest.join(' · ') : '')}</p>
            </div>
            {f.flagged && <div style={S('padding:12px 14px;border-radius:16px;background:' + TONE.red.bg + ';color:' + TONE.red.fg + ';font-size:13.5px;font-weight:600')}>A reaction was noted on this form.</div>}
            {answers.map((a, i) => (
              <AnswerBox key={i} label={a.k} muted={a.v === 'No answer'}>{a.v}</AnswerBox>
            ))}
          </>);
        })()}
        {view === 'prefs' && (
          <section style={S(CARD_M)}>
            <div style={S('display:flex;flex-direction:column')}>
              <SwitchRow id="pf-rem" title="Appointment reminders" sub="Text and email" on={c.reminders} toggle={() => c.toggle('reminders')} />
              <SwitchRow id="pf-mk" title="Marketing messages" sub="Offers and news" on={c.marketing} toggle={() => c.toggle('marketing')} last />
            </div>
          </section>
        )}
  </>);
}

/** The profile on a computer: the same layout as the phone, with the pages (overview, appointments, messages ...) behind the three dots. A page opens in the right-hand drawer. */
function Desktop({ c, initial }: { c: C; initial?: string }) {
  const { row, d } = c;
  const [page, setPage] = useState<Sub | null>(initial === 'messages' ? 'messages' : null);
  const [thread, setThread] = useState(d.messages);
  const [apFilter, setApFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [openForm, setOpenForm] = useState('');
  const [qa, setQa] = useState(false);
  const [rec, setRec] = useState(false);
  const open = (v: Sub) => { c.setError(''); c.setNotice(''); setOpenForm(''); setQa(false); setPage(v); };
  const close = () => { setPage(null); setOpenForm(''); c.setError(''); c.setNotice(''); };
  const back = () => { if (openForm) { setOpenForm(''); return; } close(); };
  // Editing opens its own drawer, so the page that asked for it steps aside first.
  const edit = () => { close(); setQa(false); c.startEdit(); };
  const cc = { ...c, startEdit: edit };
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 32px;display:flex;flex-direction:column;gap:20px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
        <Link href="/clients" aria-label="Back to clients" style={S(RING)}>{BACK}</Link>
        <Link href="/clients" aria-label="Close profile" style={S(RING)}>{CLOSE}</Link>
      </div>
      <div style={S('width:100%;display:flex;flex-direction:column;gap:16px')}>
        <ProfileHome c={c} messages={thread.length} rec={rec} setRec={setRec} onOpen={open} onMore={() => setQa(true)} />
      </div>
      {c.mode !== 'view' && <Mobile c={c} drawer />}
      {qa && (
        <div className="m-cal cal-root m-drawer">
          <QuickActions onClose={() => setQa(false)}>
            <QaGroup first>
              <button onClick={edit} style={S(QA_ITEM)}>Edit details</button>
              <Link href={'/clients/forms?c=' + row.id} style={S(QA_ITEM)}>View forms</Link>
            </QaGroup>
          </QuickActions>
        </div>
      )}
      {page && (
        <div className="m-cal cal-root m-drawer">
          <div role="dialog" aria-label={SUB_TITLE[page]} style={S(PAGE)}>
            {page === 'messages'
              ? <ChatPanel fill clientId={row.id} name={row.name} first={c.first} initial={thread} send={(t) => sendClientMessage(row.id, t)} onSent={(m) => setThread((x) => [...x, m])} onBack={back} />
              : (<>
                <ScreenHeader title={row.name} avatar={row.name} onBack={back} style="margin-bottom:8px">
                  <button onClick={close} aria-label="Close" style={S(RING)}>{CLOSE}</button>
                </ScreenHeader>
                <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 24px;display:flex;flex-direction:column;gap:16px')}>
                  {!!c.error && c.mode === 'view' && <FieldError>{c.error}</FieldError>}
                  <ProfilePages c={cc} view={page} setView={(v) => { setOpenForm(''); setPage(v === 'home' ? null : v); }} apFilter={apFilter} setApFilter={setApFilter} openForm={openForm} setOpenForm={setOpenForm} title />
                </main>
              </>)}
          </div>
        </div>
      )}
    </div>
  );
}

function Mobile({ c, initial, drawer }: { c: C; initial?: string; drawer?: boolean }) {
  const { row, d } = c;
  const [view, setView] = useState<Sub>(initial === 'messages' ? 'messages' : 'home');
  const [thread, setThread] = useState(d.messages);
  const [rec, setRec] = useState(false);
  const [qa, setQa] = useState(false);
  const [apFilter, setApFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [openForm, setOpenForm] = useState('');
  const [eqa, setEqa] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  // Every page opens at its top, whatever the last one was scrolled to.
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [view, c.mode, openForm]);
  const sheet = (title: string, body: React.ReactNode, onClose: () => void) => (
    <BottomSheet label={title} onClose={onClose} z={6} maxHeight="none" gap={6} handleGap={12}>
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{title}</h2><button onClick={onClose} aria-label="Close" style={S(RING)}>{CLOSE}</button></div>
        {body}
      </BottomSheet>
  );
  const page = "position:relative;width:100%;height:100dvh;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;";

  // Editing takes over the page (on desktop, it slides in from the right instead).
  if (c.mode === 'edit') {
    const inner = (
      <>
        <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px')}>
          <button onClick={() => { c.setMode('view'); c.setError(''); }} aria-label="Back" style={S(RING)}>{BACK}</button>
          <h1 style={S('margin:0;flex:1 1 auto;font-size:22px;font-weight:600;letter-spacing:-0.025em')}>Edit details</h1>
        </header>
        <main ref={mainRef} className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:8px 20px 20px;display:flex;flex-direction:column;gap:12px')}>
          <Field label="Full name"><input type="text" value={c.ed.name} onChange={(e) => { c.setEd({ ...c.ed, name: e.target.value }); c.setError(''); }} style={FIELD_IN} /></Field>
          <Field label="Email"><input type="email" inputMode="email" value={c.ed.email} onChange={(e) => { c.setEd({ ...c.ed, email: e.target.value }); c.setError(''); }} placeholder="name@example.com" style={FIELD_IN} /></Field>
          <Field label="Phone"><input type="tel" inputMode="tel" value={c.ed.phone} onChange={(e) => { c.setEd({ ...c.ed, phone: phoneInput(e.target.value) }); c.setError(''); }} placeholder="Optional" style={FIELD_IN} /></Field>
        </main>
        <div style={S(BAR)}>
          {!!c.error && <FieldError>{c.error}</FieldError>}
          <div style={S('display:flex;gap:10px')}>
            <button onClick={() => setEqa(true)} aria-label="More actions" aria-haspopup="dialog" style={S(RING + ';flex:0 0 52px;width:52px;height:52px')}>{DOTS}</button>
            <button onClick={c.saveEdit} disabled={c.busy} style={S(BLACK + dim(c.busy))}>{c.busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
        {eqa && sheet('More actions', !c.confirmDel ? (
          <div style={S('display:flex;flex-direction:column')}>
            <button onClick={() => c.setConfirmDel(true)} style={S(MENU_ROW + ';color:#B42318')}>Remove client</button>
          </div>
        ) : (
          <ConfirmBox label="Confirm removal" title={'Remove ' + row.name + ' for good?'} body="Only possible when they have no appointments or sales. Their notes go too." error={c.error} action="Remove client" onAction={c.removeClient} busy={c.busy} onKeep={() => { c.setConfirmDel(false); setEqa(false); }} />
        ), () => { c.setConfirmDel(false); setEqa(false); })}
      </>
    );
    return drawer
      ? <div className="m-cal cal-root m-drawer"><div role="dialog" aria-label="Edit details" style={S(PAGE)}>{inner}</div></div>
      : <div className="only-m m-cal cal-root" style={S(page + 'background:#F4F5F7')}>{inner}</div>;
  }

  const openPage = (id: Sub) => { c.setError(''); c.setNotice(''); setOpenForm(''); setView(id); };
  return (
    <div className="only-m m-cal cal-root" style={S(page + 'background:#F4F5F7')}>
      <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px;' + (view !== 'home' ? 'border-bottom:1px solid #E6E8EC;margin-bottom:8px' : ''))}>
        {view === 'home'
          ? <Link href="/clients" aria-label="Back to clients" style={S(RING)}>{BACK}</Link>
          : <button onClick={() => { if (openForm) { setOpenForm(''); return; } setView('home'); c.setError(''); c.setNotice(''); }} aria-label="Back to profile" style={S(RING)}>{BACK}</button>}
        {view !== 'home' && <><Avatar name={row.name} size="sm" /><div style={S('flex:1 1 auto;min-width:0;font-size:18px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{row.name}</div></>}
        {view === 'home' && <div style={S('flex:1 1 auto')} />}
        <Link href="/clients" aria-label="Close profile" style={S(RING)}>{CLOSE}</Link>
      </header>
      <main ref={mainRef} className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 24px;display:flex;flex-direction:column;gap:16px')}>
        {!!c.error && <FieldError>{c.error}</FieldError>}
        {view === 'home' && <ProfileHome c={c} messages={thread.length} rec={rec} setRec={setRec} onOpen={openPage} onMore={() => setQa(true)} />}
        <ProfilePages c={c} view={view} setView={setView} apFilter={apFilter} setApFilter={setApFilter} openForm={openForm} setOpenForm={setOpenForm} title />
      </main>
      <MobileTabs active="clients" />
      {view === 'messages' && <ChatPage label={'Message ' + c.first} clientId={row.id} name={row.name} first={c.first} initial={thread} send={(t) => sendClientMessage(row.id, t)} onSent={(m) => setThread((x) => [...x, m])} onBack={() => { setView('home'); c.setError(''); }} />}
      {qa && (
        <QuickActions onClose={() => setQa(false)}>
          <QaGroup first>
            <button onClick={() => { setQa(false); c.startEdit(); }} style={S(QA_ITEM)}>Edit details</button>
            <Link href={'/clients/forms?c=' + row.id} style={S(QA_ITEM)}>View forms</Link>
          </QaGroup>
        </QuickActions>
      )}
    </div>
  );
}

export function ProfileView({ data, initial }: { data: ProfileData; initial?: string }) {
  const c = useProfile(data);
  return (<>
    {c.narrow !== false && <Mobile c={c} initial={initial} />}
    {c.narrow !== true && <Desktop c={c} initial={initial} />}
  </>);
}
