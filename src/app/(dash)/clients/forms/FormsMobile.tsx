'use client';
import Link from 'next/link';
import { addMonthsYmd, niceDate } from '@/lib/forms-shared';
import { S } from '../../calendar/pickers';
import { Tiles } from '../../calendar/wizardUi';
import type { FormsCtl } from './ClientFormsView';

const RING = 'flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;padding:0';
const BACK = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6l-6 6 6 6" /></svg>;
const CHEV = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true"><path d="M9.5 6l6 6-6 6" /></svg>;
const FORM_ICON = (stroke: string) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 9h6M9 13h6M9 17h3" /></svg>;
const BLACK = 'height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none;box-sizing:border-box;width:100%';
const OUTLINE = 'height:52px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none;box-sizing:border-box;width:100%';
const CARD = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:18px';
const FIELD_IN = { ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), minHeight: 0, borderRadius: 0 } as const;
const LVL_BG = { ok: ['#DDF3EA', '#14624A'], todo: ['#FFF4E5', '#8A4B00'], alert: ['#FDECEA', '#B42318'] } as const;

function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} style={S('display:block;box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{label}</span>{children}</label>;
}

/** A form as the profile shows it: purple tile, name, date, chips. */
function FormCard({ name, line, chips, flagged, onOpen }: { name: string; line: React.ReactNode; chips: string[]; flagged: boolean; onOpen: () => void }) {
  return (
    <button onClick={onOpen} style={S('display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;padding:16px;border:1px solid ' + (flagged ? '#F4C7C2' : '#E6E8EC') + ';border-radius:22px;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
      <span style={S('flex:0 0 44px;width:44px;height:44px;border-radius:14px;background:#EEEAFE;display:flex;align-items:center;justify-content:center')}>{FORM_ICON('#3A2BB5')}</span>
      <span style={S('flex:1 1 auto;min-width:0')}>
        <span style={S('display:block;font-size:16px;font-weight:600;letter-spacing:-0.01em;overflow-wrap:anywhere')}>{name}</span>
        <span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{line}</span>
        {(chips.length > 0 || flagged) && <span style={S('display:flex;flex-wrap:wrap;gap:6px;margin-top:8px')}>
          {chips.map((r) => <span key={r} style={S('padding:3px 10px;border-radius:999px;background:#EEF0F3;color:#4A525E;font-size:12px;font-weight:500')}>{r}</span>)}
          {flagged && <span style={S('padding:3px 10px;border-radius:999px;background:#FDECEA;color:#B42318;font-size:12px;font-weight:600')}>Reaction noted</span>}
        </span>}
      </span>
      {CHEV}
    </button>
  );
}

/** The phone's Client forms content: the list for the tab you are on. */
export function FormsMain({ c }: { c: FormsCtl }) {
  const tabs = (
    <div role="tablist" aria-label="Client forms view" style={S('display:flex;gap:4px;padding:4px;border-radius:999px;background:#E9ECF0;flex:0 0 auto')}>
      {([['upcoming', 'Upcoming visits'], ['done', 'Completed']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={c.tab === id} onClick={() => c.setTab(id)} style={S('flex:1 1 0;height:44px;border:0;border-radius:999px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;background:' + (c.tab === id ? '#0E1116' : 'transparent') + ';color:' + (c.tab === id ? '#FFFFFF' : '#0E1116'))}>{label}</button>)}
    </div>
  );
  return (
    <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:14px')}>
      <Link href="/clients" style={S('align-self:flex-start;display:inline-flex;align-items:center;min-height:36px;color:#4A525E;font-size:14px;font-weight:500;text-decoration:none')}>&larr; Clients</Link>
      {tabs}
      {c.tab === 'done' ? <Done c={c} /> : <Upcoming c={c} />}
    </main>
  );
}

function Done({ c }: { c: FormsCtl }) {
  return (<>
    {c.done.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14.5px')}>No forms have been completed yet. When a client or a team member fills one in, it appears here.</p>}
    {c.done.map((r) => (
      <FormCard key={r.id} name={r.form} flagged={r.flagged} chips={[r.by, ...(r.ref ? [r.ref] : [])]}
        line={<>{r.client} · {r.date}</>}
        onOpen={() => c.setAns({ name: r.form, sub: r.client + ' · ' + r.date, flagged: r.flagged, answers: r.answers, clientId: r.clientId })} />
    ))}
  </>);
}

function Upcoming({ c }: { c: FormsCtl }) {
  const k = c.cur;
  if (!k) return (
    <section style={S(CARD + ';display:flex;flex-direction:column;gap:10px')}>
      <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{c.hasForms ? 'No upcoming appointments' : 'No forms set up yet'}</h2>
      <p style={S('margin:0;color:#5E6673;font-size:14.5px')}>{c.hasForms ? 'Clients with an appointment coming up appear here with the forms they still need.' : c.owner ? 'Set up the forms clients fill in before a visit, then they show here for each appointment.' : 'Ask the owner to set up forms in Settings.'}</p>
      {!c.hasForms && c.owner && <Link href="/settings/forms" style={S(BLACK)}>Set up forms</Link>}
    </section>
  );
  const lv = LVL_BG[k.level];
  const wasSent = !!c.sent[k.bookingId];
  const chip = (on: boolean) => 'flex:0 0 auto;display:flex;align-items:center;gap:8px;height:44px;padding:0 18px;border-radius:999px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116') ;
  const DOT: Record<string, string> = { ok: '#14A27A', todo: '#E0932B', alert: '#D92D20' };
  return (<>
    {c.cards.length > 1 && (
      <div role="group" aria-label="Clients with appointments" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto')}>
        {c.cards.map((x) => { const on = x.id === k.id; return <button key={x.id} type="button" onClick={() => c.pick(x.id)} aria-current={on} style={S(chip(on))}><span aria-hidden="true" style={S('width:8px;height:8px;border-radius:999px;background:' + DOT[x.level])} />{x.name.split(' ')[0]} · {x.time}</button>; })}
      </div>
    )}
    <section style={S(CARD + ';display:flex;flex-direction:column;gap:14px')}>
      <div style={S('display:flex;align-items:center;gap:14px')}>
        <span aria-hidden="true" style={S('flex:0 0 48px;width:48px;height:48px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600')}>{k.init}</span>
        <div style={S('min-width:0')}><h2 style={S('margin:0;font-size:19px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{k.name}</h2><p style={S('margin:2px 0 0;color:#5E6673;font-size:13.5px;overflow-wrap:anywhere')}>{k.email || 'No email on file'}</p></div>
      </div>
      <div><span style={S('color:#5E6673;font-size:13px')}>Appointment {k.ref}</span><div style={S('font-size:14.5px;font-weight:600;overflow-wrap:anywhere')}>{k.when} · {k.svc}{k.who ? ' with ' + k.who : ''}</div></div>
      <Link href={`/clients/${k.clientId}`} style={S(OUTLINE)}>Open profile</Link>
    </section>
    <section role="status" style={S('box-sizing:border-box;border-radius:20px;background:' + lv[0] + ';color:' + lv[1] + ';padding:16px 18px;display:flex;flex-direction:column;gap:12px')}>
      <div><div style={S('font-size:15px;font-weight:600')}>{k.banner.title}</div><div style={S('margin-top:2px;font-size:13.5px;opacity:0.92')}>{k.banner.text}</div></div>
      {k.sendable > 0 && !!k.email && !wasSent && <button type="button" onClick={c.send} disabled={c.busy} style={S(BLACK)}>{k.sendable > 1 ? `Send ${k.sendable} forms by email` : 'Send link'}</button>}
    </section>
    {!!c.notice && <p role="status" style={S('margin:0;color:#14624A;font-size:14px;font-weight:600')}>{c.notice}</p>}
    {!!c.error && !c.rec && <p role="alert" style={S('margin:0;color:#B42318;font-size:14px;font-weight:600')}>{c.error}</p>}
    {k.rows.map((r) => {
      const st = c.stat[r.state];
      const bad = r.needed && (r.state === 'missing' || r.state === 'expired' || r.state === 'reaction');
      return (
        <section key={r.tplId} style={S(CARD + ';display:flex;flex-direction:column;gap:12px;border-color:' + (bad ? (r.state === 'missing' ? '#F3D9AE' : '#F4C7C2') : '#E6E8EC'))}>
          <div style={S('display:flex;align-items:flex-start;gap:14px')}>
            <span style={S('flex:0 0 44px;width:44px;height:44px;border-radius:14px;background:#EEEAFE;display:flex;align-items:center;justify-content:center')}>{FORM_ICON('#3A2BB5')}</span>
            <div style={S('flex:1 1 auto;min-width:0')}>
              <h3 style={S('margin:0;font-size:16px;font-weight:600;letter-spacing:-0.01em;overflow-wrap:anywhere')}>{r.name}</h3>
              <p style={S('margin:2px 0 0;font-size:13px;color:' + (r.needed ? '#5E6673' : '#8A93A0'))}>{r.needed ? 'Needed for this appointment' : 'Optional'}</p>
              <span style={S('display:inline-block;margin-top:8px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:' + st.bg + ';color:' + st.fg)}>{st.t}</span>
            </div>
          </div>
          <p style={S('margin:0;color:#4A525E;font-size:14px;overflow-wrap:anywhere')}>{wasSent && r.canSend ? 'Link sent to ' + k.email : r.line}</p>
          {(r.canSend && !!k.email && !wasSent) || r.canFill || r.canRecord || r.answers.length > 0 ? (
            <div style={S('display:flex;flex-direction:column;gap:8px')}>
              {r.canSend && !!k.email && !wasSent && <button type="button" onClick={c.send} disabled={c.busy} style={S(BLACK)}>Send link</button>}
              {r.canFill && <Link href={`/clients/forms/fill/${k.bookingId}?t=${r.tplId}`} style={S(OUTLINE)}>Fill in at the salon</Link>}
              {r.canRecord && <button type="button" onClick={() => { c.setRec({ tplId: r.tplId, date: c.today, reaction: false, note: '' }); c.setError(''); }} style={S(OUTLINE)}>{r.state === 'valid' || r.state === 'reaction' ? 'Record again' : 'Record result'}</button>}
              {r.answers.length > 0 && <button type="button" onClick={() => c.setAns({ name: r.name, sub: k.name + ' · ' + k.when, flagged: r.state === 'reaction', answers: r.answers, clientId: k.clientId })} style={S(OUTLINE)}>View answers</button>}
            </div>
          ) : null}
        </section>
      );
    })}
  </>);
}

const PAGE = "position:absolute;left:0;right:0;top:0;bottom:0;z-index:5;display:flex;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4";

/** The full pages that sit on top of the list: a form's answers, and recording a patch test. */
export function FormsOverlay({ c }: { c: FormsCtl }) {
  const k = c.cur;
  const rec = c.rec;
  const recTpl = rec && k ? k.rows.find((r) => r.tplId === rec.tplId) : null;
  if (c.ans) {
    const a = c.ans;
    // Unanswered questions and the signature are left out, as on the profile.
    const answers = a.answers.filter((x) => !/^signed$/i.test(x.k) && x.v !== 'No answer');
    return (
      <div role="dialog" aria-label={a.name} style={S(PAGE)}>
        <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px;border-bottom:1px solid #E6E8EC')}>
          <button onClick={() => c.setAns(null)} aria-label="Back" style={S(RING)}>{BACK}</button>
          <div style={S('flex:1 1 auto;min-width:0;font-size:18px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{a.name}</div>
        </header>
        <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 24px;display:flex;flex-direction:column;gap:12px')}>
          <div>
            <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;overflow-wrap:anywhere')}>{a.name}</h2>
            <p style={S('margin:6px 0 0;font-size:14px;color:#5E6673;overflow-wrap:anywhere')}>{a.sub}</p>
          </div>
          {a.flagged && <div style={S('padding:12px 14px;border-radius:16px;background:#FDECEA;color:#B42318;font-size:13.5px;font-weight:600')}>A reaction was noted on this form.</div>}
          {answers.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>No answers were given.</p>}
          {answers.map((x, i) => (
            <div key={i} style={S('box-sizing:border-box;padding:12px 16px 14px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}>
              <div style={S('font-size:12.5px;color:#5E6673;overflow-wrap:anywhere')}>{x.k}</div>
              <div style={S('margin-top:3px;font-size:16px;font-weight:600;overflow-wrap:anywhere')}>{x.v}</div>
            </div>
          ))}
          <Link href={`/clients/${a.clientId}`} style={S(OUTLINE)}>Open profile</Link>
        </main>
      </div>
    );
  }
  if (rec && recTpl) {
    return (
      <div role="dialog" aria-label="Record patch test" style={S(PAGE)}>
        <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px;border-bottom:1px solid #E6E8EC')}>
          <button onClick={() => { c.setRec(null); c.setError(''); }} aria-label="Back" style={S(RING)}>{BACK}</button>
          <div style={S('flex:1 1 auto;min-width:0;font-size:18px;font-weight:600;letter-spacing:-0.02em')}>Record result</div>
        </header>
        <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 24px;display:flex;flex-direction:column;gap:14px')}>
          <div>
            <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em')}>{recTpl.name}</h2>
            <p style={S('margin:6px 0 0;font-size:14px;color:#5E6673')}>Fill this in after the 48 hour check.</p>
          </div>
          <Field label="Date applied" htmlFor="rc-date"><input id="rc-date" type="date" max={c.today} value={rec.date} onChange={(e) => { c.setRec({ ...rec, date: e.target.value }); c.setError(''); }} style={FIELD_IN} /></Field>
          <Tiles label="Result after 48 hours" options={[['ok', 'No reaction'], ['bad', 'Reaction']] as const} value={rec.reaction ? 'bad' : 'ok'} onPick={(v) => c.setRec({ ...rec, reaction: v === 'bad' })} />
          {rec.date && /^\d{4}-\d{2}-\d{2}$/.test(rec.date) && <p style={S('margin:0;color:#5E6673;font-size:13.5px')}>{rec.reaction ? 'A reaction puts a warning on the appointment.' : 'Valid until ' + niceDate(addMonthsYmd(rec.date, 6)) + ' if there is no reaction.'}</p>}
          <Field label="Notes (optional)" htmlFor="rc-note"><input id="rc-note" type="text" maxLength={300} value={rec.note} onChange={(e) => c.setRec({ ...rec, note: e.target.value })} placeholder="For example, mild redness behind the ear" style={FIELD_IN} /></Field>
        </main>
        <div style={S('flex:0 0 auto;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:12px')}>
          {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
          <button type="button" onClick={c.saveRec} disabled={c.busy} style={S(BLACK)}>Save result</button>
        </div>
      </div>
    );
  }
  return null;
}
