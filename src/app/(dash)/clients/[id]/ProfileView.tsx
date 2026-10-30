'use client';
// 1:1 conversion of the prototype's ClientProfile.dc.html and MobileClientProfile.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { MobileTabs } from '@/components/Chrome';
import { STATUS_LABEL } from '@/lib/format';
import { S } from '../../calendar/pickers';
import { addNote, deleteClient, recordPatchTest, removeNote, saveFormula, sendClientMessage, setAllergies, setPatchTest, setPreference, updateClient } from '../actions';
import { phoneInput } from '@/lib/phone';
import { channelNote, initialsOf, money, patchInfo, type Channels, type ClientRow } from '../shared';
import { niceDate } from '@/lib/forms-shared';

export type ProfileData = {
  row: ClientRow; since: string; allergies: string[]; patchOn: string | null; formula: string; reminders: boolean; marketing: boolean;
  notes: { id: string; text: string }[];
  forms: { id: string; name: string; date: string; flagged: boolean; answers: { k: string; v: string }[] }[];
  history: { id: string; ref: string; date: string; service: string; staff: string; cents: number; when: string; paid: string }[]; historyTotal: number;
  today: string; channels: Channels;
  messages: { id: string; mine: boolean; text: string; day: string; time: string }[];
  appts: { id: string; href: string; month: string; label: string; time: string; status: string; staff: string; services: string; cents: number; pay: string; upcoming: boolean }[];
};
// The same colours as the tags in the Clients list: Regular purple, New green, Lapsed amber.
const TONE: Record<string, [string, string]> = { Regular: ['#ECE8FF', '#3B2BB5'], New: ['#DDF3EA', '#14624A'], Lapsed: ['#FFEBD0', '#7A4204'] };

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
  const [openHist, setOpenHist] = useState('');
  const [histPage, setHistPage] = useState(0);
  const [notes, setNotes] = useState(d.notes);
  const [allergies, setAl] = useState(d.allergies);
  const [patchOn, setPatchOn] = useState(d.patchOn);
  const [formula, setFormula] = useState(d.formula);
  const [saved, setSaved] = useState(d.formula);
  const [reminders, setReminders] = useState(d.reminders);
  const [marketing, setMarketing] = useState(d.marketing);
  const [noteDraft, setNoteDraft] = useState('');
  const [allergyDraft, setAllergyDraft] = useState('');
  const [mode, setMode] = useState<'view' | 'message' | 'edit'>('view');
  const [ed, setEd] = useState({ name: '', email: '', phone: '' });
  const [confirmDel, setConfirmDel] = useState(false);
  const [msg, setMsg] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const first = row.name.split(' ')[0];
  const fail = (e?: string) => { setError(e ?? 'Something went wrong'); };
  const run = (fn: () => Promise<{ error?: string }>, ok: () => void) => startT(async () => { const r = await fn(); if (r.error) { fail(r.error); return; } setError(''); ok(); });

  return {
    d, row, first, narrow, busy, openHist, setOpenHist, histPage, setHistPage, notes, allergies, patchOn, formula, setFormula, saved, reminders, marketing, noteDraft, setNoteDraft, allergyDraft, setAllergyDraft, mode, setMode, msg, setMsg, notice, setNotice, error, setError,
    addNote: () => { const t = noteDraft.trim(); if (!t) return; startT(async () => { const r = await addNote(row.id, t); if (r.error) { fail(r.error); return; } setError(''); setNotes((n) => [...n, { id: r.id!, text: t }]); setNoteDraft(''); setNotice('Note added'); }); },
    removeNote: (id: string) => run(() => removeNote(id), () => { setNotes((n) => n.filter((x) => x.id !== id)); }),
    addAllergy: () => { const t = allergyDraft.trim(); if (!t) return; const next = allergies.includes(t) ? allergies : [...allergies, t]; run(() => setAllergies(row.id, next), () => { setAl(next); setAllergyDraft(''); setNotice('Alert added'); }); },
    removeAllergy: (i: number) => { const next = allergies.filter((_, j) => j !== i); run(() => setAllergies(row.id, next), () => setAl(next)); },
    recordPatch: () => startT(async () => { const r = await recordPatchTest(row.id); if (r.error) { fail(r.error); return; } setPatchOn(r.on!); setNotice('Patch test recorded for today'); }),
    setPatch: (on: string | null) => run(() => setPatchTest(row.id, on), () => { setPatchOn(on); }),
    saveFormula: () => run(() => saveFormula(row.id, formula), () => { setSaved(formula); setNotice('Formula saved'); }),
    toggle: (k: 'reminders' | 'marketing') => { const v = k === 'reminders' ? !reminders : !marketing; run(() => setPreference(row.id, k, v), () => (k === 'reminders' ? setReminders(v) : setMarketing(v))); },
    ed, setEd, confirmDel, setConfirmDel,
    startEdit: () => { setEd({ name: row.name, email: row.email, phone: row.phone }); setConfirmDel(false); setMode('edit'); setError(''); setNotice(''); },
    saveEdit: () => { if (!ed.name.trim()) { setError("Add the client's name."); return; } run(() => updateClient(row.id, ed.name, ed.email, ed.phone), () => { setMode('view'); setNotice('Details saved'); router.refresh(); }); },
    removeClient: () => run(() => deleteClient(row.id), () => { router.push('/clients'); router.refresh(); }),
    sendMsg: () => { if (!msg.trim()) { setError('Write a message first.'); return; } run(() => sendClientMessage(row.id, msg), () => { setMsg(''); setMode('view'); setNotice('Message sent to ' + first); }); },
  };
}
type C = ReturnType<typeof useProfile>;

