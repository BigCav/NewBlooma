import type { CSSProperties, ReactNode } from 'react';

type Table = { chips: number; cols: number[]; rows: number; avatar: boolean };
type Body = { t: 'table'; table: Table } | { t: 'inbox' } | { t: 'sales'; table: Table } | { t: 'timecards' } | { t: 'waitcards' } | { t: 'reviews' } | { t: 'tiles' } | { t: 'calendar' } | { t: 'report' } | { t: 'profile' };
type Preset = { search: boolean; action: boolean; stats: number; delta?: boolean; periods?: boolean; bare?: boolean; body: Body };

/** One entry per page: what its real desktop layout is made of, so the grey version lines up with it. */
const PRESETS: Record<string, Preset> = {
  calendar: { search: true, action: true, stats: 3, body: { t: 'calendar' } },
  clients: { search: true, action: true, stats: 3, body: { t: 'table', table: { chips: 4, cols: [3, 1.4, 1.6, 0.7, 1, 1], rows: 8, avatar: true } } },
  services: { search: true, action: true, stats: 3, body: { t: 'table', table: { chips: 2, cols: [3, 1.2, 1, 1, 1], rows: 3, avatar: true } } },
  team: { search: true, action: true, stats: 3, body: { t: 'table', table: { chips: 3, cols: [2.6, 1, 1, 1, 1, 1, 1, 1, 1], rows: 3, avatar: true } } },
  products: { search: true, action: true, stats: 3, body: { t: 'table', table: { chips: 4, cols: [3, 1.2, 1, 1, 1, 1], rows: 3, avatar: true } } },
  packages: { search: true, action: true, stats: 4, body: { t: 'table', table: { chips: 2, cols: [2.4, 2, 1, 1.2, 1], rows: 5, avatar: true } } },
  'gift-cards': { search: true, action: true, stats: 4, body: { t: 'table', table: { chips: 3, cols: [2, 2, 1, 1, 1.4, 1], rows: 5, avatar: false } } },
  sales: { search: true, action: true, stats: 3, body: { t: 'sales', table: { chips: 4, cols: [2, 1, 1.3, 1, 1.2, 1, 1], rows: 6, avatar: true } } },
  inbox: { search: true, action: false, stats: 3, body: { t: 'inbox' } },
  waitlist: { search: true, action: true, stats: 0, body: { t: 'waitcards' } },
  reviews: { search: true, action: true, stats: 3, body: { t: 'reviews' } },
  payroll: { search: false, action: false, stats: 3, body: { t: 'timecards' } },
  settings: { search: false, action: false, stats: 0, body: { t: 'tiles' } },
  reports: { search: false, action: false, stats: 4, delta: true, periods: true, body: { t: 'report' } },
  summary: { search: false, action: false, stats: 4, periods: true, body: { t: 'report' } },
  profile: { search: false, action: false, stats: 0, bare: true, body: { t: 'profile' } },
};

const B = ({ w, h, r = 12, s }: { w: number | string; h: number; r?: number; s?: CSSProperties }) => <div className="sk" style={{ width: w, height: h, borderRadius: r, flex: '0 0 auto', maxWidth: '100%', ...s }} />;
const CARD: CSSProperties = { background: '#FFFFFF', border: '1px solid #E6E8EC', borderRadius: 24, overflow: 'hidden', boxSizing: 'border-box' };
const LINE = '1px solid #EEF0F3';

function Head({ search, action }: { search: boolean; action: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, minHeight: 56 }}>
      <div><B w={190} h={34} /><B w={270} h={16} s={{ marginTop: 10 }} /></div>
      {(search || action) && <div style={{ display: 'flex', gap: 10 }}>{search && <B w={250} h={44} r={999} />}{action && <B w={160} h={44} r={999} />}</div>}
    </div>
  );
}

const Stats = ({ n, delta }: { n: number; delta?: boolean }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 64px' }}>
    {Array.from({ length: n }, (_, i) => <div key={i}><B w={96} h={14} /><B w={110} h={38} s={{ marginTop: 8 }} />{delta && <B w={150} h={13} s={{ marginTop: 8 }} />}</div>)}
  </div>
);

const Chips = ({ n, h = 40 }: { n: number; h?: number }) => (
  <div style={{ display: 'flex', gap: 8 }}>{Array.from({ length: n }, (_, i) => <B key={i} w={i === 0 ? 64 : 92 + (i % 2) * 22} h={h} r={999} />)}</div>
);

