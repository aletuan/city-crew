import { describe, expect, it } from 'vitest';
import { DAY_START, openThroughout } from './format';
import { matchesExplore } from './exploreFilters';
import { countsByCity } from './cityCounts';
import { answerFor, AXIS, axisOf, clockAt, headsFor, headToMove, moveHead, snap, STEP } from './hoursSlider';

const ICT = 'Asia/Ho_Chi_Minh';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const week = (hours: string) => DAYS.map((d) => `${d}: ${hours}`);
/** A week with one day's line replaced. */
const except = (hours: string, day: string, other: string) =>
  DAYS.map((d) => `${d}: ${d === day ? other : hours}`);

// 2026-08-12 is a Wednesday; Vietnam is UTC+7.
const WED_10AM = new Date('2026-08-12T03:00:00Z');
const THU_0030 = new Date('2026-08-12T17:30:00Z');

/** A wall-clock time on the slider's axis: 23:00 is 17h past six, 01:00
 *  the next morning is 19h past it. */
const p = (h: number, m = 0) => axisOf(h * 60 + m);
const span = (from: number, to: number) => ({ from, to });

describe('openThroughout', () => {
  it('starts its day at six', () => {
    expect(DAY_START).toBe(360);
    expect(p(6)).toBe(0);
    expect(p(1)).toBe(19 * 60);
  });

  // The case the axis exists for: a bar that shuts at two.
  it('reads a bar open past midnight on the evening it opened', () => {
    const bar = week('7:00 PM – 2:00 AM');
    expect(openThroughout(bar, span(p(23), p(1)), WED_10AM, ICT)).toBe(true);
    expect(openThroughout(bar, span(p(1), p(3)), WED_10AM, ICT)).toBe(false);
    expect(openThroughout(bar, span(p(18), p(20)), WED_10AM, ICT)).toBe(false);
  });

  // The whole of the span, not some of it.
  it('wants the whole span, closing time included, and a lunch break breaks it', () => {
    const lunch = week('7:00 AM – 11:00 AM, 1:00 PM – 9:00 PM');
    expect(openThroughout(lunch, span(p(10), p(14)), WED_10AM, ICT)).toBe(false);
    expect(openThroughout(lunch, span(p(13), p(21)), WED_10AM, ICT)).toBe(true);
    expect(openThroughout(lunch, span(p(13), p(21, 30)), WED_10AM, ICT)).toBe(false);
    expect(openThroughout(lunch, span(p(6, 30), p(8)), WED_10AM, ICT)).toBe(false);
  });

  // A span of no length is a moment, and the moment a place closes is
  // not a moment it is open.
  it('reads a moment as open at it, closing minute excluded', () => {
    const lunch = week('7:00 AM – 11:00 AM, 1:00 PM – 9:00 PM');
    expect(openThroughout(lunch, span(p(9), p(9)), WED_10AM, ICT)).toBe(true);
    expect(openThroughout(lunch, span(p(12), p(12)), WED_10AM, ICT)).toBe(false);
    expect(openThroughout(lunch, span(p(21), p(21)), WED_10AM, ICT)).toBe(false);
    expect(openThroughout(lunch, span(p(13), p(13)), WED_10AM, ICT)).toBe(true);
  });

  // Wednesday's day runs to six on Thursday morning: a place open around
  // the clock is open across midnight only if Thursday's window is joined
  // to Wednesday's.
  it('joins the windows that meet at midnight', () => {
    expect(openThroughout(week('Open 24 hours'), span(0, AXIS), WED_10AM, ICT)).toBe(true);
    const shutThursday = except('Open 24 hours', 'Thursday', 'Closed');
    expect(openThroughout(shutThursday, span(0, AXIS), WED_10AM, ICT)).toBe(false);
    expect(openThroughout(shutThursday, span(0, p(0)), WED_10AM, ICT)).toBe(true);
    // Joined, the longer of two overlapping windows is the one kept.
    const overlap = except('9:00 PM – 3:00 AM, 10:00 PM – 1:00 AM', 'Thursday', 'Closed');
    expect(openThroughout(overlap, span(p(21), p(2)), WED_10AM, ICT)).toBe(true);
  });

  // The night shift that began on Tuesday is still on at six on
  // Wednesday, on a Wednesday that is otherwise shut.
  it('reads yesterday’s window into this morning', () => {
    const night = except('Closed', 'Tuesday', '10:00 PM – 7:00 AM');
    expect(openThroughout(night, span(0, p(6, 30)), WED_10AM, ICT)).toBe(true);
    expect(openThroughout(night, span(0, p(7, 30)), WED_10AM, ICT)).toBe(false);
  });

  // Half past midnight on Thursday is still Wednesday's trading day.
  it('reads the small hours as the day before', () => {
    const bar = except('Closed', 'Wednesday', '7:00 PM – 2:00 AM');
    expect(openThroughout(bar, span(p(1), p(1)), THU_0030, ICT)).toBe(true);
    expect(openThroughout(bar, span(p(20), p(1, 30)), THU_0030, ICT)).toBe(true);
    // And Thursday's own evening is not the one asked about.
    const thursday = except('Closed', 'Thursday', '7:00 PM – 2:00 AM');
    expect(openThroughout(thursday, span(p(20), p(21)), THU_0030, ICT)).toBe(false);
  });

  it('has no answer without hours, or when the day itself does not read', () => {
    expect(openThroughout(null, span(0, 60), WED_10AM, ICT)).toBeNull();
    expect(openThroughout([], span(0, 60), WED_10AM, ICT)).toBeNull();
    expect(openThroughout(except('Closed', 'Wednesday', 'whenever'), span(0, 60), WED_10AM, ICT)).toBeNull();
  });

  // A neighbour in a shape nobody has seen costs nothing but itself.
  it('still answers when a neighbouring day does not read', () => {
    const days = week('9:00 AM – 5:00 PM');
    days[1] = 'Tuesday: whenever';
    days[3] = 'Thursday: whenever';
    expect(openThroughout(days, span(p(10), p(16)), WED_10AM, ICT)).toBe(true);
    expect(openThroughout(days, span(p(10), p(18)), WED_10AM, ICT)).toBe(false);
  });
});

