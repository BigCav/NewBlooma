'use client';
// Client forms: who has an appointment coming up, which forms it needs, what is done, and what to send or record.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { S } from '../../calendar/pickers';
import { FormsMain, FormsOverlay } from './FormsMobile';
import { addMonthsYmd, niceDate, type FormState, type How } from '@/lib/forms-shared';
import { recordPatchTest, sendFormLinks } from './actions';

export type RowVM = { tplId: string; name: string; how: How; isPatch: boolean; needed: boolean; state: FormState; line: string; canSend: boolean; canFill: boolean; canRecord: boolean; answers: { k: string; v: string }[] };
export type ClientCard = { id: string; clientId: string; ref: string; time: string; name: string; init: string; email: string; bookingId: string; when: string; svc: string; who: string; level: 'ok' | 'todo' | 'alert'; todoCount: number; banner: { title: string; text: string }; rows: RowVM[]; sendable: number };
export type DoneRow = { id: string; clientId: string; client: string; form: string; date: string; ref: string; by: string; flagged: boolean; answers: { k: string; v: string }[] };
type Props = { cards: ClientCard[]; done: DoneRow[]; initial: string; hasForms: boolean; owner: boolean; today: string };

const STAT: Record<FormState, { t: string; bg: string; fg: string }> = {
  valid: { t: 'Valid', bg: '#DDF3EA', fg: '#14624A' }, expired: { t: 'Expired', bg: '#FDECEA', fg: '#B42318' }, missing: { t: 'Not completed', bg: '#FFF4E5', fg: '#8A4B00' },
  na: { t: 'Not needed yet', bg: '#EEF0F3', fg: '#4A525E' }, reaction: { t: 'Reaction', bg: '#FDECEA', fg: '#B42318' },
};
const LVL = { ok: { dot: '#14A27A', bg: '#DDF3EA', fg: '#14624A' }, todo: { dot: '#E0932B', bg: '#FFF4E5', fg: '#8A4B00' }, alert: { dot: '#D92D20', bg: '#FDECEA', fg: '#B42318' } };
const chip = (on: boolean) => 'flex:0 0 auto;height:44px;padding:0 18px;border-radius:999px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
const BTN = 'height:44px;padding:0 20px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:14px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;text-decoration:none;box-sizing:border-box';
const GHOST = 'height:44px;padding:0 20px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:14px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;text-decoration:none;box-sizing:border-box';
const noMin = { minHeight: 0 } as const;
const INPUT = 'box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15px;color:#0E1116;background:#FFFFFF';

