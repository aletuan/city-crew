// The line under a stop on the plan options screen. What is pinned: each
// fact appears only when it is true; the dwell only when the place says
// how long people stay; and open or shut is read at the hour the plan
// arrives, on the plan's own day, not at the moment the screen is read.

import { describe, expect, it } from 'vitest';
import { stopFacts } from './stopFacts';

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
  it('names the district, the rating and the closing time', () => {
    expect(stopFacts(place(), evening, '2026-10-03', ICT, 'en', en))
      .toBe('Hoàn Kiếm · 4.6★ · open until 22:00');
  });

  it('says it in Vietnamese and Japanese too', () => {
    expect(stopFacts(place(), evening, '2026-10-03', ICT, 'vi', vi))
      .toBe('Hoàn Kiếm · 4.6★ · mở tới 22:00');
    expect(stopFacts(place(), evening, '2026-10-03', ICT, 'ja', ja))
      .toBe('Hoàn Kiếm · 4.6★ · 22:00まで営業');
  });

  // The planner's 75 minutes is its own default, not the place's.
  it('prints the dwell only when the place says how long people stay', () => {
    expect(stopFacts(place({ duration_min: 60 }), evening, '2026-10-03', ICT, 'vi', vi))
      .toBe('Hoàn Kiếm · 4.6★ · 75 phút · mở tới 22:00');
    expect(stopFacts(place({ duration_max: 90 }), evening, '2026-10-03', ICT, 'en', en))
      .toBe('Hoàn Kiếm · 4.6★ · 75 min · open until 22:00');
  });

  // Arriving before it opens: say when it does.
  it('says when a place opens if the plan arrives before it does', () => {
    const late = place({ opening_hours: week('7:00 PM – 11:00 PM') });
    expect(stopFacts(late, evening, '2026-10-03', ICT, 'en', en))
      .toBe('Hoàn Kiếm · 4.6★ · opens 19:00');
    expect(stopFacts(late, evening, '2026-10-03', ICT, 'vi', vi)).toBe('Hoàn Kiếm · 4.6★ · mở lúc 19:00');
    expect(stopFacts(late, evening, '2026-10-03', ICT, 'ja', ja)).toBe('Hoàn Kiếm · 4.6★ · 19:00開店');
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
    expect(stopFacts(weekdays, evening, '2026-10-03', MEL, 'en', en)).toBe('Hoàn Kiếm · 4.6★ · open until 23:00');
    expect(stopFacts(weekdays, evening, '2026-10-02', MEL, 'en', en)).toBe('Hoàn Kiếm · 4.6★ · open until 22:00');
  });

  // Open around the clock has no closing time worth naming, and unknown
  // hours are not closed.
  it('says nothing about hours it cannot state', () => {
    expect(stopFacts(place({ opening_hours: week('Open 24 hours') }), evening, '2026-10-03', ICT, 'en', en))
      .toBe('Hoàn Kiếm · 4.6★');
    expect(stopFacts(place({ opening_hours: null }), evening, '2026-10-03', ICT, 'en', en))
      .toBe('Hoàn Kiếm · 4.6★');
    // Not a real day: no instant to read the hours at.
    expect(stopFacts(place(), evening, 'someday', ICT, 'en', en)).toBe('Hoàn Kiếm · 4.6★');
  });

  it('leaves out a rating and a district it does not have', () => {
    expect(stopFacts(place({ rating: null, neighborhood_en: null }), evening, '2026-10-03', ICT, 'en', en))
      .toBe('open until 22:00');
    expect(stopFacts(place({ rating: 0 }), evening, '2026-10-03', ICT, 'en', en))
      .toBe('Hoàn Kiếm · open until 22:00');
  });
});