const Bar = ({ n, right }: { n: number; right?: ReactNode }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: LINE }}><Chips n={n} />{right ?? <B w={110} h={14} />}</div>
);

function TableCard({ t }: { t: Table }) {
  return (
    <div style={CARD}>
      <Bar n={t.chips} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', borderBottom: LINE }}>
        {t.cols.map((c, i) => <div key={i} style={{ flex: `${c} 1 0`, minWidth: 0 }}><B w={i === 0 ? 70 : 56} h={11} /></div>)}
      </div>
      {Array.from({ length: t.rows }, (_, r) => (
        <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: r === t.rows - 1 ? undefined : LINE }}>
          {t.cols.map((c, i) => (
            <div key={i} style={{ flex: `${c} 1 0`, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
              {i === 0 && t.avatar && <B w={40} h={40} r={999} />}
              {i === 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><B w={110 + (r % 3) * 20} h={14} />{t.avatar && <B w={90} h={11} />}</div>
                : i === t.cols.length - 1 ? <B w={64} h={24} r={999} /> : <B w={50 + ((r + i) % 3) * 14} h={13} />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function InboxCard() {
  return (
    <div style={CARD}>
      <Bar n={4} right={<div style={{ display: 'flex', alignItems: 'center', gap: 16 }}><B w={80} h={14} /><B w={140} h={40} r={999} /></div>} />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 20px', borderBottom: i === 5 ? undefined : LINE }}>
          <B w={40} h={40} r={999} />
          <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}><B w={110} h={15} /><B w={`${35 + (i % 4) * 12}%`} h={12} /><div style={{ display: 'flex', gap: 8 }}><B w={76} h={24} r={999} /><B w={56} h={24} r={999} /></div></div>
          <B w={44} h={12} />
        </div>
      ))}
    </div>
  );
}

function SalesBody({ t }: { t: Table }) {
  const h = [12, 28, 104, 6, 6, 6, 6];
  return (<>
    <div style={{ ...CARD, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><B w={110} h={18} /><B w={110} h={14} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 12, alignItems: 'end', height: 150 }}>
        {h.map((x, i) => <B key={i} w="100%" h={x + 8} r={10} />)}
      </div>
    </div>
    <TableCard t={t} />
  </>);
}

function TimeCards() {
  return (<>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Chips n={2} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><B w={40} h={40} r={999} /><B w={170} h={34} /><B w={40} h={40} r={999} /></div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(400px,1fr))', gap: 16 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...CARD, padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><B w={40} h={40} r={999} /><div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><B w={110} h={14} /><B w={70} h={12} /></div></div>
          <B w={150} h={34} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>{Array.from({ length: 7 }, (_, k) => <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}><B w={24} h={10} /><B w="100%" h={36} /></div>)}</div>
          <B w={130} h={13} />
        </div>
      ))}
    </div>
  </>);
}

function WaitCards() {
  return (<>
    <Chips n={4} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(380px,1fr))', gap: 16 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...CARD, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <B w={40} h={40} r={999} />
          <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 8 }}><B w={90} h={15} /><B w={200} h={12} /><B w={150} h={11} /></div>
          <B w={64} h={24} r={999} s={{ alignSelf: 'flex-start' }} />
        </div>
      ))}
    </div>
  </>);
}

function ReviewsBody() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 20 }}>
      <div style={{ ...CARD, flex: '0 0 340px', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <B w={110} h={44} /><B w={120} h={16} /><B w={70} h={13} />
        {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}><B w={34} h={12} /><B w="100%" h={8} r={999} /></div>)}
      </div>
      <div style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Chips n={5} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ ...CARD, padding: 20, display: 'flex', gap: 14 }}>
              <B w={40} h={40} r={999} />
              <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 8 }}><B w={120} h={14} /><B w={80} h={12} /><B w={190} h={13} /><B w={64} h={22} r={999} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Tiles() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 16, minHeight: 92, padding: '18px 20px' }}>
          <B w={48} h={48} r={16} /><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><B w={130} h={16} /><B w={190} h={13} /></div>
        </div>
      ))}
    </div>
  );
}

