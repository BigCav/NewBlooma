import type { CalHours, CalService, CalSettings } from '@/lib/cal';

// The parts of the calendar's data that do not depend on which day is on screen. Shared by the calendar page and the global "new appointment" sheet.

export function buildHours(oh: any[] | null): CalHours[] {
  const mm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return Array.from({ length: 7 }, (_, wd) => { const r = (oh ?? []).find((h) => h.weekday === wd); return { wd, open: !!r?.is_open, from: r?.is_open ? mm(r.open_time) : 8 * 60, to: r?.is_open ? mm(r.close_time) : 18 * 60 }; });
}

export function buildServices(svc: any[] | null, sa: any[] | null): CalService[] {
  return (svc ?? []).map((s: any) => ({ id: s.id, name: s.name, dur: s.duration_min, priceCents: s.price_cents, cat: s.service_categories?.name ?? 'Services', addon: !!s.is_addon, parents: (sa ?? []).filter((l: any) => l.addon_id === s.id).map((l: any) => l.service_id) }));
}

export function buildOffers(ss: any[] | null): Record<string, string[]> {
  const offers: Record<string, string[]> = {};
  for (const r of ss ?? []) (offers[r.service_id] ??= []).push(r.staff_id);
  return offers;
}

export function buildCfg(settings: Record<string, any>, role: string): CalSettings {
  return { taxRate: Number(settings.tax_rate ?? 15), taxInclusive: settings.tax_inclusive !== false, askTip: settings.ask_for_tip !== false, tipDefault: Number(settings.suggested_tip_pct ?? 0), acceptCard: settings.accept_card !== false, acceptCash: settings.accept_cash !== false, acceptGift: settings.accept_gift_cards !== false, canDiscount: role !== 'stylist' };
}

export function buildRecent(rc: any[] | null): { id: string; name: string }[] {
  const seen = new Set<string>(); const recent: { id: string; name: string }[] = [];
  for (const r of rc ?? []) { if (!r.client_id || seen.has(r.client_id) || !r.clients?.name) continue; seen.add(r.client_id); recent.push({ id: r.client_id, name: r.clients.name }); if (recent.length >= 8) break; }
  return recent;
}
