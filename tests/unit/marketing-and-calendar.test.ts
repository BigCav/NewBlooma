import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { googleCalUrl, icsFile } from '@/lib/ics';
import { birthdayDate, birthdayParts, fillTokens } from '@/lib/marketing-shared';
import { renderMarketing } from '@/lib/marketing';

const EV = { uid: 'booking-1@aster', start: '2026-11-12T01:30:00Z', end: '2026-11-12T02:45:00Z', title: 'Cut, colour & style at Aster', description: 'With Mia\nBooking AB12', location: '1 High St, Sydney', url: 'https://x.test/manage/t' };

describe('calendar file', () => {
  it('writes a valid event in UTC with CRLF line ends', () => {
    const f = icsFile(EV, new Date('2026-11-05T00:00:00Z'));
    expect(f.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(f).toContain('\r\nUID:booking-1@aster\r\n');
    expect(f).toContain('\r\nDTSTART:20261112T013000Z\r\n');
    expect(f).toContain('\r\nDTEND:20261112T024500Z\r\n');
    expect(f).toContain('\r\nDTSTAMP:20261105T000000Z\r\n');
    expect(f.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true);
    expect(f.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });
  it('escapes commas, semicolons and new lines in text', () => {
    const f = icsFile(EV);
    expect(f).toContain('SUMMARY:Cut\\, colour & style at Aster');
    expect(f).toContain('DESCRIPTION:With Mia\\nBooking AB12');
    expect(f).toContain('LOCATION:1 High St\\, Sydney');
  });
  it('folds long lines at 75 bytes without splitting a character', () => {
    const f = icsFile({ ...EV, description: 'é'.repeat(120) });
    for (const line of f.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(f.replace(/\r\n /g, '')).toContain('DESCRIPTION:' + 'é'.repeat(120));
  });
  it('builds a Google Calendar link with the same times', () => {
    const u = new URL(googleCalUrl(EV));
    expect(u.hostname).toBe('calendar.google.com');
    expect(u.searchParams.get('dates')).toBe('20261112T013000Z/20261112T024500Z');
    expect(u.searchParams.get('text')).toBe(EV.title);
    expect(u.searchParams.get('location')).toBe(EV.location);
  });
});

describe('birthdays', () => {
  it('accepts real days, including 29 February, and nothing else', () => {
    expect(birthdayDate(3, 14)).toBe('2000-03-14');
    expect(birthdayDate(2, 29)).toBe('2000-02-29');
    expect(birthdayDate(2, 30)).toBeNull();
    expect(birthdayDate(4, 31)).toBeNull();
    expect(birthdayDate(13, 1)).toBeNull();
    expect(birthdayDate(0, 1)).toBeNull();
    expect(birthdayDate(1.5, 1)).toBeNull();
  });
  it('reads a stored birthday back', () => {
    expect(birthdayParts('2000-03-14')).toEqual({ month: 3, day: 14 });
    expect(birthdayParts(null)).toBeNull();
    expect(birthdayParts('')).toBeNull();
  });
});

describe('marketing message', () => {
  const salon = { name: 'Aster & Co <b>', phone: '021 000', slug: 'aster' };
  it('fills the first name and salon name', () => {
    expect(fillTokens('Hi {first}, from {SALON}', { first: 'Mia', salon: 'Aster' })).toBe('Hi Mia, from Aster');
  });
  it('carries an unsubscribe link and a book button, and escapes hostile text', () => {
    const m = renderMarketing({ salon, subject: 'Hello', heading: '<img src=x>', body: 'Hi {first} <script>alert(1)</script>', first: 'Mia', unsubUrl: 'https://x.test/unsubscribe/abc' });
    expect(m.html).toContain('https://x.test/unsubscribe/abc');
    expect(m.html).toContain('/b/aster');
    expect(m.html).not.toContain('<script>');
    expect(m.html).not.toContain('<img src=x>');
    expect(m.html).toContain('Hi Mia');
    expect(m.text).toContain('Unsubscribe: https://x.test/unsubscribe/abc');
    expect(m.text).toContain('Book online:');
  });
  it('marks the owner’s test copy and has no unsubscribe link', () => {
    const m = renderMarketing({ salon, subject: '[Test] Hello', heading: 'Hello', body: 'Hi {first}', first: 'Cav', unsubUrl: null, test: true });
    expect(m.text).toContain('This is a test');
    expect(m.text).not.toContain('Unsubscribe:');
  });
});
