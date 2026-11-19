import { describe, expect, it } from 'vitest';
import { decodeXml, latestReceipt, receiptLines, withReceipt, type HitReceipt } from '@/lib/hit-receipt';

// Windcave's own example (HIT spec 2.4, final status): fixed-width lines of 30 characters joined with no line breaks.
const LINES = [
  '*-----------EFTPOS-----------*',
  '27 Mar 18 13:13        CHEQUE',
  'SWIPE                VISA CARD',
  '411111******1111',
  'AUTHORISATION           000289',
  'APPROVED',
];
const fixed = LINES.map((l) => l.padEnd(30)).join('');

describe('receiptLines', () => {
  it('cuts the one-string receipt into its fixed-width lines, keeping the spacing', () => {
    const out = receiptLines(fixed, 30);
    expect(out).toHaveLength(LINES.length);
    expect(out[0]).toBe('*-----------EFTPOS-----------*');
    expect(out[1]).toBe('27 Mar 18 13:13        CHEQUE');
    expect(out[4]).toBe('AUTHORISATION           000289');
  });
  it('drops only trailing spaces, never anything inside or in front of a line', () => {
    const out = receiptLines('   TOTAL        1.00'.padEnd(20) + 'APPROVED'.padEnd(20), 20);
    expect(out[0]).toBe('   TOTAL        1.00');
    expect(out[1]).toBe('APPROVED');
  });
  it('uses line breaks when the receipt has them', () => {
    expect(receiptLines('A  \r\nB\nC', 30)).toEqual(['A', 'B', 'C']);
  });
  it('every character of the receipt is kept (nothing added, nothing lost)', () => {
    expect(receiptLines(fixed, 30).join('').replace(/ /g, '')).toBe(fixed.replace(/ /g, ''));
  });
});

describe('receipts kept for a payment', () => {
  const sign: HitReceipt = { stage: 'signature', width: 30, text: 'PLEASE SIGN BELOW' };
  const fin: HitReceipt = { stage: 'final', width: 30, text: 'APPROVED' };
  it('keeps one per stage, newest in place', () => {
    const a = withReceipt([], sign);
    const b = withReceipt(a, fin);
    const c = withReceipt(b, { ...sign, text: 'PLEASE SIGN BELOW AGAIN' });
    expect(c).toHaveLength(2);
    expect(c.find((r) => r.stage === 'signature')?.text).toBe('PLEASE SIGN BELOW AGAIN');
  });
  it('shows the final receipt when there is one, otherwise the one to sign', () => {
    expect(latestReceipt([sign])?.stage).toBe('signature');
    expect(latestReceipt([sign, fin])?.stage).toBe('final');
    expect(latestReceipt([])).toBeUndefined();
    expect(latestReceipt(null)).toBeUndefined();
  });
  it('XML escapes are turned back and nothing else is changed', () => {
    expect(decodeXml('M&amp;S &lt;NZ&gt; &quot;x&quot;  y')).toBe('M&S <NZ> "x"  y');
  });
});
