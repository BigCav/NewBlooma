import 'server-only';
import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto';

const prod = () => process.env.WINDCAVE_ENV === 'prod';
const REST = () => (prod() ? 'https://sec.windcave.com' : 'https://uat.windcave.com');
const HIT = () => (prod() ? 'https://sec.windcave.com/hit/pos.aspx' : 'https://uat.windcave.com/hit/pos.aspx');

type Creds = { restUser?: string; restKey?: string; hitUser?: string; hitKey?: string; station?: string; onlineEnabled: boolean; terminalEnabled: boolean };

/** Per-salon encrypted credentials first, then platform env vars. Never returned to the browser. */
export async function getCreds(salonId: string): Promise<Creds> {
  const sb = supabaseAdmin();
  const [{ data: s }, { data: p }] = await Promise.all([
    sb.from('salon_payment_secrets').select('*').eq('salon_id', salonId).maybeSingle(),
    sb.from('salon_payment_settings').select('*').eq('salon_id', salonId).single(),
  ]);
  const d = (v?: string | null) => (v ? decrypt(v) : undefined);
  return {
    restUser: d(s?.online_user) ?? process.env.WINDCAVE_REST_USER, restKey: d(s?.online_key) ?? process.env.WINDCAVE_REST_KEY,
    hitUser: d(s?.hit_user) ?? process.env.WINDCAVE_HIT_USER, hitKey: d(s?.hit_key) ?? process.env.WINDCAVE_HIT_KEY,
    station: p?.terminal_station_id ?? undefined, onlineEnabled: !!p?.online_cards_enabled, terminalEnabled: !!p?.terminal_enabled,
  };
}

const dollars = (cents: number) => (cents / 100).toFixed(2);
const ref = (prefix: string) => `${prefix}${randomBytes(9).toString('hex')}`;
const basic = (u: string, k: string) => 'Basic ' + Buffer.from(`${u}:${k}`).toString('base64');

async function loadSale(saleId: string) {
  const { data } = await supabaseAdmin().from('sales').select('id,salon_id,status,total_cents,clients(email,phone),salons(currency,name)').eq('id', saleId).single();
  return data as null | { id: string; salon_id: string; status: string; total_cents: number; clients: { email: string | null; phone: string | null } | null; salons: { currency: string; name: string } };
}

const DIAL: Record<string, string> = { NZD: '64', AUD: '61' };
/** Windcave wants an international number for 3D Secure. A local number gets the salon's country code; anything unclear is left out. */
export function intlPhone(raw: string | null | undefined, currency: string): string | null {
  const t = (raw ?? '').replace(/[^\d+]/g, '');
  if (!t) return null;
  if (t.startsWith('+')) return /^\+\d{8,15}$/.test(t) ? t : null;
  const cc = DIAL[currency]; if (!cc) return null;
  const n = t.replace(/^0+/, '');
  return /^\d{7,12}$/.test(n) ? `+${cc}${n}` : null;
}

