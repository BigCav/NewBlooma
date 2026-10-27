import { describe, expect, it } from 'vitest';
import { checkPhone, phoneInput } from '@/lib/phone';
import { decimalInput, digitsInput } from '@/lib/numeric';

describe('phone numbers', () => {
  it('accepts normal numbers and tidies them', () => {
    expect(checkPhone('021 123 4567')).toEqual({ value: '0211234567', error: '' });
    expect(checkPhone('+64 21 123 4567').error).toBe('');
    expect(checkPhone('(09) 123-4567').value).toBe('091234567');
  });
  it('rejects letters, too short and too long', () => {
    expect(checkPhone('021abc4567').error).not.toBe('');
    expect(checkPhone('12345').error).not.toBe('');
    expect(checkPhone('1'.repeat(16)).error).not.toBe('');
  });
  it('empty is fine unless required', () => {
    expect(checkPhone('').error).toBe('');
    expect(checkPhone('', true).error).not.toBe('');
  });
  it('a + only survives at the start', () => {
    expect(phoneInput('+64+21')).toBe('+6421');
    expect(phoneInput('64+21')).toBe('6421');
  });
});

describe('numeric inputs', () => {
  it('digits only', () => { expect(digitsInput('1a2-3')).toBe('123'); });
  it('money keeps one dot and two decimals', () => {
    expect(decimalInput('12.345')).toBe('12.34');
    expect(decimalInput('1.2.3')).toBe('1.23');
    expect(decimalInput('$9,99')).toBe('999');
  });
});
