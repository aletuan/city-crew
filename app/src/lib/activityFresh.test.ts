// What the Activity row's number means: items newer than the last time
// the feed was opened, inside the feed's own window.

import { describe, expect, it } from 'vitest';
import { activitySeenKey, APPLAUSE_DAYS, countFresh, freshSince, windowStart } from './activityFresh';

const NOW = new Date('2026-10-08T10:00:00Z');

describe('the window', () => {
  it('is the feed’s fourteen days', () => {
    expect(APPLAUSE_DAYS).toBe(14);
    expect(windowStart(NOW)).toBe('2026-09-24T10:00:00.000Z');
  });
  it('asks since the later of the last look and the window’s start', () => {
    expect(freshSince(null, NOW)).toBe('2026-09-24T10:00:00.000Z');
    expect(freshSince('2026-09-01T00:00:00.000Z', NOW)).toBe('2026-09-24T10:00:00.000Z');
    expect(freshSince('2026-10-07T09:00:00.000Z', NOW)).toBe('2026-10-07T09:00:00.000Z');
  });
});

describe('countFresh', () => {
  const items = [{ at: '2026-10-08T09:00:00.000Z' }, { at: '2026-10-07T09:00:00.000Z' }, { at: '2026-10-01T09:00:00.000Z' }];
  it('counts everything for a feed never opened', () => {
    expect(countFresh(items, null)).toBe(3);
  });
  it('counts only what landed after the last look — strictly after', () => {
    expect(countFresh(items, '2026-10-07T09:00:00.000Z')).toBe(1);
    expect(countFresh(items, '2026-10-08T09:00:00.000Z')).toBe(0);
    expect(countFresh([], null)).toBe(0);
  });
  it('compares instants, not strings', () => {
    expect(countFresh([{ at: '2026-10-08T16:00:00+07:00' }], '2026-10-08T09:30:00Z')).toBe(0);
    expect(countFresh([{ at: '2026-10-08T16:00:00+07:00' }], '2026-10-08T08:30:00Z')).toBe(1);
  });
});

describe('activitySeenKey', () => {
  it('is per account, so another sign-in starts fresh', () => {
    expect(activitySeenKey('u1')).toBe('activity.seen.v1:u1');
    expect(activitySeenKey('u1')).not.toBe(activitySeenKey('u2'));
  });
});