/* ---------------- Online (hosted payment page) ---------------- */
export async function startOnline(saleId: string, origin: string): Promise<{ url?: string; error?: string }> {
  const sale = await loadSale(saleId);
  if (!sale || sale.status !== 'pending') return { error: 'This sale is not open.' };
  const c = await getCreds(sale.salon_id);
  if (!c.onlineEnabled || !c.restUser || !c.restKey) return { error: 'On-screen card payments are not set up. Add your Windcave details in Settings.' };
  // 3D Secure needs the cardholder's email and/or phone on every request.
  const email = sale.clients?.email?.trim() || undefined, phone = intlPhone(sale.clients?.phone, sale.salons.currency) ?? undefined;
  if (!email && !phone) return { error: 'Add an email or mobile number to this client first. The card network needs one to check the payment (3D Secure).' };
  const txn = ref('ON');
  const back = (r: string) => `${origin}/api/windcave/return?t=${txn}&r=${r}`;
  const res = await fetch(`${REST()}/api/v1/sessions`, {
    method: 'POST', headers: { Authorization: basic(c.restUser, c.restKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'purchase', methods: ['card'], amount: dollars(sale.total_cents), currency: sale.salons.currency, merchantReference: txn, language: 'en', customer: { ...(email ? { email } : {}), ...(phone ? { phoneNumber: phone } : {}) },
      callbackUrls: { approved: back('approved'), declined: back('declined'), cancelled: back('cancelled') }, notificationUrl: `${origin}/api/windcave/notify?t=${txn}` }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('windcave session rejected', res.status, detail.slice(0, 500));
    return { error: res.status === 401 ? 'Windcave rejected the username or API key. Check them in Settings.' : 'The payment provider did not accept the request.' };
  }
  const j = await res.json();
  const hpp = (j.links ?? []).find((l: any) => l.rel === 'hpp');
  if (!j.id || !hpp?.href) return { error: 'The payment provider returned an unexpected response.' };
  const ins = await supabaseAdmin().from('card_payments').insert({ salon_id: sale.salon_id, sale_id: sale.id, kind: 'online', txn_ref: txn, session_id: j.id, amount_cents: sale.total_cents });
  if (ins.error) return { error: 'Could not record the payment attempt.' };
  return { url: hpp.href };
}

/**
 * Frees a sale whose hosted payment page was closed without paying. Each open attempt is re-checked with Windcave first
 * (so a payment that did go through is still recorded); anything still unpaid is closed so the sale can be charged again.
 */
export async function releaseOnline(saleId: string) {
  const sb = supabaseAdmin();
  const { data: open } = await sb.from('card_payments').select('id,txn_ref').eq('sale_id', saleId).eq('kind', 'online').eq('status', 'pending');
  for (const cp of open ?? []) {
    if ((await settleOnline(cp.txn_ref)) === 'pending') {
      await sb.from('card_payments').update({ status: 'cancelled', response_text: 'Payment page closed without paying', resolved_at: new Date().toISOString() }).eq('id', cp.id).eq('status', 'pending');
    }
  }
}

/** Always confirm with Windcave server-side. Never trust the browser's return URL. Safe to call repeatedly. */
export async function settleOnline(txn: string): Promise<'approved' | 'declined' | 'pending' | 'unknown'> {
  const sb = supabaseAdmin();
  const { data: cp } = await sb.from('card_payments').select('*').eq('txn_ref', txn).maybeSingle();
  if (!cp) return 'unknown';
  if (cp.status === 'approved') return 'approved';
  const c = await getCreds(cp.salon_id);
  if (!c.restUser || !c.restKey || !cp.session_id) return 'unknown';
  const res = await fetch(`${REST()}/api/v1/sessions/${cp.session_id}`, { headers: { Authorization: basic(c.restUser, c.restKey) } });
  if (!res.ok) return 'pending';
  const j = await res.json();
  const tx = (j.transactions ?? [])[0];
  if (!tx) return j.state === 'complete' || j.state === 'cancelled' ? 'declined' : 'pending';
  if (tx.authorised === true) {
    if (Math.round(Number(tx.amount) * 100) !== cp.amount_cents) {
      await sb.from('card_payments').update({ status: 'error', needs_review: true, review_note: 'Approved amount differs from sale total', dps_txn_ref: tx.id, resolved_at: new Date().toISOString() }).eq('id', cp.id);
      return 'unknown';
    }
    await sb.from('card_payments').update({ status: 'approved', dps_txn_ref: tx.id, response_code: tx.reCo ?? null, response_text: tx.responseText ?? null, auth_code: tx.authCode ?? null, resolved_at: new Date().toISOString() }).eq('id', cp.id);
    const { error } = await sb.rpc('finalize_sale', { p_sale: cp.sale_id, p_method: 'card' });
    if (error) await sb.from('card_payments').update({ needs_review: true, review_note: `Approved but sale not finalised: ${error.message}` }).eq('id', cp.id);
    return 'approved';
  }
  if (j.state === 'complete' || j.state === 'cancelled') {
    await sb.from('card_payments').update({ status: tx.responseText ? 'declined' : 'cancelled', response_code: tx.reCo ?? null, response_text: tx.responseText ?? null, resolved_at: new Date().toISOString() }).eq('id', cp.id);
    return 'declined';
  }
  return 'pending';
}

/* ---------------- Terminal (HIT) ---------------- */
const xml = (attrs: Record<string, string | number>, body: Record<string, string | number>) =>
  `<Scr ${Object.entries(attrs).map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`).join(' ')}>${Object.entries(body).map(([k, v]) => `<${k}>${String(v).replace(/[<&]/g, '')}</${k}>`).join('')}</Scr>`;
/** Reads a value whether Windcave returns it as an element or an attribute. */
const pick = (x: string, k: string) => x.match(new RegExp(`<${k}>([^<]*)</${k}>`))?.[1] ?? x.match(new RegExp(`\\b${k}="([^"]*)"`))?.[1];

