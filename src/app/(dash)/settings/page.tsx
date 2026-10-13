import { requireOwner } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import ActionForm from '@/components/ActionForm';
import { WEEKDAYS } from '@/lib/format';
import { saveSettings, savePayments, saveHours } from './actions';

export const metadata = { title: 'Settings' };

export default async function Settings({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { sb, salon, settings: st } = await requireOwner();
  const sp = await searchParams;
  const [{ data: full }, { data: pay }, { data: hours }, secrets] = await Promise.all([
    sb.from('salons').select('name,phone,email,address,slug').eq('id', salon.id).single(),
    sb.from('salon_payment_settings').select('*').eq('salon_id', salon.id).single(),
    sb.from('opening_hours').select('*').eq('salon_id', salon.id).order('weekday'),
    supabaseAdmin().from('salon_payment_secrets').select('online_user,online_key,hit_user,hit_key').eq('salon_id', salon.id).maybeSingle(),
  ]);
  const has = (k: string) => Boolean((secrets.data as any)?.[k]);
  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><div className="muted">Your booking page: <b>/b/{full?.slug}</b></div></div></div>
      {sp.welcome && <div className="notice ok">Your salon is ready. Add your services and team next, then share your booking page.</div>}

      <ActionForm action={saveSettings} submit="Save settings">
        <div className="card">
          <h2 style={{ marginBottom: 14 }}>Business</h2>
          <div className="grid g2">
            <div className="field"><label htmlFor="name">Salon name</label><input id="name" name="name" defaultValue={full?.name} required /></div>
            <div className="field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" defaultValue={full?.phone ?? ''} /></div>
            <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={full?.email ?? ''} /></div>
            <div className="field"><label htmlFor="address">Address</label><input id="address" name="address" defaultValue={full?.address ?? ''} /></div>
          </div>
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 14 }}>Online booking</h2>
          <label className="row field"><input type="checkbox" name="online_booking" defaultChecked={st.online_booking} /> Accept online bookings</label>
          <div className="grid g3">
            <div className="field"><label htmlFor="booking_window">Clients can book up to</label>
              <select id="booking_window" name="booking_window" defaultValue={st.booking_window}><option value="1w">1 week ahead</option><option value="2w">2 weeks ahead</option><option value="4w">4 weeks ahead</option><option value="8w">8 weeks ahead</option></select></div>
            <div className="field"><label htmlFor="min_notice">Minimum notice</label>
              <select id="min_notice" name="min_notice" defaultValue={st.min_notice}><option value="none">None</option><option value="1h">1 hour</option><option value="2h">2 hours</option><option value="24h">24 hours</option></select></div>
            <div className="field"><label htmlFor="free_cancel_before">Free cancellation until</label>
              <select id="free_cancel_before" name="free_cancel_before" defaultValue={st.free_cancel_before}><option value="2h">2 hours before</option><option value="24h">24 hours before</option><option value="48h">48 hours before</option></select></div>
          </div>
          <div className="field"><label htmlFor="auto_confirm">New online bookings</label>
            <select id="auto_confirm" name="auto_confirm" defaultValue={st.auto_confirm ? 'auto' : 'manual'}><option value="auto">Confirm automatically</option><option value="manual">I approve each one</option></select></div>
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 14 }}>Checkout</h2>
          <div className="row wrap" style={{ gap: 20, marginBottom: 14 }}>
            <label className="row"><input type="checkbox" name="accept_card" defaultChecked={st.accept_card} /> Card</label>
            <label className="row"><input type="checkbox" name="accept_cash" defaultChecked={st.accept_cash} /> Cash</label>
            <label className="row"><input type="checkbox" name="accept_gift_cards" defaultChecked={st.accept_gift_cards} /> Gift cards</label>
          </div>
          <label className="row field"><input type="checkbox" name="ask_for_tip" defaultChecked={st.ask_for_tip} /> Ask for a tip at checkout</label>
          <div className="grid g3">
            <div className="field"><label htmlFor="suggested_tip_pct">Suggested tip</label>
              <select id="suggested_tip_pct" name="suggested_tip_pct" defaultValue={String(st.suggested_tip_pct)}><option value="0">None</option><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option></select></div>
            <div className="field"><label htmlFor="tax_rate">Sales tax rate (%)</label><input id="tax_rate" name="tax_rate" type="number" step="0.01" min="0" max="30" defaultValue={Number(st.tax_rate)} required /></div>
            <div className="field"><label htmlFor="tax_mode">Prices are</label>
              <select id="tax_mode" name="tax_mode" defaultValue={st.tax_inclusive ? 'inclusive' : 'exclusive'}><option value="inclusive">Tax inclusive</option><option value="exclusive">Tax exclusive (added at checkout)</option></select></div>
          </div>
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 14 }}>Notifications</h2>
          <div className="stack" style={{ gap: 10 }}>
            <label className="row"><input type="checkbox" name="email_confirmations" defaultChecked={st.email_confirmations} /> Email clients a booking confirmation</label>
            <label className="row"><input type="checkbox" name="remind_24h" defaultChecked={st.remind_24h} /> Email a reminder 24 hours before</label>
            <label className="row"><input type="checkbox" name="remind_2h" defaultChecked={st.remind_2h} /> Text a reminder 2 hours before</label>
            <label className="row"><input type="checkbox" name="notify_new_booking" defaultChecked={st.notify_new_booking} /> Tell me about new bookings</label>
            <label className="row"><input type="checkbox" name="notify_cancellation" defaultChecked={st.notify_cancellation} /> Tell me about cancellations</label>
          </div>
        </div>
      </ActionForm>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 14 }}>Opening hours</h2>
        <ActionForm action={saveHours} submit="Save hours">
          <div className="stack" style={{ gap: 8, marginBottom: 16 }}>
            {WEEKDAYS.map((d, i) => { const h = hours?.find((x) => x.weekday === i); return (
              <div className="row wrap" key={d}>
                <label className="row" style={{ width: 140 }}><input type="checkbox" name={`open_${i}`} defaultChecked={h?.is_open} /> {d}</label>
                <input type="time" name={`from_${i}`} defaultValue={h?.open_time?.slice(0, 5)} style={{ width: 130 }} aria-label={`${d} opens`} />
                <span className="muted">to</span>
                <input type="time" name={`to_${i}`} defaultValue={h?.close_time?.slice(0, 5)} style={{ width: 130 }} aria-label={`${d} closes`} />
              </div>); })}
          </div>
        </ActionForm>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 6 }}>Card payments (Windcave)</h2>
        <p className="muted small" style={{ marginTop: 0 }}>Credentials are encrypted and only ever used on the server. Leave a field blank to keep what is saved.</p>
        <ActionForm action={savePayments} submit="Save payment settings">
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
