'use client';
// Marketing: the two automatic messages ("we miss you", birthdays), a message to a chosen group, and what has gone out lately.
// One layout on the phone and on a computer; only the page header around it differs.
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader, MobileTabs, PageHeader } from '@/components/Chrome';
import { BLACK, FieldError, INPUT, LabelledField, Note, Notice, OUTLINE, Stat, SwitchRow, TEXTAREA, dim } from '@/components/ui';
import { plural } from '@/lib/display';
import { AUDIENCES, SUBJECT_MAX, TEXT_MAX, type AudienceKind } from '@/lib/marketing-shared';
import { S } from '../calendar/pickers';
import { previewAudience, saveAutomation, sendBroadcast, sendTest, type AudiencePreview } from './actions';

export type MarketingProps = {
  settings: { winbackOn: boolean; winbackWeeks: number; winbackText: string; birthdayOn: boolean; birthdayText: string };
  counts: { total: number; agreed: number; birthdays: number; sent: number };
  services: { id: string; name: string }[];
  recent: { kind: string; name: string; when: string }[];
  channels: { email: boolean; sms: boolean };
};

const WEEKS: [number, string][] = [[4, '4 weeks'], [6, '6 weeks'], [8, '8 weeks'], [12, '12 weeks'], [16, '16 weeks'], [26, '6 months']];
const KIND_LABEL: Record<string, string> = { winback: 'We miss you', birthday: 'Birthday', broadcast: 'Group message' };
const CARD = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;padding:20px;display:flex;flex-direction:column;gap:14px';
const H2 = 'margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em';
const SELECT = INPUT + ';appearance:auto';
const SMALL = 'margin:0;font-size:13px;line-height:1.45;color:#5E6673';

function useMarketing(p: MarketingProps) {
  const router = useRouter();
  const [busy, startT] = useTransition();
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:900px)');
    const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const [auto, setAuto] = useState(p.settings);
  const [autoMsg, setAutoMsg] = useState<{ ok?: string; err?: string }>({});
  const [aud, setAud] = useState<{ kind: AudienceKind; n: number; service: string }>({ kind: 'all', n: 0, service: p.services[0]?.id ?? '' });
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [testMsg, setTestMsg] = useState<{ key: string; ok?: string; err?: string } | null>(null);

  const def = AUDIENCES.find((a) => a.id === aud.kind)!;
  // The group's size is looked up again whenever the choice changes; an older answer arriving late is ignored.
  const seq = useRef(0);
  useEffect(() => {
    const mine = ++seq.current;
    setPreview(null);
    const n = def.n ? (def.n.options.some(([v]) => v === aud.n) ? aud.n : def.n.options[0][0]) : 0;
    previewAudience({ kind: aud.kind, n, service: aud.kind === 'service' ? aud.service : null }).then((r) => { if (mine === seq.current) setPreview(r); }).catch(() => { if (mine === seq.current) setPreview({ total: 0, agreed: 0, reach: 0, names: [], error: 'Could not work out who this reaches.' }); });
  }, [aud.kind, aud.n, aud.service]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickKind = (kind: AudienceKind) => { setAud({ ...aud, kind, n: AUDIENCES.find((a) => a.id === kind)?.n?.options[0][0] ?? 0 }); setConfirm(false); setMsg({}); };
  const current = () => ({ kind: aud.kind, n: def.n ? (def.n.options.some(([v]) => v === aud.n) ? aud.n : def.n.options[0][0]) : 0, service: aud.kind === 'service' ? aud.service : null });

  const saveAuto = () => startT(async () => {
    const r = await saveAutomation(auto);
    setAutoMsg(r.error ? { err: r.error } : { ok: r.notice });
    if (!r.error) router.refresh();
  });
  const test = (key: 'broadcast' | 'winback' | 'birthday', subj: string, body: string) => startT(async () => {
    const r = await sendTest(key, subj, body);
    setTestMsg({ key, ...(r.error ? { err: r.error } : { ok: r.notice }) });
  });
  const send = () => startT(async () => {
    const r = await sendBroadcast(current(), subject, text);
    setConfirm(false);
    if (r.error) { setMsg({ err: r.error }); return; }
    setMsg({ ok: r.notice }); setSubject(''); setText('');
    router.refresh();
  });
  return { ...p, busy, narrow, auto, setAuto, autoMsg, setAutoMsg, aud, setAud, def, pickKind, subject, setSubject, text, setText, preview, confirm, setConfirm, msg, setMsg, testMsg, saveAuto, test, send };
}
type C = ReturnType<typeof useMarketing>;