function useClientForms(props: Props) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => { const mq = window.matchMedia('(max-width:900px)'); const f = () => setNarrow(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  const [tab, setTab] = useState<'upcoming' | 'done'>('upcoming');
  const [sel, setSel] = useState(props.initial);
  const [open, setOpen] = useState('');
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [rec, setRec] = useState<{ tplId: string; date: string; reaction: boolean; note: string } | null>(null);
  const [ans, setAns] = useState<{ name: string; sub: string; flagged: boolean; answers: { k: string; v: string }[]; clientId: string } | null>(null);
  const cur = props.cards.find((x) => x.id === sel) ?? props.cards[0] ?? null;
  const pick = (id: string) => { setSel(id); setOpen(''); setRec(null); setError(''); setNotice(''); };
  const send = () => { if (!cur) return; const k = cur.bookingId; startT(async () => { const r = await sendFormLinks(k); if (r.error) { setError(r.error); setNotice(''); return; } setError(''); setNotice(r.notice ?? 'Link sent'); setSent((s) => ({ ...s, [k]: true })); }); };
  const saveRec = () => {
    if (!cur || !rec) return;
    startT(async () => { const r = await recordPatchTest(cur.clientId, rec.tplId, rec.date, rec.reaction, rec.note); if (r.error) { setError(r.error); return; } setError(''); setRec(null); setNotice(r.notice ?? 'Saved'); router.refresh(); });
  };
  return { ...props, tab, setTab, busy, narrow, cur, sel, pick, open, setOpen, sent, notice, error, setError, rec, setRec, send, saveRec, ans, setAns, stat: STAT };
}
type C = ReturnType<typeof useClientForms>;
export type FormsCtl = C;

function Body({ c, m }: { c: C; m: boolean }) {
  const k = c.cur;
  if (!k) return (
    <section style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:10px')}>
      <h2 style={S('margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{c.hasForms ? 'No upcoming appointments' : 'No forms set up yet'}</h2>
      <p style={S('margin:0;color:#5E6673;font-size:14.5px')}>{c.hasForms ? 'Clients with an appointment coming up appear here with the forms they still need.' : c.owner ? 'Set up the forms clients fill in before a visit, then they show here for each appointment.' : 'Ask the owner to set up forms in Settings.'}</p>
      {!c.hasForms && c.owner && <div><Link href="/settings/forms" style={S(BTN)}>Set up forms</Link></div>}
    </section>
  );
  const lv = LVL[k.level];
  const wasSent = !!c.sent[k.bookingId];
  const rec = c.rec;
  const recTpl = rec ? k.rows.find((r) => r.tplId === rec.tplId) : null;
  return (
    <div style={S('display:flex;flex-direction:column;gap:16px;min-width:0')}>
      <section style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:' + (m ? 20 : 24) + 'px;display:flex;flex-wrap:wrap;align-items:center;gap:14px 20px')}>
        <div style={S('flex:1 1 220px;min-width:0;display:flex;align-items:center;gap:14px')}>
          <span aria-hidden="true" style={S('flex:0 0 48px;width:48px;height:48px;border-radius:999px;background:#EEF0F3;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600')}>{k.init}</span>
          <div style={S('min-width:0')}><h2 style={S('margin:0;font-size:19px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{k.name}</h2><p style={S('margin:2px 0 0;color:#5E6673;font-size:13.5px;overflow-wrap:anywhere')}>{k.email || 'No email on file'}</p></div>
        </div>
        <div style={S('flex:1 1 220px;min-width:0')}><span style={S('color:#5E6673;font-size:13px')}>Appointment {k.ref}</span><div style={S('font-size:14.5px;font-weight:600;overflow-wrap:anywhere')}>{k.when} · {k.svc}{k.who ? ' with ' + k.who : ''}</div></div>
        <Link href={`/clients/${k.clientId}`} className="ghost" style={S(GHOST)}>Open profile</Link>
      </section>

      <section role="status" style={S('box-sizing:border-box;border-radius:20px;background:' + lv.bg + ';color:' + lv.fg + ';padding:16px 20px;display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px')}>
        <div style={S('flex:1 1 220px;min-width:0')}><div style={S('font-size:15px;font-weight:600')}>{k.banner.title}</div><div style={S('margin-top:2px;font-size:13.5px;opacity:0.92')}>{k.banner.text}</div></div>
        {k.sendable > 0 && k.email && !wasSent && <button type="button" onClick={c.send} disabled={c.busy} style={S(BTN)}>{k.sendable > 1 ? `Send ${k.sendable} forms by email` : 'Send link'}</button>}
      </section>
      {!!c.notice && <p role="status" style={S('margin:0;color:#14624A;font-size:14px;font-weight:600')}>{c.notice}</p>}
      {!!c.error && !rec && <p role="alert" style={S('margin:0;color:#B42318;font-size:14px;font-weight:600')}>{c.error}</p>}

      {k.rows.map((r) => {
        const st = STAT[r.state]; const isOpen = c.open === k.id + r.tplId;
        const bad = r.needed && (r.state === 'missing' || r.state === 'expired' || r.state === 'reaction');
        return (
          <section key={r.tplId} style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid ' + (bad ? (r.state === 'missing' ? '#F3D9AE' : '#F4C7C2') : '#E6E8EC') + ';border-radius:24px;padding:' + (m ? 18 : 22) + 'px;display:flex;flex-direction:column;gap:12px')}>
            <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:8px 12px')}>
              <div style={S('min-width:0')}><h3 style={S('margin:0;font-size:16px;font-weight:600;overflow-wrap:anywhere')}>{r.name}</h3><p style={S('margin:2px 0 0;font-size:13px;color:' + (r.needed ? '#0E1116' : '#8A93A0'))}>{r.needed ? 'Needed for this appointment' : 'Optional'}</p></div>
              <span style={S('flex:0 0 auto;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:' + st.bg + ';color:' + st.fg)}>{st.t}</span>
            </div>
            <p style={S('margin:0;color:#4A525E;font-size:14px;overflow-wrap:anywhere')}>{wasSent && r.canSend ? 'Link sent to ' + k.email : r.line}</p>
            <div style={S('display:flex;flex-wrap:wrap;gap:8px')}>
              {r.canSend && k.email && !wasSent && <button type="button" onClick={c.send} disabled={c.busy} style={S(BTN)}>Send link</button>}
              {r.canFill && <Link href={`/clients/forms/fill/${k.bookingId}?t=${r.tplId}`} className="ghost" style={S(GHOST)}>Fill in at the salon</Link>}
              {r.canRecord && <button type="button" onClick={() => { c.setRec({ tplId: r.tplId, date: c.today, reaction: false, note: '' }); c.setError(''); }} className="ghost" style={S(GHOST)}>{r.state === 'valid' || r.state === 'reaction' ? 'Record again' : 'Record result'}</button>}
              {r.answers.length > 0 && <button type="button" onClick={() => c.setOpen(isOpen ? '' : k.id + r.tplId)} aria-expanded={isOpen} className="ghost" style={S(GHOST)}>{isOpen ? 'Hide answers' : 'View answers'}</button>}
            </div>
            {isOpen && (
              <dl style={S('margin:0;display:flex;flex-direction:column;border-top:1px solid #EEF0F3')}>
                {r.answers.map((a, i) => <div key={i} style={S('display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 16px;padding:10px 0;border-bottom:1px solid #EEF0F3;font-size:14px')}><dt style={S('color:#5E6673')}>{a.k}</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{a.v}</dd></div>)}
              </dl>
            )}
          </section>
        );
      })}

      {rec && recTpl && (
        <section aria-label="Record patch test" style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #0E1116;border-radius:24px;padding:' + (m ? 18 : 24) + 'px;display:flex;flex-direction:column;gap:16px')}>
          <div><h3 style={S('margin:0;font-size:17px;font-weight:600')}>Record {recTpl.name.toLowerCase()}</h3><p style={S('margin:2px 0 0;color:#5E6673;font-size:14px')}>Fill this in after the 48 hour check.</p></div>
          <div style={S('display:flex;flex-direction:column;gap:8px')}>
            <label htmlFor="rc-date" style={S('font-size:14px;font-weight:600')}>Date applied</label>
            <input id="rc-date" className="field" type="date" max={c.today} value={rec.date} onChange={(e) => { c.setRec({ ...rec, date: e.target.value }); c.setError(''); }} style={{ ...S(INPUT), ...noMin }} />
          </div>
          <div style={S('display:flex;flex-direction:column;gap:8px')}>
            <span id="rc-res" style={S('font-size:14px;font-weight:600')}>Result after 48 hours</span>
            <div role="group" aria-labelledby="rc-res" style={S('display:flex;gap:8px')}>
              <button type="button" aria-pressed={!rec.reaction} onClick={() => c.setRec({ ...rec, reaction: false })} style={S(chip(!rec.reaction))}>No reaction</button>
              <button type="button" aria-pressed={rec.reaction} onClick={() => c.setRec({ ...rec, reaction: true })} style={S(chip(rec.reaction) + (rec.reaction ? ';background:#B42318;border-color:#B42318' : ''))}>Reaction</button>
            </div>
            {rec.date && /^\d{4}-\d{2}-\d{2}$/.test(rec.date) && <p style={S('margin:0;color:#5E6673;font-size:13.5px')}>{rec.reaction ? 'A reaction puts a warning on the appointment.' : 'Valid until ' + niceDate(addMonthsYmd(rec.date, 6)) + ' if there is no reaction.'}</p>}
          </div>
          <div style={S('display:flex;flex-direction:column;gap:8px')}>
            <label htmlFor="rc-note" style={S('font-size:14px;font-weight:600')}>Notes (optional)</label>
            <input id="rc-note" className="field" type="text" maxLength={300} value={rec.note} onChange={(e) => c.setRec({ ...rec, note: e.target.value })} placeholder="For example, mild redness behind the ear" style={{ ...S(INPUT), ...noMin }} />
          </div>
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px')}>
            <button type="button" onClick={c.saveRec} disabled={c.busy} style={S(BTN)}>Save result</button>
            <button type="button" onClick={() => { c.setRec(null); c.setError(''); }} className="ghost" style={S(GHOST)}>Cancel</button>
            {!!c.error && <span role="alert" style={S('color:#B42318;font-size:13.5px;font-weight:500')}>{c.error}</span>}
          </div>
        </section>
      )}
    </div>
  );
}

function Tabs({ c }: { c: C }) {
  return (
    <div role="tablist" aria-label="Client forms view" style={S('display:flex;gap:4px;padding:4px;border-radius:999px;background:#E9ECF0;flex:0 0 auto;max-width:420px')}>
      {([['upcoming', 'Upcoming visits'], ['done', 'Completed']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={c.tab === id} onClick={() => c.setTab(id)} style={S('flex:1 1 0;height:44px;border:0;border-radius:999px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;background:' + (c.tab === id ? '#0E1116' : 'transparent') + ';color:' + (c.tab === id ? '#FFFFFF' : '#0E1116'))}>{label}</button>)}
    </div>
  );
}

function Completed({ c, m }: { c: C; m: boolean }) {
  const [open, setOpen] = useState('');
  return (
    <section aria-label="Completed forms" style={S('display:flex;flex-direction:column;gap:12px;min-width:0')}>
      {c.done.length === 0 && <p style={S('margin:0;color:#5E6673;font-size:14.5px')}>No forms have been completed yet. When a client or a team member fills one in, it appears here.</p>}
      {c.done.map((r) => (
        <article key={r.id} style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid ' + (r.flagged ? '#F4C7C2' : '#E6E8EC') + ';border-radius:24px;padding:' + (m ? 18 : 22) + 'px;display:flex;flex-direction:column;gap:10px')}>
          <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:8px 12px')}>
            <div style={S('min-width:0')}><h3 style={S('margin:0;font-size:16px;font-weight:600;overflow-wrap:anywhere')}>{r.form}</h3><p style={S('margin:2px 0 0;font-size:13.5px;color:#5E6673;overflow-wrap:anywhere')}><Link href={'/clients/' + r.clientId} style={S('color:#0E1116;font-weight:500')}>{r.client}</Link> · {r.date} · {r.by}{r.ref ? ' · ' + r.ref : ''}</p></div>
            {r.flagged && <span style={S('padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:500;background:#FDECEA;color:#B42318')}>Reaction</span>}
          </div>
          <div><button type="button" onClick={() => setOpen(open === r.id ? '' : r.id)} aria-expanded={open === r.id} className="ghost" style={S(GHOST)}>{open === r.id ? 'Hide answers' : 'View answers'}</button></div>
          {open === r.id && <dl style={S('margin:0;display:flex;flex-direction:column;border-top:1px solid #EEF0F3')}>{r.answers.map((a, i) => <div key={i} style={S('display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 16px;padding:10px 0;border-bottom:1px solid #EEF0F3;font-size:14px')}><dt style={S('color:#5E6673')}>{a.k}</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{a.v}</dd></div>)}</dl>}
        </article>
      ))}
    </section>
  );
}

function List({ c, m }: { c: C; m: boolean }) {
  if (!c.cards.length) return null;
  return (
    <nav aria-label="Clients with appointments" style={S(m ? '' : 'flex:0 0 300px;display:flex;flex-direction:column;gap:8px')}>
      {m
        ? <div className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto')}>{c.cards.map((x) => { const on = x.id === c.cur?.id; return <button key={x.id} type="button" onClick={() => c.pick(x.id)} aria-current={on} style={S(chip(on) + ';display:flex;align-items:center;gap:8px')}><span aria-hidden="true" style={S('width:8px;height:8px;border-radius:999px;background:' + LVL[x.level].dot)} />{x.name.split(' ')[0]} · {x.time}</button>; })}</div>
        : c.cards.map((x) => { const on = x.id === c.cur?.id; return (
          <button key={x.id} type="button" onClick={() => c.pick(x.id)} aria-current={on} style={S('width:100%;box-sizing:border-box;text-align:left;font:inherit;cursor:pointer;padding:12px 14px;border-radius:16px;display:flex;align-items:center;gap:12px;border:1px solid ' + (on ? '#0E1116' : '#E6E8EC') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116'))}>
            <span aria-hidden="true" style={S('flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:' + (on ? '#FFFFFF' : '#EEF0F3') + ';color:#0E1116;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600')}>{x.init}</span>
            <span style={S('min-width:0')}><span style={S('display:block;font-size:14.5px;font-weight:600;overflow-wrap:anywhere')}>{x.name}</span><span style={S('display:flex;align-items:center;gap:6px;font-size:12.5px;color:' + (on ? '#C9CDD5' : '#5E6673'))}><span aria-hidden="true" style={S('width:8px;height:8px;border-radius:999px;background:' + LVL[x.level].dot)} />{x.level === 'ok' ? 'All set' : x.level === 'alert' ? 'Reaction recorded' : x.todoCount + ' needed'} · {x.when}</span></span>
          </button>); })}
    </nav>
  );
}

export function ClientFormsView(props: Props) {
  const c = useClientForms(props);
  return (<>
    {c.narrow !== false && (
      <div className="only-m m-cal cal-root" style={S("position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
        <MobileHeader title="Client forms" subtitle="Forms for upcoming appointments" showSearch={false} />
        <FormsMain c={c} />
        <MobileTabs active="clients" />
        <FormsOverlay c={c} />
      </div>
    )}
    {c.narrow !== true && (
      <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 8px;display:flex;flex-direction:column;gap:24px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
        <PageHeader title="Client forms" subtitle="See which forms each client has done for their next appointment, send what is missing, and record patch tests." showSearch={false} showAction={false} />
        <Tabs c={c} />
        {c.tab === 'done' ? <div style={S('max-width:860px')}><Completed c={c} m={false} /></div> : <div style={S('display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px')}><List c={c} m={false} /><div style={S('flex:999 1 520px;min-width:0')}><Body c={c} m={false} /></div></div>}
      </div>
    )}
  </>);
}
