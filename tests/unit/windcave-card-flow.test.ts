// A card machine and a payment page that are not real: Windcave is replaced by a script that answers the way Windcave does, and the database by a
// small in-memory copy. The app's own card code (src/lib/windcave.ts) runs unchanged against them, so every way a card payment can go is tried
// without a card: approved, declined, still waiting, the wrong amount, the terminal offline, the same answer arriving twice at once, refunds.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void Promise.resolve().then(fn) }));
vi.mock('@/lib/crypto', () => ({ decrypt: (s: string) => s, encrypt: (s: string) => s }));

type Row = Record<string, any>;
const db: { tables: Record<string, Row[]>; rpcs: { name: string; args: any }[] } = { tables: {}, rpcs: [] };
let seq = 0;

class Query {
  private op: 'select' | 'insert' | 'update' = 'select';
  private filters: ((r: Row) => boolean)[] = [];
  private patch: Row = {};
  private row: Row = {};
  private wantRows = false;
  constructor(private table: string) {}
  select() { if (this.op !== 'select') this.wantRows = true; return this; }
  insert(row: Row) { this.op = 'insert'; this.row = row; return this; }
  update(patch: Row) { this.op = 'update'; this.patch = patch; return this; }
  eq(k: string, v: any) { this.filters.push((r) => r[k] === v); return this; }
  gte() { return this; }
  order() { return this; }
  limit() { return this; }
  private run(): { data: any; error: any } {
    const rows = (db.tables[this.table] ??= []);
    if (this.op === 'insert') {
      if (this.table === 'card_payments' && rows.some((r) => r.txn_ref === this.row.txn_ref)) return { data: null, error: { message: 'duplicate txn_ref' } };
      const r = { id: `id${++seq}`, status: 'pending', needs_review: false, ...this.row }; rows.push(r);
      return { data: [r], error: null };
    }
    const hit = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === 'update') { hit.forEach((r) => Object.assign(r, this.patch)); return { data: this.wantRows ? hit.map((r) => ({ id: r.id })) : null, error: null }; }
    return { data: hit, error: null };
  }
  maybeSingle() { const { data, error } = this.run(); return Promise.resolve({ data: data?.[0] ?? null, error }); }
  single() { return this.maybeSingle(); }
  then(res: (v: any) => any, rej?: (e: any) => any) { return Promise.resolve(this.run()).then(res, rej); }
}

const sb = {
  from: (t: string) => new Query(t),
  rpc: async (name: string, args: any) => {
    db.rpcs.push({ name, args });
    const s = db.tables.sales.find((x) => x.id === args.p_sale)!;
    if (name === 'finalize_sale') {
      if (s.status === 'paid') return s.method === args.p_method ? { error: null } : { error: { message: 'sale_already_paid_another_way' } };
      if (s.status !== 'pending') return { error: { message: 'sale_not_pending' } };
      Object.assign(s, { status: 'paid', method: args.p_method });
    }
    if (name === 'refund_sale_internal') {
      if (s.status !== 'paid') return { error: { message: 'sale_not_paid' } };
      s.status = 'refunded';
    }
    return { error: null };
  },
};
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: () => sb }));

// ---- the pretend Windcave -------------------------------------------------------------------------------------------------------------
type HitCall = { type: string; ref: string; body: string };
const hitCalls: HitCall[] = [];
let hitReply: (c: HitCall) => string = () => '';
let sessionState: any = { state: 'pending', transactions: [] };
let refundReply: any = { ok: true, body: { authorised: true } };
const restCalls: { url: string; method: string; body?: any }[] = [];

const field = (x: string, k: string) => x.match(new RegExp(`<${k}>([^<]*)</${k}>`))?.[1] ?? '';
globalThis.fetch = vi.fn(async (url: any, init: any = {}) => {
  const u = String(url);
  if (u.includes('/hit/pos.aspx')) {
    const c = { type: field(init.body, 'TxnType'), ref: field(init.body, 'TxnRef'), body: String(init.body) };
    hitCalls.push(c);
    return new Response(hitReply(c), { status: 200 });
  }
  const body = init.body ? JSON.parse(init.body) : undefined;
  restCalls.push({ url: u, method: init.method ?? 'GET', body });
  if (u.endsWith('/api/v1/sessions') && init.method === 'POST') return new Response(JSON.stringify({ id: 'SESS1', links: [{ rel: 'hpp', href: 'https://uat.windcave.com/hpp/SESS1' }] }), { status: 200 });
  if (u.includes('/api/v1/sessions/SESS1')) return new Response(JSON.stringify(sessionState), { status: 200 });
  if (u.endsWith('/api/v1/transactions')) return new Response(JSON.stringify(refundReply.body), { status: refundReply.ok ? 200 : 400 });
  return new Response('{}', { status: 404 });
}) as any;

