import Link from 'next/link';
import { requireOwner } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import ActionForm from '@/components/ActionForm';
import { savePayments } from './actions';

export const metadata = { title: 'Card payments' };

export default async function Windcave() {
  const { sb, salon, settings: st } = await requireOwner();
  const [{ data: pay }, secrets] = await Promise.all([
    sb.from('salon_payment_settings').select('*').eq('salon_id', salon.id).single(),
    supabaseAdmin().from('salon_payment_secrets').select('online_user,online_key,hit_user,hit_key').eq('salon_id', salon.id).maybeSingle(),
  ]);
  const has = (k: string) => Boolean((secrets.data as any)?.[k]);
  return (
    <>
      <div className="page-head"><div><h1>Card payments</h1><div className="muted"><Link href="/settings">Back to settings</Link></div></div></div>
<div className="card" >
        <h2 style={{ marginBottom: 6 }}>Card payments (Windcave)</h2>
        <p className="muted small" style={{ marginTop: 0 }}>Credentials are encrypted and only ever used on the server. Leave a field blank to keep what is saved.</p>
        <ActionForm action={savePayments} submit="Save payment settings">
          <div className="field"><label htmlFor="tax_mode">Prices are</label>
            <select id="tax_mode" name="tax_mode" defaultValue={st.tax_inclusive ? 'inclusive' : 'exclusive'}><option value="inclusive">Tax inclusive</option><option value="exclusive">Tax exclusive (added at checkout)</option></select></div>
          <label className="row field"><input type="checkbox" name="online_cards_enabled" defaultChecked={pay?.online_cards_enabled} /> Take card payments on screen</label>
          <div className="grid g2">
            <div className="field"><label htmlFor="online_user">Windcave REST user {has('online_user') && <span className="pill ok">saved</span>}</label><input id="online_user" name="online_user" autoComplete="off" /></div>
            <div className="field"><label htmlFor="online_key">Windcave REST key {has('online_key') && <span className="pill ok">saved</span>}</label><input id="online_key" name="online_key" type="password" autoComplete="new-password" /></div>
          </div>
          <label className="row field"><input type="checkbox" name="terminal_enabled" defaultChecked={pay?.terminal_enabled} /> Use a card terminal (Windcave HIT)</label>
          <div className="grid g3">
            <div className="field"><label htmlFor="terminal_station_id">Terminal station ID</label><input id="terminal_station_id" name="terminal_station_id" defaultValue={pay?.terminal_station_id ?? ''} /></div>
            <div className="field"><label htmlFor="hit_user">HIT user {has('hit_user') && <span className="pill ok">saved</span>}</label><input id="hit_user" name="hit_user" autoComplete="off" /></div>
            <div className="field"><label htmlFor="hit_key">HIT key {has('hit_key') && <span className="pill ok">saved</span>}</label><input id="hit_key" name="hit_key" type="password" autoComplete="new-password" /></div>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
