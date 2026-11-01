import type { CSSProperties, ReactNode } from 'react';

type Kind = 'list' | 'grid' | 'tiles' | 'calendar' | 'report';

const B = ({ w, h, r = 12, s }: { w: number | string; h: number; r?: number; s?: CSSProperties }) => <div className="sk" style={{ width: w, height: h, borderRadius: r, flex: '0 0 auto', maxWidth: '100%', ...s }} />;
const CARD: CSSProperties = { background: '#FFFFFF', border: '1px solid #E6E8EC', borderRadius: 24, overflow: 'hidden', boxSizing: 'border-box' };

function Head({ action, search }: { action: boolean; search: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
      <div><B w={190} h={34} /><B w={270} h={16} s={{ marginTop: 10 }} /></div>
      <div style={{ display: 'flex', gap: 10 }}>{search && <B w={280} h={44} r={999} />}{action && <B w={170} h={44} r={999} />}</div>
    </div>
  );
}

const Stats = ({ n }: { n: number }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 64px' }}>
    {Array.from({ length: n }, (_, i) => <div key={i}><B w={96} h={14} /><B w={110} h={38} s={{ marginTop: 8 }} /></div>)}
  </div>
);

const Chips = ({ n }: { n: number }) => (
  <div style={{ display: 'flex', gap: 8 }}>{Array.from({ length: n }, (_, i) => <B key={i} w={i === 0 ? 64 : 96 + (i % 2) * 24} h={40} r={999} />)}</div>
);

function Rows({ n }: { n: number }) {
  return (<>{Array.from({ length: n }, (_, i) => (
    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', borderTop: '1px solid #EEF0F3' }}>
      <B w={44} h={44} r={999} />
      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}><B w={150 + (i % 3) * 30} h={15} /><B w={`${40 + (i % 4) * 10}%`} h={12} /></div>
      <B w={70} h={14} />
    </div>
  ))}</>);
}

function Body({ kind }: { kind: Kind }): ReactNode {
  if (kind === 'list') return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 20px' }}><Chips n={4} /><B w={90} h={14} /></div>
      <Rows n={6} />
    </div>
  );
  if (kind === 'grid') return (<>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><Chips n={2} /><B w={300} h={44} r={999} /></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(400px,1fr))', gap: 16 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...CARD, padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><B w={40} h={40} r={999} /><div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><B w={110} h={14} /><B w={70} h={12} /></div></div>
          <B w={130} h={34} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>{Array.from({ length: 7 }, (_, k) => <B key={k} w="100%" h={38} />)}</div>
          <B w={150} h={13} />
        </div>
      ))}
    </div>
  </>);
  if (kind === 'tiles') return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 16, minHeight: 92, padding: '18px 20px' }}>
          <B w={48} h={48} r={16} /><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><B w={130} h={16} /><B w={190} h={13} /></div>
        </div>
      ))}
    </div>
  );
  if (kind === 'calendar') return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px' }}><B w={40} h={40} r={999} /><B w={40} h={40} r={999} /><B w={140} h={18} /><div style={{ flex: '1 1 auto' }} /><Chips n={4} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(3,1fr)', borderTop: '1px solid #EEF0F3' }}>
        <div />{[0, 1, 2].map((i) => <div key={i} style={{ padding: '16px 20px', display: 'flex', gap: 10, alignItems: 'center' }}><B w={36} h={36} r={999} /><B w={100} h={14} /></div>)}
        {Array.from({ length: 6 }, (_, r) => [<div key={'t' + r} style={{ padding: '30px 10px' }}><B w={40} h={11} /></div>, ...[0, 1, 2].map((c) => <div key={r + '-' + c} style={{ borderTop: '1px solid #EEF0F3', borderLeft: '1px solid #EEF0F3', height: 72 }} />)])}
      </div>
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(420px,1fr))', gap: 16 }}>
      {[0, 1].map((i) => <div key={i} style={{ ...CARD, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}><B w={160} h={18} /><B w="100%" h={220} r={16} /></div>)}
    </div>
  );
}

/** What a page looks like while it loads: the same header, numbers and cards as the real page, in grey. Phones keep the simple stack. */
export function PageSkeleton({ kind = 'list', stats = 3, action = false, search = true }: { kind?: Kind; stats?: number; action?: boolean; search?: boolean }) {
  return (<>
    <div className="only-d sk-desk" role="status" aria-busy="true" aria-label="Loading" style={{ boxSizing: 'border-box', padding: '28px 32px 40px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <Head action={action} search={search} />
      {stats > 0 && kind !== 'tiles' && <Stats n={stats} />}
      <Body kind={kind} />
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
