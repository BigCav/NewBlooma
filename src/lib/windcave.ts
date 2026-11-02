import 'server-only';
import { randomBytes } from 'node:crypto';
import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto';

const prod = () => process.env.WINDCAVE_ENV === 'prod';
const REST = () => (prod() ? 'https://sec.windcave.com' : 'https://uat.windcave.com');
const HIT_LIVE = 'https://sec.windcave.com/hit/pos.aspx', HIT_TEST = 'https://uat.windcave.com/hit/pos.aspx';
const HIT = () => (prod() ? HIT_LIVE : HIT_TEST);

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

/** The spec requires DeviceId, PosName and VendorId (1 to 32 characters) on Purchase and Refund; Status and button requests carry only Station, TxnType and TxnRef. */
const POS_IDS = () => ({ DeviceId: process.env.WINDCAVE_DEVICE_ID || 'Aster-1', PosName: process.env.WINDCAVE_POS_NAME || 'Aster', PosVersion: '1', VendorId: process.env.WINDCAVE_VENDOR_ID || 'Aster' });

async function hit(c: Creds, body: Record<string, string | number>, url: string = HIT()) {
  const money = body.TxnType === 'Purchase' || body.TxnType === 'Refund';
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/xml' }, body: xml({ action: 'doScrHIT', user: c.hitUser!, key: c.hitKey! }, money ? { ...body, ...POS_IDS() } : body) });
  if (!res.ok) throw new Error('hit_http');
  return res.text();
}

/** What Windcave's two-letter ReCo codes mean for the person at the till (spec: Response Codes). PJ is only "that reference is unknown". */
const OFFLINE = 'The terminal is not connected to Windcave. Check it is online, then do a Logon from its menu.';
const HIT_ERR: Record<string, string> = {
  P4: 'The POS device ID is too long.', P5: 'The POS device ID was not matched.', P7: 'Windcave did not recognise that transaction type.',
  P8: 'Windcave rejected the HIT user or key. Check them in Settings.', P9: 'That station ID does not belong to this HIT user. Check the station ID in Settings.',
  PA: 'Windcave could not read the payment status.', PB: 'Windcave could not start a session with the terminal.', PC: 'The terminal is still busy with a payment that was not finished. Wait a moment, or finish or cancel it on the terminal.',
  PD: OFFLINE, PE: OFFLINE, PF: OFFLINE, PG: 'The terminal did not answer in time.', PK: 'HIT is not switched on for this terminal. Ask Windcave to enable it.', PL: 'Windcave rejected one of the fields sent.',
  PM: 'That transaction type is not allowed on this terminal.', PO: 'Windcave does not know that station ID. Check it in Settings.', TQ: 'The terminal lost its connection. Do a Logon from its menu.',
};
/** A request-level failure (bad user, key, station, or the terminal offline) as a sentence, or null when the reply is an ordinary status. */
const hitProblem = (out: string): string | null => {
  const code = (pick(out, 'ReCo') ?? '').trim();
  return code && HIT_ERR[code] ? HIT_ERR[code] : null;
};
/** The buttons Windcave asks the POS to show (en="1"). CANCEL has its own control; the rest (YES / NO at a signature) are shown to the operator. */
const hitButtons = (out: string) => (['B1', 'B2'] as const).map((name) => { const m = out.match(new RegExp('<' + name + '\\s+en="1"\\s*>([^<]+)</' + name + '>')); return m ? { name, label: m[1].trim() } : null; }).filter((b): b is { name: 'B1' | 'B2'; label: string } => !!b);