const final = (o: { ap?: number; amt: number; tip?: number; rt?: string; tr?: string }) =>
  `<Scr><Complete>1</Complete><Result><AP>${o.ap ?? 1}</AP><RC>${o.ap === 0 ? '51' : '00'}</RC><RT>${o.rt ?? (o.ap === 0 ? 'DECLINED' : 'APPROVED')}</RT><AmtA>${o.amt}</AmtA><AmtT>${o.tip ?? 0}</AmtT><AC>123456</AC><TR>${o.tr ?? 'DPS-1'}</TR></Result></Scr>`;
const waiting = '<Scr><Complete>0</Complete><DL1>PRESENT CARD</DL1><DL2></DL2></Scr>';

process.env.WINDCAVE_REST_USER = 'rest'; process.env.WINDCAVE_REST_KEY = 'k'; process.env.WINDCAVE_HIT_USER = 'hit'; process.env.WINDCAVE_HIT_KEY = 'k';
const { startTerminal, pollTerminal, startOnline, settleOnline, releaseOnline, startRefund, refundCard, refundByCard } = await import('@/lib/windcave');

const SALE = 'sale1', SALON = 'salon1';
const sale = () => db.tables.sales.find((s) => s.id === SALE)!;
const payments = () => db.tables.card_payments ?? [];
const finalized = () => db.rpcs.filter((r) => r.name === 'finalize_sale').length;

beforeEach(() => {
  db.tables = {
    sales: [{ id: SALE, salon_id: SALON, status: 'pending', method: null, total_cents: 6000, clients: { email: 'c@t.test', phone: null }, salons: { currency: 'NZD', name: 'Aster & Co' } }],
    card_payments: [],
    salon_payment_secrets: [],
    salon_payment_settings: [{ salon_id: SALON, terminal_station_id: 'ST1', online_cards_enabled: true, terminal_enabled: true }],
  };
  db.rpcs = []; hitCalls.length = 0; restCalls.length = 0; seq = 0;
  hitReply = () => '<Scr><Complete>0</Complete></Scr>';
  sessionState = { state: 'pending', transactions: [] };
  refundReply = { ok: true, body: { authorised: true } };
});

