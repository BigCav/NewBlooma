'use client';
import { useState, useTransition } from 'react';
import { BLACK, FieldError, OUTLINE, dim } from '@/components/ui';
import { CardText } from '@/app/b/[slug]/PublicCard';
import { S } from '@/app/(dash)/calendar/pickers';
import { setMarketing } from './actions';

export function UnsubscribeForm({ token, salon, subscribed }: { token: string; salon: string; subscribed: boolean }) {
  const [on, setOn] = useState(subscribed);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, start] = useTransition();
  const go = (next: boolean) => start(async () => {
    const r = await setMarketing(token, next).catch(() => ({ ok: false }));
    if (!r.ok) { setError('That did not work. Please try again in a moment.'); return; }
    setError(''); setOn(next); setDone(true);
  });
  return (<>
    <CardText>{on ? `You are on the list for offers and news from ${salon}.` : done ? `You are unsubscribed. ${salon} will not send you offers or news.` : `You are not receiving offers or news from ${salon}.`}</CardText>
    {on
      ? <button type="button" onClick={() => go(false)} disabled={busy} style={S(BLACK + ';flex:0 0 auto' + dim(busy))}>{busy ? 'Please wait…' : 'Unsubscribe'}</button>
      : <button type="button" className="ghost" onClick={() => go(true)} disabled={busy} style={S(OUTLINE + ';flex:0 0 auto' + dim(busy))}>{busy ? 'Please wait…' : done ? 'Changed your mind? Subscribe again' : 'Subscribe'}</button>}
    {!!error && <FieldError>{error}</FieldError>}
    <CardText small>Booking confirmations and reminders are not affected.</CardText>
  </>);
}
