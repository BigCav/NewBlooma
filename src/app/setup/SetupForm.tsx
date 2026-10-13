'use client';
import { useActionState, useState } from 'react';
import { createSalon } from './actions';
import { WEEKDAYS } from '@/lib/format';

const CURRENCIES = ['NZD', 'AUD', 'USD', 'GBP', 'EUR', 'CAD'];

export default function SetupForm({ zones }: { zones: string[] }) {
  const [state, run, pending] = useActionState(createSalon, undefined as { error?: string } | undefined);
  const [slug, setSlug] = useState('');
  const guessZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="auth" style={{ maxWidth: 640 }}>
      <div className="brand" style={{ paddingLeft: 0 }}>Aster &amp; Co</div>
      <form action={run} className="card">
        <h1 style={{ marginBottom: 6 }}>Set up your salon</h1>
        <p className="muted" style={{ marginTop: 0 }}>You can change all of this later in Settings.</p>
        {state?.error && <div className="notice err" role="alert">{state.error}</div>}
        <div className="grid g2">
          <div className="field"><label htmlFor="name">Salon name</label><input id="name" name="name" required /></div>
          <div className="field"><label htmlFor="slug">Booking web address</label>
            <input id="slug" name="slug" required pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="your-salon" />
            <span className="small muted">/b/{slug || 'your-salon'}</span></div>
        </div>
        <div className="grid g2">
          <div className="field"><label htmlFor="owner">Your name</label><input id="owner" name="owner" required autoComplete="name" /></div>
          <div className="field"><label htmlFor="title">Your title</label><input id="title" name="title" defaultValue="Owner" required /></div>
        </div>
        <div className="grid g2">
          <div className="field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" /></div>
          <div className="field"><label htmlFor="email">Salon email</label><input id="email" name="email" type="email" /></div>
        </div>
        <div className="field"><label htmlFor="address">Address</label><input id="address" name="address" /></div>
        <div className="grid g2">
          <div className="field"><label htmlFor="timezone">Timezone</label>
            <select id="timezone" name="timezone" defaultValue={guessZone} required>{zones.map((z) => <option key={z}>{z}</option>)}</select></div>
          <div className="field"><label htmlFor="currency">Currency</label>
            <select id="currency" name="currency" defaultValue="NZD">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>
        <div className="lbl" style={{ marginBottom: 8 }}>Opening hours</div>
        <div className="stack" style={{ gap: 8, marginBottom: 18 }}>
          {WEEKDAYS.map((d, i) => (
            <div className="row wrap" key={d}>
              <label className="row" style={{ width: 140, gap: 8 }}><input type="checkbox" name={`open_${i}`} defaultChecked={i < 5} /> {d}</label>
              <input type="time" name={`from_${i}`} defaultValue="09:00" style={{ width: 130 }} aria-label={`${d} opens`} />
              <span className="muted">to</span>
              <input type="time" name={`to_${i}`} defaultValue="17:00" style={{ width: 130 }} aria-label={`${d} closes`} />
            </div>
          ))}
        </div>
        <button className="btn primary" disabled={pending}>{pending ? 'Creating…' : 'Create salon'}</button>
      </form>
    </div>
  );
}
