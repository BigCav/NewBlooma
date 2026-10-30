'use client';
import Link from 'next/link';
import { addMonthsYmd, niceDate } from '@/lib/forms-shared';
import { S } from '../../calendar/pickers';
import { DetailRows, ICONS, Tiles } from '../../calendar/wizardUi';
import type { ClientCard, FormsCtl } from './ClientFormsView';

const RING = 'flex:0 0 44px;width:44px;height:44px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;padding:0';
const BACK = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6l-6 6 6 6" /></svg>;
const CHEV = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6673" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={S('flex:0 0 auto')} aria-hidden="true"><path d="M9.5 6l6 6-6 6" /></svg>;
const FORM_ICON = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3A2BB5" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 9h6M9 13h6M9 17h3" /></svg>;
const BLACK = 'height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none;box-sizing:border-box;width:100%';
const OUTLINE = 'height:52px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none;box-sizing:border-box;width:100%';
const FIELD_IN = { ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), minHeight: 0, borderRadius: 0 } as const;
const LEVEL = { ok: { t: 'All set', bg: '#DDF3EA', fg: '#14624A' }, todo: { t: '', bg: '#FFF4E5', fg: '#8A4B00' }, alert: { t: 'Reaction', bg: '#FDECEA', fg: '#B42318' } } as const;
const PAGE = "position:absolute;left:0;right:0;top:0;bottom:0;z-index:5;display:flex;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4";
const BAR = 'flex:0 0 auto;padding:14px 20px 28px;background:#FFFFFF;border-top:1px solid #EEF0F3;display:flex;flex-direction:column;gap:10px';
const AVATAR = (px: number, fs: number) => 'flex:0 0 ' + px + 'px;width:' + px + 'px;height:' + px + 'px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:' + fs + 'px;font-weight:600';

