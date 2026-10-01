// The line under a stop on the plan options screen. What is pinned: each
// fact appears only when it is true; the district only when the caller
// asks, which the card does only for a plan that crosses districts; the
// dwell only when the place says how long people stay; and open or shut
// is read at the hour the plan arrives, on the plan's own day, not at the
// moment the screen is read.

import { describe, expect, it } from 'vitest';
import { sharedArea, stopFacts } from './stopFacts';

const ICT = 'Asia/Ho_Chi_Minh';
const MEL = 'Australia/Melbourne';
const week = (hours: string) =>
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    .map((d) => `${d}: ${hours}`);
const en = (e: string) => e;
const vi = (_e: string, v: string) => v;
const ja = (_e: string, _v: string, j: string) => j;
const place = (over: Partial<Parameters<typeof stopFacts>[0]> = {}) => ({
  neighborhood_en: 'Hoàn Kiếm',
  rating: 4.6,
  duration_min: null,
  duration_max: null,
  opening_hours: week('8:00 AM – 10:00 PM'),
  ...over,
});
// 18:00 on Saturday 2026-10-03.
const evening = { arriveMin: 18 * 60, dwellMin: 75 };

describe('stopFacts', () => {
  it('names the district and the closing time', () => {
    expect(stopFacts(place(), evening, '2026-10-03', ICT, 'en', en))
      .toBe('Hoàn Kiếm · open until 22:00');
  });

  it('says it in Vietnamese and Japanese too', () => {
    expect(stopFacts(place(), evening, '2026-10-03', ICT, 'vi', vi))
      .toBe('Hoàn Kiếm · mở tới 22:00');
    expect(stopFacts(place(), evening, '2026-10-03', ICT, 'ja', ja))
      .toBe('Hoàn Kiếm · 22:00まで営業');
  });

  // The planner's 75 minutes is its own default, not the place's.
  it('prints the dwell only when the place says how long people stay', () => {
    expect(stopFacts(place({ duration_min: 60 }), evening, '2026-10-03', ICT, 'vi', vi))
      .toBe('Hoàn Kiếm · 75 phút · mở tới 22:00');
    expect(stopFacts(place({ duration_max: 90 }), evening, '2026-10-03', ICT, 'en', en))
      .toBe('Hoàn Kiếm · 75 min · open until 22:00');
  });

  // Arriving before it opens: say when it does.
  it('says when a place opens if the plan arrives before it does', () => {
    const late = place({ opening_hours: week('7:00 PM – 11:00 PM') });
    expect(stopFacts(late, evening, '2026-10-03', ICT, 'en', en))
      .toBe('Hoàn Kiếm · opens 19:00');
    expect(stopFacts(late, evening, '2026-10-03', ICT, 'vi', vi)).toBe('Hoàn Kiếm · mở lúc 19:00');
    expect(stopFacts(late, evening, '2026-10-03', ICT, 'ja', ja)).toBe('Hoàn Kiếm · 19:00開店');
  });

  // The plan's day and hour, in the city's own zone: a place shut on
  // Sundays reads shut on a Sunday plan, whatever day it is now.
  it('reads the hours on the plan’s own day, in the city’s zone', () => {
    const weekdays = place({
      opening_hours: [
        'Monday: 8:00 AM – 10:00 PM', 'Tuesday: 8:00 AM – 10:00 PM', 'Wednesday: 8:00 AM – 10:00 PM',
        'Thursday: 8:00 AM – 10:00 PM', 'Friday: 8:00 AM – 10:00 PM', 'Saturday: 8:00 AM – 11:00 PM',
        'Sunday: Closed',
      ],
    });
    expect(stopFacts(weekdays, evening, '2026-10-03', MEL, 'en', en)).toBe('Hoàn Kiếm · open until 23:00');
    expect(stopFacts(weekdays, evening, '2026-10-02', MEL, 'en', en)).toBe('Hoàn Kiếm · open until 22:00');
  });

  // Open around the clock has no closing time worth naming, and unknown
  // hours are not closed.
  it('says nothing about hours it cannot state', () => {
    expect(stopFacts(place({ opening_hours: week('Open 24 hours') }), evening, '2026-10-03', ICT, 'en', en))
      .toBe('Hoàn Kiếm');
    expect(stopFacts(place({ opening_hours: null }), evening, '2026-10-03', ICT, 'en', en))
      .toBe('Hoàn Kiếm');
    // Not a real day: no instant to read the hours at.
    expect(stopFacts(place(), evening, 'someday', ICT, 'en', en)).toBe('Hoàn Kiếm');
  });

  it('leaves out a district it does not have', () => {
    expect(stopFacts(place({ neighborhood_en: null }), evening, '2026-10-03', ICT, 'en', en))
      .toBe('open until 22:00');
  });

  it('never prints the rating, whatever the place carries', () => {
    expect(stopFacts(place({ rating: 4.9 } as never), evening, '2026-10-03', ICT, 'en', en))
      .toBe('Hoàn Kiếm · open until 22:00');
  });

  // A plan that never leaves one district already names it in its heading;
  // the card asks for the line without it, and gets the rest unchanged.
  it('leaves the district off when asked', () => {
    expect(stopFacts(place(), evening, '2026-10-03', ICT, 'en', en, { area: false }))
      .toBe('open until 22:00');
    expect(stopFacts(place({ duration_min: 60 }), evening, '2026-10-03', ICT, 'en', en, { area: false }))
      .toBe('75 min · open until 22:00');
    expect(stopFacts(place(), evening, '2026-10-03', ICT, 'en', en, { area: true }))
      .toBe('Hoàn Kiếm · open until 22:00');
  });
});

describe('sharedArea', () => {
  const at = (neighborhood_en: string | null) => ({ neighborhood_en });

  it('is true when every stop sits in one district', () => {
    expect(sharedArea([at('Melbourne City'), at('Melbourne City'), at('Melbourne City')])).toBe(true);
  });

  it('is false the moment one stop is elsewhere', () => {
    expect(sharedArea([at('Hoàn Kiếm'), at('Hoàn Kiếm'), at('Tây Hồ')])).toBe(false);
    expect(sharedArea([at('Hoàn Kiếm'), at(null)])).toBe(false);
  });

  it('counts unknown districts as one district, and an empty plan as one too', () => {
    expect(sharedArea([at(null), at(null)])).toBe(true);
    expect(sharedArea([])).toBe(true);
  });
});
