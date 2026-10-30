'use client';
import { phoneInput } from '@/lib/phone';
import { S } from '../calendar/pickers';
import { ICONS, StepShell, useSteps, DetailRows } from '../calendar/wizardUi';
import { initialsOf } from './shared';
import type { ClientsCtl } from './ClientsView';

const FIELD_IN = { ...S('box-sizing:border-box;width:100%;margin-top:2px;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:16px;color:#0E1116'), minHeight: 0, borderRadius: 0 } as const;
const I_MAIL = <><rect x="3.5" y="5.5" width="17" height="13" rx="3" /><path d="m4.5 7.5 7.5 5.5 7.5-5.5" /></>;
const I_PHONE = <path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 4.7 4.7l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A14.5 14.5 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4z" />;

function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} style={S('display:block;box-sizing:border-box;padding:10px 16px 12px;border:1px solid #E1E4E9;border-radius:16px;background:#FFFFFF')}><span style={S('display:block;font-size:12.5px;color:#5E6673')}>{label}</span>{children}</label>;
}

/** The phone's new client form as steps: name, contact details, then a summary. */
export function NewClientFlow({ c }: { c: ClientsCtl }) {
  const { nc, setNc } = c;
  const kinds = ['details', 'contact', 'summary'] as const;
  const last = kinds.length - 1;
  const { step, jump, forward, back } = useSteps(last, () => c.setError(''));
  const kind = kinds[Math.min(step, last)];
  const titles: Record<string, string> = { details: 'Name', contact: 'Contact', summary: 'Summary' };
  const set = (k: 'name' | 'email' | 'phone', v: string) => { setNc({ ...nc, [k]: v }); c.setError(''); };

  const ready = () => {
    if (kind === 'details') return nc.name.trim() ? '' : "Add the client's name.";
    if (kind === 'contact') {
      if (!nc.email.trim()) return "Add the client's email address.";
      if (!/^\S+@\S+\.\S+$/.test(nc.email.trim())) return 'Add a valid email address.';
      if (!nc.phone.trim()) return "Add the client's phone number.";
    }
    return '';
  };
  const next = () => { const e = ready(); if (e) { c.setError(e); return; } forward(); };

  return (
    <StepShell step={step} titles={kinds.map((k) => titles[k])} onBack={back} onClose={c.cancel} error={c.error}
      actions={kind === 'summary' ? [] : [{ label: 'Continue', onClick: next }]}
      bar={kind === 'summary' ? <button type="button" onClick={c.create} disabled={c.busy} style={S('width:100%;height:52px;border:0;border-radius:999px;background:#0E1116;color:#FFFFFF;font-size:14.5px;font-weight:500;cursor:pointer')}>Add client</button> : undefined}>
      <div style={S('display:flex;flex-direction:column;gap:14px')}>
        {kind === 'details' && (<>
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>They start with the New tag.</p>
          <Field label="Full name" htmlFor="nc-name"><input id="nc-name" type="text" value={nc.name} onChange={(e) => set('name', e.target.value)} placeholder="Client name" style={FIELD_IN} /></Field>
        </>)}

        {kind === 'contact' && (<>
          <p style={S('margin:0;font-size:13px;color:#5E6673')}>Both are needed so you can send booking confirmations and reminders.</p>
          <Field label="Email" htmlFor="nc-email"><input id="nc-email" type="email" inputMode="email" autoComplete="off" value={nc.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" style={FIELD_IN} /></Field>
          <Field label="Phone" htmlFor="nc-phone"><input id="nc-phone" type="tel" inputMode="tel" autoComplete="off" value={nc.phone} onChange={(e) => set('phone', phoneInput(e.target.value))} placeholder="021 234 5678" style={FIELD_IN} /></Field>
        </>)}

        {kind === 'summary' && (<>
          <div style={S('display:flex;align-items:center;gap:14px;box-sizing:border-box;padding:14px 16px;border:1px solid #E6E8EC;border-radius:20px;background:#FAFAFB')}>
            <div style={S('flex:0 0 48px;width:48px;height:48px;border-radius:999px;background:#EEEAFE;color:#3A2BB5;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600')}>{initialsOf(nc.name.trim() || '?')}</div>
            <div style={S('flex:1 1 auto;min-width:0')}>
              <div style={S('font-size:16px;font-weight:600;overflow-wrap:anywhere')}>{nc.name.trim() || 'Client name'}</div>
              <div style={S('font-size:13px;color:#5E6673')}>New client</div>
            </div>
          </div>
          <DetailRows go={jump} rows={[
            { icon: ICONS.person, text: nc.name.trim() || 'No name', step: 0 },
            { icon: I_MAIL, text: nc.email.trim() || 'No email', step: 1 },
            { icon: I_PHONE, text: nc.phone.trim() || 'No phone', step: 1 },
          ]} />
        </>)}
      </div>
    </StepShell>
  );
}
