import { describe, expect, it } from 'vitest';
import { dotWindow, fmtDuration, groupHours, splitHours } from './format';

describe('fmtDuration', () => {
  it('stays in minutes up to an hour', () => {
    expect(fmtDuration(30, 45, 'en')).toBe('30–45 min');
    expect(fmtDuration(30, 45, 'vi')).toBe('30–45 phút');
    expect(fmtDuration(30, 45, 'ja')).toBe('30–45分');
  });

  it('collapses a range with no range in it', () => {
    expect(fmtDuration(30, 30, 'en')).toBe('30 min');
    expect(fmtDuration(30, null, 'en')).toBe('30 min');
  });

  it('switches to hours past sixty minutes, rounded to the half', () => {
    expect(fmtDuration(120, 240, 'en')).toBe('2–4h');
    expect(fmtDuration(90, 90, 'en')).toBe('1.5h');
    // 100 minutes rounds to 1.5, not 1.67.
    expect(fmtDuration(100, 100, 'en')).toBe('1.5h');
  });

  it('collapses an hour range whose ends round together', () => {
    // Both land on 2h at half-hour granularity; 100–110 would not, which
    // is the point of rounding before comparing rather than after.
    expect(fmtDuration(110, 115, 'en')).toBe('2h');
    expect(fmtDuration(100, 110, 'en')).toBe('1.5–2h');
  });

  // The boundary itself belongs to minutes.
  it('treats exactly sixty as minutes', () => {
    expect(fmtDuration(60, 60, 'en')).toBe('60 min');
  });

  it('says nothing when there is no duration', () => {
    expect(fmtDuration(null, null, 'en')).toBeNull();
    expect(fmtDuration(0, 60, 'en')).toBeNull();
  });
});

describe('splitHours', () => {
  it('splits a day from its hours', () => {
    expect(splitHours('Monday: 8:00 AM – 11:00 PM')).toEqual(['Monday', '8:00 AM – 11:00 PM']);
  });

  // Google returns times with colons in them; only the first one separates.
  it('splits on the first separator only', () => {
    expect(splitHours('Monday: 8:00–11:00')).toEqual(['Monday', '8:00–11:00']);
  });

  it('hands back an unsplittable line whole', () => {
    expect(splitHours('Open 24 hours')).toEqual(['Open 24 hours', '']);
  });
});

describe('dotWindow', () => {
  it('shows every page while they fit', () => {
    expect(dotWindow(3, 0)).toEqual([0, 1, 2]);
    expect(dotWindow(7, 3)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('keeps the window the same size once they do not', () => {
    expect(dotWindow(20, 10)).toHaveLength(7);
  });

  it('centres on the active page in the middle of a long strip', () => {
    expect(dotWindow(20, 10)).toEqual([7, 8, 9, 10, 11, 12, 13]);
  });

  it('pins to the start rather than running off it', () => {
    expect(dotWindow(20, 0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(dotWindow(20, 2)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('pins to the end rather than running off it', () => {
    expect(dotWindow(20, 19)).toEqual([13, 14, 15, 16, 17, 18, 19]);
  });

  it('always contains the active page', () => {
    for (let active = 0; active < 20; active++) {
      expect(dotWindow(20, active)).toContain(active);
    }
  });
});

describe('groupHours', () => {
  const week = (...hours: string[]) =>
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .map((d, i) => `${d}: ${hours[i]}`);

  it('collapses a whole identical week to one row', () => {
    const rows = groupHours(week(...Array(7).fill('Open 24 hours')));
    expect(rows).toEqual([{ label: 'Mon–Sun', hours: 'Open 24 hours' }]);
  });

  it('keeps the day that differs on its own', () => {
    const rows = groupHours(week('8 AM', '8 AM', '8 AM', '8:30 AM', '8 AM', '8 AM', '8 AM'));
    expect(rows).toEqual([
      { label: 'Mon–Wed', hours: '8 AM' },
      { label: 'Thu', hours: '8:30 AM' },
      { label: 'Fri–Sun', hours: '8 AM' },
    ]);
  });

  it('leaves seven different days as seven rows', () => {
    expect(groupHours(week('a', 'b', 'c', 'd', 'e', 'f', 'g'))).toHaveLength(7);
  });

  it('pairs two days without inventing a longer run', () => {
    const rows = groupHours(week('a', 'a', 'b', 'b', 'c', 'c', 'd'));
    expect(rows.map((r) => r.label)).toEqual(['Mon–Tue', 'Wed–Thu', 'Fri–Sat', 'Sun']);
  });

  // Same hours, but not adjacent: merging them would produce a label a
  // reader has to decode rather than scan.
  it('does not merge days that are not consecutive', () => {
    const rows = groupHours(week('a', 'b', 'a', 'c', 'd', 'e', 'f'));
    expect(rows.slice(0, 3)).toEqual([
      { label: 'Mon', hours: 'a' },
      { label: 'Tue', hours: 'b' },
      { label: 'Wed', hours: 'a' },
    ]);
  });

  it('handles a run that reaches the end of the week', () => {
    const rows = groupHours(week('a', 'b', 'b', 'b', 'b', 'b', 'b'));
    expect(rows).toEqual([
      { label: 'Mon', hours: 'a' },
      { label: 'Tue–Sun', hours: 'b' },
    ]);
  });

  it('keeps an unrecognised day name whole rather than truncating it', () => {
    expect(groupHours(['Thứ Hai: 8 AM'])).toEqual([{ label: 'Thứ Hai', hours: '8 AM' }]);
  });

  it('survives a line with no separator', () => {
    expect(groupHours(['Closed'])).toEqual([{ label: 'Closed', hours: '' }]);
  });

  it('has nothing to say about nothing', () => {
    expect(groupHours([])).toEqual([]);
  });
});