describe('card on the terminal', () => {
  it('asks the terminal for exactly the sale total and does not mark anything paid yet', async () => {
    hitReply = () => '<Scr><Complete>0</Complete></Scr>';
    const r = await startTerminal(SALE);
    expect(r.error).toBeUndefined();
    expect(hitCalls[0].type).toBe('Purchase');
    expect(field(hitCalls[0].body, 'Amount')).toBe('60.00');
    expect(field(hitCalls[0].body, 'Cur')).toBe('NZD');
    expect(payments()).toHaveLength(1);
    expect(payments()[0]).toMatchObject({ kind: 'terminal', status: 'pending', amount_cents: 6000 });
    expect(sale().status).toBe('pending');
    expect(finalized()).toBe(0);
  });

  it('keeps waiting while the customer taps, then pays the sale once on approval', async () => {
    const { txn } = await startTerminal(SALE);
    hitReply = () => waiting;
    expect((await pollTerminal(txn!)).state).toBe('pending');
    expect(sale().status).toBe('pending');
    hitReply = () => final({ amt: 6000 });
    expect((await pollTerminal(txn!)).state).toBe('approved');
    expect(sale()).toMatchObject({ status: 'paid', method: 'card' });
    expect(payments()[0]).toMatchObject({ status: 'approved', dps_txn_ref: 'DPS-1', auth_code: '123456' });
    expect((await pollTerminal(txn!)).state).toBe('approved'); // the till polls again
    expect(finalized()).toBe(1);
  });

  it('pays the sale only once when two checks see the approval at the same moment', async () => {
    const { txn } = await startTerminal(SALE);
    hitReply = () => final({ amt: 6000 });
    const both = await Promise.all([pollTerminal(txn!), pollTerminal(txn!), pollTerminal(txn!)]);
    expect(both.every((b) => b.state === 'approved')).toBe(true);
    expect(finalized()).toBe(1);
    expect(payments().filter((p) => p.status === 'approved')).toHaveLength(1);
  });

  it('accepts a tip the customer added on the terminal (charged amount less the tip is the sale total)', async () => {
    const { txn } = await startTerminal(SALE);
    hitReply = () => final({ amt: 6600, tip: 600 });
    expect((await pollTerminal(txn!)).state).toBe('approved');
    expect(sale().status).toBe('paid');
  });

  it('does NOT pay the sale when the terminal approved a different amount, and flags it for a person to look at', async () => {
    const { txn } = await startTerminal(SALE);
    hitReply = () => final({ amt: 4000 });
    const r = await pollTerminal(txn!);
    expect(r.state).toBe('error');
    expect(sale().status).toBe('pending');
    expect(payments()[0]).toMatchObject({ status: 'error', needs_review: true });
    expect(finalized()).toBe(0);
  });

  it('a declined card leaves the sale open and the customer can try again', async () => {
    const first = (await startTerminal(SALE)).txn!;
    hitReply = () => final({ ap: 0, amt: 0, rt: 'DECLINED' });
    const r = await pollTerminal(first);
    expect(r).toMatchObject({ state: 'declined', text: 'DECLINED' });
    expect(sale().status).toBe('pending');
    hitReply = () => '<Scr><Complete>0</Complete></Scr>';
    const second = await startTerminal(SALE);
    expect(second.error).toBeUndefined();
    hitReply = () => final({ amt: 6000, tr: 'DPS-2' });
    expect((await pollTerminal(second.txn!)).state).toBe('approved');
    expect(sale().status).toBe('paid');
    expect(payments().map((p) => p.status).sort()).toEqual(['approved', 'declined']);
    expect(await pollTerminal(first)).toMatchObject({ state: 'declined' }); // the old attempt never comes back to life
    expect(finalized()).toBe(1);
  });

  it('refuses a second payment while one is in progress, and on a sale that is not open', async () => {
    await startTerminal(SALE);
    expect((await startTerminal(SALE)).error).toMatch(/already in progress/);
    expect(payments()).toHaveLength(1);
    sale().status = 'paid';
    expect((await startTerminal(SALE)).error).toMatch(/not open/);
  });

  it('says so plainly when the terminal is offline, and does not pay the sale', async () => {
    const { txn } = await startTerminal(SALE);
    hitReply = () => '<Scr><ReCo>PD</ReCo></Scr>';
    const r = await pollTerminal(txn!);
    expect(r.state).toBe('error');
    expect(r.text).toMatch(/not connected to Windcave/);
    expect(sale().status).toBe('pending');
    expect(payments()[0].status).toBe('error');
  });

  it('keeps waiting (does not fail the payment) while the terminal is busy finishing it', async () => {
    const { txn } = await startTerminal(SALE);
    hitReply = () => '<Scr><ReCo>PC</ReCo></Scr>';
    expect((await pollTerminal(txn!)).state).toBe('pending');
    expect(payments()[0].status).toBe('pending');
  });

  it('turns a failed start (terminal unknown to Windcave) into an error and records it', async () => {
    hitReply = () => '<Scr><ReCo>PO</ReCo></Scr>';
    const r = await startTerminal(SALE);
    expect(r.error).toMatch(/does not know that station/);
    expect(payments()[0].status).toBe('error');
    expect(sale().status).toBe('pending');
  });
});

describe('card on the payment page', () => {
  it('creates a payment page for the sale total and remembers the attempt', async () => {
    const r = await startOnline(SALE, 'https://app.test');
    expect(r.url).toBe('https://uat.windcave.com/hpp/SESS1');
    expect(restCalls[0].body).toMatchObject({ type: 'purchase', amount: '60.00', currency: 'NZD' });
    expect(restCalls[0].body.customer.email).toBe('c@t.test');
    expect(payments()[0]).toMatchObject({ kind: 'online', status: 'pending', amount_cents: 6000, session_id: 'SESS1' });
    expect(sale().status).toBe('pending');
  });

  it('wants an email or mobile for 3D Secure before it will start', async () => {
    db.tables.sales[0].clients = { email: null, phone: null };
    expect((await startOnline(SALE, 'https://app.test')).error).toMatch(/email or mobile/);
    expect(payments()).toHaveLength(0);
  });

  it('pays the sale when Windcave confirms (never on the browser coming back), once however often it is asked', async () => {
    await startOnline(SALE, 'https://app.test');
    const txn = payments()[0].txn_ref;
    sessionState = { state: 'complete', transactions: [{ authorised: true, amount: '60.00', id: 'T9', reCo: '00', responseText: 'APPROVED', authCode: 'A1' }] };
    const [a, b] = await Promise.all([settleOnline(txn), settleOnline(txn)]);
    expect([a, b]).toEqual(['approved', 'approved']);
    expect(await settleOnline(txn)).toBe('approved');
    expect(sale()).toMatchObject({ status: 'paid', method: 'card' });
    expect(payments()[0]).toMatchObject({ status: 'approved', dps_txn_ref: 'T9' });
    expect(finalized()).toBeLessThanOrEqual(2); // a second finalize on a paid sale is harmless in the database
  });

  it('does not pay the sale if the approved amount is not the sale total', async () => {
    await startOnline(SALE, 'https://app.test');
    sessionState = { state: 'complete', transactions: [{ authorised: true, amount: '45.00', id: 'T9' }] };
    expect(await settleOnline(payments()[0].txn_ref)).toBe('unknown');
    expect(sale().status).toBe('pending');
    expect(payments()[0]).toMatchObject({ status: 'error', needs_review: true });
  });

  it('a declined or cancelled page leaves the sale open', async () => {
    await startOnline(SALE, 'https://app.test');
    sessionState = { state: 'complete', transactions: [{ authorised: false, responseText: 'DECLINED' }] };
    expect(await settleOnline(payments()[0].txn_ref)).toBe('declined');
    expect(payments()[0].status).toBe('declined');
    expect(sale().status).toBe('pending');
  });

  it('a payment page closed without paying is released so the sale can be charged again; one that DID pay is still recorded', async () => {
    await startOnline(SALE, 'https://app.test');
    await releaseOnline(SALE);
    expect(payments()[0].status).toBe('cancelled');
    expect(sale().status).toBe('pending');

    db.tables.card_payments = [];
    await startOnline(SALE, 'https://app.test');
    sessionState = { state: 'complete', transactions: [{ authorised: true, amount: '60.00', id: 'T10' }] };
    await releaseOnline(SALE);
    expect(sale().status).toBe('paid');
    expect(payments()[0].status).toBe('approved');
  });
});

