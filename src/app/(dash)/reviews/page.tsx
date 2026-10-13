import Link from 'next/link';
import { requireCtx } from '@/lib/session';
import ActionForm from '@/components/ActionForm';
import { dateLong } from '@/lib/format';
import { replyReview, requestReviews } from './actions';

export const metadata = { title: 'Reviews' };

export default async function Reviews({ searchParams }: { searchParams: Promise<{ f?: string; reply?: string }> }) {
  const sp = await searchParams;
  const { sb, salon } = await requireCtx();
  const { data: all } = await sb.from('reviews').select('id,stars,body,reply,replied_at,created_at,clients(name),staff(name)').order('created_at', { ascending: false }).limit(200);
  const list = (all ?? []).filter((r) => sp.f === 'unreplied' ? !r.reply : true);
  const avg = all?.length ? all.reduce((a, r) => a + r.stars, 0) / all.length : 0;
  const unreplied = (all ?? []).filter((r) => !r.reply).length;
  return (
    <>
      <div className="page-head"><div><h1>Reviews</h1><div className="muted">{all?.length ? `${avg.toFixed(1)} average from ${all.length} review${all.length === 1 ? '' : 's'}` : 'No reviews yet'}</div></div>
        <div className="row wrap"><Link className={`btn sm ${sp.f !== 'unreplied' ? 'dark' : ''}`} href="/reviews">All</Link><Link className={`btn sm ${sp.f === 'unreplied' ? 'dark' : ''}`} href="/reviews?f=unreplied">Needs reply ({unreplied})</Link>
          <ActionForm action={requestReviews} submit="Request reviews"><span /></ActionForm></div></div>
      {!list.length ? <div className="card empty">{sp.f === 'unreplied' ? 'Every review has a reply.' : 'Reviews appear here once clients leave them. Use “Request reviews” after completed appointments.'}</div> : (
        <div className="grid g3" style={{ alignItems: 'start' }}>
          {(list as any[]).map((r) => (
            <div className="card" key={r.id} style={{ margin: 0 }}>
              <div className="row between"><span aria-label={`${r.stars} stars`} style={{ color: '#F5A623', letterSpacing: 2 }}>{'★'.repeat(r.stars)}<span style={{ color: 'var(--line2)' }}>{'★'.repeat(5 - r.stars)}</span></span><span className="muted small">{dateLong(r.created_at, salon.timezone)}</span></div>
              <p style={{ margin: '10px 0' }}>{r.body}</p>
              <div className="muted small">{r.clients?.name} · with {r.staff?.name}</div>
              {r.reply && sp.reply !== r.id && <div style={{ marginTop: 12, padding: 12, background: 'var(--bg)', borderRadius: 14 }}><div className="small muted">Your reply</div>{r.reply}
                <div style={{ marginTop: 8 }}><Link className="btn sm" href={`/reviews?${sp.f ? `f=${sp.f}&` : ''}reply=${r.id}`}>Edit reply</Link></div></div>}
              {(!r.reply || sp.reply === r.id) && (
                <details open={sp.reply === r.id} style={{ marginTop: 12 }}><summary className="btn sm" style={{ listStyle: 'none', display: sp.reply === r.id ? 'none' : 'inline-flex' }}>Reply</summary>
                  <ActionForm action={replyReview} submit="Post reply"><input type="hidden" name="id" value={r.id} /><div className="field" style={{ marginTop: 10 }}><textarea name="reply" rows={3} defaultValue={r.reply ?? ''} aria-label="Reply" required /></div></ActionForm></details>)}
            </div>))}
        </div>)}
    </>
  );
}
