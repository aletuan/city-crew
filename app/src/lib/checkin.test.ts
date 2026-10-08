// What the pill reads off the check-ins: which visit was the last one
// here, and whether another may be written yet.

import { describe, expect, it } from 'vitest';
import {
  canRepeat, type Checkin, latestCheckin, monthTitle, REPEAT_AFTER_MIN, visitSections, visitSummary,
} from './checkin';

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

// Instants mid-month and mid-day, so the two clocks the suite runs on
// (Hanoi, New York) file them under the same month.
describe('visitSections', () => {
  it('groups by month, newest month first and newest visit first inside it', () => {
    const rows = [
      row('a', 'cong', '2026-09-15T05:00:00Z'),
      row('b', 'pizza', '2026-10-15T05:00:00Z'),
      row('c', 'cong', '2026-10-12T05:00:00Z'),
      row('d', 'bun', '2026-07-15T05:00:00Z'),
    ];
    const secs = visitSections(rows);
    expect(secs.map((x) => x.key)).toEqual(['2026-10', '2026-09', '2026-07']);
    expect(secs[0]).toMatchObject({ year: 2026, month: 10 });
    expect(secs[0].data.map((x) => x.id)).toEqual(['b', 'c']);
    expect(secs[2].data.map((x) => x.id)).toEqual(['d']);
  });
  it('is empty for nobody', () => {
    expect(visitSections([])).toEqual([]);
  });
  it('does not trust the order it was given, and leaves it alone', () => {
    const rows = [row('old', 'cong', '2026-10-12T05:00:00Z'), row('new', 'cong', '2026-10-15T05:00:00Z')];
    expect(visitSections(rows)[0].data.map((x) => x.id)).toEqual(['new', 'old']);
    expect(rows[0].id).toBe('old');
  });
});

describe('monthTitle', () => {
  it('names the month the way each language does', () => {
    expect(monthTitle('en', 2026, 10)).toBe('October 2026');
    expect(monthTitle('vi', 2026, 10)).toBe('Tháng 10, 2026');
    expect(monthTitle('ja', 2026, 10)).toBe('2026年10月');
    expect(monthTitle('en', 2025, 1)).toBe('January 2025');
  });
});

describe('visitSummary', () => {
  it('counts visits, and the distinct places among them', () => {
    const rows = [row('a', 'cong', '2026-10-01T05:00:00Z'), row('b', 'cong', '2026-10-02T05:00:00Z'), row('c', 'pizza', '2026-10-03T05:00:00Z')];
    expect(visitSummary(rows)).toEqual({ visits: 3, places: 2 });
    expect(visitSummary([])).toEqual({ visits: 0, places: 0 });
  });
});