/** Asks the terminal service about a made-up transaction: proves the username, key and station are accepted without charging anything. */
export async function testTerminal(salonId: string): Promise<{ ok?: true; error?: string; reply?: string }> {
  const c = await getCreds(salonId);
  if (!c.hitUser || !c.hitKey) return { error: 'Add the terminal username and key first.' };
  if (!c.station) return { error: 'Add the terminal station ID first.' };
  // Ask the service the app is set to use first, then the other one: HIT users are issued for either the live or the test service, never both.
  const here = HIT(), order: [string, string][] = here === HIT_LIVE ? [[HIT_LIVE, 'live'], [HIT_TEST, 'test']] : [[HIT_TEST, 'test'], [HIT_LIVE, 'live']];
  const notes: string[] = [];
  for (const [url, name] of order) {
    let out: string;
    try { out = await hit(c, { Station: c.station, TxnType: 'Status', TxnRef: ref('TEST') }, url); } catch { notes.push(`${name} service: could not be reached`); continue; }
    const reply = out.replace(/\s+/g, ' ').slice(0, 200);
    // Windcave answers an unknown reference with PJ ("TxnRef not matched"): the user, key and station were all accepted.
    if ((pick(out, 'ReCo') ?? '').trim() === 'PJ' || (pick(out, 'RC') ?? '').trim() === 'PJ') return url === here ? { ok: true, reply: name + ' service, ' + reply } : { error: `Your terminal details work on Windcave's ${name} service, but the app is set to use the ${order[0][1]} one. Tell me and I will switch it.`, reply };
    notes.push(`${name} service: ${hitProblem(out) ?? reply}`);
  }
  return { error: 'Windcave did not accept the details on either service. ' + notes.join(' | ') };
}

/** The terminal payment still open for a sale, if any. A sale with one must not be changed, voided or charged another way until it settles. */
export async function terminalInFlight(saleId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from('card_payments').select('txn_ref').eq('sale_id', saleId).eq('kind', 'terminal').eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data?.txn_ref ?? null;
}

/** Asks Windcave about every terminal payment still open for the salon, so one finished while nobody was watching still finishes its sale. */
export async function settleTerminals(salonId: string) {
  const { data } = await supabaseAdmin().from('card_payments').select('txn_ref').eq('salon_id', salonId).eq('kind', 'terminal').eq('status', 'pending').gte('created_at', new Date(Date.now() - 6 * 3600e3).toISOString()).limit(10);
  for (const r of data ?? []) await pollTerminal(r.txn_ref).catch(() => undefined);
}

export async function startTerminal(saleId: string, origin?: string): Promise<{ txn?: string; error?: string }> {
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
  return dispatch(c, { Station: c.station, Amount: dollars(sale.total_cents), Cur: sale.salons.currency, TxnType: 'Purchase', TxnRef: txn, MRef: sale.salons.name.slice(0, 60) }, txn, origin);
}

/**
 * Sends a Purchase or Refund to the terminal. Windcave may hold its reply while the terminal waits for a card, so the till is not made to wait:
 * after a moment the reference is handed back (Cancel works straight away) and the reply is dealt with when it comes.
 */
