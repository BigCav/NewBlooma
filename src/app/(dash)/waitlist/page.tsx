import { requireCtx } from '@/lib/session';
import ActionForm from '@/components/ActionForm';
import { WEEKDAYS, dateLong, time12 } from '@/lib/format';
import { addEntry, offerSlot, removeEntry } from './actions';

export const metadata = { title: 'Waitlist' };

export default async function Waitlist() {
  const { sb, salon } = await requireCtx();
  const [{ data: entries }, { data: clients }, { data: services }, { data: team }] = await Promise.all([
    sb.from('waitlist_entries').select('id,status,weekdays,earliest_time,latest_time,offered_start,offer_expires_at,clients(name,email,phone),services(name),staff:staff_id(name)').in('status', ['waiting', 'offered']).order('created_at'),
    sb.from('clients').select('id,name').order('name').limit(500),
    sb.from('services').select('id,name').eq('active', true).order('name'),
    sb.from('staff').select('id,name').eq('active', true).order('name'),
  ]);
  const withMatches = await Promise.all((entries ?? []).map(async (e: any) => {
    if (e.status !== 'waiting') return { e, matches: [] as any[] };
    const { data } = await sb.rpc('waitlist_matches', { p_entry: e.id });
    return { e, matches: (data ?? []).slice(0, 6) as any[] };
  }));
  const tn = (id: string) => team?.find((t) => t.id === id)?.name ?? '';
  return (
    <>
      <div className="page-head"><div><h1>Waitlist</h1><div className="muted">{entries?.length ?? 0} waiting</div></div></div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div>
          {!withMatches.length ? <div className="card empty">No one is waiting. Add a client to hold their preferred times.</div> : withMatches.map(({ e, matches }) => (
            <div className="card" key={e.id}>
              <div className="row between wrap"><div><h3>{e.clients?.name}</h3><div className="muted">{e.services?.name}{e.staff?.name ? ` with ${e.staff.name}` : ''}</div>
                <div className="muted small">{e.weekdays.length === 7 ? 'Any day' : e.weekdays.map((d: number) => WEEKDAYS[d].slice(0, 3)).join(', ')}{e.earliest_time ? ` · from ${e.earliest_time.slice(0, 5)}` : ''}{e.latest_time ? ` · until ${e.latest_time.slice(0, 5)}` : ''}</div></div>
                <span className={`pill ${e.status === 'offered' ? 'warn' : ''}`}>{e.status === 'offered' ? 'Offer sent' : 'Waiting'}</span></div>
              {e.status === 'offered' && <p className="muted small">Offered {dateLong(e.offered_start, salon.timezone)} at {time12(e.offered_start, salon.timezone)} until {time12(e.offer_expires_at, salon.timezone)}.</p>}
              {e.status === 'waiting' && (matches.length ? (
                <div style={{ marginTop: 10 }}><div className="lbl" style={{ marginBottom: 6 }}>Matching openings, send an offer</div>
                  <div className="row wrap" style={{ gap: 8 }}>{matches.map((m) => <form action={offerSlot} key={`${m.staff_id}${m.starts_at}`}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="slot" value={`${m.staff_id}|${m.starts_at}`} />
                    <button className="slot">{dateLong(m.starts_at, salon.timezone)} {time12(m.starts_at, salon.timezone)} · {tn(m.staff_id).split(' ')[0]}</button></form>)}</div></div>
              ) : <p className="muted small" style={{ marginBottom: 0 }}>No matching openings in the next two weeks.</p>)}
              <form action={removeEntry} style={{ marginTop: 10 }}><input type="hidden" name="id" value={e.id} /><button className="btn sm danger">Remove</button></form>
            </div>))}
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Add to waitlist</h2>
          <ActionForm action={addEntry} submit="Add" resetOnOk>
            <div className="field"><label>Client</label><select name="client_id" required defaultValue=""><option value="" disabled>Choose…</option>{(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="field"><label>Service</label><select name="service_id" required defaultValue=""><option value="" disabled>Choose…</option>{(services ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="field"><label>Team member</label><select name="staff_id"><option value="">Anyone</option>{(team ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="lbl" style={{ marginBottom: 6 }}>Days</div>
            <div className="row wrap" style={{ gap: 12, marginBottom: 12 }}>{WEEKDAYS.map((d, i) => <label className="row" key={d} style={{ gap: 4 }}><input type="checkbox" name="day" value={i} defaultChecked /> {d.slice(0, 3)}</label>)}</div>
            <div className="grid g2"><div className="field"><label>Earliest</label><input type="time" name="earliest" /></div><div className="field"><label>Latest finish</label><input type="time" name="latest" /></div></div>
          </ActionForm>
        </div>
      </div>
    </>
  );
}
