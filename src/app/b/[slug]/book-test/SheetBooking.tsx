'use client';
// TEMPORARY test: the customer booking as the same step-by-step sheet the salon uses for "New appointment" (a drawer on a computer, a full sheet on a phone).
// It calls the same actions as the real booking page, so a booking made here is a real booking.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BottomSheet } from '@/components/BottomSheet';
import { Avatar, BLACK, FIELD_IN, Field, OUTLINE, SwitchRow, dim } from '@/components/ui';
import { addDaysYmd, dayInfo, type CalService } from '@/lib/cal';
import { clock12, duration, makeMoney, plural, timeRange } from '@/lib/display';
import { firstName } from '@/lib/people';
import { checkPhone, phoneInput } from '@/lib/phone';
import { S } from '../../../(dash)/calendar/pickers';
import { ServicePicker } from '../../../(dash)/calendar/pickers';
import { DayTimeStep, DetailRows, ICONS, PeopleStep, StepShell, useSteps } from '../../../(dash)/calendar/wizardUi';
import { publicBook, publicSlots, type Slot } from '../book/actions';
import { SalonHeader } from '../SalonHeader';

type Member = { id: string; name: string; role: string; photo: string | null; svc: string[] };
type Props = {
  slug: string; name: string; currency: string; services: CalService[]; team: Member[]; hours: ({ from: string; to: string } | null)[];
  today: string; nowMin: number; windowDays: number; autoConfirm: boolean; account: { name: string; email: string; phone: string } | null;
};
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const TITLES: Record<string, string> = { services: 'Select services', team: 'Select team member', time: 'Select time', details: 'Your details', summary: 'Summary' };

export function SheetBooking(p: Props) {
  const [open, setOpen] = useState(true);
  return (<>
    <div className="cal-root" style={S("min-height:100dvh;box-sizing:border-box;background:#F4F5F7;color:#0E1116;font-family:'Geist',system-ui,sans-serif;font-size:14px;line-height:1.4;padding:24px 20px;display:flex;flex-direction:column;gap:24px;max-width:1180px;margin:0 auto")}>
      <SalonHeader slug={p.slug} name={p.name} subtitle="Test: booking sheet" account={p.account ? { name: p.account.name || p.account.email } : null} />
      <div style={S('display:flex;flex-direction:column;gap:12px;align-items:flex-start')}>
        <p style={S('margin:0;color:#5E6673;font-size:14px;max-width:520px')}>This is a test of the booking flow in the same sheet style as the salon's new appointment sheet. It books for real, with the same rules as the normal booking page.</p>
        <button onClick={() => setOpen(true)} style={S(BLACK + ';flex:0 0 auto;padding:0 24px')}>Open the booking sheet</button>
        <Link href={`/b/${p.slug}/book`} style={S('color:#5E6673;font-size:13.5px')}>Go to the normal booking page</Link>
      </div>
    </div>
    {open && (
      <div className="m-cal cal-root m-drawer" style={S("font-family:'Geist',system-ui,sans-serif;color:#0E1116;font-size:14px;line-height:1.4")}>
        <BottomSheet label="Book an appointment" onClose={() => setOpen(false)} z={60} fixed>
          <Flow p={p} onClose={() => setOpen(false)} />
        </BottomSheet>
      </div>
    )}
  </>);
}

