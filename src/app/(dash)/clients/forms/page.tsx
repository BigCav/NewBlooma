import { requireCtx } from '@/lib/session';
import { dateLong, time12, ymd } from '@/lib/format';
import { loadSubs, loadTemplates } from '@/lib/forms';
import { formRows, niceDate, type FormRow } from '@/lib/forms-shared';
import { ClientFormsView, type ClientCard, type DoneRow, type RowVM } from './ClientFormsView';

export const metadata = { title: 'Client forms' };
export const dynamic = 'force-dynamic';

const initials = (n: string) => n.split(' ').filter((w) => /[A-Za-z0-9]/.test(w[0] ?? '')).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'C';

export default async function ClientForms({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const { sb, salon, staff } = await requireCtx();
  const tz = salon.timezone;
  const tpls = await loadTemplates(sb, salon.id);
  const { data: bk } = await sb.from('bookings')
    .select('id,ref_no,client_id,starts_at,status,staff(name),clients(name,email),booking_services(services(name,category_id))')
    .in('status', ['pending', 'confirmed', 'checked_in', 'in_progress']).gte('starts_at', new Date(Date.now() - 6 * 3600e3).toISOString()).order('starts_at').limit(80);
  const upcoming = ((bk ?? []) as any[]).filter((b) => b.client_id);
  const subs = await loadSubs(sb, [...new Set(upcoming.map((b) => b.client_id as string))]);
  const stamp = (iso: string) => `${niceDate(ymd(iso, tz))}, ${time12(iso, tz)}`;

  const cards: ClientCard[] = upcoming.map((b) => {
    const lines = (b.booking_services ?? []) as any[];
    const when = `${dateLong(b.starts_at, tz)}, ${time12(b.starts_at, tz)}`;
    const svc = lines.map((l) => l.services?.name).filter(Boolean).join(' + ');
    const who = (b.staff?.name ?? '').split(' ')[0];
    const first = (b.clients?.name ?? 'Client').split(' ')[0];
    const rows: FormRow[] = formRows(tpls, subs.filter((s) => s.client_id === b.client_id), { id: b.id, dayYmd: ymd(b.starts_at, tz), catIds: [...new Set(lines.map((l) => l.services?.category_id).filter(Boolean))] as string[] }, tz, ymd);
    const vms: RowVM[] = rows.map((r): RowVM => {
      const open = r.needed && (r.state === 'missing' || r.state === 'expired');
      let line = '';
      if (r.state === 'valid') line = `${r.sub?.performed_on ? 'Applied ' + niceDate(r.sub.performed_on) + ' · recorded' : r.tpl.how === 'staff' ? 'Recorded' : 'Completed'} ${stamp(r.sub!.completed_at)}${r.until ? ' · valid until ' + niceDate(r.until) : ' · for this visit'}${r.sub?.booking_ref ? ' · booking B-' + r.sub.booking_ref : ''}${r.sub?.answers.find((a) => /^Result/.test(a.q)) ? ' · ' + r.sub.answers.find((a) => /^Result/.test(a.q))!.a : ''}`;
      else if (r.state === 'expired') line = `Last done ${niceDate(r.doneOn!)} · expired ${r.until ? niceDate(r.until) : 'after that visit'}`;
      else if (r.state === 'reaction') line = `Recorded ${niceDate(r.doneOn!)} · reaction, check before treating`;
      else if (r.state === 'missing') line = r.tpl.how === 'staff' ? 'Needs a staff member to do it and record the result' : 'Not yet completed';
      else line = r.doneOn ? `Last done ${niceDate(r.doneOn)}` : 'Not needed for the booked service';
      return {
        tplId: r.tpl.id, name: r.tpl.name, how: r.tpl.how, isPatch: r.tpl.isPatch, needed: r.needed, state: r.state, line,
        canSend: open && r.tpl.how === 'client', canFill: open && !(r.tpl.how === 'staff' && r.tpl.isPatch), canRecord: r.tpl.isPatch && r.tpl.how === 'staff' && (r.needed || !!r.sub),
        answers: (r.sub?.answers ?? []).map((a) => ({ k: a.q, v: a.a || 'No answer' })),
      };
    });
    const reaction = rows.find((r) => r.needed && r.state === 'reaction');
    const todo = rows.filter((r) => r.needed && (r.state === 'missing' || r.state === 'expired'));
    const level: ClientCard['level'] = reaction ? 'alert' : todo.length ? 'todo' : 'ok';
    const banner = level === 'alert'
      ? { title: 'Reaction recorded. Check before treating.', text: `${reaction!.tpl.name} on ${niceDate(reaction!.doneOn!)} showed a reaction. Talk to ${first} before ${when} and choose a different service or product.` }
      : level === 'todo'
        ? { title: `${todo.length} ${todo.length === 1 ? 'form' : 'forms'} needed before ${when}`, text: `${svc} with ${who} needs: ${todo.map((r) => r.tpl.name.toLowerCase()).join(', ')}.` }
        : { title: `All set for ${when}`, text: `${svc} with ${who}. Every form it needs is up to date.` };
    return { id: b.id, clientId: b.client_id, dayYmd: ymd(b.starts_at, tz), ref: 'B-' + b.ref_no, time: time12(b.starts_at, tz), name: b.clients?.name ?? 'Client', init: initials(b.clients?.name ?? 'Client'), email: b.clients?.email ?? '', bookingId: b.id, when, svc, who, level, todoCount: todo.length, banner, rows: vms, sendable: todo.filter((r) => r.tpl.how === 'client').length };
  });
  const { data: recent } = await sb.from('form_submissions').select('id,client_id,answers,flagged,performed_on,completed_at,form_templates(name),clients(name),staff:recorded_by(name),bookings(ref_no)').order('completed_at', { ascending: false }).limit(60);
  const done: DoneRow[] = ((recent ?? []) as any[]).map((s) => ({ id: s.id, clientId: s.client_id, client: s.clients?.name ?? 'Client', form: s.form_templates?.name ?? 'Form', date: (s.performed_on ? `Applied ${niceDate(s.performed_on)} · recorded ` : '') + stamp(s.completed_at), ref: s.bookings?.ref_no ? 'Booking B-' + s.bookings.ref_no : '', by: s.staff?.name ? 'Recorded by ' + s.staff.name : 'Completed by the client', flagged: !!s.flagged, answers: ((s.answers ?? []) as { q: string; a: string }[]).map((a) => ({ k: a.q, v: a.a || 'No answer' })) }));
  const pickId = cards.find((x) => x.clientId === c && x.level !== 'ok')?.id ?? cards.find((x) => x.clientId === c)?.id ?? cards.find((x) => x.level !== 'ok')?.id ?? cards[0]?.id ?? '';
  return <ClientFormsView cards={cards} done={done} initial={pickId} hasForms={tpls.length > 0} owner={staff.app_role === 'owner'} today={ymd(new Date(), tz)} />;
}