const CARD = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:16px';
const TXTIN = (h: number) => ({ ...S('box-sizing:border-box;width:100%;height:' + h + 'px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF;flex:1 1 auto;min-width:0'), minHeight: 0 });
const HIST_PER = 6, FORMS_PER = 5;
/** Previous / next for a list that is paged on the client. Hidden while everything fits on one page. */
function Pager({ page, pages, total, per, onPage }: { page: number; pages: number; total: number; per: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const btn = (dis: boolean) => 'height:40px;padding:0 16px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:' + (dis ? '#A6ADB8' : '#0E1116') + ';font:inherit;font-size:13.5px;font-weight:500;cursor:' + (dis ? 'default' : 'pointer');
  return (
    <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:12px;border-top:1px solid #EEF0F3')}>
      <button className="ghost" onClick={() => onPage(page - 1)} disabled={page === 0} style={S(btn(page === 0))}>Previous</button>
      <span style={S('font-size:13px;color:#5E6673;text-align:center')}>{page * per + 1}–{Math.min(total, (page + 1) * per)} of {total}</span>
      <button className="ghost" onClick={() => onPage(page + 1)} disabled={page >= pages - 1} style={S(btn(page >= pages - 1))}>Next</button>
    </div>
  );
}
const X = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;

/* The section cards. `pad` is the card padding (24 desktop, 20 mobile). */
function Sections({ c, pad, titles = true, usually = true }: { c: C; pad: number; titles?: boolean; usually?: boolean }) {
  const { d } = c;
  const card = CARD + ';padding:' + pad + 'px';
  const pi = patchInfo(c.patchOn, d.today);
  const patchStyle = 'display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + (pi.tone === 'ok' ? '#DDF3EA' : pi.tone === 'bad' ? '#FDECEA' : '#EEF0F3') + ';color:' + (pi.tone === 'ok' ? '#14624A' : pi.tone === 'bad' ? '#B42318' : '#5E6673');
  const sw = (on: boolean) => ({ st: 'position:relative;flex:0 0 52px;width:52px;height:32px;padding:0;border:0;border-radius:999px;background:' + (on ? '#0E1116' : '#D5D9E0'), kn: 'position:absolute;top:3px;left:' + (on ? 23 : 3) + 'px;width:26px;height:26px;border-radius:999px;background:#FFFFFF' });
  const rs = sw(c.reminders), ms = sw(c.marketing);
  const hPages = Math.max(1, Math.ceil(d.history.length / HIST_PER)), hPage = Math.min(c.histPage, hPages - 1);
  const history = (
    <section style={S(card)}>{titles && <div><h2 style={S('margin:0;font-size:16px;font-weight:600')}>Visit history</h2></div>}
      {d.history.slice(hPage * HIST_PER, (hPage + 1) * HIST_PER).map((h) => {
        const open = c.openHist === h.id;
        return (
          <div key={h.id} style={S('border-top:1px solid #EEF0F3')}>
            <button onClick={() => c.setOpenHist(open ? '' : h.id)} aria-expanded={open} aria-label={`${h.service}, ${h.date}, ${open ? 'hide details' : 'show details'}`} style={S('width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border:0;background:transparent;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
              <span style={S('min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;overflow-wrap:anywhere')}>{h.service}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{h.ref} · {h.date}, With {h.staff}</span></span>
              <span style={S('flex:0 0 auto;display:flex;align-items:center;gap:10px')}><span style={S('font-size:14.5px;font-weight:600')}>{money(h.cents)}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={S('transform:rotate(' + (open ? 180 : 0) + 'deg)')}><path d="M6 9l6 6 6-6" /></svg></span>
            </button>
            {open && (
              <div style={S('margin:0 0 12px;padding:4px 14px;border-radius:16px;background:#F4F5F7')}>
                {([['Booking', h.ref], ['When', h.when], ['Service', h.service], ['With', h.staff], ['Status', 'Completed'], ['Paid', h.paid]] as const).map(([k, v], j) => (
                  <div key={k} style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0' + (j < 5 ? ';border-bottom:1px solid #E6E8EC' : ''))}><span style={S('color:#5E6673')}>{k}</span><span style={S('font-weight:500;text-align:right' + (k === 'Status' ? ';color:#14624A' : ''))}>{v}</span></div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {d.history.length === 0 && <p style={S('margin:0;font-size:14px;color:#5E6673')}>No completed visits yet.</p>}
      <Pager page={hPage} pages={hPages} total={d.history.length} per={HIST_PER} onPage={(p) => { c.setHistPage(p); c.setOpenHist(''); }} />
    </section>
  );
  const notes = (
    <section style={S(card)}>{titles && <div><h2 style={S('margin:0;font-size:16px;font-weight:600')}>Notes</h2></div>}
      {c.notes.length === 0 && <p style={S('margin:0;font-size:14px;color:#5E6673')}>No notes yet.</p>}
      {c.notes.map((n) => (
        <div key={n.id} style={S('display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:12px 14px;border-radius:16px;background:#F4F5F7')}>
          <span style={S('font-size:14px;overflow-wrap:anywhere;padding-top:6px')}>{n.text}</span>
          <button className="ghost" onClick={() => c.removeNote(n.id)} aria-label="Remove note" style={S('flex:0 0 36px;width:36px;height:36px;border:0;border-radius:999px;background:transparent;display:flex;align-items:center;justify-content:center')}>{X}</button>
        </div>
      ))}
      <div style={S('display:flex;gap:8px')}><label htmlFor="pf-note" style={S('position:absolute;left:-9999px')}>Add a note</label>
        <input id="pf-note" type="text" value={c.noteDraft} onChange={(e) => c.setNoteDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') c.addNote(); }} placeholder="Add a note" style={TXTIN(48)} />
        <button onClick={c.addNote} disabled={c.busy} style={S('height:44px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500;padding:0 20px;height:48px;flex:0 0 auto')}>Add</button></div>
    </section>
  );
  const alerts = (
    <section style={S(card)}>{titles && <div><h2 style={S('margin:0;font-size:16px;font-weight:600')}>Alerts</h2></div>}
      <div style={S('display:flex;flex-direction:column;gap:10px')}>
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
          <span style={S('font-size:14px;font-weight:600')}>Allergies</span>
          {c.allergies.length === 0 && <span style={S('font-size:13.5px;color:#5E6673')}>None recorded</span>}
        </div>
        {c.allergies.length > 0 && <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>
          {c.allergies.map((a, i) => (
            <span key={a} style={S('display:inline-flex;align-items:center;gap:2px;padding:0 4px 0 14px;height:36px;border-radius:999px;background:#FDECEA;color:#B42318;font-size:13.5px;font-weight:500')}>{a}
              <button className="ghost" onClick={() => c.removeAllergy(i)} aria-label={'Remove ' + a} style={S('flex:0 0 32px;width:32px;height:32px;border:0;border-radius:999px;background:transparent;display:flex;align-items:center;justify-content:center')}>{X}</button></span>
          ))}
        </div>}
        <div style={S('display:flex;gap:8px')}><label htmlFor="pf-all" style={S('position:absolute;left:-9999px')}>Add an allergy</label>
          <input id="pf-all" type="text" value={c.allergyDraft} onChange={(e) => c.setAllergyDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') c.addAllergy(); }} placeholder="Add an allergy" style={TXTIN(44)} />
          <button onClick={c.addAllergy} disabled={c.busy} style={S('border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500;padding:0 20px;height:44px;flex:0 0 auto')}>Add</button></div>
      </div>
      <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:14px;border-top:1px solid #EEF0F3')}>
        <div style={S('display:flex;flex-direction:column;gap:6px')}><span style={S('font-size:14px;font-weight:600')}>Patch test</span><span style={S(patchStyle)}>{pi.text}</span></div>
        {pi.needsAction && <button onClick={c.recordPatch} disabled={c.busy} style={S('height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500;padding:0 20px;flex:0 0 auto')}>Record test</button>}
      </div>
    </section>
  );
  const formula = (
    <section style={S(card)}>{titles && <div><h2 style={S('margin:0;font-size:16px;font-weight:600')}>Colour formula</h2></div>}
      <label htmlFor="pf-formula" style={S('position:absolute;left:-9999px')}>Colour formula</label>
      <textarea id="pf-formula" value={c.formula} onChange={(e) => c.setFormula(e.target.value)} placeholder="No formula saved yet" style={S('box-sizing:border-box;width:100%;min-height:88px;resize:vertical;padding:12px 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:14.5px;color:#0E1116;background:#FFFFFF')} />
      {c.formula !== c.saved && <button onClick={c.saveFormula} disabled={c.busy} style={S('height:44px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500;padding:0 20px')}>Save formula</button>}
    </section>
  );
  const switchRow = (id: string, title: string, sub: string, on: boolean, st: { st: string; kn: string }, k: 'reminders' | 'marketing', top = true) => (
    <div style={S('display:flex;align-items:center;justify-content:space-between;gap:16px;justify-content:space-between;gap:12px;padding:12px 0;' + (top ? 'border-top:1px solid #EEF0F3' : ''))}>
      <div><div id={id} style={S('font-size:14px;font-weight:600')}>{title}</div><div style={S('font-size:13px;color:#5E6673')}>{sub}</div></div>
      <button role="switch" aria-checked={on} aria-labelledby={id} onClick={() => c.toggle(k)} style={S(st.st)}><span style={S(st.kn)} /></button>
    </div>
  );
  const prefs = (
    <section style={S(card)}>{titles && <div><h2 style={S('margin:0;font-size:16px;font-weight:600')}>Preferences</h2></div>}
      <div style={S('display:flex;flex-direction:column')}>
        {usually && <div style={S('display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}><span style={S('color:#5E6673')}>Usually sees</span><span style={S('font-weight:500;text-align:right')}>{c.row.staff}</span></div>}
        {switchRow('pf-rem', 'Appointment reminders', 'Text and email', c.reminders, rs, 'reminders', usually)}
        {switchRow('pf-mk', 'Marketing messages', 'Offers and news', c.marketing, ms, 'marketing')}
      </div>
    </section>
  );
  const forms = <FormsCard forms={d.forms} card={card} titles={titles} />;
  return { history, notes, alerts, formula, prefs, forms };
}

/** Everything this client has completed, newest first, with their answers. */
function FormsCard({ forms, card, titles = true }: { forms: ProfileData['forms']; card: string; titles?: boolean }) {
  const [open, setOpen] = useState('');
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(forms.length / FORMS_PER)), pg = Math.min(page, pages - 1);
  return (
    <section style={S(card)}>
      {titles && <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}><h2 style={S('margin:0;font-size:16px;font-weight:600')}>Forms</h2></div>}
      {forms.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>No forms completed yet.</p>}
      {forms.slice(pg * FORMS_PER, (pg + 1) * FORMS_PER).map((f) => (
        <div key={f.id} style={S('display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid #EEF0F3')}>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 12px')}>
            <div style={S('min-width:0')}><div style={S('font-size:14.5px;font-weight:600;overflow-wrap:anywhere')}>{f.name}</div><div style={S('font-size:13px;color:#5E6673')}>{f.date}{f.flagged ? ' · reaction' : ''}</div></div>
            <button className="ghost" onClick={() => setOpen(open === f.id ? '' : f.id)} aria-expanded={open === f.id} style={S('height:36px;padding:0 14px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:13px;font-weight:500;cursor:pointer')}>{open === f.id ? 'Hide answers' : 'View answers'}</button>
          </div>
          {open === f.id && <dl style={S('margin:0;display:flex;flex-direction:column;border-top:1px solid #EEF0F3')}>{f.answers.map((a, i) => <div key={i} style={S('display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 16px;padding:10px 0;border-bottom:1px solid #EEF0F3;font-size:14px')}><dt style={S('color:#5E6673')}>{a.k}</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{a.v}</dd></div>)}</dl>}
        </div>
      ))}
      <Pager page={pg} pages={pages} total={forms.length} per={FORMS_PER} onPage={(p) => { setPage(p); setOpen(''); }} />
    </section>
  );
}

const PRI = 'height:44px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500;padding:0 20px;';
const MSGS = 'height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500;padding:0 20px;';

function MessageForm({ c }: { c: C }) {
  return (
        <div style={S('display:flex;flex-direction:column;gap:10px')}>
          <label htmlFor="pf-msg" style={S('font-size:14px;font-weight:600')}>Message {c.first}</label>
          <textarea id="pf-msg" value={c.msg} onChange={(e) => { c.setMsg(e.target.value); c.setError(''); }} placeholder="Write a message" style={S('box-sizing:border-box;width:100%;min-height:96px;resize:vertical;padding:12px 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:14.5px;color:#0E1116;background:#FFFFFF')} />
          {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
          <div style={S('display:flex;gap:10px')}><button onClick={c.sendMsg} disabled={c.busy} style={S(PRI + 'flex:1 1 0')}>Send</button><button className="ghost" onClick={() => { c.setMode('view'); c.setError(''); }} style={S(MSGS + 'flex:1 1 0')}>Cancel</button></div>
        </div>
  );
}

function EditForm({ c }: { c: C }) {
  return (
        <div style={S('display:flex;flex-direction:column;gap:12px')}>
          <label htmlFor="pf-name" style={S('font-size:14px;font-weight:600')}>Full name</label>
          <input id="pf-name" type="text" value={c.ed.name} onChange={(e) => { c.setEd({ ...c.ed, name: e.target.value }); c.setError(''); }} style={TXTIN(48)} />
          <label htmlFor="pf-email" style={S('font-size:14px;font-weight:600')}>Email</label>
          <input id="pf-email" type="email" inputMode="email" value={c.ed.email} onChange={(e) => { c.setEd({ ...c.ed, email: e.target.value }); c.setError(''); }} placeholder="name@example.com" style={TXTIN(48)} />
          <label htmlFor="pf-phone" style={S('font-size:14px;font-weight:600')}>Phone</label>
          <input id="pf-phone" type="tel" inputMode="tel" value={c.ed.phone} onChange={(e) => { c.setEd({ ...c.ed, phone: phoneInput(e.target.value) }); c.setError(''); }} placeholder="Optional" style={TXTIN(48)} />
          {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
          <div style={S('display:flex;gap:10px')}><button onClick={c.saveEdit} disabled={c.busy} style={S(PRI + 'flex:1 1 0')}>Save details</button><button className="ghost" onClick={() => { c.setMode('view'); c.setError(''); }} style={S(MSGS + 'flex:1 1 0')}>Cancel</button></div>
          {!c.confirmDel
            ? <button className="ghost" onClick={() => c.setConfirmDel(true)} style={S('height:44px;border:0;border-radius:999px;background:transparent;color:#B42318;font-size:14px;font-weight:500')}>Delete client</button>
            : <div style={S('display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid #F3C6C3;border-radius:16px;background:#FEF3F2')}>
                <span style={S('font-size:14px;font-weight:600')}>Delete {c.row.name} for good?</span>
                <span style={S('font-size:13.5px;color:#5E6673')}>Only possible when they have no bookings or sales. Their notes go too.</span>
                <div style={S('display:flex;gap:10px')}><button onClick={c.removeClient} disabled={c.busy} style={S('flex:1 1 0;height:44px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font-size:14px;font-weight:500')}>Delete client</button><button className="ghost" onClick={() => c.setConfirmDel(false)} style={S(MSGS + 'flex:1 1 0')}>Keep</button></div>
              </div>}
        </div>
  );
}

function Header({ c, m }: { c: C; m: boolean }) {
  const { row } = c;
  const tone = TONE[row.tag];
  const msgS = 'height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500;padding:0 20px;';
  const pri = 'height:44px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500;padding:0 20px;';
  const avatar = 'flex:0 0 72px;width:72px;height:72px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:600;background:' + tone[0] + ';color:' + tone[1];
  const tagS = 'display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + tone[0] + ';color:' + tone[1];
  const book = `/calendar?new=1&c=${encodeURIComponent(row.name)}`;
  const ico = (d: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')}><path d={d} /></svg>;
  const PHONE = 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z';
  const MAIL = 'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm0 1 8 6 8-6';
  const actions = c.mode === 'view' && (
    <div style={S('display:flex;gap:10px;flex-wrap:wrap;' + (m ? 'width:100%' : 'justify-content:flex-end;align-self:flex-start'))}>
      <Link href={book} style={S(pri + 'display:flex;align-items:center;justify-content:center;text-decoration:none;box-sizing:border-box;' + (m ? 'flex:1 1 0' : 'flex:0 0 auto'))}>{m ? 'Book' : 'Book appointment'}</Link>
      <button className="ghost" onClick={() => { c.setMode('message'); c.setError(''); c.setNotice(''); }} style={S(msgS + (m ? 'flex:1 1 0' : 'flex:0 0 auto'))}>Message</button>
      <button className="ghost" onClick={c.startEdit} style={S(msgS + (m ? 'flex:1 1 0' : 'flex:0 0 auto'))}>Edit</button>
      <Link href={'/clients/forms?c=' + c.row.id} className="ghost" style={S(msgS + (m ? 'flex:1 1 0' : 'flex:0 0 auto') + ';text-decoration:none;display:inline-flex;align-items:center;justify-content:center')}>Forms</Link>
    </div>
  );
  return (
    <section style={S(CARD + (m ? ';padding:20px;gap:20px' : ';padding:28px;gap:20px'))}>
      <div style={S('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px')}>
        <div style={S('display:flex;align-items:center;gap:' + (m ? 14 : 20) + 'px;min-width:0')}>
          <div style={S(avatar)}>{initialsOf(row.name, 3)}</div>
          <div style={S('min-width:0;display:flex;flex-direction:column;gap:6px')}>
            <h1 style={S('margin:0;font-size:' + (m ? 22 : 28) + 'px;line-height:1.15;font-weight:600;letter-spacing:-0.025em;overflow-wrap:anywhere')}>{row.name}</h1>
            <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px')}><span style={S(tagS)}>{row.tag}</span><span style={S('font-size:13px;color:#5E6673')}>{c.d.since}</span></div>
            <div style={S('display:flex;flex-wrap:wrap;gap:6px 22px;font-size:14px;color:#0E1116;margin-top:2px')}>
              <span style={S('display:inline-flex;align-items:center;gap:8px;overflow-wrap:anywhere')}>{ico(PHONE)}{row.phone || 'No phone'}</span>
              <span style={S('display:inline-flex;align-items:center;gap:8px;overflow-wrap:anywhere')}>{ico(MAIL)}{row.email || 'No email'}</span>
            </div>
          </div>
        </div>
        {!m && actions}
      </div>
      {m && actions}
      {!!c.notice && <span role="status" style={S('align-self:flex-start;padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.notice}</span>}
      {!!c.error && c.mode === 'view' && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
      {c.mode === 'message' && <MessageForm c={c} />}
      {c.mode === 'edit' && <EditForm c={c} />}
    </section>
  );
}

function Stats({ c, cols, big }: { c: C; cols: number; big: boolean }) {
  const { row } = c;
  const avg = row.visits ? Math.round(row.spentCents / row.visits) : 0;
  const stats: [string, string][] = [['Visits', String(row.visits)], ['Total spent', money(row.spentCents)], ['Average visit', money(Math.round(avg / 100) * 100)], ['Last visit', row.last], ['Next booking', row.next]];
  return (
    <section aria-label="Client stats" style={S('display:grid;grid-template-columns:repeat(' + cols + ',minmax(0,1fr));gap:' + (big ? 16 : 12) + 'px')}>
      {stats.map(([l, v]) => <div key={l} style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:20px;padding:16px')}><div style={S('font-size:13px;color:#5E6673')}>{l}</div><div style={S('margin-top:4px;font-size:' + (big ? 22 : 20) + 'px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{v}</div></div>)}
    </section>
  );
}

function Desktop({ c }: { c: C }) {
  const s = Sections({ c, pad: 24 });
  return (
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <Header c={c} m={false} />
      <Stats c={c} cols={5} big />
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:24px')}>
        <div style={S('flex:1.4 1 480px;min-width:0;display:flex;flex-direction:column;gap:24px')}>{s.history}{s.forms}</div>
        <div style={S('flex:1 1 340px;min-width:0;display:flex;flex-direction:column;gap:24px')}>{s.notes}{s.alerts}{s.formula}{s.prefs}</div>
      </div>
    </div>
  );
}

type Sub = 'home' | 'overview' | 'appointments' | 'messages' | 'details' | 'notes' | 'alerts' | 'formula' | 'forms' | 'prefs';
const SUB_TITLE: Record<Sub, string> = { home: '', overview: 'Overview', appointments: 'Appointments', messages: 'Messages', details: 'Client details', notes: 'Notes', alerts: 'Allergies and patch tests', formula: 'Colour formula', forms: 'Client forms', prefs: 'Preferences' };
const CHEV = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true"><path d="M9.5 6l6 6-6 6" /></svg>;
const BACK = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6l-6 6 6 6" /></svg>;
const CLOSE = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;
const RING = 'flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;padding:0';

/** How each kind of visit looks in the appointments list, so a glance tells them apart. */
const VISIT: Record<string, { label: string; card: string; fg: string; chipBg: string; chipFg: string; strike?: boolean }> = {
  pending: { label: 'Needs approval', card: 'background:#FFF4E5;border:1px solid #F6D9A8', fg: '#7A4204', chipBg: '#FFEBD0', chipFg: '#7A4204' },
  confirmed: { label: 'Confirmed', card: 'background:#ECE8FE;border:1px solid #ECE8FE', fg: '#3A2BB5', chipBg: '#FFFFFF', chipFg: '#3A2BB5' },
  checked_in: { label: 'Checked in', card: 'background:#E3F0FF;border:1px solid #E3F0FF', fg: '#1B4A8A', chipBg: '#FFFFFF', chipFg: '#1B4A8A' },
  in_progress: { label: 'In progress', card: 'background:#5B3DF5;border:1px solid #5B3DF5', fg: '#FFFFFF', chipBg: '#FFFFFF', chipFg: '#5B3DF5' },
  completed: { label: 'Done', card: 'background:#FFFFFF;border:1px solid #E6E8EC', fg: '#0E1116', chipBg: '#DDF3EA', chipFg: '#14624A' },
  cancelled: { label: 'Cancelled', card: 'background:#FDF0EF;border:1px solid #FDF0EF', fg: '#9A7773', chipBg: '#FFFFFF', chipFg: '#B42318', strike: true },
  no_show: { label: 'No-show', card: 'background:#FFF6E8;border:1px solid #FFF6E8', fg: '#8F7A5C', chipBg: '#FFFFFF', chipFg: '#7A4204', strike: true },
  refunded: { label: 'Refunded', card: 'background:#FDF0EF;border:1px solid #FDF0EF', fg: '#9A7773', chipBg: '#FFFFFF', chipFg: '#B42318', strike: true },
};

/** A labelled field in a rounded card: the label sits small above the value. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={S('display:block;box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{label}</span>{children}</label>;
}
const FIELD_IN = { ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), minHeight: 0, borderRadius: 0 } as const;
const CARD_M = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px;display:flex;flex-direction:column;gap:14px';
const BLACK = 'height:48px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500;padding:0 20px;flex:0 0 auto';

/** A bottom bar pinned to the foot of the page, as on the booking and checkout pages. */
function BottomBar({ error, children }: { error?: string; children: React.ReactNode }) {
  return (
    <div style={S('flex:0 0 auto;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px')}>
      {!!error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{error}</p>}
      {children}
    </div>
  );
}

function Mobile({ c, initial }: { c: C; initial?: string }) {
  const { row, d } = c;
  const [view, setView] = useState<Sub>(initial === 'messages' ? 'messages' : 'home');
  const [thread, setThread] = useState(d.messages);
  const [draft, setDraft] = useState('');
  const [sendErr, setSendErr] = useState('');
  const [sending, startSend] = useTransition();
  const [rec, setRec] = useState(false);
  const [qa, setQa] = useState(false);
  const [apFilter, setApFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [openForm, setOpenForm] = useState('');
  const [eqa, setEqa] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  // Every page opens at its top, whatever the last one was scrolled to.
  useEffect(() => { const el = mainRef.current; if (!el) return; if (view === 'messages') el.scrollTo({ top: el.scrollHeight }); else el.scrollTo({ top: 0 }); }, [view, c.mode, openForm, thread.length]);
  const sendChat = () => {
    const t = draft.trim();
    if (!t) return;
    startSend(async () => {
      const r = await sendClientMessage(row.id, t);
      if (r.error) { setSendErr(r.error); return; }
      setSendErr(''); setDraft('');
      setThread((m) => [...m, { id: 'me-' + Date.now(), mine: true, text: t, day: 'Today', time: new Date().toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' }).toLowerCase() }]);
    });
  };
  const s = Sections({ c, pad: 20, titles: false, usually: false });
  const tone = TONE[row.tag];
  const book = `/calendar?new=1&c=${encodeURIComponent(row.name)}`;
  const avatar = (px: number, fs: number) => <div style={S('flex:0 0 ' + px + 'px;width:' + px + 'px;height:' + px + 'px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:' + fs + 'px;font-weight:600;background:' + tone[0] + ';color:' + tone[1])}>{initialsOf(row.name, 2)}</div>;
  const rowCss = 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:58px;padding:0 4px;border:0;background:transparent;font:inherit;font-size:16px;text-align:left;color:#0E1116;cursor:pointer';
  const menu = (id: Sub, label: string, count?: number, indent?: boolean) => (
    <button key={id} onClick={() => { c.setError(''); c.setNotice(''); setOpenForm(''); setView(id); }} style={S(rowCss + (indent ? ';padding-left:24px' : ''))}>
      <span style={S('flex:1 1 auto;min-width:0')}>{label}</span>
      {!!count && <span style={S('flex:0 0 auto;min-width:24px;height:24px;padding:0 8px;box-sizing:border-box;border-radius:999px;background:#EEF0F3;color:#4A525E;font-size:12.5px;font-weight:600;display:flex;align-items:center;justify-content:center')}>{count}</span>}
      {CHEV}
    </button>
  );
  const ico = (path: string) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true"><path d={path} /></svg>;
  const PHONE = 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z';
  const MAIL = 'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm0 1 8 6 8-6';
  const CAL = 'M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V7A1.5 1.5 0 0 1 5 5.5zM3.5 10h17M8 3.5v4M16 3.5v4';
  const card = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:8px 20px';
  const sheet = (title: string, body: React.ReactNode, onClose: () => void) => (
    <div style={S('position:absolute;left:0;right:0;top:0;bottom:0;z-index:6')}>
      <button onClick={onClose} aria-label="Close" style={S('position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;padding:0;border:0;background:rgba(14,17,22,0.4);cursor:pointer')} />
      <div className="sheet" role="dialog" aria-label={title} style={S('position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;overflow-y:auto;background:#FFFFFF;border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:6px')}>
        <div style={S('align-self:center;width:40px;height:4px;border-radius:999px;background:#D5D9E0;margin-bottom:12px')} />
        <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px')}><h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{title}</h2><button onClick={onClose} aria-label="Close" style={S(RING)}>{CLOSE}</button></div>
        {body}
      </div>
    </div>
  );
  const page = "position:relative;width:100%;height:100dvh;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;";

  // Messaging and editing take over the page.
  if (c.mode === 'message') {
    return (
      <div className="only-m m-cal cal-root" style={S(page + 'background:#F4F5F7')}>
        <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px')}>
          <button onClick={() => { c.setMode('view'); c.setError(''); }} aria-label="Back" style={S(RING)}>{BACK}</button>
          <h1 style={S('margin:0;flex:1 1 auto;font-size:22px;font-weight:600;letter-spacing:-0.025em')}>{'Message ' + c.first}</h1>
        </header>
        <main ref={mainRef} className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:8px 20px 20px;display:flex;flex-direction:column;gap:14px')}>
          <Field label="Message"><textarea value={c.msg} onChange={(e) => { c.setMsg(e.target.value); c.setError(''); }} placeholder="Write a message" rows={7} style={{ ...FIELD_IN, resize: 'none' }} /></Field>
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>{channelNote(d.channels, row.phone, row.email)}</p>
        </main>
        <BottomBar error={c.error}><button onClick={c.sendMsg} disabled={c.busy} style={S(BLACK + ';width:100%;height:52px')}>Send</button></BottomBar>
      </div>
    );
  }
  if (c.mode === 'edit') {
    return (
      <div className="only-m m-cal cal-root" style={S(page + 'background:#F4F5F7')}>
        <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px')}>
          <button onClick={() => { c.setMode('view'); c.setError(''); }} aria-label="Back" style={S(RING)}>{BACK}</button>
          <h1 style={S('margin:0;flex:1 1 auto;font-size:22px;font-weight:600;letter-spacing:-0.025em')}>Edit details</h1>
        </header>
        <main ref={mainRef} className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:8px 20px 20px;display:flex;flex-direction:column;gap:12px')}>
          <Field label="Full name"><input type="text" value={c.ed.name} onChange={(e) => { c.setEd({ ...c.ed, name: e.target.value }); c.setError(''); }} style={FIELD_IN} /></Field>
          <Field label="Email"><input type="email" inputMode="email" value={c.ed.email} onChange={(e) => { c.setEd({ ...c.ed, email: e.target.value }); c.setError(''); }} placeholder="name@example.com" style={FIELD_IN} /></Field>
          <Field label="Phone"><input type="tel" inputMode="tel" value={c.ed.phone} onChange={(e) => { c.setEd({ ...c.ed, phone: phoneInput(e.target.value) }); c.setError(''); }} placeholder="Optional" style={FIELD_IN} /></Field>
        </main>
        <BottomBar error={c.error}>
          <div style={S('display:flex;gap:10px')}>
            <button onClick={() => setEqa(true)} aria-label="More actions" aria-haspopup="dialog" style={S(RING + ';flex:0 0 52px;width:52px;height:52px')}><svg width="20" height="20" viewBox="0 0 24 24" fill="#0E1116"><circle cx="12" cy="5.5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="18.5" r="1.6" /></svg></button>
            <button onClick={c.saveEdit} disabled={c.busy} style={S(BLACK + ';flex:1 1 0;height:52px')}>Save details</button>
          </div>
        </BottomBar>
        {eqa && sheet('More actions', !c.confirmDel ? (
          <div style={S('display:flex;flex-direction:column')}>
            <button onClick={() => c.setConfirmDel(true)} style={S(rowCss + ';color:#B42318')}>Delete client</button>
          </div>
        ) : (
          <div style={S('display:flex;flex-direction:column;gap:12px;padding:16px;border:1px solid #F3C6C3;border-radius:20px;background:#FEF3F2')}>
            <span style={S('font-size:14.5px;font-weight:600')}>Delete {row.name} for good?</span>
            <span style={S('font-size:13.5px;color:#5E6673')}>Only possible when they have no bookings or sales. Their notes go too.</span>
            {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
            <div style={S('display:flex;gap:10px')}><button onClick={c.removeClient} disabled={c.busy} style={S('flex:1 1 0;height:48px;border:0;border-radius:999px;background:#C0261B;color:#FFFFFF;font-size:14px;font-weight:500')}>Delete client</button><button className="ghost" onClick={() => { c.setConfirmDel(false); setEqa(false); }} style={S('flex:1 1 0;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500')}>Keep</button></div>
          </div>
        ), () => { c.setConfirmDel(false); setEqa(false); })}
      </div>
    );
  }

  const appts = d.appts.filter((a) => (apFilter === 'all' ? true : apFilter === 'upcoming' ? a.upcoming : !a.upcoming));
  const groups: { month: string; items: typeof appts }[] = [];
  appts.forEach((a) => { const g = groups[groups.length - 1]; if (g && g.month === a.month) g.items.push(a); else groups.push({ month: a.month, items: [a] }); });
  const avg = row.visits ? Math.round(row.spentCents / row.visits) : 0;
  const pi = patchInfo(c.patchOn, d.today);
  const piBg = pi.tone === 'ok' ? '#DDF3EA' : pi.tone === 'bad' ? '#FDECEA' : '#EEF0F3', piFg = pi.tone === 'ok' ? '#14624A' : pi.tone === 'bad' ? '#B42318' : '#5E6673';
  const greyRow = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;border-radius:16px;background:#F4F5F7';
  const xBtn = 'flex:0 0 36px;width:36px;height:36px;border:0;border-radius:999px;background:transparent;display:flex;align-items:center;justify-content:center';
  const addRow = (id: string, value: string, set: (v: string) => void, add: () => void, ph: string) => (
    <div style={S('display:flex;gap:8px')}><label htmlFor={id} style={S('position:absolute;left:-9999px')}>{ph}</label>
      <input id={id} type="text" value={value} onChange={(e) => set(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder={ph} style={TXTIN(48)} />
      <button onClick={add} disabled={c.busy} style={S(BLACK)}>Add</button></div>
  );

  return (
    <div className="only-m m-cal cal-root" style={S(page + 'background:#F4F5F7')}>
      <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px;' + (view !== 'home' ? 'border-bottom:1px solid #E6E8EC;margin-bottom:8px' : ''))}>
        {view === 'home'
          ? <Link href="/clients" aria-label="Back to clients" style={S(RING)}>{BACK}</Link>
          : <button onClick={() => { if (openForm) { setOpenForm(''); return; } setView('home'); c.setError(''); c.setNotice(''); }} aria-label="Back to profile" style={S(RING)}>{BACK}</button>}
        {view !== 'home' && <>{avatar(36, 13)}<div style={S('flex:1 1 auto;min-width:0;font-size:18px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{row.name}</div></>}
        {view === 'home' && <div style={S('flex:1 1 auto')} />}
        <Link href="/clients" aria-label="Close profile" style={S(RING)}>{CLOSE}</Link>
      </header>
      <main ref={mainRef} className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 24px;display:flex;flex-direction:column;gap:16px')}>
        {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}

        {view === 'home' && (<>
          <div style={S('display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 0 4px;text-align:center')}>
            {avatar(112, 34)}
            <h1 style={S('margin:12px 0 0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;overflow-wrap:anywhere')}>{row.name}</h1>
            <div style={S('display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px')}><span style={S('display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + tone[0] + ';color:' + tone[1])}>{row.tag}</span>{!!row.email && <span style={S('font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{row.email}</span>}</div>
          </div>
          <div style={S('display:flex;gap:10px')}>
            <button onClick={() => setQa(true)} aria-label="More actions" aria-haspopup="dialog" style={S(RING + ';flex:0 0 52px;width:52px;height:52px')}><svg width="20" height="20" viewBox="0 0 24 24" fill="#0E1116"><circle cx="12" cy="5.5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="18.5" r="1.6" /></svg></button>
            <button onClick={() => { c.setError(''); c.setNotice(''); setView('messages'); }} aria-label={'Messages with ' + c.first} style={S(RING + ';flex:0 0 52px;width:52px;height:52px')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="3" /><path d="m4.5 7.5 7.5 5.5 7.5-5.5" /></svg></button>
            <Link href={book} style={S('flex:1 1 0;height:52px;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;display:flex;align-items:center;justify-content:center;text-decoration:none')}>Book now</Link>
          </div>
          <div style={S(card + ';display:flex;flex-direction:column')} className="sum-rows">
            {[[PHONE, row.phone || 'No phone'], [MAIL, row.email || 'No email'], [CAL, d.since]].map(([p, t]) => <div key={p} style={S('display:flex;align-items:center;gap:12px;padding:14px 0;font-size:15px')}>{ico(p)}<span style={S('min-width:0;overflow-wrap:anywhere')}>{t}</span></div>)}
          </div>
          <div style={S(card + ';display:flex;flex-direction:column')} className="sum-rows">
            {menu('overview', 'Overview')}
            {menu('appointments', 'Appointments', d.appts.length)}
            {menu('messages', 'Messages', thread.length)}
            {menu('details', 'Client details')}
            <button onClick={() => setRec(!rec)} aria-expanded={rec} style={S(rowCss)}><span style={S('flex:1 1 auto')}>Records</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto;transform:rotate(' + (rec ? 180 : 0) + 'deg)')} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
            {rec && <>
              {menu('notes', 'Notes', c.notes.length, true)}
              {menu('alerts', 'Allergies and patch tests', c.allergies.length, true)}
              {menu('formula', 'Colour formula', undefined, true)}
              {menu('forms', 'Client forms', d.forms.length, true)}
            </>}
            {menu('prefs', 'Preferences')}
          </div>
        </>)}

        {view !== 'home' && !openForm && <h2 style={S('margin:8px 0 0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>{SUB_TITLE[view]}</h2>}

        {view === 'overview' && (<>
          <section aria-label="Total spent" style={S('box-sizing:border-box;border-radius:24px;background:#0E1116;color:#FFFFFF;padding:22px 22px 20px')}>
            <div style={S('font-size:13.5px;opacity:0.7')}>Total spent</div>
            <div style={S('margin-top:4px;font-size:40px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{money(row.spentCents)}</div>
            <div style={S('margin-top:6px;font-size:14px;opacity:0.7')}>{row.visits + (row.visits === 1 ? ' visit' : ' visits') + (row.visits ? ', ' + money(Math.round(avg / 100) * 100) + ' on average' : '')}</div>
          </section>
          <section aria-label="Last and next visit" style={S('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px')}>
            <div style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:20px;padding:16px')}><div style={S('font-size:13px;color:#5E6673')}>Last visit</div><div style={S('margin-top:4px;font-size:18px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{row.last}</div></div>
            <div style={S('box-sizing:border-box;background:#ECE8FE;border-radius:20px;padding:16px;color:#3A2BB5')}><div style={S('font-size:13px;opacity:0.8')}>Next booking</div><div style={S('margin-top:4px;font-size:18px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{row.next}</div></div>
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
            {([['all', 'All'], ['upcoming', 'Upcoming'], ['past', 'Past']] as const).map(([id, l]) => <button key={id} onClick={() => setApFilter(id)} aria-pressed={apFilter === id} style={S('flex:0 0 auto;height:44px;padding:0 18px;border-radius:999px;font-size:14px;font-weight:500;border:1px solid ' + (apFilter === id ? '#0E1116' : '#E1E4E9') + ';background:' + (apFilter === id ? '#0E1116' : '#FFFFFF') + ';color:' + (apFilter === id ? '#FFFFFF' : '#0E1116'))}>{l}</button>)}
          </div>
          {groups.map((g) => (
            <div key={g.month} style={S('display:flex;flex-direction:column;gap:10px')}>
              <h3 style={S('margin:6px 0 0;font-size:15px;font-weight:600;color:#5E6673')}>{g.month}</h3>
              {g.items.map((a) => {
                const v = VISIT[a.status] ?? VISIT.confirmed;
                return (
                  <Link key={a.id} href={a.href} aria-label={a.label + ', ' + a.services + ', ' + v.label} style={S('display:block;text-decoration:none;box-sizing:border-box;padding:14px 16px;border-radius:20px;color:' + v.fg + ';' + v.card)}>
                    <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px')}><span style={S('font-size:16px;font-weight:600')}>{a.label}</span><span style={S('font-size:14.5px;font-weight:500;flex:0 0 auto' + (v.strike ? ';text-decoration:line-through' : ''))}>{money(a.cents)}</span></div>
                    <div style={S('margin-top:2px;font-size:14px;overflow-wrap:anywhere' + (v.strike ? ';text-decoration:line-through' : ''))}>{(a.time ? a.time + ' · ' : '') + a.services + (a.staff ? ' with ' + a.staff : '')}</div>
                    <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px')}>
                      <span style={S('display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:' + v.chipBg + ';color:' + v.chipFg)}>{v.label}</span>
                      {!!a.pay && <span style={S('font-size:12.5px;opacity:0.85')}>{a.pay}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
          {appts.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>{apFilter === 'upcoming' ? 'Nothing coming up.' : apFilter === 'past' ? 'No past appointments.' : 'No appointments yet.'}</p>}
        </>)}

        {view === 'messages' && (<>
          {thread.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>No messages yet. Say hello below.</p>}
          {thread.map((m, i) => {
            const newDay = i === 0 || thread[i - 1].day !== m.day;
            return (
              <div key={m.id} style={S('display:flex;flex-direction:column;gap:6px')}>
                {newDay && <div style={S('align-self:center;margin:8px 0 2px;font-size:12.5px;color:#5E6673')}>{m.day}</div>}
                <div style={S('display:flex;flex-direction:column;align-items:' + (m.mine ? 'flex-end' : 'flex-start') + ';gap:3px')}>
                  <div style={S('max-width:82%;box-sizing:border-box;padding:11px 15px;border-radius:20px;font-size:15px;line-height:1.35;overflow-wrap:anywhere;white-space:pre-wrap;' + (m.mine ? 'background:#0E1116;color:#FFFFFF;border-bottom-right-radius:6px' : 'background:#FFFFFF;color:#0E1116;border:1px solid #E6E8EC;border-bottom-left-radius:6px'))}>{m.text}</div>
                  <div style={S('font-size:11.5px;color:#8A93A0')}>{(m.mine ? 'You, ' : '') + m.time}</div>
                </div>
              </div>
            );
          })}
        </>)}

        {view === 'details' && (<>
          <div style={S(card + ';display:flex;flex-direction:column')} className="sum-rows">
            {([['Name', row.name], ['Phone', row.phone || 'Not added'], ['Email', row.email || 'Not added'], ['Client since', d.since.replace('Client since ', '')]] as [string, string][]).map(([l, v]) => <div key={l} style={S('display:flex;justify-content:space-between;gap:12px;padding:14px 0;font-size:15px')}><span style={S('color:#5E6673')}>{l}</span><span style={S('font-weight:500;text-align:right;overflow-wrap:anywhere')}>{v}</span></div>)}
          </div>
          <button onClick={c.startEdit} style={S('height:52px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500;cursor:pointer')}>Edit details</button>
        </>)}

        {view === 'notes' && s.notes}

        {view === 'alerts' && (<>
          <section style={S(CARD_M)}>
            <h3 style={S('margin:0;font-size:16px;font-weight:600')}>Allergies</h3>
            {c.allergies.length === 0 && <p style={S('margin:0;font-size:14px;color:#5E6673')}>No allergies recorded.</p>}
            {c.allergies.map((a, i) => (
              <div key={a} style={S(greyRow)}>
                <span style={S('font-size:14px;overflow-wrap:anywhere;padding-top:2px')}>{a}</span>
                <button className="ghost" onClick={() => c.removeAllergy(i)} aria-label={'Remove ' + a} style={S(xBtn)}>{X}</button>
              </div>
            ))}
            {addRow('pf-all', c.allergyDraft, c.setAllergyDraft, c.addAllergy, 'Add an allergy')}
          </section>
          <section style={S(CARD_M)}>
            <h3 style={S('margin:0;font-size:16px;font-weight:600')}>Patch test</h3>
            <div style={S(greyRow)}>
              <span style={S('display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:600;background:' + piBg + ';color:' + piFg)}>{pi.text}</span>
              {c.patchOn && <span style={S('font-size:13px;color:#5E6673')}>{'Tested ' + niceDate(c.patchOn)}</span>}
            </div>
            <Field label="Test date"><input type="date" value={c.patchOn ?? ''} max={d.today} onChange={(e) => { if (e.target.value) c.setPatch(e.target.value); }} style={FIELD_IN} /></Field>
            <div style={S('display:flex;gap:10px')}>
              <button onClick={c.recordPatch} disabled={c.busy} style={S(BLACK + ';flex:1 1 0')}>Record today</button>
              {c.patchOn && <button className="ghost" onClick={() => c.setPatch(null)} disabled={c.busy} style={S('flex:1 1 0;height:48px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#B42318;font-size:14px;font-weight:500')}>Remove</button>}
            </div>
          </section>
        </>)}

        {view === 'formula' && (
          <section style={S(CARD_M)}>
            <h3 style={S('margin:0;font-size:16px;font-weight:600')}>Formula</h3>
            <label htmlFor="pf-formula" style={S('position:absolute;left:-9999px')}>Colour formula</label>
            <textarea id="pf-formula" value={c.formula} onChange={(e) => c.setFormula(e.target.value)} placeholder="No formula saved yet" rows={6} style={S('box-sizing:border-box;width:100%;resize:none;padding:12px 14px;border:1px solid #E1E4E9;border-radius:16px;background:#F4F5F7;font:inherit;font-size:14.5px;color:#0E1116')} />
            <button onClick={c.saveFormula} disabled={c.busy || c.formula === c.saved} style={S(BLACK + ';opacity:' + (c.formula === c.saved ? 0.45 : 1))}>Save formula</button>
          </section>
        )}

        {view === 'forms' && !openForm && (<>
          {d.forms.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>No forms completed yet.</p>}
          {d.forms.map((f) => {
            const [when, ...rest] = f.date.split(' · ');
            return (
              <button key={f.id} onClick={() => setOpenForm(f.id)} style={S('display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;padding:16px;border:1px solid #E6E8EC;border-radius:22px;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
                <span style={S('flex:0 0 44px;width:44px;height:44px;border-radius:14px;background:#EEEAFE;display:flex;align-items:center;justify-content:center')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3A2BB5" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 9h6M9 13h6M9 17h3" /></svg></span>
                <span style={S('flex:1 1 auto;min-width:0')}>
                  <span style={S('display:block;font-size:16px;font-weight:600;letter-spacing:-0.01em;overflow-wrap:anywhere')}>{f.name}</span>
                  <span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{when}</span>
                  {(rest.length > 0 || f.flagged) && <span style={S('display:flex;flex-wrap:wrap;gap:6px;margin-top:8px')}>
                    {rest.map((r) => <span key={r} style={S('padding:3px 10px;border-radius:999px;background:#EEF0F3;color:#4A525E;font-size:12px;font-weight:500')}>{r.replace('booking ', 'Booking ')}</span>)}
                    {f.flagged && <span style={S('padding:3px 10px;border-radius:999px;background:#FDECEA;color:#B42318;font-size:12px;font-weight:600')}>Reaction noted</span>}
                  </span>}
                </span>
                {CHEV}
              </button>
            );
          })}
          <Link href={'/clients/forms?c=' + row.id} style={S('display:flex;align-items:center;justify-content:center;height:52px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14.5px;font-weight:500;text-decoration:none')}>Open client forms</Link>
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
              <p style={S('margin:6px 0 0;font-size:14px;color:#5E6673')}>{'Completed ' + when + (rest.length ? ' · ' + rest.map((r) => r.replace('booking ', 'Booking ')).join(' · ') : '')}</p>
            </div>
            {f.flagged && <div style={S('padding:12px 14px;border-radius:16px;background:#FDECEA;color:#B42318;font-size:13.5px;font-weight:600')}>A reaction was noted on this form.</div>}
            {answers.map((a, i) => (
              <div key={i} style={S('box-sizing:border-box;padding:12px 16px 14px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}>
                <div style={S('font-size:12.5px;color:#5E6673;overflow-wrap:anywhere')}>{a.k}</div>
                <div style={S('margin-top:3px;font-size:16px;font-weight:600;overflow-wrap:anywhere;' + (a.v === 'No answer' ? 'color:#8A93A0;font-weight:400' : ''))}>{a.v}</div>
              </div>
            ))}
          </>);
        })()}
        {view === 'prefs' && s.prefs}
      </main>
      {view === 'messages' ? (
        <BottomBar error={sendErr}>
          <div style={S('display:flex;align-items:flex-end;gap:10px')}>
            <textarea value={draft} onChange={(e) => { setDraft(e.target.value); setSendErr(''); }} placeholder={'Message ' + c.first} rows={1} aria-label={'Message ' + c.first} style={{ ...S('flex:1 1 auto;min-width:0;box-sizing:border-box;max-height:120px;resize:none;padding:13px 16px;border:1px solid #E1E4E9;border-radius:24px;background:#FFFFFF;font:inherit;font-size:15px;color:#0E1116'), minHeight: 48 }} />
            <button onClick={sendChat} disabled={sending || !draft.trim()} aria-label="Send" style={S('flex:0 0 48px;width:48px;height:48px;border:0;border-radius:999px;background:#0E1116;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:' + (sending || !draft.trim() ? 0.45 : 1))}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
          </div>
        </BottomBar>
      ) : <MobileTabs active="clients" />}
      {qa && sheet('Quick actions', (
        <div style={S('display:flex;flex-direction:column')}>
          <button onClick={() => { setQa(false); c.startEdit(); }} style={S(rowCss)}>Edit details</button>
          <Link href={'/clients/forms?c=' + row.id} style={S(rowCss + ';text-decoration:none')}>Client forms</Link>
        </div>
      ), () => setQa(false))}
    </div>
  );
}

export function ProfileView({ data, initial }: { data: ProfileData; initial?: string }) {
  const c = useProfile(data);
  return (<>
    {c.narrow !== false && <Mobile c={c} initial={initial} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