function Flow({ p, onClose }: { p: Props; onClose: () => void }) {
  const money = useMemo(() => makeMoney(p.currency), [p.currency]);
  const [sel, setSel] = useState<string[]>([]);
  const [staff, setStaff] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: p.account?.name ?? '', email: p.account?.email ?? '', phone: p.account?.phone ?? '', notes: '' });
  const [mk, setMk] = useState(false);
  const [hp, setHp] = useState('');
  const [done, setDone] = useState<{ ics?: string; forms?: { names: string[]; url: string }; staffName: string } | null>(null);

  const days = useMemo(() => Array.from({ length: Math.min(p.windowDays, 57) }, (_, i) => {
    const d = dayInfo(addDaysYmd(p.today, i));
    return { ymd: d.ymd, abbr: d.abbr, num: d.num, month: d.month, full: d.full, closed: !p.hours[d.wd] };
  }), [p.today, p.windowDays, p.hours]);
  const firstOpen = days.find((d, i) => { const t = p.hours[dayInfo(d.ymd).wd]; return !!t && (i > 0 || p.nowMin < toMin(t.to)); })?.ymd ?? days[0].ymd;
  const [day, setDay] = useState(firstOpen);
  const [slotKey, setSlotKey] = useState('');
  const [min, setMin] = useState<number | null>(null);

  const list = p.services.filter((s) => sel.includes(s.id));
  const mains = list.filter((s) => !s.addon);
  const totalDur = list.reduce((a, s) => a + s.dur, 0);
  const totalCents = list.reduce((a, s) => a + s.priceCents, 0);
  // Only one person can do what was chosen: nobody to choose between, so that step is left out.
  const able = sel.length ? p.team.filter((t) => mains.every((s) => t.svc.includes(s.id))) : [];
  const lone = able.length === 1 ? able[0].id : null;
  const who = lone ?? staff;
  const member = p.team.find((t) => t.id === who);
  const kinds = ['services', ...(lone ? [] : ['team']), 'time', 'details', 'summary'] as const;
  const at = (k: string) => (kinds as readonly string[]).indexOf(k);
  const { step, jump, forward, back } = useSteps(kinds.length - 1, () => setError(''));
  const kind = kinds[Math.min(step, kinds.length - 1)];

  // Open times for the chosen day; an older answer arriving late is ignored.
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [slotErr, setSlotErr] = useState('');
  const req = useRef(0);
  const hoursToday = p.hours[dayInfo(day).wd];
  useEffect(() => {
    setSlotKey(''); setMin(null);
    if (!sel.length || !who || !hoursToday) { setSlots([]); setLoading(false); setSlotErr(''); return; }
    const id = ++req.current; setLoading(true); setSlotErr('');
    publicSlots(p.slug, day, sel, who).then((r) => { if (id !== req.current) return; setSlots(r.slots); setSlotErr(r.error ?? ''); setLoading(false); })
      .catch(() => { if (id !== req.current) return; setSlots([]); setSlotErr('Could not load times. Please try again.'); setLoading(false); });
  }, [p.slug, sel.join(','), who, day, hoursToday ? 1 : 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = new Map(slots.map((s) => [s.min, s.key]));
  const grid = useMemo(() => {
    if (!hoursToday) return [] as number[];
    const set = new Set<number>(); for (let m = toMin(hoursToday.from); m < toMin(hoursToday.to); m += 30) set.add(m);
    for (const s of slots) set.add(s.min);
    return [...set].sort((a, b) => a - b);
  }, [hoursToday, slots]);

  const pickService = (id: string) => {
    let next = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    // An extra only stays ticked while a service it goes with is still chosen.
    next = next.filter((x) => { const s = p.services.find((y) => y.id === x); return !s?.addon || (s.parents ?? []).some((pid) => next.includes(pid)); });
    const m = p.team.find((t) => t.id === staff);
    if (m && !next.filter((x) => !p.services.find((y) => y.id === x)?.addon).every((x) => m.svc.includes(x))) setStaff('');
    setSel(next); setError('');
  };

  const setField = (k: keyof typeof form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(''); };
  const detailsError = () => {
    if (!form.name.trim()) return 'Please add your name.';
    if (!/\S+@\S+\.\S+/.test(form.email)) return 'Please add a valid email so we can confirm your booking.';
    if (!p.account?.phone) { const ph = checkPhone(form.phone, true); if (ph.error) return ph.error; }
    return '';
  };
  const next = () => {
    const e = kind === 'services' ? (sel.length ? '' : 'Choose a service.') : kind === 'team' ? (who ? '' : 'Choose a team member.') : kind === 'time' ? (slotKey ? '' : 'Choose a time.') : kind === 'details' ? detailsError() : '';
    if (e) { setError(e); return; }
    forward();
  };
  const confirm = async () => {
    if (busy || !slotKey) return;
    setBusy(true); setError('');
    try {
      const r = await publicBook(p.slug, { services: sel, slot: slotKey, name: form.name, email: form.email, phone: form.phone, notes: form.notes, website: hp, marketing: mk });
      if (r.error) { setError(r.error); return; }
      setDone({ ics: r.ics, forms: r.forms ? { names: r.forms.names, url: r.forms.url } : undefined, staffName: r.staffName || member?.name || '' });
    } catch { setError('Something went wrong. Please try again.'); } finally { setBusy(false); }
  };

  const whenText = min !== null ? timeRange(clock12(min), clock12(min + totalDur)) : '';
  if (done) return (
    <StepShell plain step={0} titles={[p.autoConfirm ? 'You are booked' : 'Request sent']} onBack={onClose} onClose={onClose} error={error}
      actions={[...(done.ics ? [{ label: 'Add to calendar', onClick: () => window.location.assign(done.ics!) }] : []), ...(done.forms ? [{ label: 'Complete your form', onClick: () => window.location.assign(done.forms!.url), secondary: !!done.ics }] : []), { label: 'Done', onClick: onClose, secondary: true }]}>
      <p style={S('margin:0;color:#5E6673;font-size:15px')}>{p.autoConfirm ? `We have emailed the details to ${form.email.trim()}.` : `We will email ${form.email.trim()} once the salon confirms.`}</p>
      <DetailRows go={() => {}} rows={[
        { icon: ICONS.day, text: dayInfo(day).full },
        { icon: ICONS.time, text: whenText },
        { icon: ICONS.person, text: done.staffName || 'Your team member' },
        { icon: ICONS.scissors, text: list.map((s) => s.name).join(' + ') },
      ]} />
      <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:4px 2px')}><span style={S('color:#5E6673;font-size:14px')}>Total, pay at the salon</span><span style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{money(totalCents)}</span></div>
    </StepShell>
  );

  return (
    <StepShell step={step} titles={kinds.map((k) => TITLES[k])} onBack={back} onClose={onClose} error={error}
      summary={sel.length > 0 && kind !== 'summary' ? <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px')}><span style={S('color:#5E6673;font-size:14px')}>{plural(sel.length, 'service') + ', ' + duration(totalDur)}</span><span style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{money(totalCents)}</span></div> : undefined}
      actions={kind === 'summary' ? [] : [{ label: 'Continue', onClick: next }]}
      bar={kind === 'summary' ? <button type="button" onClick={confirm} disabled={busy} style={S(BLACK + ';width:100%;flex:0 0 auto' + dim(busy))}>{busy ? 'Booking…' : p.autoConfirm ? 'Confirm booking' : 'Request booking'}</button> : undefined}>
      {kind === 'services' && <ServicePicker services={p.services} selected={sel} chipHeight={44} onPick={pickService} />}

      {kind === 'team' && <PeopleStep any team={p.team} selected={staff} offers={(id) => { const t = p.team.find((x) => x.id === id); return !t || mains.every((s) => t.svc.includes(s.id)); }} onPick={(id) => { setStaff(id || 'any'); setError(''); }} />}

      {kind === 'time' && (<>
        <DayTimeStep days={days} day={day} onDay={(d) => { setDay(d); setError(''); }} slots={grid} why={(t) => (open.has(t) ? '' : 'busy')} time={min} onTime={(t) => { setMin(t); setSlotKey(open.get(t) ?? ''); setError(''); }} />
        {!hoursToday && <div style={S('font-size:14px;color:#5E6673')}>We are closed on {dayInfo(day).weekday}s. Pick another day.</div>}
        {!!hoursToday && !loading && !slots.length && !slotErr && <div style={S('font-size:14px;color:#5E6673')}>No times left on this day. Try another day.</div>}
        {loading && <div style={S('font-size:14px;color:#5E6673')}>Loading times…</div>}
        {!!slotErr && <div style={S('font-size:14px;color:#B42318')}>{slotErr}</div>}
      </>)}

      {kind === 'details' && (<>
        <input tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={hp} onChange={(e) => setHp(e.target.value)} style={S('position:absolute;left:-9999px;width:1px;height:1px;min-height:0;padding:0;opacity:0')} />
        {p.account ? (
          <div style={S('display:flex;align-items:center;gap:14px;padding:16px;border:1px solid #E6E8EC;border-radius:22px')}>
            <Avatar name={p.account.name || p.account.email} size="xl" />
            <div style={S('min-width:0')}><div style={S('font-size:19px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{p.account.name || p.account.email}</div><div style={S('margin-top:2px;font-size:13.5px;color:#5E6673;overflow-wrap:anywhere')}>{p.account.email}</div></div>
          </div>
        ) : (<>
          <Field label="Full name" htmlFor="sb-name"><input id="sb-name" type="text" autoComplete="name" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Your name" style={FIELD_IN} /></Field>
          <Field label="Email" htmlFor="sb-email"><input id="sb-email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="you@example.com" style={FIELD_IN} /></Field>
          {!p.account && <Field label="Phone" htmlFor="sb-phone"><input id="sb-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setField('phone', phoneInput(e.target.value))} placeholder="Required" style={FIELD_IN} /></Field>}
        </>)}
        <Field label="Notes for the salon" htmlFor="sb-notes"><textarea id="sb-notes" value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Optional" rows={3} style={{ ...FIELD_IN, resize: 'none' }} /></Field>
        <div style={S('padding:0 16px;border:1px solid #E6E8EC;border-radius:22px')}><SwitchRow id="sb-mk" title="Send me offers and news" sub={'An occasional email. You can unsubscribe at any time.'} on={mk} toggle={() => setMk(!mk)} last /></div>
        <p style={S('margin:0;font-size:13px;color:#5E6673')}>You pay at the salon after your appointment.</p>
      </>)}

      {kind === 'summary' && (<>
        <div style={S('display:flex;align-items:center;gap:14px;padding:16px;border:1px solid #E6E8EC;border-radius:22px')}>
          <Avatar name={form.name.trim() || p.account?.name || '?'} size="xl" />
          <div style={S('min-width:0')}><div style={S('font-size:19px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere')}>{form.name.trim() || p.account?.name}</div><div style={S('margin-top:2px;font-size:13.5px;color:#5E6673;overflow-wrap:anywhere')}>{form.email.trim()}</div></div>
          <button onClick={() => jump(at('details'))} style={S('flex:0 0 auto;margin-left:auto;height:36px;padding:0 14px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;font:inherit;font-size:13.5px;font-weight:500;cursor:pointer')}>Change</button>
        </div>
        <DetailRows go={jump} rows={[
          { icon: ICONS.day, text: dayInfo(day).full, step: at('time') },
          { icon: ICONS.time, text: whenText, step: at('time') },
          { icon: ICONS.person, text: member ? member.name : 'First available team member', step: lone ? undefined : at('team') },
        ]} />
        <div style={S('display:flex;flex-direction:column;gap:10px')}>
          <div style={S('display:flex;align-items:center;justify-content:space-between')}><h3 style={S('margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em')}>Services</h3><button onClick={() => jump(at('services'))} style={S('border:0;background:transparent;font:inherit;font-size:14px;font-weight:500;text-decoration:underline;cursor:pointer')}>Change</button></div>
          {list.map((v) => (
            <div key={v.id} style={S('display:flex;align-items:center;gap:12px')}>
              <span style={S('flex:0 0 4px;align-self:stretch;border-radius:999px;background:#B9AEFB')} />
              <span style={S('flex:1 1 auto;min-width:0')}><span style={S('display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere')}>{v.name}</span><span style={S('display:block;font-size:13px;color:#5E6673')}>{duration(v.dur)}</span></span>
              <span style={S('flex:0 0 auto;font-size:14.5px;font-weight:500')}>{money(v.priceCents)}</span>
            </div>
          ))}
          <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-top:10px;border-top:1px solid #EEF0F3')}><span style={S('color:#5E6673')}>Total, pay at the salon</span><span style={S('font-size:20px;font-weight:600;letter-spacing:-0.02em')}>{money(totalCents)}</span></div>
        </div>
      </>)}
    </StepShell>
  );
}
