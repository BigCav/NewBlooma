import { describe, expect, it } from 'vitest';
import { addDays, minutesOfDay, time12, toCents, ymd, zonedToUtc } from '@/lib/format';
import { dayInfo, fmtMin, weekStartOf, initials, dollars } from '@/lib/cal';

const NZ = 'Pacific/Auckland';

describe('timezone maths (Pacific/Auckland)', () => {
  it('converts salon wall-clock time to UTC in NZST (winter) and NZDT (summer)', () => {
    expect(zonedToUtc('2027-07-01', '10:00', NZ).toISOString()).toBe('2027-06-30T22:00:00.000Z');
    expect(zonedToUtc('2027-01-15', '10:00', NZ).toISOString()).toBe('2027-01-14T21:00:00.000Z');
  });
  it('round-trips through minutesOfDay and ymd, including across the DST changes', () => {
    for (const d of ['2027-04-03', '2027-04-04', '2027-04-05', '2027-09-25', '2027-09-26', '2027-09-27']) {
      const u = zonedToUtc(d, '09:30', NZ);
      expect(ymd(u, NZ)).toBe(d);
      expect(minutesOfDay(u, NZ)).toBe(9 * 60 + 30);
    }
  });
  it('a calendar day is 25 hours on the autumn change and 23 on the spring change', () => {
    const hrs = (d: string) => (zonedToUtc(addDays(d, 1), '00:00', NZ).getTime() - zonedToUtc(d, '00:00', NZ).getTime()) / 3600e3;
    expect(hrs('2027-04-04')).toBe(25);
    expect(hrs('2027-09-26')).toBe(23);
    expect(hrs('2027-06-10')).toBe(24);
  });
  it('shows 12 hour times', () => {
    expect(time12(zonedToUtc('2027-06-10', '14:00', NZ), NZ)).toBe('2:00pm');
    expect(time12(zonedToUtc('2027-06-10', '00:05', NZ), NZ)).toBe('12:05am');
  });
  it('adds days across month and year ends and leap days', () => {
    expect(addDays('2027-12-31', 1)).toBe('2028-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
  });
});

describe('calendar helpers', () => {
  it('weeks start on Monday', () => {
    expect(weekStartOf('2026-10-27')).toBe('2026-10-26'); // a Tuesday
    expect(weekStartOf('2026-11-01')).toBe('2026-10-26'); // a Sunday
    expect(dayInfo('2026-10-26').wd).toBe(0);
  });
  it('formats minutes of the day', () => {
    expect(fmtMin(0)).toBe('12:00am');
    expect(fmtMin(12 * 60)).toBe('12:00pm');
    expect(fmtMin(13 * 60 + 5)).toBe('1:05pm');
  });
  it('initials and dollars', () => {
    expect(initials('  cav   allen smith ')).toBe('CA');
    expect(dollars(8500)).toBe('$85');
    expect(dollars(8550)).toBe('$85.50');
  });
  it('turns typed prices into whole cents without float errors', () => {
    expect(toCents('19.99')).toBe(1999);
    expect(toCents('0.1')).toBe(10);
    expect(toCents('1.005')).toBe(101);
    expect(toCents('abc')).toBe(0);
    expect(toCents(null)).toBe(0);
  });
});
