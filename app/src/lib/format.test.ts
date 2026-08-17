import { describe, expect, it } from 'vitest';
import { clockOf, dateline, dotWindow, fmtDuration, groupHours, instantOn, openState, splitHours } from './format';

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
    // The hours branch has its own three translations, and only English
    // had ever been through it — the minutes branch above was carrying the
    // other two on its own.
    expect(fmtDuration(120, 240, 'vi')).toBe('2–4 giờ');
    expect(fmtDuration(120, 240, 'ja')).toBe('2–4時間');
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

  // The rows used to be Google's own string handed straight back — English
  // and twelve-hour, under a Vietnamese heading, beside a plan the app had
  // printed as "09:00".
  it('prints the hours on the app\'s clock, not Google\'s', () => {
    expect(groupHours(week(...Array(7).fill('8:00 AM – 11:00 PM'))))
      .toEqual([{ label: 'Mon–Sun', hours: '08:00–23:00' }]);
  });

  it('keeps a lunch break as two windows', () => {
    expect(groupHours(['Monday: 10:00 AM – 1:50 PM, 4:00 – 8:50 PM'])[0].hours)
      .toBe('10:00–13:50, 16:00–20:50');
  });

  // Past midnight the closing hour wraps, which is what a wall clock does
  // and what the plan screens already print.
  it('wraps a window that runs into the next day', () => {
    expect(groupHours(['Monday: 7:00 PM – 1:00 AM'])[0].hours).toBe('19:00–01:00');
  });

  it('says closed and all-day in words rather than in hours', () => {
    expect(groupHours(['Monday: Closed'])[0].hours).toBe('Closed');
    expect(groupHours(['Monday: Closed'], 'vi')[0].hours).toBe('Đóng cửa');
    expect(groupHours(['Monday: Closed'], 'ja')[0].hours).toBe('休業');
    expect(groupHours(['Monday: Open 24 hours'], 'vi')[0].hours).toBe('Mở cả ngày');
    expect(groupHours(['Monday: Open 24 hours'], 'ja')[0].hours).toBe('24時間営業');
    // A place whose own hours run the full day is the same answer.
    expect(groupHours(['Monday: 12:00 AM – 12:00 AM'])[0].hours).toBe('Open 24 hours');
  });

  it('names the day in the reader\'s language', () => {
    expect(groupHours(week(...Array(7).fill('Closed')), 'vi'))
      .toEqual([{ label: 'T2–CN', hours: 'Đóng cửa' }]);
    expect(groupHours(week(...Array(7).fill('Closed')), 'ja')[0].label).toBe('月–日');
    expect(groupHours(['Monday: Closed', 'Tuesday: Open 24 hours'], 'vi').map((r) => r.label))
      .toEqual(['T2', 'T3']);
  });

  // Google writes the same afternoon two ways, dropping the meridiem on
  // the opening time when it matches the closing one. Grouping on the raw
  // text would split them into two rows saying the same thing.
  it('merges two days Google wrote differently but meant the same', () => {
    const rows = groupHours(['Monday: 5:00 – 10:00 PM', 'Tuesday: 5:00 PM – 10:00 PM']);
    expect(rows).toEqual([{ label: 'Mon–Tue', hours: '17:00–22:00' }]);
  });

  // A shape the parser has never seen keeps Google's words. Awkward beats
  // blank, and beats a guess.
  it('falls back to the raw line for a shape it cannot read', () => {
    expect(groupHours(['Monday: Opening hours vary'], 'vi')[0].hours).toBe('Opening hours vary');
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

  // ── the guards below are the paths a malformed week takes. Each was
  // reachable and untested, which is the state a guard is least useful in:
  // present, trusted, and never once run. ──

  // `parseTime`: a word where a clock should be.
  it('says nothing when a time does not parse', () => {
    expect(openState(week('noon – 5:00 PM'), WED_10AM)).toBeNull();
  });

  // `parseDay`: the day is listed but carries no hours.
  it('says nothing when a day line is blank', () => {
    expect(openState(week(''), WED_10AM)).toBeNull();
  });

  // `dayAt`: a week with a hole in it, which is what a partial row from
  // the desk looks like by the time it reaches here.
  it('says nothing when the day itself is missing from the list', () => {
    const holed = week('8:00 AM – 11:00 PM');
    holed[2] = undefined as unknown as string; // Wednesday
    expect(openState(holed, WED_10AM)).toBeNull();
  });

  // Yesterday being unreadable must not cost today its answer — the
  // look-back is an extra chance to say "open", not a prerequisite.
  it('still answers from today when yesterday does not parse', () => {
    const mixed = week('5:00 PM – 10:00 PM');
    mixed[1] = 'Tuesday: ';
    expect(openState(mixed, WED_10AM)).toEqual({ open: false, opensAtMin: 17 * 60 });
  });

  // Round the clock from yesterday: open, with no closing time worth
  // naming. The same rule as today's windows, on the other loop.
  it('names no closing time for a full-day window that began yesterday', () => {
    expect(openState(week('1:00 AM – 1:00 AM'), WED_MIDNIGHT_30)).toEqual({ open: true });
  });

  it('says nothing when there are no hours at all', () => {
    expect(openState(null, WED_10AM)).toBeNull();
    expect(openState([], WED_10AM)).toBeNull();
  });

  it('is open inside the window, and names the closing time', () => {
    expect(openState(week('8:00 AM – 11:00 PM'), WED_10AM)).toEqual({ open: true, untilMin: 23 * 60 });
  });

  it('is closed before opening, and names the opening time', () => {
    expect(openState(week('5:00 PM – 10:00 PM'), WED_10AM)).toEqual({ open: false, opensAtMin: 17 * 60 });
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
      .toEqual({ open: true, untilMin: 23 * 60 });
    expect(openState(week('6:00 AM – 10:00 AM'), at('2026-08-12T03:00:00Z')))
      .toEqual({ open: false });
  });

  it('reads the day that actually applies rather than the first line', () => {
    const lines = [
      'Monday: 8:00 AM – 9:00 AM', 'Tuesday: 8:00 AM – 9:00 AM',
      'Wednesday: 9:00 AM – 6:00 PM', 'Thursday: Closed',
      'Friday: Closed', 'Saturday: Closed', 'Sunday: Closed',
    ];
    expect(openState(lines, WED_10AM)).toEqual({ open: true, untilMin: 18 * 60 });
  });

  it('stays open past midnight on the window that started yesterday', () => {
    expect(openState(week('7:00 PM – 1:00 AM'), WED_MIDNIGHT_30))
      .toEqual({ open: true, untilMin: 25 * 60 });
  });

  // Same clock, but nothing ran into today — the small hours are shut.
  it('is closed after midnight when yesterday did not run over', () => {
    expect(openState(week('8:00 AM – 11:00 PM'), WED_MIDNIGHT_30))
      .toEqual({ open: false, opensAtMin: 8 * 60 });
  });

  it('treats a midnight close as the end of the day, not the start', () => {
    expect(openState(week('8:00 AM – 12:00 AM'), at('2026-08-12T15:00:00Z')))
      .toEqual({ open: true, untilMin: 24 * 60 });
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
    expect(openState(week('5:00 – 10:00 PM'), WED_10AM)).toEqual({ open: false, opensAtMin: 17 * 60 });
    expect(openState(week('5:00 – 10:00 PM'), at('2026-08-12T11:00:00Z')))
      .toEqual({ open: true, untilMin: 22 * 60 });
  });

  it('handles a lunch break as two windows', () => {
    const hours = week('10:00 AM – 1:50 PM, 4:00 – 8:50 PM');
    expect(openState(hours, WED_10AM)).toEqual({ open: true, untilMin: 13 * 60 + 50 });
    // 15:00 ICT — after the first window, before the second.
    expect(openState(hours, at('2026-08-12T08:00:00Z'))).toEqual({ open: false, opensAtMin: 16 * 60 });
    // 17:00 ICT — inside the second.
    expect(openState(hours, at('2026-08-12T10:00:00Z'))).toEqual({ open: true, untilMin: 20 * 60 + 50 });
  });

  it('noon and midnight do not collapse into each other', () => {
    // Both read "12:00"; only the meridiem separates midday from the top
    // of the morning. At 13:00 ICT one is open and the other shut hours ago.
    expect(openState(week('12:00 PM – 5:00 PM'), at('2026-08-12T06:00:00Z')))
      .toEqual({ open: true, untilMin: 17 * 60 });
    expect(openState(week('12:00 AM – 6:00 AM'), at('2026-08-12T06:00:00Z')))
      .toEqual({ open: false });
  });

  // The whole point of the offset: a phone in London must still be told
  // what the café in Saigon is doing.
  it('answers on the place\'s clock, not the reader\'s', () => {
    // 20:00Z is 03:00 the next morning in Saigon — shut, whatever the
    // device thinks the hour is.
    expect(openState(week('8:00 AM – 11:00 PM'), at('2026-08-12T20:00:00Z')))
      .toEqual({ open: false, opensAtMin: 8 * 60 });
  });

  it('declines to guess at a shape it does not know', () => {
    expect(openState(week('Opening hours vary'), WED_10AM)).toBeNull();
    expect(openState(week('8:00 AM'), WED_10AM)).toBeNull();
    expect(openState(week('25:00 AM – 9:00 PM'), WED_10AM)).toBeNull();
  });
});

