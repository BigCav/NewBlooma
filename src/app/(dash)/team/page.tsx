import { requireCtx } from '@/lib/session';
import ActionForm from '@/components/ActionForm';
import { WEEKDAYS } from '@/lib/format';
import { saveMember, setActive, inviteMember } from './actions';

export const metadata = { title: 'Team' };

export default async function Team() {
  const { sb, staff: me } = await requireCtx();
  const owner = me.app_role === 'owner';
  const [{ data: team }, { data: shifts }] = await Promise.all([
    sb.from('staff').select('*').order('active', { ascending: false }).order('name'),
    sb.from('staff_shifts').select('*'),
  ]);
  const Form = ({ m }: { m?: any }) => (
    <ActionForm action={saveMember} submit={m ? 'Save' : 'Add team member'} resetOnOk={!m}>
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="grid g3">
        <div className="field"><label>Name</label><input name="name" defaultValue={m?.name} required /></div>
        <div className="field"><label>Title</label><input name="role_title" defaultValue={m?.role_title ?? 'Stylist'} /></div>
        <div className="field"><label>Access</label><select name="app_role" defaultValue={m?.app_role ?? 'stylist'}><option value="stylist">Stylist</option><option value="reception">Reception</option><option value="owner">Owner</option></select></div>
        <div className="field"><label>Commission (%)</label><input name="commission_pct" type="number" step="0.5" min="0" max="100" defaultValue={m ? Number(m.commission_pct) : 0} /></div>
      </div>
      <label className="row field"><input type="checkbox" name="online_bookable" defaultChecked={m ? m.online_bookable : true} /> Bookable online</label>
      <div className="lbl" style={{ marginBottom: 6 }}>Weekly shifts</div>
      <div className="stack" style={{ gap: 6, marginBottom: 14 }}>
        {WEEKDAYS.map((d, i) => { const sh = (shifts ?? []).find((x) => x.staff_id === m?.id && x.weekday === i); return (
          <div className="row wrap" key={d}>
            <label className="row" style={{ width: 130 }}><input type="checkbox" name={`work_${i}`} defaultChecked={m ? !!sh : i < 5} /> {d}</label>
            <input type="time" name={`from_${i}`} defaultValue={sh?.start_time?.slice(0, 5) ?? '09:00'} style={{ width: 130 }} aria-label={`${d} start`} />
            <span className="muted">to</span>
            <input type="time" name={`to_${i}`} defaultValue={sh?.end_time?.slice(0, 5) ?? '17:00'} style={{ width: 130 }} aria-label={`${d} end`} />
          </div>); })}
      </div>
    </ActionForm>
  );
  return (
    <>
      <div className="page-head"><div><h1>Team</h1><div className="muted">{team?.filter((t) => t.active).length ?? 0} active</div></div></div>
      {owner && <div className="card"><h2 style={{ marginBottom: 12 }}>Add a team member</h2><Form /></div>}
      {(team ?? []).map((m) => (
        <div className="card" key={m.id}>
          <details>
            <summary className="row between" style={{ cursor: 'pointer', listStyle: 'none' }}>
              <span><b>{m.name}</b> {!m.active && <span className="pill">Inactive</span>}<div className="muted small">{m.role_title}{m.user_id ? ' · has a login' : ''}</div></span>
              <span className="pill">{m.app_role}</span>
            </summary>
            {owner && <div style={{ paddingTop: 14 }}>
              <Form m={m} />
              <div className="row wrap" style={{ marginTop: 10 }}>
                <form action={setActive}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="active" value={String(!m.active)} /><button className="btn sm">{m.active ? 'Deactivate' : 'Reactivate'}</button></form>
                {!m.user_id && <ActionForm action={inviteMember} submit="Create login invite"><input type="hidden" name="id" value={m.id} /></ActionForm>}
              </div>
            </div>}
          </details>
        </div>
      ))}
      {!team?.length && <div className="card empty">No team members yet.</div>}
    </>
  );
}