function Test({ c, k, subj, body }: { c: C; k: 'broadcast' | 'winback' | 'birthday'; subj: string; body: string }) {
  const m = c.testMsg?.key === k ? c.testMsg : null;
  return (<>
    <button type="button" className="ghost" disabled={c.busy || !c.channels.email} onClick={() => c.test(k, subj, body)} style={S(OUTLINE + ';flex:0 0 auto;height:44px;padding:0 20px' + dim(c.busy || !c.channels.email))}>Send me a test</button>
    {m?.ok && <Notice>{m.ok}</Notice>}
    {m?.err && <FieldError>{m.err}</FieldError>}
  </>);
}

function Body({ c }: { c: C }) {
  const a = c.auto;
  const none = c.counts.agreed === 0;
  return (
    <div style={S('display:flex;flex-direction:column;gap:20px;max-width:760px;width:100%')}>
      <section aria-label="At a glance" style={S('display:flex;flex-wrap:wrap;gap:16px 48px')}>
        <Stat label="Agreed to messages" value={`${c.counts.agreed} of ${c.counts.total}`} small />
        <Stat label="Birthdays on file" value={String(c.counts.birthdays)} small />
        <Stat label="Sent in 30 days" value={String(c.counts.sent)} small />
      </section>
      <p style={S(SMALL)}>Only clients with Marketing messages switched on are ever contacted. Clients switch it on by ticking “Send me offers and news” when they book online, or you can switch it on from their profile. Every message has an unsubscribe link.{none ? ' Nobody has agreed yet, so nothing will be sent until they do.' : ''}</p>
      {!c.channels.email && <Note>Email is not set up yet, so messages cannot go out until the Resend key is added.</Note>}

      <section aria-label="Automatic messages" style={S(CARD)}>
        <div><h2 style={S(H2)}>Automatic messages</h2><p style={S(SMALL + ';margin-top:4px')}>They go out once a day. Use {'{first}'} for the client’s first name. Both are off until you switch them on.</p></div>
        <div>
          <SwitchRow id="mk-wb" title="We miss you" sub="Sent to a client who has not been back for a while and has nothing booked." on={a.winbackOn} toggle={() => { c.setAuto({ ...a, winbackOn: !a.winbackOn }); c.setAutoMsg({}); }} last={!a.winbackOn} />
          {a.winbackOn && (
            <div style={S('display:flex;flex-direction:column;gap:12px;padding:4px 0 14px')}>
              <LabelledField id="mk-wb-weeks" label="Message clients who have not visited for">
                <select id="mk-wb-weeks" value={a.winbackWeeks} onChange={(e) => { c.setAuto({ ...a, winbackWeeks: Number(e.target.value) }); c.setAutoMsg({}); }} style={S(SELECT)}>{WEEKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </LabelledField>
              <LabelledField id="mk-wb-text" label="Message"><textarea id="mk-wb-text" value={a.winbackText} maxLength={TEXT_MAX} onChange={(e) => { c.setAuto({ ...a, winbackText: e.target.value }); c.setAutoMsg({}); }} style={S(TEXTAREA + ';min-height:104px;resize:vertical')} /></LabelledField>
              <p style={S(SMALL)}>At most 25 a day, and nobody is messaged more than once every 4 months. A client who has already come back is never sent it.</p>
              <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px')}><Test c={c} k="winback" subj="We miss you" body={a.winbackText} /></div>
            </div>
          )}
        </div>
        <div>
          <SwitchRow id="mk-bd" title="Happy birthday" sub="Sent on a client’s birthday, once a year." on={a.birthdayOn} toggle={() => { c.setAuto({ ...a, birthdayOn: !a.birthdayOn }); c.setAutoMsg({}); }} last />
          {a.birthdayOn && (
            <div style={S('display:flex;flex-direction:column;gap:12px;padding:4px 0 4px')}>
              <LabelledField id="mk-bd-text" label="Message"><textarea id="mk-bd-text" value={a.birthdayText} maxLength={TEXT_MAX} onChange={(e) => { c.setAuto({ ...a, birthdayText: e.target.value }); c.setAutoMsg({}); }} style={S(TEXTAREA + ';min-height:104px;resize:vertical')} /></LabelledField>
              <p style={S(SMALL)}>Add a birthday on a client’s profile, or clients can give theirs when they book online.</p>
              <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px')}><Test c={c} k="birthday" subj="Happy birthday" body={a.birthdayText} /></div>
            </div>
          )}
        </div>
        {c.autoMsg.err && <FieldError>{c.autoMsg.err}</FieldError>}
        {c.autoMsg.ok && <Notice>{c.autoMsg.ok}</Notice>}
        <button type="button" onClick={c.saveAuto} disabled={c.busy} style={S(BLACK + ';flex:0 0 auto;align-self:flex-start;height:48px;padding:0 28px' + dim(c.busy))}>{c.busy ? 'Saving…' : 'Save automatic messages'}</button>
      </section>

      <section aria-label="Message a group" style={S(CARD)}>
        <div><h2 style={S(H2)}>Message a group</h2><p style={S(SMALL + ';margin-top:4px')}>Write once, choose who it goes to. You see how many it reaches before anything is sent.</p></div>
        <LabelledField id="mk-aud" label="Who to message">
          <select id="mk-aud" value={c.aud.kind} onChange={(e) => c.pickKind(e.target.value as AudienceKind)} style={S(SELECT)}>{AUDIENCES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
        </LabelledField>
        {c.def.n && (
          <LabelledField id="mk-aud-n" label={c.def.n.label}>
            <select id="mk-aud-n" value={c.aud.n} onChange={(e) => { c.setAud({ ...c.aud, n: Number(e.target.value) }); c.setConfirm(false); }} style={S(SELECT)}>{c.def.n.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </LabelledField>
        )}
        {c.aud.kind === 'service' && (
          <LabelledField id="mk-aud-svc" label="Service">
            <select id="mk-aud-svc" value={c.aud.service} onChange={(e) => { c.setAud({ ...c.aud, service: e.target.value }); c.setConfirm(false); }} style={S(SELECT)}>{c.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </LabelledField>
        )}
        <div role="status" style={S('padding:12px 14px;border-radius:16px;background:#F4F5F7;font-size:14px;line-height:1.5')}>
          {!c.preview ? 'Working out who this reaches…' : c.preview.error ? c.preview.error : (<>
            <strong>{plural(c.preview.reach, 'client')}</strong> will get this.
            <span style={S('color:#5E6673')}> {c.preview.total} match, {c.preview.agreed} of them agreed to messages{c.preview.agreed > c.preview.reach ? `, and ${c.preview.agreed - c.preview.reach} have no way to be reached` : ''}.</span>
            {c.preview.names.length > 0 && <div style={S('margin-top:4px;color:#5E6673;overflow-wrap:anywhere')}>{c.preview.names.join(', ')}{c.preview.reach > c.preview.names.length ? ` and ${c.preview.reach - c.preview.names.length} more` : ''}</div>}
          </>)}
        </div>
        <LabelledField id="mk-subj" label="Subject"><input id="mk-subj" type="text" value={c.subject} maxLength={SUBJECT_MAX} onChange={(e) => { c.setSubject(e.target.value); c.setConfirm(false); c.setMsg({}); }} placeholder="A little something for you" style={S(INPUT)} /></LabelledField>
        <LabelledField id="mk-text" label="Message"><textarea id="mk-text" value={c.text} maxLength={TEXT_MAX} onChange={(e) => { c.setText(e.target.value); c.setConfirm(false); c.setMsg({}); }} placeholder="Hi {first}, …" style={S(TEXTAREA + ';min-height:120px;resize:vertical')} /></LabelledField>
        <p style={S(SMALL)}>{c.text.length} of {TEXT_MAX}. Each message includes a book-online button and an unsubscribe link.</p>
        {c.msg.err && <FieldError>{c.msg.err}</FieldError>}
        {c.msg.ok && <Notice>{c.msg.ok}</Notice>}
        {!c.confirm ? (
          <div style={S('display:flex;flex-wrap:wrap;align-items:center;gap:10px')}>
            <Test c={c} k="broadcast" subj={c.subject} body={c.text} />
            <button type="button" onClick={() => c.setConfirm(true)} disabled={c.busy || !c.preview || c.preview.reach === 0 || !c.subject.trim() || !c.text.trim()} style={S(BLACK + ';flex:0 0 auto;height:44px;padding:0 24px' + dim(c.busy || !c.preview || c.preview.reach === 0 || !c.subject.trim() || !c.text.trim()))}>Review and send</button>
          </div>
        ) : (
          <div role="alertdialog" aria-label="Confirm sending" style={S('display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:18px;border:1px solid #E6E8EC;background:#FAFAFB')}>
            <div style={S('font-size:15px;font-weight:600')}>Send to {plural(c.preview?.reach ?? 0, 'client')}?</div>
            <p style={S(SMALL)}>Messages go out straight away and cannot be taken back.</p>
            <div style={S('display:flex;gap:10px')}>
              <button type="button" onClick={c.send} disabled={c.busy} style={S(BLACK + ';height:48px' + dim(c.busy))}>{c.busy ? 'Sending…' : 'Send now'}</button>
              <button type="button" className="ghost" onClick={() => c.setConfirm(false)} disabled={c.busy} style={S(OUTLINE + ';height:48px')}>Not yet</button>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Recently sent" style={S(CARD)}>
        <h2 style={S(H2)}>Recently sent</h2>
        {c.recent.length === 0 ? <Note>Nothing has been sent yet.</Note> : (
          <ul style={S('margin:0;padding:0;list-style:none')}>
            {c.recent.map((r, i) => (
              <li key={i} style={S('display:flex;justify-content:space-between;gap:12px;padding:10px 0;font-size:14.5px;' + (i ? 'border-top:1px solid #EEF0F3' : ''))}>
                <span style={S('min-width:0;overflow-wrap:anywhere')}>{r.name}<span style={S('color:#5E6673')}> · {KIND_LABEL[r.kind] ?? r.kind}</span></span>
                <span style={S('flex:0 0 auto;color:#5E6673')}>{r.when}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function MarketingView(props: MarketingProps) {
  const c = useMarketing(props);
  return (<>
    {c.narrow !== false && (
      <div className="m-cal cal-root" style={S("display:flex;position:relative;width:100%;height:100dvh;box-sizing:border-box;flex-direction:column;overflow:hidden;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
        <MobileHeader title="Marketing" subtitle="Win clients back and say happy birthday" showSearch={false} />
        <main className="page" style={S('flex:1 1 0;min-height:0;overflow-y:auto;padding:0 20px 20px')}><Body c={c} /></main>
        <MobileTabs active="more" />
      </div>
    )}
    {c.narrow !== true && (
      <div className="only-d d-cal cal-root" style={S("flex:999 1 560px;min-width:0;box-sizing:border-box;padding:28px 32px 40px 32px;display:flex;flex-direction:column;gap:28px;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4")}>
        <PageHeader title="Marketing" subtitle="Win clients back and say happy birthday" showSearch={false} showAction={false} />
        <Body c={c} />
      </div>
    )}
  </>);
}