describe('dateline', () => {
  // A fixed instant, because a function that reads the clock itself
  // cannot be tested — which is why `now` is a parameter.
  const sat = new Date(2026, 7, 15); // Saturday, 15 August 2026

  it('spells the day and month out in English', () => {
    expect(dateline('en', sat)).toBe('Saturday, August 15');
  });

  it('uses the Vietnamese day names and "tháng"', () => {
    expect(dateline('vi', sat)).toBe('Thứ Bảy, 15 tháng 8');
  });

  it('puts the Japanese weekday in its brackets', () => {
    expect(dateline('ja', sat)).toBe('8月15日（土）');
  });

  // Sunday is index 0 in both tables, and getting that wrong shifts every
  // day of the week by one — a bug that looks like a translation problem.
  it('lines Sunday up with index zero', () => {
    const sun = new Date(2026, 7, 16);
    expect(dateline('en', sun)).toBe('Sunday, August 16');
    expect(dateline('vi', sun)).toBe('Chủ Nhật, 16 tháng 8');
    expect(dateline('ja', sun)).toBe('8月16日（日）');
  });

  it('falls back to English for a language it does not know', () => {
    expect(dateline('fr', sat)).toBe('Saturday, August 15');
  });
});

describe('instantOn', () => {
  // Seven in the evening on the 15th, read on the catalog's clock. The
  // assertion is in UTC because that is the only frame both test clocks
  // agree on: 19:00 ICT is 12:00 UTC wherever the runner is standing.
  it('lands on the right instant whatever clock the runner is on', () => {
    const at = instantOn('2026-08-15', 19 * 60)!;
    expect(at.toISOString()).toBe('2026-08-15T12:00:00.000Z');
  });

  // A bar closing at 1am is minute 1500 of the day it opened, so the day
  // is validated at midnight and the minutes added after. Validating the
  // finished instant instead refused every month-end evening that ran late
  // — and refusing meant "hours unknown", so those stops quietly stopped
  // being checked against opening hours.
  it('lets a plan run past midnight, including off the end of a month', () => {
    expect(instantOn('2026-08-15', 25 * 60)!.toISOString()).toBe('2026-08-15T18:00:00.000Z');
    expect(instantOn('2026-08-31', 25 * 60)!.toISOString()).toBe('2026-08-31T18:00:00.000Z');
    expect(instantOn('2026-12-31', 25 * 60)!.toISOString()).toBe('2026-12-31T18:00:00.000Z');
  });

  it('refuses anything that is not a day', () => {
    expect(instantOn('', 540)).toBeNull();
    expect(instantOn('15/08/2026', 540)).toBeNull();
    expect(instantOn('2026-8-15', 540)).toBeNull();
  });

  // The one `Date.UTC` accepts and rolls forward to the 2nd of March,
  // which is how a mistyped date becomes a plan for the wrong week.
  it('refuses a day the calendar does not have', () => {
    expect(instantOn('2026-02-30', 540)).toBeNull();
    expect(instantOn('2026-13-01', 540)).toBeNull();
  });
});

