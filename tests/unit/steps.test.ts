import { describe, expect, it } from 'vitest';
import { hop, visible } from '@/lib/steps';

// A five step flow: 0 client, 1 services, 2 team member, 3 time, 4 summary. A solo salon passes over 2.
const last = 4;
describe('steps that are not needed', () => {
  it('goes straight past the team step in both directions', () => {
    expect(hop(2, 1, last, [2])).toBe(3);
    expect(hop(2, -1, last, [2])).toBe(1);
  });
  it('lands on the next step when nothing is skipped', () => {
    expect(hop(2, 1, last, [])).toBe(2);
    expect(hop(3, -1, last, [])).toBe(3);
  });
  it('never passes over the first or last step', () => {
    expect(hop(0, -1, last, [0])).toBe(0);
    expect(hop(4, 1, last, [4])).toBe(4);
  });
  it('can pass over several in a row', () => {
    expect(hop(1, 1, last, [1, 2])).toBe(3);
    expect(hop(2, -1, last, [1, 2])).toBe(0);
  });
  it('counts the progress bar without the skipped steps', () => {
    const titles = ['Client', 'Services', 'Team', 'Time', 'Summary'];
    expect(visible(titles, [2], 3)).toEqual({ titles: ['Client', 'Services', 'Time', 'Summary'], at: 2 });
    expect(visible(titles, [2], 1)).toEqual({ titles: ['Client', 'Services', 'Time', 'Summary'], at: 1 });
    expect(visible(titles, [0, 2], 3)).toEqual({ titles: ['Services', 'Time', 'Summary'], at: 1 });
    expect(visible(titles, [], 4).at).toBe(4);
  });
});
