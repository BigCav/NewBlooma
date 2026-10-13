import { requireCtx } from '@/lib/session';
import ActionForm from '@/components/ActionForm';
import { money } from '@/lib/format';
import { addCategory, saveService, archiveService } from './actions';

export const metadata = { title: 'Services' };

export default async function Services() {
  const { sb, salon, staff } = await requireCtx();
  const owner = staff.app_role === 'owner';
  const [{ data: cats }, { data: svcs }, { data: team }, { data: links }] = await Promise.all([
    sb.from('service_categories').select('id,name').order('sort').order('name'),
    sb.from('services').select('*').order('name'),
    sb.from('staff').select('id,name').eq('active', true).order('name'),
    sb.from('service_staff').select('service_id,staff_id'),
  ]);
  const who = (sid: string) => (links ?? []).filter((l) => l.service_id === sid).map((l) => l.staff_id);
  const Form = ({ svc }: { svc?: any }) => (
    <ActionForm action={saveService} submit={svc ? 'Save' : 'Add service'} resetOnOk={!svc}>
      {svc && <input type="hidden" name="id" value={svc.id} />}
      <div className="grid g3">
        <div className="field"><label>Name</label><input name="name" defaultValue={svc?.name} required /></div>
        <div className="field"><label>Category</label><select name="category_id" defaultValue={svc?.category_id} required>{(cats ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="field"><label>Duration (min)</label><input name="duration_min" type="number" min="5" step="5" defaultValue={svc?.duration_min} required /></div>
        <div className="field"><label>Price ({salon.currency})</label><input name="price" inputMode="decimal" defaultValue={svc ? (svc.price_cents / 100).toFixed(2) : ''} required /></div>
        <div className="field" style={{ gridColumn: 'span 2' }}><label>Description</label><input name="description" defaultValue={svc?.description ?? ''} /></div>
      </div>
      <div className="lbl" style={{ marginBottom: 6 }}>Who performs it</div>
      <div className="row wrap" style={{ gap: 16, marginBottom: 12 }}>
        {(team ?? []).map((t) => <label className="row" key={t.id}><input type="checkbox" name="staff" value={t.id} defaultChecked={svc ? who(svc.id).includes(t.id) : false} /> {t.name}</label>)}
        {!team?.length && <span className="muted small">Add team members first.</span>}
      </div>
      <label className="row field"><input type="checkbox" name="online_bookable" defaultChecked={svc ? svc.online_bookable : true} /> Bookable online</label>
    </ActionForm>
  );
  return (
    <>
      <div className="page-head"><div><h1>Services</h1><div className="muted">{svcs?.filter((s) => s.active).length ?? 0} active</div></div></div>
      {owner && (
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Categories</h2>
          <div className="row wrap" style={{ marginBottom: 12 }}>{(cats ?? []).map((c) => <span className="pill" key={c.id}>{c.name}</span>)}{!cats?.length && <span className="muted">No categories yet. Add one to start adding services.</span>}</div>
          <ActionForm action={addCategory} submit="Add category" resetOnOk><div className="field" style={{ maxWidth: 320 }}><label>New category</label><input name="name" required /></div></ActionForm>
        </div>
      )}
      {owner && !!cats?.length && <div className="card"><h2 style={{ marginBottom: 12 }}>Add a service</h2><Form /></div>}
      {(cats ?? []).map((c) => {
        const list = (svcs ?? []).filter((s) => s.category_id === c.id);
        if (!list.length) return null;
        return (
          <div className="card" key={c.id}>
            <h2 style={{ marginBottom: 8 }}>{c.name}</h2>
            {list.map((s) => (
              <details key={s.id} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
                <summary className="row between" style={{ cursor: 'pointer', listStyle: 'none' }}>
                  <span><b>{s.name}</b> {!s.active && <span className="pill">Archived</span>} {!s.online_bookable && <span className="pill">In-salon only</span>}<div className="muted small">{s.duration_min} min</div></span>
                  <b>{money(s.price_cents, salon.currency)}</b>
                </summary>
                {owner && <div style={{ paddingTop: 14 }}><Form svc={s} />
                  <form action={archiveService} style={{ marginTop: 8 }}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="active" value={String(!s.active)} /><button className="btn sm">{s.active ? 'Archive' : 'Restore'}</button></form></div>}
              </details>
            ))}
          </div>
        );
      })}
      {!svcs?.length && <div className="card empty">{owner ? 'No services yet. Add a category, then your first service.' : 'No services yet.'}</div>}
    </>
  );
}