function CalendarCard() {
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><B w={40} h={40} r={999} /><B w={40} h={40} r={999} /><B w={120} h={16} /></div>
        <div style={{ display: 'flex', gap: 8 }}><B w={56} h={36} r={999} /><B w={64} h={36} r={999} /><B w={86} h={36} r={999} /><B w={110} h={36} r={999} /><B w={100} h={36} r={999} /></div>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 16px' }}><B w={110} h={36} r={999} /><B w={64} h={36} r={999} /><B w={64} h={36} r={999} /><B w={72} h={36} r={999} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(3,minmax(0,1fr))', borderTop: LINE }}>
        <div />
        {[0, 1, 2].map((i) => <div key={i} style={{ padding: '14px 20px', display: 'flex', gap: 10, alignItems: 'center', borderLeft: LINE }}><B w={36} h={36} r={999} /><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><B w={90} h={13} /><B w={50} h={10} /></div></div>)}
        {Array.from({ length: 7 }, (_, r) => [
          <div key={'t' + r} style={{ padding: '12px 10px', borderTop: LINE }}><B w={42} h={11} /></div>,
          ...[0, 1, 2].map((c) => <div key={r + '-' + c} style={{ borderTop: LINE, borderLeft: LINE, height: 72 }} />),
        ])}
      </div>
    </div>
  );
}

function Report() {
  const side = (h: number, k: number) => <div key={k} style={{ ...CARD, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><B w={130} h={17} /><B w={80} h={13} /></div><B w="100%" h={h} r={16} /></div>;
  const list = (k: number) => (
    <div key={k} style={{ ...CARD, padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><B w={120} h={17} /><B w={90} h={13} /></div>
      {[0, 1, 2].map((i) => <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><B w={100} h={14} /><B w={50} h={14} /></div><B w="100%" h={8} r={999} /></div>)}
    </div>
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 20 }}>
      <div style={{ flex: '1 1 620px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {side(210, 0)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>{list(1)}{list(2)}</div>
      </div>
      <div style={{ flex: '0 1 440px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 20 }}>{side(190, 3)}{side(30, 4)}</div>
    </div>
  );
}

/** A client's profile: back and close, the client, three buttons, the contact card and the list of pages. */
function Profile() {
  const row = (k: number) => <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderTop: k ? LINE : undefined }}><B w={20} h={20} r={999} /><B w={120 + (k % 3) * 40} h={15} /></div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><B w={44} h={44} r={999} /><B w={44} h={44} r={999} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '8px 0 4px' }}><B w={112} h={112} r={999} /><B w={190} h={28} s={{ marginTop: 6 }} /><B w={230} h={16} /></div>
      <div style={{ display: 'flex', gap: 10 }}><B w={52} h={52} r={999} /><B w={52} h={52} r={999} /><B w="100%" h={52} r={999} s={{ flex: '1 1 0' }} /></div>
      <div style={{ ...CARD, padding: '4px 20px' }}>{[0, 1, 2].map(row)}</div>
      <div style={{ ...CARD, padding: '4px 20px' }}>{[0, 1, 2, 3, 4].map((k) => <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 4px', borderTop: k ? LINE : undefined }}><B w={110 + (k % 3) * 30} h={15} /><B w={14} h={14} r={999} /></div>)}</div>
    </div>
  );
}

function Content({ b }: { b: Body }): ReactNode {
  switch (b.t) {
    case 'table': return <TableCard t={b.table} />;
    case 'inbox': return <InboxCard />;
    case 'sales': return <SalesBody t={b.table} />;
    case 'timecards': return <TimeCards />;
    case 'waitcards': return <WaitCards />;
    case 'reviews': return <ReviewsBody />;
    case 'tiles': return <Tiles />;
    case 'calendar': return <CalendarCard />;
    case 'report': return <Report />;
    case 'profile': return <Profile />;
  }
}

/** What a page looks like while it loads: the same header, numbers and cards as the real page, in grey. Phones keep the simple stack. */
export function PageSkeleton({ page = 'clients' }: { page?: keyof typeof PRESETS | string }) {
  const p = PRESETS[page] ?? PRESETS.clients;
  return (<>
    <div className="only-d sk-desk" role="status" aria-busy="true" aria-label="Loading" style={{ boxSizing: 'border-box', padding: '28px 32px 40px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      {!p.bare && <Head search={p.search} action={p.action} />}
      {p.periods && <Chips n={4} />}
      {p.stats > 0 && <Stats n={p.stats} delta={p.delta} />}
      <Content b={p.body} />
    </div>
    <div className="only-m sk-page" role="status" aria-busy="true" aria-label="Loading">
      <div className="sk sk-title" />
      <div className="sk sk-sub" />
      <div className="sk-row"><div className="sk sk-stat" /><div className="sk sk-stat" /></div>
      <div className="sk sk-pill" />
      {[0, 1, 2, 3, 4].map((i) => <div key={i} className="sk sk-card" />)}
    </div>
  </>);
}