async function hit(c: Creds, body: Record<string, string | number>) {
  const res = await fetch(HIT(), { method: 'POST', headers: { 'Content-Type': 'application/xml' },
    body: xml({ action: 'doScrHIT', user: c.hitUser!, key: c.hitKey! }, { ...body, DeviceId: process.env.WINDCAVE_DEVICE_ID ?? '', PosName: process.env.WINDCAVE_POS_NAME ?? 'Aster', VendorId: process.env.WINDCAVE_VENDOR_ID ?? '' }) });
  if (!res.ok) throw new Error('hit_http');
  return res.text();
}

export async function startTerminal(saleId: string): Promise<{ txn?: string; error?: string }> {
  const sale = await loadSale(saleId);
  if (!sale || sale.status !== 'pending') return { error: 'This sale is not open.' };
  const c = await getCreds(sale.salon_id);
  if (!c.terminalEnabled || !c.hitUser || !c.hitKey || !c.station) return { error: 'The card terminal is not set up. Add its details in Settings.' };
  const sb = supabaseAdmin();
  const { data: open } = await sb.from('card_payments').select('id').eq('sale_id', saleId).eq('status', 'pending');
  if (open?.length) return { error: 'A card payment is already in progress for this sale.' };
  const txn = ref('TM');
  const ins = await sb.from('card_payments').insert({ salon_id: sale.salon_id, sale_id: sale.id, kind: 'terminal', txn_ref: txn, amount_cents: sale.total_cents });
  if (ins.error) return { error: 'Could not record the payment attempt.' };
  try {
    await hit(c, { Station: c.station, Amount: dollars(sale.total_cents), Cur: sale.salons.currency, TxnType: 'Purchase', TxnRef: txn, MRef: sale.salons.name.slice(0, 60) });
  } catch {
    await sb.from('card_payments').update({ status: 'error', response_text: 'Terminal unreachable', resolved_at: new Date().toISOString() }).eq('txn_ref', txn);
    return { error: 'Could not reach the card terminal.' };
  }
  return { txn };
}

