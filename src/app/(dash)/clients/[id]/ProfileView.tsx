'use client';
// 1:1 conversion of the prototype's ClientProfile.dc.html and MobileClientProfile.dc.html. Markup and style strings are kept as written;
// only the {{ }} holes are real data and handlers are real server actions.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { MobileTabs } from '@/components/Chrome';
import { S } from '../../calendar/pickers';
import { addNote, recordPatchTest, removeNote, saveFormula, sendClientMessage, setAllergies, setPreference } from '../actions';
import { MSG_TEMPLATES, initialsOf, money, patchInfo, type Channels, type ClientRow } from '../shared';

export type ProfileData = {
  row: ClientRow; since: string; allergies: string[]; patchOn: string | null; formula: string; reminders: boolean; marketing: boolean;
  notes: { id: string; text: string }[];
  history: { id: string; date: string; service: string; staff: string; cents: number; when: string; paid: string }[]; historyTotal: number;
  switcher: { id: string; label: string }[]; today: string; channels: Channels;
};
const TONE: Record<string, [string, string]> = { Regular: ['#DDF3EA', '#14624A'], New: ['#DFEEFF', '#1B4A8A'], Lapsed: ['#FFEBD0', '#7A4204'] };

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
  const [openHist, setOpenHist] = useState(-1);
  const [notes, setNotes] = useState(d.notes);
  const [allergies, setAl] = useState(d.allergies);
  const [patchOn, setPatchOn] = useState(d.patchOn);
  const [formula, setFormula] = useState(d.formula);
  const [saved, setSaved] = useState(d.formula);
  const [reminders, setReminders] = useState(d.reminders);
  const [marketing, setMarketing] = useState(d.marketing);
  const [noteDraft, setNoteDraft] = useState('');
  const [allergyDraft, setAllergyDraft] = useState('');
  const [mode, setMode] = useState<'view' | 'message'>('view');
  const [msg, setMsg] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const first = row.name.split(' ')[0];
  const fail = (e?: string) => { setError(e ?? 'Something went wrong'); };
  const run = (fn: () => Promise<{ error?: string }>, ok: () => void) => startT(async () => { const r = await fn(); if (r.error) { fail(r.error); return; } setError(''); ok(); });

  return {
    d, row, first, narrow, busy, openHist, setOpenHist, notes, allergies, patchOn, formula, setFormula, saved, reminders, marketing, noteDraft, setNoteDraft, allergyDraft, setAllergyDraft, mode, setMode, msg, setMsg, notice, setNotice, error, setError,
    addNote: () => { const t = noteDraft.trim(); if (!t) return; run(() => addNote(row.id, t), () => { setNoteDraft(''); setNotice('Note added'); router.refresh(); }); },
    removeNote: (id: string) => run(() => removeNote(id), () => { setNotes((n) => n.filter((x) => x.id !== id)); }),
    addAllergy: () => { const t = allergyDraft.trim(); if (!t) return; const next = allergies.includes(t) ? allergies : [...allergies, t]; run(() => setAllergies(row.id, next), () => { setAl(next); setAllergyDraft(''); setNotice('Alert added'); }); },
    removeAllergy: (i: number) => { const next = allergies.filter((_, j) => j !== i); run(() => setAllergies(row.id, next), () => setAl(next)); },
    recordPatch: () => startT(async () => { const r = await recordPatchTest(row.id); if (r.error) { fail(r.error); return; } setPatchOn(r.on!); setNotice('Patch test recorded for today'); }),
    saveFormula: () => run(() => saveFormula(row.id, formula), () => { setSaved(formula); setNotice('Formula saved'); }),
    toggle: (k: 'reminders' | 'marketing') => { const v = k === 'reminders' ? !reminders : !marketing; run(() => setPreference(row.id, k, v), () => (k === 'reminders' ? setReminders(v) : setMarketing(v))); },
    sendMsg: () => { if (!msg.trim()) { setError('Write a message first.'); return; } run(() => sendClientMessage(row.id, msg), () => { setMsg(''); setMode('view'); setNotice('Message sent to ' + first); }); },
  };
}
type C = ReturnType<typeof useProfile>;

const CARD = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:16px';
const TXTIN = (h: number) => ({ ...S('box-sizing:border-box;width:100%;height:' + h + 'px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF;flex:1 1 auto;min-width:0'), minHeight: 0 });
const X = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;

