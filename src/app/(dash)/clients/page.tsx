import Link from 'next/link';
import { requireCtx } from '@/lib/session';
import ActionForm from '@/components/ActionForm';
import { addClient } from './actions';

export const metadata = { title: 'Clients' };

export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { sb } = await requireCtx();
  let query = sb.from('clients').select('id,name,email,phone,created_at').order('name').limit(200);
  const term = (q ?? '').trim().replace(/[%,()]/g, '');
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data: clients } = await query;
  return (
    <>
      <div className="page-head"><div><h1>Clients</h1><div className="muted">{clients?.length ?? 0}{term ? ' found' : ''}</div></div>
        <form className="row"><input name="q" defaultValue={q} placeholder="Search clients" aria-label="Search clients" style={{ width: 260 }} /><button className="btn">Search</button></form></div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          {!clients?.length ? <div className="empty">{term ? 'No clients match.' : 'No clients yet. Add your first one.'}</div> : (
            <table className="stack-m"><thead><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead><tbody>
              {clients.map((c) => <tr key={c.id}><td><Link href={`/clients/${c.id}`}><b>{c.name}</b></Link></td><td className="muted">{c.email}</td><td className="muted">{c.phone}</td></tr>)}
            </tbody></table>
          )}
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Add a client</h2>
          <ActionForm action={addClient} submit="Add client" resetOnOk>
            <div className="field"><label>Name</label><input name="name" required /></div>
            <div className="grid g2"><div className="field"><label>Email</label><input name="email" type="email" /></div><div className="field"><label>Phone</label><input name="phone" type="tel" /></div></div>
            <div className="field"><label>Notes</label><textarea name="notes" rows={3} /></div>
          </ActionForm>
        </div>
      </div>
    </>
  );
}
