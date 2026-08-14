import { describe, expect, it } from 'vitest';
import { dotWindow, fmtDuration, groupHours, openState, splitHours } from './format';

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

describe('openState', () => {
  // Every case is pinned to a real instant so the assertions cannot drift
  // with the machine's clock or its timezone. Vietnam is UTC+7, so 03:00Z
  // is 10:00 in Saigon.
  const at = (iso: string) => new Date(iso);
  const week = (hours: string) =>
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .map((d) => `${d}: ${hours}`);

  // 2026-08-12 is a Wednesday.
  const WED_10AM = at('2026-08-12T03:00:00Z');
  const WED_MIDNIGHT_30 = at('2026-08-12T17:30:00Z'); // 00:30 Thursday in ICT

  it('says nothing when there are no hours at all', () => {
    expect(openState(null, WED_10AM)).toBeNull();
    expect(openState([], WED_10AM)).toBeNull();
  });

  it('is open inside the window, and names the closing time', () => {
    expect(openState(week('8:00 AM – 11:00 PM'), WED_10AM)).toEqual({ open: true, until: '11:00 PM' });
  });

  it('is closed before opening, and names the opening time', () => {
    expect(openState(week('5:00 PM – 10:00 PM'), WED_10AM)).toEqual({ open: false, opensAt: '5:00 PM' });
  });

  it('is closed after the last window, with nothing left to promise today', () => {
    expect(openState(week('6:00 AM – 9:00 AM'), WED_10AM)).toEqual({ open: false });
  });

  // The boundaries themselves: open at the opening minute, shut at the
  // closing one.
  it('opens on the minute and closes on the minute', () => {
    // 10:00 ICT exactly: inside a window that starts then, outside one
    // that ends then.
    expect(openState(week('10:00 AM – 11:00 PM'), at('2026-08-12T03:00:00Z')))
      .toEqual({ open: true, until: '11:00 PM' });
    expect(openState(week('6:00 AM – 10:00 AM'), at('2026-08-12T03:00:00Z')))
      .toEqual({ open: false });
  });

  it('reads the day that actually applies rather than the first line', () => {
    const lines = [
      'Monday: 8:00 AM – 9:00 AM', 'Tuesday: 8:00 AM – 9:00 AM',
      'Wednesday: 9:00 AM – 6:00 PM', 'Thursday: Closed',
      'Friday: Closed', 'Saturday: Closed', 'Sunday: Closed',
    ];
    expect(openState(lines, WED_10AM)).toEqual({ open: true, until: '6:00 PM' });
  });

  it('stays open past midnight on the window that started yesterday', () => {
    expect(openState(week('7:00 PM – 1:00 AM'), WED_MIDNIGHT_30))
      .toEqual({ open: true, until: '1:00 AM' });
  });

  // Same clock, but nothing ran into today — the small hours are shut.
  it('is closed after midnight when yesterday did not run over', () => {
    expect(openState(week('8:00 AM – 11:00 PM'), WED_MIDNIGHT_30))
      .toEqual({ open: false, opensAt: '8:00 AM' });
  });

  it('treats a midnight close as the end of the day, not the start', () => {
    expect(openState(week('8:00 AM – 12:00 AM'), at('2026-08-12T15:00:00Z')))
      .toEqual({ open: true, until: '12:00 AM' });
  });

  it('is open around the clock without inventing a closing time', () => {
    expect(openState(week('Open 24 hours'), WED_10AM)).toEqual({ open: true });
    expect(openState(week('Open 24 hours'), WED_MIDNIGHT_30)).toEqual({ open: true });
  });

  it('is shut all day when the day says Closed', () => {
    expect(openState(week('Closed'), WED_10AM)).toEqual({ open: false });
  });

  // Google drops the meridiem on the opening time when it matches the
  // closing one, so "4:00 – 8:50 PM" is an afternoon, not a dawn.
  it('borrows the missing meridiem from the closing time', () => {
    expect(openState(week('5:00 – 10:00 PM'), WED_10AM)).toEqual({ open: false, opensAt: '5:00' });
    expect(openState(week('5:00 – 10:00 PM'), at('2026-08-12T11:00:00Z')))
      .toEqual({ open: true, until: '10:00 PM' });
  });

  it('handles a lunch break as two windows', () => {
    const hours = week('10:00 AM – 1:50 PM, 4:00 – 8:50 PM');
    expect(openState(hours, WED_10AM)).toEqual({ open: true, until: '1:50 PM' });
    // 15:00 ICT — after the first window, before the second.
    expect(openState(hours, at('2026-08-12T08:00:00Z'))).toEqual({ open: false, opensAt: '4:00' });
    // 17:00 ICT — inside the second.
    expect(openState(hours, at('2026-08-12T10:00:00Z'))).toEqual({ open: true, until: '8:50 PM' });
  });

  it('noon and midnight do not collapse into each other', () => {
    // Both read "12:00"; only the meridiem separates midday from the top
    // of the morning. At 13:00 ICT one is open and the other shut hours ago.
    expect(openState(week('12:00 PM – 5:00 PM'), at('2026-08-12T06:00:00Z')))
      .toEqual({ open: true, until: '5:00 PM' });
    expect(openState(week('12:00 AM – 6:00 AM'), at('2026-08-12T06:00:00Z')))
      .toEqual({ open: false });
  });

  // The whole point of the offset: a phone in London must still be told
  // what the café in Saigon is doing.
  it('answers on the place\'s clock, not the reader\'s', () => {
    // 20:00Z is 03:00 the next morning in Saigon — shut, whatever the
    // device thinks the hour is.
    expect(openState(week('8:00 AM – 11:00 PM'), at('2026-08-12T20:00:00Z')))
      .toEqual({ open: false, opensAt: '8:00 AM' });
  });

  it('declines to guess at a shape it does not know', () => {
    expect(openState(week('Opening hours vary'), WED_10AM)).toBeNull();
    expect(openState(week('8:00 AM'), WED_10AM)).toBeNull();
    expect(openState(week('25:00 AM – 9:00 PM'), WED_10AM)).toBeNull();
  });
});