describe('the axis', () => {
  it('puts the city’s clock on a day from six to six', () => {
    expect(axisOf(6 * 60)).toBe(0);
    expect(axisOf(14 * 60 + 37)).toBe(8 * 60 + 37);
    expect(axisOf(90)).toBe(19 * 60 + 30);
    expect(axisOf(6 * 60 - 1)).toBe(AXIS - 1);
  });

  it('snaps to the half hour, inside the ends', () => {
    expect(STEP).toBe(30);
    expect(snap(44)).toBe(30);
    expect(snap(46)).toBe(60);
    expect(snap(-40)).toBe(0);
    expect(snap(AXIS + 40)).toBe(AXIS);
  });

  it('writes a position as the clock it stands for', () => {
    expect(clockAt(0)).toBe('06:00');
    expect(clockAt(p(22))).toBe('22:00');
    expect(clockAt(p(1, 30))).toBe('01:30');
    expect(clockAt(AXIS)).toBe('06:00');
  });
});

describe('segments to heads', () => {
  const NOW = p(14, 37);

  it('draws Any time as the whole day', () => {
    expect(headsFor({ status: 'any' }, NOW)).toEqual({ from: 0, to: AXIS, muted: false });
  });

  // The owner's case: "Open now" points the heads at the present.
  it('puts both heads on the present minute for Open now', () => {
    expect(headsFor({ status: 'open' }, NOW)).toEqual({ from: NOW, to: NOW, muted: false });
  });

  it('puts them there too for Closed now, muted', () => {
    expect(headsFor({ status: 'closed' }, NOW)).toEqual({ from: NOW, to: NOW, muted: true });
  });

  it('draws a span where it is, and a span nobody set as the whole day', () => {
    expect(headsFor({ status: 'window', window: span(p(8), p(22)) }, NOW)).toEqual({ from: p(8), to: p(22), muted: false });
    expect(headsFor({ status: 'window' }, NOW)).toEqual({ from: 0, to: AXIS, muted: false });
    // A window left behind by an earlier drag is not drawn under a segment.
    expect(headsFor({ status: 'any', window: span(p(8), p(22)) }, NOW)).toEqual({ from: 0, to: AXIS, muted: false });
  });
});