async function dispatch(c: Creds, body: Record<string, string | number>, txn: string, origin?: string): Promise<{ txn?: string; error?: string }> {
  const sb = supabaseAdmin();
  const fail = async (text: string, code?: string | null) => { await sb.from('card_payments').update({ status: 'error', response_code: code ?? null, response_text: text, resolved_at: new Date().toISOString() }).eq('txn_ref', txn); };
  const sent = hit(c, { ...body, HttpTimeout: 10,
    // Fail-proof result notification: Windcave tells us when it ends, even if the browser has been closed. The result is still confirmed with Windcave, never taken from this call.
    ...(origin ? { UrlSuccess: `${origin}/api/windcave/terminal?t=${txn}`, UrlFail: `${origin}/api/windcave/terminal?t=${txn}` } : {}) }).then((out) => ({ out }), () => ({ out: null as string | null }));
  const first = await Promise.race([sent, new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
  const judge = async (out: string | null) => {
    if (out === null) { await fail('Terminal unreachable'); return 'Could not reach the card terminal.'; }
    const bad = hitProblem(out);
    if (bad) { await fail(bad, pick(out, 'ReCo')); return bad; }
    return null;
  };
  if (first === null) { after(async () => { await judge((await sent).out); }); return { txn }; }
  const bad = await judge(first.out);
  return bad ? { error: bad } : { txn };
}

export async function pollTerminal(txn: string): Promise<{ state: 'pending' | 'approved' | 'declined' | 'error'; text?: string; buttons?: { name: string; label: string }[] }> {
  const sb = supabaseAdmin();
  const { data: cp } = await sb.from('card_payments').select('*').eq('txn_ref', txn).eq('kind', 'terminal').maybeSingle();
  if (!cp) return { state: 'error' };
  if (txn.startsWith('RF')) return pollRefund(cp);
  if (cp.status === 'approved') return { state: 'approved' };
  if (cp.status !== 'pending') return { state: cp.status === 'declined' || cp.status === 'cancelled' ? 'declined' : 'error', text: cp.response_text ?? undefined };
  const c = await getCreds(cp.salon_id);
  if (!c.station) return { state: 'error' };
  let out: string;
  try { out = await hit(c, { Station: c.station, TxnType: 'Status', TxnRef: txn }); } catch { return { state: 'pending' }; }
  const bad = hitProblem(out);
  if (bad) {
    // PC means the terminal is still busy: keep waiting. Anything else is a real failure of this attempt.
    if ((pick(out, 'ReCo') ?? '').trim() === 'PC') return { state: 'pending', text: bad };
    await sb.from('card_payments').update({ status: 'error', response_code: pick(out, 'ReCo') ?? null, response_text: bad, resolved_at: new Date().toISOString() }).eq('id', cp.id);
    return { state: 'error', text: bad };
  }
  if (pick(out, 'Complete') !== '1') return { state: 'pending', text: [pick(out, 'DL1'), pick(out, 'DL2')].filter((x) => x && x.trim()).join(' ').trim() || undefined, buttons: hitButtons(out).filter((b) => b.label.toUpperCase() !== 'CANCEL') };
  // Final reply: the outcome is inside <Result> (AP 1 = approved, RC/RT = response code and text, AmtA = amount in cents).
  const approved = pick(out, 'AP') === '1';
  const paid = Number(pick(out, 'AmtA') ?? '0'); // cents
  const tip = Number(pick(out, 'AmtT') ?? '0');
  const patch = { response_code: pick(out, 'RC') ?? pick(out, 'ReCo') ?? null, response_text: pick(out, 'RT') || pick(out, 'DL1') || null, auth_code: pick(out, 'AC') ?? null, dps_txn_ref: pick(out, 'TR') ?? null, resolved_at: new Date().toISOString() };
  if (!approved) { await sb.from('card_payments').update({ ...patch, status: 'declined' }).eq('id', cp.id); return { state: 'declined', text: patch.response_text ?? undefined }; }
  if (paid - tip !== cp.amount_cents && paid !== cp.amount_cents) {
    await sb.from('card_payments').update({ ...patch, status: 'error', needs_review: true, review_note: `Terminal approved ${paid} cents, sale was ${cp.amount_cents}` }).eq('id', cp.id);
    return { state: 'error', text: 'Amount mismatch. Check with your payment provider.' };
  }
  const { data: won } = await sb.from('card_payments').update({ ...patch, status: 'approved' }).eq('id', cp.id).eq('status', 'pending').select('id');
  if (!won?.length) return { state: 'approved' }; // another check got here first and finishes the sale
  const { error } = await sb.rpc('finalize_sale', { p_sale: cp.sale_id, p_method: 'card' });
  if (error) await sb.from('card_payments').update({ needs_review: true, review_note: `Approved but sale not finalised: ${error.message}` }).eq('id', cp.id);
  return { state: 'approved' };
}

/** A button the terminal asked the POS to show (such as YES / NO at a signature). */
export async function pressTerminalButton(txn: string, name: string, label: string) {
  const { data: cp } = await supabaseAdmin().from('card_payments').select('salon_id').eq('txn_ref', txn).eq('status', 'pending').maybeSingle();
  if (!cp || (name !== 'B1' && name !== 'B2')) return;
  const c = await getCreds(cp.salon_id);
  try { await hit(c, { Station: c.station!, TxnType: 'UI', UiType: 'Bn', Name: name, Val: label.toUpperCase(), TxnRef: txn }); } catch { /* the next status poll shows where it stands */ }
}

export async function cancelTerminal(txn: string) {
  const sb = supabaseAdmin();
  const { data: cp } = await sb.from('card_payments').select('*').eq('txn_ref', txn).eq('status', 'pending').maybeSingle();
  if (!cp) return;
  const c = await getCreds(cp.salon_id);
  // Spec: a button request names the button (B1 or B2) and sends its value. While the terminal waits for a card the CANCEL button is B2; asking for both needs no status call, which Windcave can hold for many seconds.
  for (const name of ['B2', 'B1']) {
    try {
      const r = await hit(c, { Station: c.station!, TxnType: 'UI', UiType: 'Bn', Name: name, Val: 'CANCEL', TxnRef: txn });
      console.log('windcave cancel', name, 'reply:', r.replace(/\s+/g, ' ').slice(0, 200));
    } catch (e) { console.error('windcave cancel failed', name, e); }
  }
}

/* ---------------- Refunds ---------------- */
/** A matched refund on the terminal (spec: Refund with the original DpsTxnRef). Returns the reference to watch, like a payment. */
export async function startRefund(saleId: string, origin?: string): Promise<{ txn?: string; error?: string }> {
  const sb = supabaseAdmin();
  const sale = await loadSale(saleId);
  if (!sale) return { error: 'Sale not found.' };
  const open = await terminalInFlight(saleId);
  if (open) return { txn: open };
  if (sale.status !== 'paid') return { error: 'Only a paid sale can be refunded.' };
  const { data: cp } = await sb.from('card_payments').select('*').eq('sale_id', saleId).eq('status', 'approved').eq('kind', 'terminal').maybeSingle();
  if (!cp || !cp.dps_txn_ref) return { error: 'No approved card payment found for this sale.' };
  const c = await getCreds(cp.salon_id);
  if (!c.hitUser || !c.hitKey || !c.station) return { error: 'The card terminal is not set up. Add its details in Settings.' };
  const txn = ref('RF');
  const ins = await sb.from('card_payments').insert({ salon_id: cp.salon_id, sale_id: saleId, kind: 'terminal', txn_ref: txn, amount_cents: cp.amount_cents });
  if (ins.error) return { error: 'Could not record the refund attempt.' };
  return dispatch(c, { Station: c.station, Amount: dollars(cp.amount_cents), Cur: sale.salons.currency, TxnType: 'Refund', TxnRef: txn, DpsTxnRef: cp.dps_txn_ref, MRef: sale.salons.name.slice(0, 60) }, txn, origin);
}

type Poll = { state: 'pending' | 'approved' | 'declined' | 'error'; text?: string; buttons?: { name: string; label: string }[] };
async function pollRefund(cp: any): Promise<Poll> {
  const sb = supabaseAdmin();
  if (cp.status === 'refunded') return { state: 'approved' };
  if (cp.status !== 'pending') return { state: cp.status === 'declined' || cp.status === 'cancelled' ? 'declined' : 'error', text: cp.response_text ?? undefined };
  const c = await getCreds(cp.salon_id);
  if (!c.station) return { state: 'error' };
  let out: string;
  try { out = await hit(c, { Station: c.station, TxnType: 'Status', TxnRef: cp.txn_ref }); } catch { return { state: 'pending' }; }
  const bad = hitProblem(out);
  if (bad) {
    if ((pick(out, 'ReCo') ?? '').trim() === 'PC') return { state: 'pending', text: bad };
    await sb.from('card_payments').update({ status: 'error', response_code: pick(out, 'ReCo') ?? null, response_text: bad, resolved_at: new Date().toISOString() }).eq('id', cp.id);
    return { state: 'error', text: bad };
  }
  if (pick(out, 'Complete') !== '1') return { state: 'pending', text: [pick(out, 'DL1'), pick(out, 'DL2')].filter((x) => x && x.trim()).join(' ').trim() || undefined, buttons: hitButtons(out).filter((b) => b.label.toUpperCase() !== 'CANCEL') };
  const patch = { response_code: pick(out, 'RC') ?? pick(out, 'ReCo') ?? null, response_text: pick(out, 'RT') || pick(out, 'DL1') || null, dps_txn_ref: pick(out, 'TR') ?? null, resolved_at: new Date().toISOString() };
  if (pick(out, 'AP') !== '1') {
    await sb.from('card_payments').update({ ...patch, status: 'declined' }).eq('id', cp.id);
    return { state: 'declined', text: patch.response_text ?? undefined };
  }
  // Approved: claim it once, then mark the card payment and the sale refunded.
  const { data: won } = await sb.from('card_payments').update({ ...patch, status: 'refunded' }).eq('id', cp.id).eq('status', 'pending').select('id');
  if (!won?.length) return { state: 'approved' };
  await sb.from('card_payments').update({ status: 'refunded' }).eq('sale_id', cp.sale_id).eq('kind', 'terminal').eq('status', 'approved');
  const { error } = await sb.rpc('refund_sale_internal', { p_sale: cp.sale_id });
  if (error) {
    await sb.from('card_payments').update({ needs_review: true, review_note: `Refunded on the terminal but sale not updated: ${error.message}` }).eq('id', cp.id);
    return { state: 'error', text: 'The terminal refunded the card, but the sale could not be updated. Contact support.' };
  }
  return { state: 'approved' };
}

/** Refund a card sale: on the terminal it returns the reference to watch, an on-screen payment is refunded at once. */
export async function refundByCard(saleId: string, origin?: string): Promise<{ txn?: string; ok?: true; error?: string }> {
  const open = await terminalInFlight(saleId);
  if (open) return { txn: open };
  const { data: cp } = await supabaseAdmin().from('card_payments').select('kind').eq('sale_id', saleId).eq('status', 'approved').maybeSingle();
  if (!cp) return { error: 'No approved card payment found for this sale.' };
  return cp.kind === 'terminal' ? startRefund(saleId, origin) : refundCard(saleId);
}

/** Card payments made on screen are refunded through Windcave's online service. Terminal payments use startRefund. */
export async function refundCard(saleId: string): Promise<{ ok?: true; error?: string }> {
  const sb = supabaseAdmin();
  const { data: cp } = await sb.from('card_payments').select('*').eq('sale_id', saleId).eq('status', 'approved').eq('kind', 'online').maybeSingle();
  if (!cp || !cp.dps_txn_ref) return { error: 'No approved card payment found for this sale.' };
  const sale = await loadSale(saleId); if (!sale) return { error: 'Sale not found.' };
  const c = await getCreds(cp.salon_id);
  const rtxn = ref('RO');
  try {
    if (!c.restUser || !c.restKey) return { error: 'Windcave credentials are missing.' };
    const res = await fetch(`${REST()}/api/v1/transactions`, { method: 'POST', headers: { Authorization: basic(c.restUser, c.restKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'refund', amount: dollars(cp.amount_cents), currency: sale.salons.currency, merchantReference: rtxn, parentTransactionId: cp.dps_txn_ref }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.authorised === false) return { error: `Windcave declined the refund${j.responseText ? `: ${j.responseText}` : ''}.` };
  } catch { return { error: 'Could not reach the payment provider.' }; }
  await sb.from('card_payments').update({ status: 'refunded', resolved_at: new Date().toISOString() }).eq('id', cp.id);
  const { error } = await sb.rpc('refund_sale_internal', { p_sale: saleId });
  if (error) return { error: 'Refunded with Windcave but could not update the sale. Contact support.' };
  return { ok: true };
}
