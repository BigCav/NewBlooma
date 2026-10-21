'use client';
import { useEffect, useState } from 'react';
import { S } from './pickers';
import { findClients, type ClientHit } from './actions';

/** Live list of existing clients matching what is typed in the client box. Tapping one picks that client. */
export function ClientMatches({ query, pickedId, onPick, mobile }: { query: string; pickedId: string | null; onPick: (c: ClientHit) => void; mobile?: boolean }) {
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [doneFor, setDoneFor] = useState('');
  const q = query.trim();
  useEffect(() => {
    if (!q || pickedId) { setHits([]); return; }
    let live = true;
    const t = setTimeout(() => { findClients(q).then((r) => { if (live) { setHits(r); setDoneFor(q); } }).catch(() => { if (live) { setHits([]); setDoneFor(q); } }); }, 150);
    return () => { live = false; clearTimeout(t); };
  }, [q, pickedId]);
  if (!q || pickedId) return null;
  if (!hits.length) return doneFor !== q ? null : <div style={S('font-size:13px;color:#5E6673;padding:2px 2px 0')}>No existing client with that name. A new client will be added.</div>;
  return (
    <ul role="listbox" aria-label="Matching clients" style={S('margin:0;padding:4px;list-style:none;border:1px solid #E6E8EC;border-radius:16px;background:#FFFFFF;display:flex;flex-direction:column')}>
      {hits.map((h) => (
        <li key={h.id}><button role="option" aria-selected="false" onClick={() => onPick(h)} className="ghost" style={S('display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;box-sizing:border-box;min-height:' + (mobile ? 48 : 44) + 'px;padding:6px 12px;border:0;border-radius:12px;background:transparent;text-align:left;font:inherit;color:#0E1116;cursor:pointer')}>
          <span style={S('font-size:14px;font-weight:600;overflow-wrap:anywhere')}>{h.name}</span>
          <span style={S('font-size:12.5px;color:#5E6673;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0')}>{h.sub}</span>
        </button></li>
      ))}
    </ul>
  );
}