describe('heads to segments', () => {
  const NOW = p(14, 37);

  it('lights Any time again at both edges', () => {
    expect(answerFor(span(0, AXIS), NOW)).toEqual({ status: 'any', window: undefined });
  });

  // Back together on the present's own half hour, the heads ask what
  // the segment asks.
  it('lights Open now again on the present’s step', () => {
    expect(answerFor(span(p(14, 30), p(14, 30)), NOW)).toEqual({ status: 'open', window: undefined });
    expect(answerFor(span(p(15), p(15)), NOW)).toEqual({ status: 'window', window: span(p(15), p(15)) });
  });

  it('is a window anywhere else', () => {
    expect(answerFor(span(0, AXIS - STEP), NOW)).toEqual({ status: 'window', window: span(0, AXIS - STEP) });
    expect(answerFor(span(STEP, AXIS), NOW)).toEqual({ status: 'window', window: span(STEP, AXIS) });
    expect(answerFor(span(p(14, 30), p(15)), NOW)).toEqual({ status: 'window', window: span(p(14, 30), p(15)) });
  });
});

describe('a drag', () => {
  it('moves the head under the finger while the heads are apart', () => {
    expect(headToMove(span(0, 60), 'to', -10)).toBe('to');
    expect(headToMove(span(0, 60), 'from', 10)).toBe('from');
  });

  // Together they are drawn as one, so the direction picks.
  it('opens two heads together to the side it moves', () => {
    expect(headToMove(span(60, 60), 'to', -10)).toBe('from');
    expect(headToMove(span(60, 60), 'from', 10)).toBe('to');
    expect(headToMove(span(60, 60), 'from', 0)).toBe('to');
  });

  it('lands both heads on steps, and stops one at the other', () => {
    // Out of "Open now" at 14:37: the head left behind lands on 14:30.
    expect(moveHead(span(p(14, 37), p(14, 37)), 'to', 90)).toEqual(span(p(14, 30), p(16)));
    expect(moveHead(span(p(14, 37), p(14, 37)), 'from', -90)).toEqual(span(p(13), p(14, 30)));
    expect(moveHead(span(p(8), p(22)), 'from', 20 * 60)).toEqual(span(p(22), p(22)));
    expect(moveHead(span(p(8), p(22)), 'to', -20 * 60)).toEqual(span(p(8), p(8)));
    expect(moveHead(span(p(8), p(22)), 'to', 20 * 60)).toEqual(span(p(8), AXIS));
  });
});

describe('the filter', () => {
  const base = {
    categories: [] as string[], savedOnly: false, isSaved: () => false,
    visitedOnly: false, isVisited: () => false, now: WED_10AM, tz: () => ICT,
  };
  const cafe = { slug: 'cafe', category: 'cafe', city_id: 'hcmc', opening_hours: week('7:00 AM – 6:00 PM') };
  const bar = { slug: 'bar', category: 'bar', city_id: 'hcmc', opening_hours: week('7:00 PM – 2:00 AM') };
  const blank = { slug: 'blank', category: 'cafe', city_id: 'hcmc', opening_hours: null };

  it('keeps the places open for the whole window', () => {
    const late = { ...base, status: 'window' as const, window: span(p(22), p(1)) };
    expect(matchesExplore(bar, late)).toBe(true);
    expect(matchesExplore(cafe, late)).toBe(false);
    expect(matchesExplore(blank, late)).toBe(false);
    const day = { ...base, status: 'window' as const, window: span(p(8), p(17)) };
    expect(matchesExplore(cafe, day)).toBe(true);
    expect(matchesExplore(bar, day)).toBe(false);
  });

  it('asks nothing of a window status with no window', () => {
    expect(matchesExplore(blank, { ...base, status: 'window' })).toBe(true);
  });

  it('counts each city under the same window', () => {
    const rows = [cafe, bar, { ...bar, slug: 'bar2', city_id: 'hanoi' }];
    expect(countsByCity(rows, { ...base, status: 'window', window: span(p(22), p(1)) })).toEqual({ hcmc: 1, hanoi: 1 });
  });
});