// One formatter, because there were six — five identical copies plus a
// sixth that had quietly drifted — and because next to them the opening
// hours went out in Google's own "9:00 PM", so a Vietnamese card carried
// `10:24` and `mở tới 9:00 PM` two lines apart.
describe('clockOf', () => {
  it('prints a wall clock, zero-padded, twenty-four hour', () => {
    expect(clockOf(0)).toBe('00:00');
    expect(clockOf(9 * 60)).toBe('09:00');
    expect(clockOf(13 * 60 + 5)).toBe('13:05');
    expect(clockOf(23 * 60 + 59)).toBe('23:59');
  });

  // The bug the six copies all carried: `Math.round(m) % 60` rounds the
  // minute without telling the hour, so a minute rounding up to 60 rolled
  // back to :00 of the hour it started in.
  it('rounds the instant rather than the minute', () => {
    expect(clockOf(119.6)).toBe('02:00');
    expect(clockOf(59.5)).toBe('01:00');
    expect(clockOf(90.4)).toBe('01:30');
  });

  // A window that began yesterday runs past 1440 by design — `openState`
  // returns 25 * 60 for a bar that shuts at one in the morning.
  it('wraps past midnight the way a wall clock does', () => {
    expect(clockOf(24 * 60)).toBe('00:00');
    expect(clockOf(25 * 60)).toBe('01:00');
    expect(clockOf(24 * 60 + 30)).toBe('00:30');
  });

  it('does not fall off the bottom either', () => {
    expect(clockOf(-30)).toBe('23:30');
  });

  // The whole reason `openState` stopped handing back Google's strings.
  // "5:00 – 10:00 PM" borrows its meridiem from the closing time, and the
  // raw opening string carries none — so the app used to print a bare
  // "5:00" and leave the reader to guess which one.
  it('gives an hour a meridiem could not', () => {
    const lines = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .map((d) => `${d}: 5:00 – 10:00 PM`);
    // Wednesday 10:00 ICT.
    const state = openState(lines, new Date('2026-08-12T03:00:00Z'));
    expect(state?.opensAtMin != null && clockOf(state.opensAtMin)).toBe('17:00');
  });
});
