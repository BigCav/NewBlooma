'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { publicBook, publicSlots } from './actions';
import { money } from '@/lib/format';

export default function BookingFlow({ slug, salon, services, team, cats, autoConfirm, today }: { slug: string; salon: any; services: any[]; team: any[]; cats: any[]; autoConfirm: boolean; today: string }) {
  const [state, run, pending] = useActionState(publicBook.bind(null, slug), undefined as { error?: string } | undefined);
  const [picked, setPicked] = useState<string[]>([]);
  const [date, setDate] = useState(today);
  const [staff, setStaff] = useState('');
  const [slots, setSlots] = useState<{ key: string; label: string }[]>([]);
  const [slot, setSlot] = useState('');
  const [loading, start] = useTransition();
  const [err, setErr] = useState('');
  useEffect(() => { setSlot(''); if (!picked.length) { setSlots([]); return; } start(async () => { const r = await publicSlots(slug, date, picked, staff); setSlots(r.slots); setErr(r.error ?? ''); }); }, [slug, date, picked, staff]);
  const chosen = services.filter((s) => picked.includes(s.id));
  const total = chosen.reduce((a, s) => a + s.price_cents, 0), mins = chosen.reduce((a, s) => a + s.duration_min, 0);
  return (
    <div className="auth" style={{ maxWidth: 720, margin: '4vh auto' }}>
      <h1>{salon.name}</h1>
      <p className="muted" style={{ marginTop: 4 }}>{[salon.address, salon.phone].filter(Boolean).join(' · ')}</p>
      {!services.length ? <div className="card empty">No services are available to book online yet.</div> : (
        <form action={run}>
          <div className="card">
            <h2 style={{ marginBottom: 12 }}>1. Choose services</h2>
            {cats.map((c) => { const list = services.filter((s) => s.category_id === c.id); if (!list.length) return null; return (
              <div key={c.id} style={{ marginBottom: 12 }}><div className="lbl" style={{ marginBottom: 6 }}>{c.name}</div>
                {list.map((s) => (
                  <label key={s.id} className="row between" style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 14, marginBottom: 6 }}>
                    <span className="row"><input type="checkbox" name="service" value={s.id} checked={picked.includes(s.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id))} />
                      <span><b>{s.name}</b><div className="muted small">{s.duration_min} min{s.description ? ` · ${s.description}` : ''}</div></span></span>
                    <b>{money(s.price_cents, salon.currency)}</b></label>))}
              </div>); })}
          </div>
          <div className="card">
            <h2 style={{ marginBottom: 12 }}>2. Pick a time</h2>
            <div className="grid g2">
              <div className="field"><label htmlFor="date">Date</label><input id="date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="field"><label htmlFor="staff">With</label><select id="staff" value={staff} onChange={(e) => setStaff(e.target.value)}><option value="">Anyone available</option>{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            </div>
            <input type="hidden" name="slot" value={slot} />
            <div className="row wrap" style={{ gap: 8 }}>
              {!picked.length && <span className="muted small">Choose a service first.</span>}
              {loading && <span className="muted small">Checking availability…</span>}
              {!loading && err && <span className="notice err">{err}</span>}
              {!loading && !err && picked.length > 0 && !slots.length && <span className="muted">No times left on this day. Try another date.</span>}
              {slots.map((s) => <button type="button" key={s.key} className="slot" aria-pressed={slot === s.key} style={slot === s.key ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : undefined} onClick={() => setSlot(s.key)}>{s.label}</button>)}
            </div>
          </div>
          <div className="card">
            <h2 style={{ marginBottom: 12 }}>3. Your details</h2>
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1 }} />
            <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" required /></div>
            <div className="grid g2">
              <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
              <div className="field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" autoComplete="tel" /></div>
            </div>
            <div className="field"><label htmlFor="notes">Anything we should know?</label><textarea id="notes" name="notes" rows={2} /></div>
            {!!picked.length && <div className="row between" style={{ marginBottom: 12 }}><span className="muted">{mins} min</span><b>{money(total, salon.currency)}</b></div>}
            {state?.error && <div className="notice err" role="alert">{state.error}</div>}
            <button className="btn primary" style={{ width: '100%' }} disabled={pending || !slot}>{pending ? 'Booking…' : autoConfirm ? 'Confirm booking' : 'Request booking'}</button>
            {!autoConfirm && <p className="muted small" style={{ marginBottom: 0 }}>The salon will confirm your request by email.</p>}
          </div>
        </form>
      )}
    </div>
  );
}
