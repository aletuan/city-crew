import { describe, expect, it } from 'vitest';
import { dotWindow, fmtDuration, splitHours } from './format';

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
