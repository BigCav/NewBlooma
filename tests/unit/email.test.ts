import { describe, expect, it } from 'vitest';
import { esc, mailButton, mailButtonPair, mailDetails, mailNote, mailP, mailShell, textDetails } from '@/lib/email-layout';

const EVIL = '<img src=x onerror=alert(1)>"&';

describe('email layout', () => {
  it('escapes hostile text everywhere a person can type into an email', () => {
    const html = mailShell({
      brand: EVIL, heading: EVIL, footer: EVIL, preheader: EVIL,
      body: mailP(EVIL) + mailNote(EVIL) + mailDetails([[EVIL, EVIL]]) + mailButton(EVIL, 'https://x.test/?a="><script>') + mailButtonPair({ label: EVIL, url: '"' }, { label: EVIL, url: '"' }),
    });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onerror=alert(1)>');
    expect(html).toContain('&lt;img');
  });

  it('esc handles every special character', () => {
    expect(esc('<>&"')).toBe('&lt;&gt;&amp;&quot;');
  });

  it('details skip empty values and render nothing when all are empty', () => {
    expect(mailDetails([['A', ''], ['B', null], ['C', undefined]])).toBe('');
    expect(mailDetails([['Service', 'Cut'], ['With', '']])).toContain('Cut');
    expect(mailDetails([['Service', 'Cut'], ['With', '']])).not.toContain('With');
    expect(textDetails([['Service', 'Cut'], ['With', '']])).toBe('Service: Cut');
  });

  it('every email is a full document with one brand label and its footer', () => {
    const html = mailShell({ brand: 'Cavco Hair', heading: 'Hi', body: mailP('x'), footer: 'Cavco Hair · B-1' });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('Cavco Hair · B-1');
    expect(html.match(/Cavco Hair<\/div>/g)?.length).toBe(1);
  });

  it('line breaks in a paragraph become <br>', () => {
    expect(mailP('a\nb')).toContain('a<br>b');
  });
});
