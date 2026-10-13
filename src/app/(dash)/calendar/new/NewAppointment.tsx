'use client';
import { useEffect, useState, useActionState, useTransition } from 'react';
import { createAppointment } from '../actions';
import { loadSlots } from './slots';
import { money } from '@/lib/format';

type Slot = { key: string; label: string; staff: string };

export default function NewAppointment(p: { salonId: string; tz: string; currency: string; clients: any[]; services: any[]; team: any[]; initialDate: string; initialClient: string }) {
  const [state, run, pending] = useActionState(createAppointment, undefined as { error?: string } | undefined);
  const [date, setDate] = useState(p.initialDate);
  const [staff, setStaff] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState('');
  const [client, setClient] = useState(p.initialClient);
  const [q, setQ] = useState('');
  const [loading, start] = useTransition();
  const [slotErr, setSlotErr] = useState('');

  useEffect(() => {
    setSlot('');
    start(async () => { const r = await loadSlots(date, picked, staff); setSlots(r.slots); setSlotErr(r.error ?? ''); });
  }, [date, picked, staff]);

  const total = p.services.filter((s) => picked.includes(s.id)).reduce((a, s) => a + s.price_cents, 0);
  const mins = p.services.filter((s) => picked.includes(s.id)).reduce((a, s) => a + s.duration_min, 0);
  const shown = p.clients.filter((c) => !q || `${c.name} ${c.email ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);

  return (
    <>
      <div className="page-head"><h1>New appointment</h1></div>
      <form action={run} className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Client</h2>
          <input type="hidden" name="client_id" value={client} />
          <div className="field"><label htmlFor="q">Find a client</label><input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or phone" /></div>
          <div className="stack" style={{ gap: 6, marginBottom: 14 }}>
            {shown.map((c) => (
              <button type="button" key={c.id} className="btn" style={{ justifyContent: 'space-between', borderColor: client === c.id ? 'var(--accent)' : undefined }} onClick={() => setClient(client === c.id ? '' : c.id)}>
                <span>{c.name}</span><span className="muted small">{c.email || c.phone || ''}</span></button>
            ))}
            {!shown.length && <span className="muted small">No match. Add them below.</span>}
          </div>
          {!client && (<>
            <div className="lbl" style={{ marginBottom: 8 }}>Or add a new client</div>
            <div className="field"><input name="new_name" placeholder="Full name" /></div>
            <div className="grid g2"><div className="field"><input name="new_email" type="email" placeholder="Email" /></div><div className="field"><input name="new_phone" type="tel" placeholder="Phone" /></div></div>
          </>)}
          <div className="field"><label htmlFor="notes">Notes</label><textarea id="notes" name="notes" rows={2} /></div>
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Services</h2>
          {!p.services.length && <div className="muted">Add services first.</div>}
          <div className="stack" style={{ gap: 6, marginBottom: 14 }}>
            {p.services.map((s) => (
              <label key={s.id} className="row between" style={{ padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 14 }}>
                <span className="row"><input type="checkbox" name="service" value={s.id} checked={picked.includes(s.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id))} /> {s.name} <span className="muted small">{s.duration_min} min</span></span>
                <b>{money(s.price_cents, p.currency)}</b></label>
            ))}
          </div>
          {!!picked.length && <div className="row between" style={{ marginBottom: 14 }}><span className="muted">{mins} min</span><b>{money(total, p.currency)}</b></div>}
          <div className="grid g2">
            <div className="field"><label htmlFor="date">Date</label><input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div className="field"><label htmlFor="staff">With</label><select id="staff" value={staff} onChange={(e) => setStaff(e.target.value)}><option value="">Anyone available</option>{p.team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          </div>
          <div className="lbl" style={{ marginBottom: 8 }}>Times</div>
          <input type="hidden" name="slot" value={slot} />
          <div className="row wrap" style={{ gap: 8, marginBottom: 14 }}>
            {loading && <span className="muted small">Checking availability…</span>}
            {!loading && slotErr && <span className="notice err">{slotErr}</span>}
            {!loading && !slotErr && picked.length > 0 && !slots.length && <span className="muted">Nothing available on this day.</span>}
            {!picked.length && <span className="muted small">Choose a service to see times.</span>}
            {slots.map((s) => <button type="button" key={s.key} className="slot" style={slot === s.key ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : undefined} onClick={() => setSlot(s.key)}>{s.label}{!staff && p.team.length > 1 ? ` · ${s.staff.split(' ')[0]}` : ''}</button>)}
          </div>
          {state?.error && <div className="notice err" role="alert">{state.error}</div>}
          <button className="btn primary" disabled={pending || !slot}>{pending ? 'Booking…' : 'Book appointment'}</button>
        </div>
      </form>
    </>
  );
}
