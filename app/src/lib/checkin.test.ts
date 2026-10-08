// What the pill reads off the check-ins: which visit was the last one
// here, and whether another may be written yet.

import { describe, expect, it } from 'vitest';
import { canRepeat, type Checkin, latestCheckin, REPEAT_AFTER_MIN } from './checkin';

const row = (id: string, slug: string, at: string): Checkin => ({ id, place_slug: slug, city_id: 'hanoi', at });

describe('latestCheckin', () => {
  it('picks the newest visit at this place and nothing from another', () => {
    const rows = [
      row('a', 'cong', '2026-10-01T03:00:00Z'),
      row('b', 'pizza', '2026-10-08T03:00:00Z'),
      row('c', 'cong', '2026-10-07T09:30:00Z'),
    ];
    expect(latestCheckin(rows, 'cong')?.id).toBe('c');
    expect(latestCheckin(rows, 'pizza')?.id).toBe('b');
  });
  it('is null when this place has never been checked in at', () => {
    expect(latestCheckin([row('a', 'cong', '2026-10-01T03:00:00Z')], 'pizza')).toBeNull();
    expect(latestCheckin([], 'cong')).toBeNull();
  });
  it('does not trust the order it was given', () => {
    const rows = [row('old', 'cong', '2026-10-01T00:00:00Z'), row('new', 'cong', '2026-10-02T00:00:00Z')];
    expect(latestCheckin(rows, 'cong')?.id).toBe('new');
    expect(latestCheckin([...rows].reverse(), 'cong')?.id).toBe('new');
  });
});

describe('canRepeat', () => {
  const at = '2026-10-08T03:00:00Z';
  it('allows a first visit, and another once the window has passed', () => {
    expect(canRepeat(null, new Date(at))).toBe(true);
    expect(canRepeat(row('a', 'cong', at), new Date('2026-10-08T03:10:00Z'))).toBe(true);
    expect(canRepeat(row('a', 'cong', at), new Date('2026-10-09T03:00:00Z'))).toBe(true);
  });
  it('refuses a second visit inside the window — that is a double tap, not a return', () => {
    expect(REPEAT_AFTER_MIN).toBe(10);
    expect(canRepeat(row('a', 'cong', at), new Date('2026-10-08T03:09:59Z'))).toBe(false);
    expect(canRepeat(row('a', 'cong', at), new Date(at))).toBe(false);
  });
});
