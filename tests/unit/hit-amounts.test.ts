import { describe, expect, it } from 'vitest';
import { splitAmounts } from '@/lib/hit-amounts';

describe('splitAmounts (the terminal approved amount against the ticket)', () => {
  it('an ordinary payment has no tip and no surcharge', () => {
    expect(splitAmounts(4500, 0, undefined, 4500)).toEqual({ tip: 0, surcharge: 0 });
  });
  it('a surcharge named by the terminal is kept apart, whether or not the approved amount includes it', () => {
    expect(splitAmounts(4590, 0, 90, 4500)).toEqual({ tip: 0, surcharge: 90 });
    expect(splitAmounts(4500, 0, 90, 4500)).toEqual({ tip: 0, surcharge: 90 });
  });
  it('a surcharge the terminal did not name is the amount above ticket plus tip', () => {
    expect(splitAmounts(4590, 0, undefined, 4500)).toEqual({ tip: 0, surcharge: 90 });
    expect(splitAmounts(5090, 500, undefined, 4500)).toEqual({ tip: 500, surcharge: 90 });
  });
  it('a tip is kept apart, whether or not the approved amount includes it', () => {
    expect(splitAmounts(5000, 500, undefined, 4500)).toEqual({ tip: 500, surcharge: 0 });
    expect(splitAmounts(4500, 500, undefined, 4500)).toEqual({ tip: 500, surcharge: 0 });
  });
  it('an amount that does not add up to the sale is refused', () => {
    expect(splitAmounts(4000, 0, undefined, 4500)).toBeNull();
    expect(splitAmounts(4000, 0, 90, 4500)).toBeNull();
    expect(splitAmounts(0, 0, undefined, 4500)).toBeNull();
    expect(splitAmounts(Number.NaN, 0, undefined, 4500)).toBeNull();
  });
});
