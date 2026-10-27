'use client';
import { S } from './pickers';
import { H2S, ERR, PRIMARY, SECOND } from './calUi';

/** Write to the client of one booking: a text box and Send. */
export function MessageBox({ name, context, value, onChange, onSend, onBack, busy, error }: {
  name: string; context: string; value: string; onChange: (v: string) => void; onSend: () => void; onBack: () => void; busy: boolean; error: string;
}) {
  return (<>
    <div style={S('min-width:0')}><h2 style={S(H2S)}>{'Message ' + name}</h2><p style={S('margin:4px 0 0;color:#5E6673;font-size:14px;overflow-wrap:anywhere')}>{context}</p></div>
    <textarea aria-label="Your message" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Write a message" style={S('box-sizing:border-box;width:100%;min-height:110px;resize:vertical;padding:12px 14px;border:1px solid #E1E4E9;border-radius:14px;font:inherit;color:#0E1116;background:#FFFFFF')} />
    {!!error && <p role="alert" style={S(ERR)}>{error}</p>}
    <div style={S('display:flex;gap:10px')}>
      <button onClick={onSend} disabled={busy} style={S(PRIMARY)}>Send message</button>
      <button className="ghost" onClick={onBack} style={S(SECOND)}>Back</button>
    </div>
  </>);
}
