'use client';
// The form a client completes before a visit. One page for every form they still owe, used three ways:
// the client's own link ("public"), a team member filling it in with the client at the salon ("staff"), and the owner's preview ("preview").
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { S } from '@/app/(dash)/calendar/pickers';
import { checkForm, tickMany, type FillForm, type FormInput, type Question } from '@/lib/forms-shared';

type Submit = (inputs: { templateId: string; input: FormInput }[]) => Promise<{ error?: string; errors?: Record<string, Record<string, string>> }>;
export type FillProps = {
  mode: 'public' | 'staff' | 'preview';
  salon: string; first: string; clientName: string;
  apptLine: string; svcLine: string;
  forms: FillForm[]; submit: Submit;
  links: { manage?: string; home?: string; back?: string; backLabel?: string };
  /** Shown when there is nothing to fill in (so this component stays mounted when the last form is saved and the page re-renders). */
  empty?: { title: string; text: string; link?: { href: string; label: string } };
};

const blank = (): FormInput => ({ answers: {}, details: {}, agree: false, photos: false, sign: '' });
const CARD = 'box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:24px;display:flex;flex-direction:column;gap:18px;';
const INPUT = 'box-sizing:border-box;width:100%;height:52px;padding:0 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15.5px;color:#0E1116;background:#FFFFFF';
const ERR = 'margin:0;color:#B42318;font-size:13.5px;font-weight:500';
const noMin = { minHeight: 0 } as const;
const pickCss = (on: boolean, wide = true) => (wide ? 'flex:1 1 0;' : 'width:100%;text-align:left;display:flex;align-items:center;gap:12px;') + 'box-sizing:border-box;min-height:52px;padding:8px 16px 8px 14px;border-radius:14px;font:inherit;font-size:15px;font-weight:500;cursor:pointer;border:1px solid ' + (on ? '#5B3DF5' : '#E1E4E9') + ';background:' + (on ? '#EFEBFF' : '#FFFFFF') + ';color:' + (on ? '#3B2BB5' : '#0E1116');
const ynCss = (on: boolean) => 'flex:1 1 0;height:52px;border-radius:14px;font:inherit;font-size:15px;font-weight:500;cursor:pointer;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');

