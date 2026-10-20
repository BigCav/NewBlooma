'use client';
import { useState, type CSSProperties } from 'react';
import type { CalService, CalStaff } from '@/lib/cal';
import { initials } from '@/lib/cal';

// Converts the prototype's inline style strings to React style objects, so the markup keeps the exact values.
const cache = new Map<string, CSSProperties>();
export function S(css: string): CSSProperties {
  let o = cache.get(css);
  if (o) return o;
  o = {};
  for (const part of css.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (!k) continue;
    (o as any)[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  cache.set(css, o);
  return o;
}

/* ---- ServicePicker (ServicePicker.dc.html) ---- */
export function ServicePicker({ services, selected, onPick, onCat, initialCat, chipHeight = 44, note, lock }: {
  services: CalService[]; selected: string[]; onPick: (id: string) => void; onCat?: (c: string) => void; initialCat?: string; chipHeight?: number; note?: (s: CalService) => string; lock?: (s: CalService) => string;
}) {
  const cats = Array.from(new Set(services.map((x) => x.cat)));
  const first = services.find((x) => x.id === selected[0]);
  const [cat, setCat] = useState(initialCat || first?.cat || cats[0] || '');
  const h = chipHeight;
  const chip = (on: boolean) => 'flex:0 0 auto;height:' + h + 'px;padding:0 ' + (h < 44 ? 16 : 18) + 'px;border-radius:999px;font-size:' + (h < 44 ? 13.5 : 14) + 'px;font-weight:500;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#0E1116' : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#0E1116');
  return (
    <div style={S("display:flex;flex-direction:column;gap:10px;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;color:#0E1116")}>
      <div role="group" aria-label="Service type" className="hscroll" style={S('display:flex;gap:8px;overflow-x:auto;flex:0 0 auto')}>
        {cats.map((c) => {
          const n = services.filter((x) => x.cat === c && selected.includes(x.id)).length;
          return <button key={c} onClick={() => { setCat(c); onCat?.(c); }} aria-pressed={cat === c} style={S(chip(cat === c))}>{c + (n ? ' · ' + n : '')}</button>;
        })}
      </div>
      <div role="group" aria-label="Services" style={S('display:flex;flex-direction:column;gap:8px')}>
        {services.filter((x) => x.cat === cat).map((x) => {
          const on = selected.includes(x.id);
          const why = !on ? (lock?.(x) ?? '') : '';
          const nt = why || (note?.(x) ?? '');
          return (
            <button key={x.id} onClick={() => { if (!why) onPick(x.id); }} aria-pressed={on} aria-disabled={!!why}
              style={S('width:100%;box-sizing:border-box;min-height:56px;padding:10px 16px;border-radius:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;font:inherit;cursor:' + (why ? 'default' : 'pointer') + ';opacity:' + (why ? 0.55 : 1) + ';color:#0E1116;border:1px solid ' + (on ? '#0E1116' : '#E1E4E9') + ';background:' + (on ? '#F4F5F7' : '#FFFFFF') + (on ? ';box-shadow:inset 0 0 0 1px #0E1116' : ''))}>
              <span style={S('min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600')}>{x.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{x.dur + ' min' + (nt ? ', ' + nt : '')}</span></span>
              <span style={S('flex:0 0 auto;display:flex;align-items:center;gap:10px')}><span style={S('font-size:15px;font-weight:500')}>{'$' + x.priceCents / 100}</span>
                {on && <span aria-hidden="true" style={S('flex:0 0 22px;width:22px;height:22px;border-radius:999px;background:#0E1116;display:flex;align-items:center;justify-content:center')}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19 7.5" /></svg></span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---- TeamPicker (TeamPicker.dc.html) ---- */
export function TeamPicker({ team, selected, onPick, anyLabel, offers }: {
  team: CalStaff[]; selected: string; onPick: (id: string) => void; anyLabel?: string; offers?: (staffId: string) => boolean;
}) {
  const list: { id: string; name: string; role: string; isAny?: boolean }[] = [];
  if (anyLabel) list.push({ id: 'any', name: anyLabel, role: 'Whoever is free first', isAny: true });
  team.forEach((m) => list.push({ id: m.id, name: m.name, role: m.role || 'Team member' }));
  const n = list.length;
  return (
    <div role="group" aria-label="Team member" style={S("display:flex;flex-direction:column;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:20px;overflow:hidden;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;color:#0E1116")}>
      {list.map((m, i) => {
        const off = !m.isAny && !!offers && !offers(m.id);
        const on = selected === m.id && !off;
        const textColor = off ? '#8A93A0' : '#0E1116', subColor = off ? '#A3AAB5' : '#5E6673';
        return (
          <button key={m.id} onClick={() => { if (off) return; onPick(!on || m.isAny ? m.id : ''); }} disabled={off} aria-pressed={on}
            style={S('display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;min-height:60px;padding:10px 16px;border:0;' + (i < n - 1 ? 'border-bottom:1px solid #EEF0F3;' : '') + 'text-align:left;font:inherit;background:' + (on ? '#F4F5F7' : (off ? '#FAFBFC' : 'transparent')))}>
            <span style={{ ...S('flex:0 0 40px;width:40px;height:40px;border-radius:999px;background:#EEF0F3;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600'), color: textColor }}>
              {!m.isAny && initials(m.name)}
              {m.isAny && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1116" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18.5 14.8c1.6.8 2.6 2.4 3 5.2" /></svg>}
            </span>
            <span style={{ ...S('flex:1 1 auto;min-width:0'), color: textColor }}>
              <span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{m.name}</span>
              <span style={{ ...S('display:block;font-size:13px'), color: subColor }}>{off ? 'Does not offer this service' : m.role}</span>
            </span>
            <span aria-hidden="true" style={S('flex:0 0 24px;width:24px;height:24px;border-radius:999px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border:1.5px solid ' + (on ? '#0E1116' : (off ? '#E6E8EC' : '#D5D9E0')) + ';background:' + (on ? '#0E1116' : '#FFFFFF'))}>
              {on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19 7.5" /></svg>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
