'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FieldError, Notice, dim } from '@/components/ui';
import { S } from '../calendar/pickers';
import { addSalonPhoto, makeMainPhoto, removeSalonPhoto, type SalonPhoto } from './photos';
import { resizeForPage } from './photoResize';

const MAX = 5;
const BTN = 'flex:1 1 0;height:36px;padding:0 10px;border:1px solid #E1E4E9;border-radius:999px;background:#FFFFFF;color:#0E1116;font:inherit;font-size:13px;font-weight:500;cursor:pointer';

/** The pictures at the top of the public booking page. Each change saves straight away; the first picture is the large one. */
export function PhotosSection({ initial }: { initial: SalonPhoto[] }) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ask, setAsk] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const add = async (files: FileList | null) => {
    const picked = Array.from(files ?? []).slice(0, MAX - list.length);
    if (!picked.length) return;
    setBusy(true); setMsg(null);
    let next = list, fail = '';
    for (const f of picked) {
      try {
        const blob = await resizeForPage(f);
        const fd = new FormData(); fd.append('photo', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
        const r = await addSalonPhoto(fd);
        if (r.error) { fail = r.error; break; }
        next = [...next, r.photo!]; setList(next);
      } catch { fail = 'Could not read that photo. Try a JPG or PNG.'; break; }
    }
    setBusy(false);
    const added = next.length - list.length;
    setMsg(fail ? { ok: false, text: fail } : { ok: true, text: added === 1 ? 'Photo added' : `${added} photos added` });
    if (input.current) input.current.value = '';
    router.refresh();
  };
  const remove = async (id: string) => {
    setBusy(true); setMsg(null); setAsk(null);
    const r = await removeSalonPhoto(id);
    setBusy(false);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setList((l) => l.filter((x) => x.id !== id)); setMsg({ ok: true, text: r.notice ?? '' }); router.refresh();
  };
  const main = async (id: string) => {
    setBusy(true); setMsg(null);
    const r = await makeMainPhoto(id);
    setBusy(false);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setList((l) => { const x = l.find((p) => p.id === id); return x ? [x, ...l.filter((p) => p.id !== id)] : l; }); setMsg({ ok: true, text: r.notice ?? '' }); router.refresh();
  };

  return (<>
    <p style={S('margin:0;font-size:13px;color:#5E6673')}>These show at the top of your booking page, up to {MAX}. The first one is the large picture. Until you add them, the page shows simple illustrations.</p>
    <ul style={S('margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px')}>
      {list.map((p, i) => (
        <li key={p.id} style={S('box-sizing:border-box;background:#FFFFFF;border:1px solid #E6E8EC;border-radius:20px;padding:10px;display:flex;flex-direction:column;gap:10px')}>
          <div style={S('position:relative;aspect-ratio:4/3;border-radius:14px;overflow:hidden;background:#EEF0F3')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`Salon photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {i === 0 && <span style={S('position:absolute;left:8px;top:8px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,0.92);font-size:12px;font-weight:600')}>Main photo</span>}
          </div>
          {ask === p.id ? (
            <div style={S('display:flex;gap:8px')}>
              <button type="button" onClick={() => remove(p.id)} disabled={busy} style={S(BTN + ';background:#B42318;border-color:#B42318;color:#FFFFFF' + dim(busy))}>Remove</button>
              <button type="button" onClick={() => setAsk(null)} style={S(BTN)}>Keep</button>
            </div>
          ) : (
            <div style={S('display:flex;gap:8px')}>
              {i > 0 && <button type="button" onClick={() => main(p.id)} disabled={busy} style={S(BTN + dim(busy))}>Make main</button>}
              <button type="button" onClick={() => setAsk(p.id)} disabled={busy} aria-label={`Remove photo ${i + 1}`} style={S(BTN + dim(busy))}>Remove</button>
            </div>
          )}
        </li>
      ))}
      {list.length < MAX && (
        <li>
          <button type="button" className="ghost" onClick={() => input.current?.click()} disabled={busy} style={S('width:100%;aspect-ratio:4/3;min-height:140px;box-sizing:border-box;border:1.5px dashed #C9CED6;border-radius:20px;background:transparent;color:#0E1116;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer' + dim(busy))}>{busy ? 'Uploading…' : list.length ? 'Add a photo' : 'Add photos'}</button>
        </li>
      )}
    </ul>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => add(e.target.files)} />
    {msg && (msg.ok ? <Notice>{msg.text}</Notice> : <FieldError>{msg.text}</FieldError>)}
    <p style={S('margin:0;font-size:13px;color:#5E6673')}>Use photos of your own salon and work. Photos are shrunk automatically before they upload.</p>
  </>);
}