function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} style={S('display:block;box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{label}</span>{children}</label>;
}

function Header({ title, onBack, avatar }: { title: string; onBack: () => void; avatar?: string }) {
  return (
    <header style={S('flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:20px 20px 12px;border-bottom:1px solid #E6E8EC')}>
      <button onClick={onBack} aria-label="Back" style={S(RING)}>{BACK}</button>
      {avatar && <div style={S(AVATAR(36, 13))}>{avatar}</div>}
      <div style={S('flex:1 1 auto;min-width:0;font-size:18px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{title}</div>
    </header>
  );
}

function levelChip(k: ClientCard) {
  const l = LEVEL[k.level];
  return { t: k.level === 'todo' ? k.todoCount + ' needed' : l.t, bg: l.bg, fg: l.fg };
}

/** A form as the profile shows it: purple tile, name, a line of detail, an optional status chip, a chevron. */
function FormCard({ name, line, tag, flagged, onOpen }: { name: string; line: React.ReactNode; tag?: { t: string; bg: string; fg: string }; flagged?: boolean; onOpen: () => void }) {
  return (
    <button onClick={onOpen} style={S('display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;padding:16px;border:1px solid ' + (flagged ? '#F4C7C2' : '#E6E8EC') + ';border-radius:22px;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
      <span style={S('flex:0 0 44px;width:44px;height:44px;border-radius:14px;background:#EEEAFE;display:flex;align-items:center;justify-content:center')}>{FORM_ICON}</span>
      <span style={S('flex:1 1 auto;min-width:0')}>
        <span style={S('display:block;font-size:16px;font-weight:600;letter-spacing:-0.01em;overflow-wrap:anywhere')}>{name}</span>
        <span style={S('display:block;margin-top:2px;font-size:13px;color:#5E6673;overflow-wrap:anywhere')}>{line}</span>
        {(tag || flagged) && <span style={S('display:flex;flex-wrap:wrap;gap:6px;margin-top:8px')}>
          {tag && <span style={S('padding:3px 10px;border-radius:999px;background:' + tag.bg + ';color:' + tag.fg + ';font-size:12px;font-weight:600')}>{tag.t}</span>}
          {flagged && <span style={S('padding:3px 10px;border-radius:999px;background:#FDECEA;color:#B42318;font-size:12px;font-weight:600')}>Reaction noted</span>}
        </span>}
      </span>
      {CHEV}
    </button>
  );
}

/** The phone's Client forms list for the tab you are on. */
export function FormsMain({ c }: { c: FormsCtl }) {
  const tabs = (
    <div role="tablist" aria-label="Client forms view" style={S('display:flex;gap:4px;padding:4px;border-radius:999px;background:#E9ECF0;flex:0 0 auto')}>
      {([['upcoming', 'Upcoming visits'], ['done', 'Completed']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={c.tab === id} onClick={() => c.setTab(id)} style={S('flex:1 1 0;height:44px;border:0;border-radius:999px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;background:' + (c.tab === id ? '#0E1116' : 'transparent') + ';color:' + (c.tab === id ? '#FFFFFF' : '#0E1116'))}>{label}</button>)}
    </div>
  );
  return (
    <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:14px')}>
      {tabs}
      {c.tab === 'done' ? <Done c={c} /> : <Upcoming c={c} />}
    </main>
  );
}

function Done({ c }: { c: FormsCtl }) {
  const q = c.query.trim().toLowerCase();
  const list = c.done.filter((r) => !q || (r.client + ' ' + r.form).toLowerCase().includes(q));
  return (<>
    {list.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14.5px')}>{q ? `Nothing matches "${c.query.trim()}".` : 'No forms have been completed yet. When a client or a team member fills one in, it appears here.'}</p>}
    {list.map((r) => (
      <button key={r.id} onClick={() => c.setAns({ name: r.form, sub: r.client + ' · ' + r.date, flagged: r.flagged, answers: r.answers, clientId: r.clientId })} style={S('display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;padding:16px;border:1px solid ' + (r.flagged ? '#F4C7C2' : '#E6E8EC') + ';border-radius:22px;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
        <span style={S('flex:0 0 44px;width:44px;height:44px;border-radius:14px;background:#EEEAFE;display:flex;align-items:center;justify-content:center')}>{FORM_ICON}</span>
        <span style={S('flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px')}>
          <span style={S('font-size:16px;font-weight:600;letter-spacing:-0.01em;overflow-wrap:anywhere')}>{r.client}</span>
          <span style={S('font-size:14px;color:#4A525E;overflow-wrap:anywhere')}>{r.form}</span>
          <span style={S('font-size:12.5px;color:#8A93A0;overflow-wrap:anywhere')}>{r.date}{r.ref ? ' · ' + r.ref.replace('Booking ', '') : ''}</span>
          {r.flagged && <span style={S('align-self:flex-start;margin-top:6px;padding:3px 10px;border-radius:999px;background:#FDECEA;color:#B42318;font-size:12px;font-weight:600')}>Reaction noted</span>}
        </span>
        {CHEV}
      </button>
    ))}
  </>);
}

function Upcoming({ c }: { c: FormsCtl }) {
  const q = c.query.trim().toLowerCase();
  const list = c.cards.filter((k) => !q || (k.name + ' ' + k.svc).toLowerCase().includes(q));
  if (!c.cards.length) return (
    <section style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px;display:flex;flex-direction:column;gap:10px')}>
      <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{c.hasForms ? 'No upcoming appointments' : 'No forms set up yet'}</h2>
      <p style={S('margin:0;color:#5E6673;font-size:14.5px')}>{c.hasForms ? 'Clients with an appointment coming up appear here with the forms they still need.' : c.owner ? 'Set up the forms clients fill in before a visit, then they show here for each appointment.' : 'Ask the owner to set up forms in Settings.'}</p>
      {!c.hasForms && c.owner && <Link href="/settings/forms" style={S(BLACK)}>Set up forms</Link>}
    </section>
  );
  if (!list.length) return <p style={S('margin:0;color:#5E6673;font-size:14.5px')}>{`Nothing matches "${c.query.trim()}".`}</p>;
  const groups: { day: string; items: ClientCard[] }[] = [];
  list.forEach((k) => { const day = k.when.split(', ').slice(0, -1).join(', '); const g = groups[groups.length - 1]; if (g && g.day === day) g.items.push(k); else groups.push({ day, items: [k] }); });
  return (<>
    {groups.map((g) => (
      <div key={g.day} style={S('display:flex;flex-direction:column;gap:10px')}>
        <h3 style={S('margin:6px 0 0;font-size:15px;font-weight:600;color:#5E6673')}>{g.day}</h3>
        {g.items.map((k) => {
          const t = levelChip(k);
          return (
            <button key={k.id} onClick={() => c.openBooking(k.id)} aria-label={`${k.name}, ${k.time}, ${k.svc}, ${t.t}`} style={S('display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;padding:16px;border-radius:22px;background:#FFFFFF;text-align:left;font:inherit;color:#0E1116;cursor:pointer;border:1px solid ' + (k.level === 'ok' ? '#E6E8EC' : k.level === 'todo' ? '#F3D9AE' : '#F4C7C2'))}>
              <span style={S(AVATAR(48, 15))}>{k.init}</span>
              <span style={S('flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px')}>
                <span style={S('font-size:16px;font-weight:600;letter-spacing:-0.01em;overflow-wrap:anywhere')}>{k.name}</span>
                <span style={S('font-size:14px;color:#4A525E;overflow-wrap:anywhere')}>{k.svc}{k.who ? ' with ' + k.who : ''}</span>
                <span style={S('font-size:12.5px;color:#8A93A0')}>{k.time} · {k.ref}</span>
                <span style={S('align-self:flex-start;margin-top:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:' + t.bg + ';color:' + t.fg)}>{t.t}</span>
              </span>
              {CHEV}
            </button>
          );
        })}
      </div>
    ))}
  </>);
}

/** The full pages that sit on top of the list: a booking and its forms, one form, a form's answers, and recording a patch test. */
export function FormsOverlay({ c }: { c: FormsCtl }) {
  const k = c.cur;
  const rec = c.rec;
  const recTpl = rec && k ? k.rows.find((r) => r.tplId === rec.tplId) : null;
  const row = k && c.fm ? k.rows.find((r) => r.tplId === c.fm) ?? null : null;
  const wasSent = !!(k && c.sent[k.bookingId]);

  const err = c.error && !rec ? <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p> : null;

  return (<>
    {c.bk && k && (
      <div role="dialog" aria-label="Booking" style={S(PAGE)}>
        <Header title={k.name} avatar={k.init} onBack={() => c.setBk(false)} />
        <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 24px;display:flex;flex-direction:column;gap:16px')}>
          <div>
            <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;overflow-wrap:anywhere')}>{k.svc}</h2>
            <p style={S('margin:6px 0 0;font-size:14px;color:#5E6673')}>{k.when}</p>
          </div>
          <DetailRows go={() => {}} rows={[
            { icon: ICONS.day, text: k.when },
            ...(k.who ? [{ icon: ICONS.person, text: k.who }] : []),
            { icon: ICONS.tag, text: 'Booking ' + k.ref },
          ]} />
          <section role="status" style={S('box-sizing:border-box;border-radius:20px;padding:16px 18px;background:' + LEVEL[k.level].bg + ';color:' + LEVEL[k.level].fg)}>
            <div style={S('font-size:15px;font-weight:600')}>{k.banner.title}</div>
            <div style={S('margin-top:2px;font-size:13.5px;opacity:0.92')}>{k.banner.text}</div>
          </section>
          {!!c.notice && <p role="status" style={S('margin:0;color:#14624A;font-size:14px;font-weight:600')}>{c.notice}</p>}
          {err}
          <h3 style={S('margin:6px 0 -4px;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Forms</h3>
          {k.rows.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14px')}>No forms are set up for this booking.</p>}
          {k.rows.map((r) => {
            const st = c.stat[r.state];
            return <FormCard key={r.tplId} name={r.name} line={r.needed ? 'Needed for this appointment' : 'Optional'} tag={{ t: st.t, bg: st.bg, fg: st.fg }} onOpen={() => { c.setError(''); c.setFm(r.tplId); }} />;
          })}
        </main>
        <div style={S(BAR)}>
          {k.sendable > 0 && !!k.email && !wasSent && <button type="button" onClick={c.send} disabled={c.busy} style={S(BLACK)}>{k.sendable > 1 ? `Send ${k.sendable} forms by email` : 'Send link'}</button>}
          <div style={S('display:flex;gap:10px')}>
            <Link href={`/clients/${k.clientId}`} style={S(OUTLINE)}>Profile</Link>
            <Link href={`/calendar?d=${k.dayYmd}&b=${k.bookingId}`} style={S(BLACK)}>View booking</Link>
          </div>
        </div>
      </div>
    )}

    {c.bk && k && row && (() => {
      const st = c.stat[row.state];
      const answers = row.answers.filter((x) => !/^signed$/i.test(x.k) && x.v !== 'No answer');
      const canSend = row.canSend && !!k.email && !wasSent;
      return (
        <div role="dialog" aria-label={row.name} style={S(PAGE)}>
          <Header title={row.name} onBack={() => c.setFm('')} />
          <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:16px 20px 24px;display:flex;flex-direction:column;gap:12px')}>
            <div>
              <h2 style={S('margin:0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;overflow-wrap:anywhere')}>{row.name}</h2>
              <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px')}>
                <span style={S('padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:' + st.bg + ';color:' + st.fg)}>{st.t}</span>
                <span style={S('font-size:13px;color:#5E6673')}>{k.name} · {k.when}</span>
              </div>
            </div>
            <p style={S('margin:0;color:#4A525E;font-size:14px;overflow-wrap:anywhere')}>{wasSent && row.canSend ? 'Link sent to ' + k.email : row.line}</p>
            {!!c.notice && <p role="status" style={S('margin:0;color:#14624A;font-size:14px;font-weight:600')}>{c.notice}</p>}
            {err}
            {row.state === 'reaction' && <div style={S('padding:12px 14px;border-radius:16px;background:#FDECEA;color:#B42318;font-size:13.5px;font-weight:600')}>A reaction was noted on this form.</div>}
            {answers.map((x, i) => (
              <div key={i} style={S('box-sizing:border-box;padding:12px 16px 14px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}>
                <div style={S('font-size:12.5px;color:#5E6673;overflow-wrap:anywhere')}>{x.k}</div>
                <div style={S('margin-top:3px;font-size:16px;font-weight:600;overflow-wrap:anywhere')}>{x.v}</div>
              </div>
            ))}
          </main>
          {(canSend || row.canFill || row.canRecord) && (
            <div style={S(BAR)}>
              {canSend && <button type="button" onClick={c.send} disabled={c.busy} style={S(BLACK)}>Send link</button>}
              {row.canFill && <Link href={`/clients/forms/fill/${k.bookingId}?t=${row.tplId}`} style={S(canSend ? OUTLINE : BLACK)}>Fill in at the salon</Link>}
              {row.canRecord && <button type="button" onClick={() => { c.setRec({ tplId: row.tplId, date: c.today, reaction: false, note: '' }); c.setError(''); }} style={S(canSend || row.canFill ? OUTLINE : BLACK)}>{row.state === 'valid' || row.state === 'reaction' ? 'Record again' : 'Record result'}</button>}
            </div>
          )}
        </div>
      );
    })()}

    {c.ans && (() => {
      const a = c.ans;
      // Unanswered questions and the signature are left out, as on the profile.
      const answers = a.answers.filter((x) => !/^signed$/i.test(x.k) && x.v !== 'No answer');
      return (
        <div role="dialog" aria-label={a.name} style={S(PAGE)}>
          <Header title={a.name} onBack={() => c.setAns(null)} />
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
    })()}

    {rec && recTpl && (
      <div role="dialog" aria-label="Record patch test" style={S(PAGE)}>
        <Header title="Record result" onBack={() => { c.setRec(null); c.setError(''); }} />
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
        <div style={S(BAR)}>
          {!!c.error && <p role="alert" style={S('margin:0;color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</p>}
          <button type="button" onClick={c.saveRec} disabled={c.busy} style={S(BLACK)}>Save result</button>
        </div>
      </div>
    )}
  </>);
}