/* The section cards. `pad` is the card padding (24 desktop, 20 mobile). */
function Sections({ c, pad }: { c: C; pad: number }) {
  const { d } = c;
  const card = CARD + ';padding:' + pad + 'px';
  const pi = patchInfo(c.patchOn, d.today);
  const patchStyle = 'display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + (pi.tone === 'ok' ? '#DDF3EA' : pi.tone === 'bad' ? '#FDECEA' : '#EEF0F3') + ';color:' + (pi.tone === 'ok' ? '#14624A' : pi.tone === 'bad' ? '#B42318' : '#5E6673');
  const sw = (on: boolean) => ({ st: 'position:relative;flex:0 0 52px;width:52px;height:32px;padding:0;border:0;border-radius:999px;background:' + (on ? '#0E1116' : '#D5D9E0'), kn: 'position:absolute;top:3px;left:' + (on ? 23 : 3) + 'px;width:26px;height:26px;border-radius:999px;background:#FFFFFF' });
  const rs = sw(c.reminders), ms = sw(c.marketing);
  const history = (
    <section style={S(card)}><div><h2 style={S('margin:0;font-size:16px;font-weight:600')}>Visit history</h2></div>
      {d.history.map((h, i) => {
        const open = c.openHist === i;
        return (
          <div key={h.id} style={S('border-top:1px solid #EEF0F3')}>
            <button onClick={() => c.setOpenHist(open ? -1 : i)} aria-expanded={open} aria-label={`${h.service}, ${h.date}, ${open ? 'hide details' : 'show details'}`} style={S('width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border:0;background:transparent;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
              <span style={S('min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;overflow-wrap:anywhere')}>{h.service}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{h.date}, With {h.staff}</span></span>
              <span style={S('flex:0 0 auto;display:flex;align-items:center;gap:10px')}><span style={S('font-size:14.5px;font-weight:600')}>{money(h.cents)}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={S('transform:rotate(' + (open ? 180 : 0) + 'deg)')}><path d="M6 9l6 6 6-6" /></svg></span>
            </button>
            {open && (
              <div style={S('margin:0 0 12px;padding:4px 14px;border-radius:16px;background:#F4F5F7')}>
                {([['When', h.when], ['Service', h.service], ['With', h.staff], ['Status', 'Completed'], ['Paid', h.paid]] as const).map(([k, v], j) => (
                  <div key={k} style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0' + (j < 4 ? ';border-bottom:1px solid #E6E8EC' : ''))}><span style={S('color:#5E6673')}>{k}</span><span style={S('font-weight:500;text-align:right' + (k === 'Status' ? ';color:#14624A' : ''))}>{v}</span></div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {d.history.length === 0 && <p style={S('margin:0;font-size:14px;color:#5E6673')}>No completed visits yet.</p>}
      {d.historyTotal > d.history.length && <p style={S('margin:0;font-size:13px;color:#5E6673')}>Showing the last {d.history.length} of {d.historyTotal} visits.</p>}
    </section>
  );
  const notes = (
    <section style={S(card)}><div><h2 style={S('margin:0;font-size:16px;font-weight:600')}>Notes</h2></div>
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
    <section style={S(card)}><div><h2 style={S('margin:0;font-size:16px;font-weight:600')}>Alerts and patch test</h2></div>
      <div style={S('display:flex;flex-direction:column;gap:8px')}>
        <span style={S('font-size:13px;font-weight:600;color:#5E6673')}>Allergies and sensitivities</span>
        {c.allergies.length === 0 && <span style={S('font-size:14px;color:#5E6673')}>None recorded.</span>}
        <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>
          {c.allergies.map((a, i) => (
            <span key={a} style={S('display:inline-flex;align-items:center;gap:2px;padding:0 4px 0 14px;height:36px;border-radius:999px;background:#FDECEA;color:#B42318;font-size:13.5px;font-weight:500')}>{a}
              <button className="ghost" onClick={() => c.removeAllergy(i)} aria-label={'Remove ' + a} style={S('flex:0 0 32px;width:32px;height:32px;border:0;border-radius:999px;background:transparent;display:flex;align-items:center;justify-content:center')}>{X}</button></span>
          ))}
        </div>
        <div style={S('display:flex;gap:8px')}><label htmlFor="pf-all" style={S('position:absolute;left:-9999px')}>Add an allergy</label>
          <input id="pf-all" type="text" value={c.allergyDraft} onChange={(e) => c.setAllergyDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') c.addAllergy(); }} placeholder="Add an allergy" style={TXTIN(48)} />
          <button onClick={c.addAllergy} disabled={c.busy} style={S('height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500;padding:0 20px;height:48px;flex:0 0 auto')}>Add</button></div>
      </div>
      <div style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:4px;border-top:1px solid #EEF0F3')}>
        <div style={S('padding-top:12px')}><div style={S('font-size:13px;font-weight:600;color:#5E6673')}>Patch test</div><span style={S(patchStyle)}>{pi.text}</span></div>
        {pi.needsAction && <button onClick={c.recordPatch} disabled={c.busy} style={S('height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500;padding:0 20px;margin-top:12px')}>Record test</button>}
      </div>
    </section>
  );
  const formula = (
    <section style={S(card)}><div><h2 style={S('margin:0;font-size:16px;font-weight:600')}>Colour formula</h2></div>
      <label htmlFor="pf-formula" style={S('position:absolute;left:-9999px')}>Colour formula</label>
      <textarea id="pf-formula" value={c.formula} onChange={(e) => c.setFormula(e.target.value)} placeholder="No formula saved yet" style={S('box-sizing:border-box;width:100%;min-height:88px;resize:vertical;padding:12px 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:14.5px;color:#0E1116;background:#FFFFFF')} />
      {c.formula !== c.saved && <button onClick={c.saveFormula} disabled={c.busy} style={S('height:44px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500;padding:0 20px')}>Save formula</button>}
    </section>
  );
  const switchRow = (id: string, title: string, sub: string, on: boolean, st: { st: string; kn: string }, k: 'reminders' | 'marketing') => (
    <div style={S('display:flex;align-items:center;justify-content:space-between;gap:16px;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}>
      <div><div id={id} style={S('font-size:14px;font-weight:600')}>{title}</div><div style={S('font-size:13px;color:#5E6673')}>{sub}</div></div>
      <button role="switch" aria-checked={on} aria-labelledby={id} onClick={() => c.toggle(k)} style={S(st.st)}><span style={S(st.kn)} /></button>
    </div>
  );
  const prefs = (
    <section style={S(card)}><div><h2 style={S('margin:0;font-size:16px;font-weight:600')}>Preferences</h2></div>
      <div style={S('display:flex;flex-direction:column')}>
        <div style={S('display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #EEF0F3')}><span style={S('color:#5E6673')}>Usually sees</span><span style={S('font-weight:500;text-align:right')}>{c.row.staff}</span></div>
        {switchRow('pf-rem', 'Appointment reminders', 'Text and email', c.reminders, rs, 'reminders')}
        {switchRow('pf-mk', 'Marketing messages', 'Offers and news', c.marketing, ms, 'marketing')}
      </div>
    </section>
  );
  return { history, notes, alerts, formula, prefs };
}

function Header({ c, m }: { c: C; m: boolean }) {
  const { row } = c;
  const tone = TONE[row.tag];
  const msgS = 'height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:14px;font-weight:500;padding:0 20px;';
  const pri = 'height:44px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14px;font-weight:500;padding:0 20px;';
  const avatar = 'flex:0 0 72px;width:72px;height:72px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:600;background:' + tone[0] + ';color:' + tone[1];
  const tagS = 'display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + tone[0] + ';color:' + tone[1];
  const book = `/calendar?new=1&c=${encodeURIComponent(row.name)}`;
  return (
    <section style={S(CARD + (m ? ';padding:20px;gap:20px' : ';padding:28px;gap:20px'))}>
      <div style={S('display:flex;align-items:center;gap:' + (m ? 14 : 20) + 'px')}>
        <div style={S(avatar)}>{initialsOf(row.name, 3)}</div>
        <div style={S('min-width:0;display:flex;flex-direction:column;gap:6px')}>
          <h1 style={S('margin:0;font-size:' + (m ? 22 : 28) + 'px;line-height:1.15;font-weight:600;letter-spacing:-0.025em;overflow-wrap:anywhere')}>{row.name}</h1>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px')}><span style={S(tagS)}>{row.tag}</span><span style={S('font-size:13px;color:#5E6673')}>{c.d.since}</span></div>
        </div>
      </div>
      <div style={S('display:flex;flex-wrap:wrap;gap:6px 24px;font-size:14px;color:#0E1116')}><span style={S('overflow-wrap:anywhere')}>{row.phone || 'No phone'}</span><span style={S('overflow-wrap:anywhere')}>{row.email || 'No email'}</span></div>
      {!!c.notice && <span role="status" style={S('align-self:flex-start;padding:4px 12px;border-radius:999px;background:#DDF3EA;color:#14624A;font-size:12.5px;font-weight:500')}>{c.notice}</span>}
      {c.mode === 'message' && (
        <div style={S('display:flex;flex-direction:column;gap:10px')}>
          <label htmlFor="pf-msg" style={S('font-size:14px;font-weight:600')}>Message {c.first}</label>
          <div role="group" className="hscroll" aria-label="Quick replies" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto;padding-bottom:2px')}>
            {MSG_TEMPLATES.map((t) => <button key={t.id} onClick={() => { c.setMsg(t.text(c.first)); c.setError(''); }} style={S('flex:0 0 auto;height:40px;padding:0 14px;border-radius:999px;font-size:13.5px;font-weight:500;border:1px solid #E1E4E9;background:#FFFFFF;color:#0E1116')}>{t.label}</button>)}
          </div>
          <textarea id="pf-msg" value={c.msg} onChange={(e) => { c.setMsg(e.target.value); c.setError(''); }} placeholder="Write a message" style={S('box-sizing:border-box;width:100%;min-height:96px;resize:vertical;padding:12px 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:14.5px;color:#0E1116;background:#FFFFFF')} />
          {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
          <div style={S('display:flex;gap:10px')}><button onClick={c.sendMsg} disabled={c.busy} style={S(pri + 'flex:1 1 0')}>Send</button><button className="ghost" onClick={() => { c.setMode('view'); c.setError(''); }} style={S(msgS + 'flex:1 1 0')}>Cancel</button></div>
        </div>
      )}
      {c.mode !== 'message' && (
        <div style={S('display:flex;gap:10px;flex-wrap:wrap')}>
          <Link href={book} style={S(pri + 'display:flex;align-items:center;justify-content:center;text-decoration:none;box-sizing:border-box;' + (m ? 'flex:1 1 0' : 'flex:0 0 auto'))}>{m ? 'Book' : 'Book appointment'}</Link>
          <button className="ghost" onClick={() => { c.setMode('message'); c.setError(''); c.setNotice(''); }} style={S(msgS + (m ? 'flex:1 1 0' : 'flex:0 0 auto'))}>Message</button>
        </div>
      )}
    </section>
  );
}

function Switcher({ c }: { c: C }) {
  return (
    <div style={S('display:flex;flex-direction:column;gap:8px')}><span id="pf-sw" style={S('font-size:13px;color:#5E6673')}>Viewing client</span>
      <div role="group" aria-labelledby="pf-sw" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>
        {c.d.switcher.map((x) => { const on = x.id === c.row.id; return <Link key={x.id} href={`/clients/${x.id}`} aria-current={on ? 'true' : undefined} style={S('display:flex;align-items:center;flex:0 0 auto;height:40px;padding:0 14px;border-radius:999px;font-size:13.5px;font-weight:500;text-decoration:none;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116'))}>{x.label}</Link>; })}
      </div></div>
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
    <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 48px 8px;display:flex;flex-direction:column;gap:24px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <Link href="/clients" style={S('align-self:flex-start;display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 16px 0 10px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;text-decoration:none;font-size:14px;font-weight:500')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6 8.5 12l6 6" /></svg>Clients</Link>
      <Switcher c={c} />
      <Header c={c} m={false} />
      <Stats c={c} cols={5} big />
      <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:24px')}>
        <div style={S('flex:1.4 1 480px;min-width:0;display:flex;flex-direction:column;gap:24px')}>{s.history}{s.notes}</div>
        <div style={S('flex:1 1 340px;min-width:0;display:flex;flex-direction:column;gap:24px')}>{s.alerts}{s.formula}{s.prefs}</div>
      </div>
    </div>
  );
}

function Mobile({ c }: { c: C }) {
  const s = Sections({ c, pad: 20 });
  return (
    <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
      <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px')}>
        <Link href="/clients" aria-label="Back to clients" style={S('flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6 8.5 12l6 6" /></svg></Link>
        <div style={S('min-width:0')}><div style={S('font-size:13px;color:#5E6673')}>Client profile</div></div>
      </header>
      <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:20px')}>
        <Switcher c={c} />
        <Header c={c} m={true} />
        <Stats c={c} cols={2} big={false} />
        {s.alerts}{s.history}{s.notes}{s.formula}{s.prefs}
      </main>
      <MobileTabs active="clients" />
    </div>
  );
}

export function ProfileView({ data }: { data: ProfileData }) {
  const c = useProfile(data);
  return (<>
    {c.narrow !== false && <Mobile c={c} />}
    {c.narrow !== true && <Desktop c={c} />}
  </>);
}