function Tick({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" style={S('flex:0 0 20px;width:20px;height:20px;border-radius:6px;border:1.5px solid ' + (on ? '#5B3DF5' : '#B9BFC9') + ';background:#FFFFFF;display:flex;align-items:center;justify-content:center;margin-top:1px')}>
      {on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5B3DF5" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
    </span>
  );
}

export function FormFillView(p: FillProps) {
  // The forms are fixed when the page opens, so the thank-you screen still has them after the server says nothing is left.
  const [forms] = useState(p.forms);
  const [vals, setVals] = useState<Record<string, FormInput>>(() => Object.fromEntries(forms.map((f) => [f.id, blank()])));
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState(false);
  const [serverErr, setServerErr] = useState<Record<string, Record<string, string>>>({});
  const [error, setError] = useState('');
  const [busy, startT] = useTransition();
  const multi = forms.length > 1;
  const patch = (fid: string, fn: (v: FormInput) => FormInput) => { setVals((s) => ({ ...s, [fid]: fn(s[fid]) })); setError(''); setServerErr((e) => { if (!e[fid]) return e; const n = { ...e }; delete n[fid]; return n; }); };
  const errs = (f: FillForm): Record<string, string> => (tried ? { ...checkForm(f, vals[f.id]).errors, ...(serverErr[f.id] ?? {}) } : {});
  const total = forms.reduce((n, f) => n + Object.keys(errs(f)).length, 0);

  const submit = () => {
    setTried(true);
    const bad = forms.reduce((n, f) => n + Object.keys(checkForm(f, vals[f.id]).errors).length, 0);
    if (bad) { setError(''); return; }
    if (p.mode === 'preview') { setDone(true); window.scrollTo(0, 0); return; }
    startT(async () => {
      const r = await p.submit(forms.map((f) => ({ templateId: f.id, input: vals[f.id] })));
      if (r.errors) { setServerErr(r.errors); setError(r.error ?? ''); return; }
      if (r.error) { setError(r.error); return; }
      setDone(true); window.scrollTo(0, 0);
    });
  };

  const question = (f: FillForm, q: Question, e: Record<string, string>) => {
    const v = vals[f.id], ans = v.answers[q.id];
    const set = (x: string | string[]) => patch(f.id, (s) => ({ ...s, answers: { ...s.answers, [q.id]: x } }));
    const hint = q.type === 'many' ? 'Tick all that apply.' : q.required ? '' : 'Optional.';
    return (
      <section key={q.id} style={S(CARD + 'padding:clamp(20px,5vw,28px)')}>
        <div><h2 style={S('margin:0;font-size:17px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{q.label}</h2>{hint && <p style={S('margin:4px 0 0;color:#5E6673;font-size:14px')}>{hint}</p>}</div>
        {q.type === 'yesno' && (<>
          <div role="group" aria-label={q.label} style={S('display:flex;gap:10px')}>
            <button type="button" aria-pressed={ans === 'yes'} onClick={() => set('yes')} style={S(ynCss(ans === 'yes'))}>Yes</button>
            <button type="button" aria-pressed={ans === 'no'} onClick={() => { patch(f.id, (s) => ({ ...s, answers: { ...s.answers, [q.id]: 'no' }, details: { ...s.details, [q.id]: '' } })); }} style={S(ynCss(ans === 'no'))}>No</button>
          </div>
          {ans === 'yes' && !!q.detailPrompt && (
            <div style={S('display:flex;flex-direction:column;gap:6px')}>
              <label htmlFor={'d-' + q.id} style={S('font-size:14px;font-weight:600')}>{q.detailPrompt}</label>
              <input id={'d-' + q.id} className="field" type="text" maxLength={200} value={v.details[q.id] ?? ''} onChange={(ev) => patch(f.id, (s) => ({ ...s, details: { ...s.details, [q.id]: ev.target.value } }))} style={{ ...S(INPUT), ...noMin }} />
            </div>
          )}
        </>)}
        {q.type === 'short' && <><label htmlFor={'a-' + q.id} style={{ position: 'absolute', left: -9999 }}>{q.label}</label><input id={'a-' + q.id} className="field" type="text" maxLength={200} value={typeof ans === 'string' ? ans : ''} onChange={(ev) => set(ev.target.value)} style={{ ...S(INPUT), ...noMin }} /></>}
        {q.type === 'long' && <><label htmlFor={'a-' + q.id} style={{ position: 'absolute', left: -9999 }}>{q.label}</label><textarea id={'a-' + q.id} className="field" rows={4} maxLength={2000} value={typeof ans === 'string' ? ans : ''} onChange={(ev) => set(ev.target.value)} style={{ ...S('box-sizing:border-box;width:100%;min-height:96px;padding:12px 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;font-size:15.5px;color:#0E1116;background:#FFFFFF;resize:vertical'), ...noMin }} /></>}
        {q.type === 'one' && (
          <div role="radiogroup" aria-label={q.label} style={S('display:flex;flex-direction:column;gap:8px')}>
            {q.options.map((o) => <button key={o} type="button" role="radio" aria-checked={ans === o} onClick={() => set(o)} style={S(pickCss(ans === o, false))}><span aria-hidden="true" style={S('flex:0 0 20px;width:20px;height:20px;border-radius:999px;border:1.5px solid ' + (ans === o ? '#5B3DF5' : '#B9BFC9') + ';background:' + (ans === o ? '#5B3DF5' : '#FFFFFF') + ';box-shadow:inset 0 0 0 4px #FFFFFF')} />{o}</button>)}
          </div>
        )}
        {q.type === 'many' && (
          <div role="group" aria-label={q.label} style={S('display:flex;flex-direction:column;gap:8px')}>
            {q.options.map((o) => { const on = Array.isArray(ans) && ans.includes(o); return <button key={o} type="button" aria-pressed={on} onClick={() => set(tickMany(Array.isArray(ans) ? ans : [], o))} style={S(pickCss(on, false))}><Tick on={on} />{o}</button>; })}
          </div>
        )}
        {!!e[q.id] && <p role="alert" style={S(ERR)}>{e[q.id]}</p>}
      </section>
    );
  };

  const consent = (f: FillForm, e: Record<string, string>) => {
    if (!f.consentText && !f.askPhotos) return null;
    const v = vals[f.id];
    return (
      <section key={f.id + '-consent'} style={S(CARD + 'padding:clamp(20px,5vw,28px)')}>
        <h2 style={S('margin:0;font-size:17px;font-weight:600;letter-spacing:-0.02em')}>{f.consentText && f.askPhotos ? 'Consent and photos' : f.consentText ? 'Consent' : 'Photos'}</h2>
        {!!f.consentText && <p style={S('margin:0;padding:14px 16px;border-radius:14px;background:#F4F5F7;color:#2B323C;font-size:14.5px;line-height:1.5;overflow-wrap:anywhere;white-space:pre-wrap')}>{f.consentText}</p>}
        {!!f.consentText && <button type="button" aria-pressed={v.agree} onClick={() => patch(f.id, (s) => ({ ...s, agree: !s.agree }))} style={S(pickCss(v.agree, false) + (e.agree ? ';border-color:#D92D20' : ''))}><Tick on={v.agree} /><span>I agree to the statement above</span></button>}
        {!!e.agree && <p role="alert" style={S(ERR)}>{e.agree}</p>}
        {f.askPhotos && <button type="button" aria-pressed={v.photos} onClick={() => patch(f.id, (s) => ({ ...s, photos: !s.photos }))} style={S(pickCss(v.photos, false))}><Tick on={v.photos} /><span>It is OK to take before and after photos for my client record</span></button>}
        {!!f.consentText && (
          <div style={S('display:flex;flex-direction:column;gap:6px')}>
            <label htmlFor={'sg-' + f.id} style={S('font-size:14px;font-weight:600')}>Type your full name to sign</label>
            <input id={'sg-' + f.id} className="field" type="text" autoComplete="name" maxLength={80} value={v.sign} onChange={(ev) => patch(f.id, (s) => ({ ...s, sign: ev.target.value }))} style={{ ...S(INPUT + ';border-color:' + (e.sign ? '#D92D20' : '#E1E4E9')), ...noMin }} />
            {!!e.sign && <p role="alert" style={S(ERR)}>{e.sign}</p>}
          </div>
        )}
      </section>
    );
  };

  const header = (
    <header style={S('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
      {p.mode === 'public'
        ? <span style={S('display:flex;align-items:center;min-height:44px;font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{p.salon}</span>
        : <Link href={p.links.back ?? '/clients/forms'} style={S('display:flex;align-items:center;min-height:44px;color:#0E1116;text-decoration:none;font-size:14px;font-weight:500')}>&larr; {p.links.backLabel ?? 'Client forms'}</Link>}
    </header>
  );

  if (!done && !forms.length && p.empty) return (
    <div className="page" style={S("max-width:680px;margin:0 auto;box-sizing:border-box;padding:40px 20px;display:flex;flex-direction:column;gap:12px;font-family:'Geist',system-ui,sans-serif;color:#0E1116")}>
      <h1 style={S('margin:0;font-size:26px;font-weight:600;letter-spacing:-0.02em')}>{p.empty.title}</h1>
      <p style={S('margin:0;color:#5E6673;font-size:15.5px')}>{p.empty.text}</p>
      {p.empty.link && <div><Link href={p.empty.link.href} style={S('display:inline-flex;align-items:center;height:48px;padding:0 24px;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:15px;font-weight:500;text-decoration:none')}>{p.empty.link.label}</Link></div>}
    </div>
  );

  const title = p.mode === 'staff' ? 'Fill in with ' + p.first : 'Before your visit';
  const sub = p.mode === 'staff'
    ? `Ask ${p.first} these questions and type in what they say, or hand over the screen. Nothing is saved until you press Save form.`
    : `A few quick questions so ${p.svcLine.split(' with ')[1] ?? 'we'} can look after you properly. It takes about two minutes.`;

  if (done) return (
    <div className="page" style={S("max-width:680px;margin:0 auto;box-sizing:border-box;padding:16px 20px 56px;display:flex;flex-direction:column;gap:24px;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;color:#0E1116")}>
      {header}
      <section role="status" style={S(CARD + 'padding:clamp(20px,5vw,28px);align-items:flex-start')}>
        <span aria-hidden="true" style={S('width:56px;height:56px;border-radius:999px;background:#DDF3EA;color:#14624A;display:flex;align-items:center;justify-content:center')}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
        <div>
          <h1 style={S('margin:0;font-size:24px;font-weight:600;letter-spacing:-0.02em')}>{p.mode === 'preview' ? 'This is what clients see when they finish' : p.mode === 'staff' ? 'Saved for ' + p.first : 'Thanks, ' + p.first}</h1>
          <p style={S('margin:6px 0 0;color:#4A525E;font-size:15.5px')}>{p.mode === 'preview' ? 'Nothing was saved. This was only a preview.' : p.mode === 'staff' ? 'The answers are on their record.' : `Your ${multi ? 'forms are' : 'form is'} saved. We will see ${multi ? 'them' : 'it'} before your appointment on ${p.apptLine}.`}</p>
        </div>
        <div style={S('display:flex;flex-wrap:wrap;gap:10px;width:100%')}>
          {p.mode === 'public' && p.links.manage && <a href={p.links.manage} style={S('flex:1 1 180px;height:52px;box-sizing:border-box;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center;text-decoration:none')}>Manage booking</a>}
          {p.mode === 'public' && p.links.home && <a href={p.links.home} className="ghost" style={S('flex:1 1 180px;height:52px;box-sizing:border-box;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center;text-decoration:none')}>Back to {p.salon}</a>}
          {p.mode !== 'public' && <Link href={p.links.back ?? '/clients/forms'} style={S('flex:1 1 180px;height:52px;box-sizing:border-box;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center;text-decoration:none')}>{p.links.backLabel ? 'Back to ' + p.links.backLabel.toLowerCase() : 'Back to client forms'}</Link>}
        </div>
      </section>
      {forms.map((f) => (
        <section key={f.id} style={S(CARD + 'padding:clamp(20px,5vw,28px);gap:8px')}>
          <h2 style={S('margin:0;font-size:16px;font-weight:600')}>{multi ? f.name + ': your answers' : 'Your answers'}</h2>
          <dl style={S('margin:0;display:flex;flex-direction:column;border-top:1px solid #EEF0F3')}>
            {checkForm(f, vals[f.id]).answers.map((a, i) => (
              <div key={i} style={S('display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 16px;padding:12px 0;border-bottom:1px solid #EEF0F3;font-size:14.5px')}>
                <dt style={S('color:#5E6673')}>{a.q}</dt><dd style={S('margin:0;font-weight:500;text-align:right;overflow-wrap:anywhere')}>{a.a || 'No answer'}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );

  return (
    <div className="page" style={S("max-width:680px;margin:0 auto;box-sizing:border-box;padding:16px 20px 56px;display:flex;flex-direction:column;gap:24px;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;color:#0E1116")}>
      {header}
      {p.mode === 'preview' && <p role="note" style={S('margin:0;padding:12px 16px;border-radius:14px;background:#EFEBFF;color:#3B2BB5;font-size:14px;font-weight:600')}>Preview. This is what clients see. Nothing you enter here is saved.</p>}
      <div style={S('display:flex;flex-direction:column;gap:16px')}>
        <div style={S('display:flex;flex-direction:column;gap:8px')}>
          <h1 style={S('margin:0;font-size:36px;line-height:1.1;font-weight:600;letter-spacing:-0.03em')}>{title}</h1>
          <p style={S('margin:0;color:#4A525E;font-size:16px;line-height:1.5')}>{sub}</p>
        </div>
        <div style={S('display:flex;align-items:center;gap:12px;box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:18px;padding:14px 16px')}>
          <span aria-hidden="true" style={S('flex:0 0 40px;width:40px;height:40px;border-radius:12px;background:#EFEBFF;color:#5B3DF5;display:flex;align-items:center;justify-content:center')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg></span>
          <span style={S('min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{p.apptLine}</span><span style={S('display:block;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{p.svcLine}</span></span>
        </div>
      </div>
      {tried && total > 0 && <p role="alert" style={S('margin:0;padding:12px 16px;border-radius:14px;background:#FDECEA;color:#B42318;font-size:14px;font-weight:600')}>{total === 1 ? 'There is 1 thing to fix below.' : 'There are ' + total + ' things to fix below.'}</p>}
      {forms.map((f) => {
        const e = errs(f);
        return (
          <div key={f.id} style={S('display:flex;flex-direction:column;gap:16px')}>
            {multi && <h2 style={S('margin:8px 0 0;font-size:22px;font-weight:600;letter-spacing:-0.02em')}>{f.name}</h2>}
            {f.questions.map((q) => question(f, q, e))}
            {consent(f, e)}
          </div>
        );
      })}
      {!!error && <p role="alert" style={S(ERR)}>{error}</p>}
      <button type="button" onClick={submit} disabled={busy} style={S('height:56px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font:inherit;font-size:16px;font-weight:500;cursor:pointer;opacity:' + (busy ? 0.6 : 1))}>{p.mode === 'staff' ? 'Save form' : multi ? 'Submit forms' : 'Submit form'}</button>
    </div>
  );
}