export async function pollTerminal(txn: string): Promise<{ state: 'pending' | 'approved' | 'declined' | 'error'; text?: string }> {
  const sb = supabaseAdmin();
  const { data: cp } = await sb.from('card_payments').select('*').eq('txn_ref', txn).eq('kind', 'terminal').maybeSingle();
  if (!cp) return { state: 'error' };
  if (cp.status === 'approved') return { state: 'approved' };
  if (cp.status !== 'pending') return { state: cp.status === 'declined' || cp.status === 'cancelled' ? 'declined' : 'error', text: cp.response_text ?? undefined };
  const c = await getCreds(cp.salon_id);
  if (!c.station) return { state: 'error' };
  let out: string;
  try { out = await hit(c, { Station: c.station, TxnType: 'Status', TxnRef: txn }); } catch { return { state: 'pending' }; }
  if (pick(out, 'Complete') !== '1') return { state: 'pending', text: pick(out, 'DL1') };
  const approved = pick(out, 'AP') === '1';
  const paid = Number(pick(out, 'AmtA') ?? '0') - 0; // cents
  const tip = Number(pick(out, 'AmtT') ?? '0');
  const patch = { response_code: pick(out, 'RC') ?? pick(out, 'ReCo') ?? null, response_text: pick(out, 'RT') ?? null, auth_code: pick(out, 'AC') ?? null, dps_txn_ref: pick(out, 'TR') ?? null, resolved_at: new Date().toISOString() };
  if (!approved) { await sb.from('card_payments').update({ ...patch, status: 'declined' }).eq('id', cp.id); return { state: 'declined', text: patch.response_text ?? undefined }; }
  if (paid - tip !== cp.amount_cents && paid !== cp.amount_cents) {
    await sb.from('card_payments').update({ ...patch, status: 'error', needs_review: true, review_note: `Terminal approved ${paid} cents, sale was ${cp.amount_cents}` }).eq('id', cp.id);
    return { state: 'error', text: 'Amount mismatch. Check with your payment provider.' };
  }
  await sb.from('card_payments').update({ ...patch, status: 'approved' }).eq('id', cp.id);
  const { error } = await sb.rpc('finalize_sale', { p_sale: cp.sale_id, p_method: 'card' });
  if (error) await sb.from('card_payments').update({ needs_review: true, review_note: `Approved but sale not finalised: ${error.message}` }).eq('id', cp.id);
  return { state: 'approved' };
}

export async function cancelTerminal(txn: string) {
  const sb = supabaseAdmin();
  const { data: cp } = await sb.from('card_payments').select('*').eq('txn_ref', txn).eq('status', 'pending').maybeSingle();
  if (!cp) return;
  const c = await getCreds(cp.salon_id);
  try { await hit(c, { Station: c.station!, TxnType: 'UI', UiType: 'Bn', Name: 'B1', Val: 'CANCEL', TxnRef: txn }); } catch { /* terminal will time out; poll resolves it */ }
}

/* ---------------- Refunds ---------------- */
export async function refundCard(saleId: string): Promise<{ ok?: true; error?: string }> {
  const sb = supabaseAdmin();
  const { data: cp } = await sb.from('card_payments').select('*').eq('sale_id', saleId).eq('status', 'approved').maybeSingle();
  if (!cp || !cp.dps_txn_ref) return { error: 'No approved card payment found for this sale.' };
  const sale = await loadSale(saleId); if (!sale) return { error: 'Sale not found.' };
  const c = await getCreds(cp.salon_id);
  const rtxn = ref('RF');
  try {
    if (cp.kind === 'online') {
      if (!c.restUser || !c.restKey) return { error: 'Windcave credentials are missing.' };
      const res = await fetch(`${REST()}/api/v1/transactions`, { method: 'POST', headers: { Authorization: basic(c.restUser, c.restKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'refund', amount: dollars(cp.amount_cents), currency: sale.salons.currency, merchantReference: rtxn, parentTransactionId: cp.dps_txn_ref }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.authorised === false) return { error: `Windcave declined the refund${j.responseText ? `: ${j.responseText}` : ''}.` };
    } else {
      if (!c.station || !c.hitUser) return { error: 'Terminal credentials are missing.' };
      const out = await hit(c, { Station: c.station, Amount: dollars(cp.amount_cents), Cur: sale.salons.currency, TxnType: 'Refund', TxnRef: rtxn, DpsTxnRef: cp.dps_txn_ref });
      for (let i = 0; i < 40; i++) {
        const st = i === 0 ? out : await hit(c, { Station: c.station, TxnType: 'Status', TxnRef: rtxn });
        if (pick(st, 'Complete') === '1') { if (pick(st, 'AP') !== '1') return { error: 'The terminal did not approve the refund.' }; break; }
        if (i === 39) return { error: 'The terminal did not finish the refund in time. Check the terminal before retrying.' };
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  } catch { return { error: 'Could not reach the payment provider.' }; }
  await sb.from('card_payments').update({ status: 'refunded', resolved_at: new Date().toISOString() }).eq('id', cp.id);
  const { error } = await sb.rpc('refund_sale_internal', { p_sale: saleId });
  if (error) return { error: 'Refunded with Windcave but could not update the sale. Contact support.' };
  return { ok: true };
}