describe('card refunds', () => {
  const paidOnTerminal = () => {
    sale().status = 'paid'; sale().method = 'card';
    db.tables.card_payments = [{ id: 'cp1', salon_id: SALON, sale_id: SALE, kind: 'terminal', txn_ref: 'TM1', status: 'approved', amount_cents: 6000, dps_txn_ref: 'DPS-1' }];
  };

  it('refunds the same card for the same amount on the terminal and marks both records refunded once', async () => {
    paidOnTerminal();
    const r = await startRefund(SALE);
    expect(r.error).toBeUndefined();
    expect(hitCalls[0].type).toBe('Refund');
    expect(field(hitCalls[0].body, 'Amount')).toBe('60.00');
    expect(field(hitCalls[0].body, 'DpsTxnRef')).toBe('DPS-1');
    expect(sale().status).toBe('paid'); // not refunded until the terminal says so
    hitReply = () => final({ amt: 6000, tr: 'DPS-R1' });
    const done = await Promise.all([pollTerminal(r.txn!), pollTerminal(r.txn!)]);
    expect(done.every((d) => d.state === 'approved')).toBe(true);
    expect(sale().status).toBe('refunded');
    expect(db.rpcs.filter((x) => x.name === 'refund_sale_internal')).toHaveLength(1);
    expect(payments().find((p) => p.id === 'cp1')!.status).toBe('refunded');
  });

  it('a declined refund leaves the sale paid', async () => {
    paidOnTerminal();
    const r = await startRefund(SALE);
    hitReply = () => final({ ap: 0, amt: 0, rt: 'REFUND DECLINED' });
    expect((await pollTerminal(r.txn!)).state).toBe('declined');
    expect(sale().status).toBe('paid');
  });

  it('will not refund a sale that is not paid, or one that has been refunded already', async () => {
    expect((await startRefund(SALE)).error).toMatch(/Only a paid sale/);
    paidOnTerminal();
    sale().status = 'refunded';
    expect((await startRefund(SALE)).error).toMatch(/Only a paid sale/);
    expect(hitCalls).toHaveLength(0);
  });

  it('refunds an on-screen card payment through Windcave and updates the sale', async () => {
    sale().status = 'paid'; sale().method = 'card';
    db.tables.card_payments = [{ id: 'cp2', salon_id: SALON, sale_id: SALE, kind: 'online', txn_ref: 'ON1', status: 'approved', amount_cents: 6000, dps_txn_ref: 'T9' }];
    expect(await refundByCard(SALE)).toEqual({ ok: true });
    expect(restCalls[0].body).toMatchObject({ type: 'refund', amount: '60.00', parentTransactionId: 'T9', currency: 'NZD' });
    expect(sale().status).toBe('refunded');
    expect(payments()[0].status).toBe('refunded');
  });

  it('if Windcave declines an on-screen refund the sale stays paid and the owner is told', async () => {
    sale().status = 'paid'; sale().method = 'card';
    db.tables.card_payments = [{ id: 'cp2', salon_id: SALON, sale_id: SALE, kind: 'online', txn_ref: 'ON1', status: 'approved', amount_cents: 6000, dps_txn_ref: 'T9' }];
    refundReply = { ok: true, body: { authorised: false, responseText: 'NOT ALLOWED' } };
    const r = await refundCard(SALE);
    expect(r.error).toMatch(/declined the refund: NOT ALLOWED/);
    expect(sale().status).toBe('paid');
    expect(payments()[0].status).toBe('approved');
  });
});
