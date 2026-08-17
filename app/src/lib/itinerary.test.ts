import { describe, expect, it } from 'vitest';
import {
  insert, legsOfPlan, move, nudge, outOfOrder, remove, retime, windowOf, type Editable,
} from './itinerary';

// Real Hanoi coordinates: a walk, then a ride. Toy inputs would let a
// broken journey estimate pass, and the journey is what every recomputed
// time is made of.
type Pin = { slug: string; lat: number | null; lng: number | null };
const LAKE: Pin = { slug: 'lake', lat: 21.0287, lng: 105.8524 };
const CAFE: Pin = { slug: 'cafe', lat: 21.0301, lng: 105.8510 };   // ~200 m
const WEST: Pin = { slug: 'west', lat: 21.0587, lng: 105.8180 };   // ~5 km
// The catalog holds places with a district and nothing more precise.
const NOWHERE: Pin = { slug: 'nowhere', lat: null, lng: null };

const at = (place: Pin, arriveMin: number, pinned = false): Editable<Pin> =>
  ({ place, arriveMin, dwellMin: 60, pinned });

/** 18:00 lake, then café, then West Lake — times as the planner left them. */
const PLAN = retime([at(LAKE, 18 * 60), at(CAFE, 0), at(WEST, 0)]);

describe('retime', () => {
  it('flows each stop from the one above it', () => {
    expect(PLAN[0].arriveMin).toBe(1080);
    expect(PLAN[1].arriveMin).toBeGreaterThan(PLAN[0].arriveMin + PLAN[0].dwellMin);
    expect(PLAN[2].arriveMin).toBeGreaterThan(PLAN[1].arriveMin + PLAN[1].dwellMin);
  });

  it('takes the first stop as given, pinned or not', () => {
    expect(retime([at(LAKE, 9 * 60), at(CAFE, 0)])[0].arriveMin).toBe(540);
  });

  it('leaves a pinned time exactly where the reader put it', () => {
    const out = retime([at(LAKE, 18 * 60), at(CAFE, 20 * 60, true), at(WEST, 0)]);
    expect(out[1].arriveMin).toBe(1200);
    expect(out[2].arriveMin).toBeGreaterThan(1200);
  });

  it('still spaces stops that have no coordinates between them', () => {
    const out = retime([at(LAKE, 18 * 60), at(NOWHERE, 0)]);
    expect(out[1].arriveMin).toBe(1080 + 60 + 20);
  });

  it('takes an anchor when the caller knows when the plan starts', () => {
    // Every edit that can change which stop is first passes this, so the
    // evening does not lurch to whatever hour the new first stop was
    // carrying from a journey that no longer happens.
    const out = retime([at(CAFE, 19 * 60 + 3), at(WEST, 0)], 18 * 60);
    expect(out[0].arriveMin).toBe(1080);
    expect(out[1].arriveMin).toBeGreaterThan(1080);
  });

  it('has nothing to do for an empty plan', () => {
    expect(retime([])).toEqual([]);
  });
});

describe('nudge', () => {
  it('moves the stop and pins it', () => {
    const out = nudge(PLAN, 1, 30);
    expect(out[1].arriveMin).toBe(PLAN[1].arriveMin + 30);
    expect(out[1].pinned).toBe(true);
  });

  it('carries everything below it along', () => {
    const out = nudge(PLAN, 1, 30);
    expect(out[2].arriveMin).toBe(PLAN[2].arriveMin + 30);
  });

  it('leaves what is above it alone', () => {
    expect(nudge(PLAN, 2, 45)[0].arriveMin).toBe(PLAN[0].arriveMin);
    expect(nudge(PLAN, 2, 45)[1].arriveMin).toBe(PLAN[1].arriveMin);
  });

  // The failure this whole file exists to prevent: nudge dinner, add a
  // bar, and dinner is quietly back where the planner had it.
  it('never lets a later edit undo a time the reader set', () => {
    const nudged = nudge(PLAN, 1, 60);
    const after = insert(nudged, at(CAFE, 0), 0);
    expect(after.find((s) => s.pinned)!.arriveMin).toBe(nudged[1].arriveMin);
  });

  it('stops at the edges of the day rather than wrapping', () => {
    expect(nudge([at(LAKE, 5)], 0, -60)[0].arriveMin).toBe(0);
    expect(nudge([at(LAKE, 23 * 60 + 55)], 0, 60)[0].arriveMin).toBe(24 * 60 - 1);
  });

  it('ignores an index that is not in the list', () => {
    expect(nudge(PLAN, 9, 30)).toEqual(PLAN);
    expect(nudge(PLAN, -1, 30)).toEqual(PLAN);
  });
});

describe('move', () => {
  it('reorders the stops', () => {
    expect(move(PLAN, 0, 2).map((s) => s.place.slug)).toEqual(['cafe', 'west', 'lake']);
    expect(move(PLAN, 2, 0).map((s) => s.place.slug)).toEqual(['west', 'lake', 'cafe']);
  });

  // The times stay with the positions, not with the stops: a list with
  // times down the left is an itinerary, and dragging inside it means
  // "go here at this point in the evening".
  it('leaves the hours where they were', () => {
    expect(move(PLAN, 0, 2)[0].arriveMin).toBe(PLAN[0].arriveMin);
  });

  it('carries a pin along with the stop it belongs to', () => {
    const pinned = nudge(PLAN, 2, 30);
    const moved = move(pinned, 2, 0);
    expect(moved[0].place.slug).toBe('west');
    expect(moved[0].pinned).toBe(true);
  });

  it('does nothing for a drag that ends nowhere', () => {
    expect(move(PLAN, 1, 1)).toEqual(PLAN);
    expect(move(PLAN, 0, 9)).toEqual(PLAN);
  });
});

describe('remove', () => {
  it('takes the stop out', () => {
    expect(remove(PLAN, 1).map((s) => s.place.slug)).toEqual(['lake', 'west']);
  });

  it('keeps the plan starting when it started', () => {
    // Otherwise deleting the first stop moves the evening earlier, because
    // the new first stop kept a time computed from a journey that no
    // longer happens.
    expect(remove(PLAN, 0)[0].arriveMin).toBe(PLAN[0].arriveMin);
  });

  it('closes the gap for everything below', () => {
    const out = remove(PLAN, 1);
    expect(out[1].arriveMin).toBeLessThan(PLAN[2].arriveMin);
  });

  it('leaves nothing behind for the last stop', () => {
    expect(remove([at(LAKE, 60)], 0)).toEqual([]);
  });

  it('ignores an index that is not in the list', () => {
    expect(remove(PLAN, 9)).toEqual(PLAN);
  });
});

describe('insert', () => {
  it('adds at the end by default', () => {
    expect(insert(PLAN, at(CAFE, 0)).map((s) => s.place.slug))
      .toEqual(['lake', 'cafe', 'west', 'cafe']);
  });

  it('adds in the middle and pushes the rest back', () => {
    const out = insert(PLAN, at(CAFE, 0), 1);
    expect(out).toHaveLength(4);
    expect(out[3].arriveMin).toBeGreaterThan(PLAN[2].arriveMin);
  });

  it('keeps the plan starting when it started, even inserting first', () => {
    expect(insert(PLAN, at(CAFE, 0), 0)[0].arriveMin).toBe(PLAN[0].arriveMin);
  });

  it('never arrives pinned — the plan gives it its time', () => {
    expect(insert(PLAN, { ...at(CAFE, 99), pinned: true }, 1)[1].pinned).toBe(false);
  });

  it('clamps an index past the ends rather than throwing', () => {
    expect(insert(PLAN, at(CAFE, 0), 99)).toHaveLength(4);
    expect(insert(PLAN, at(CAFE, 0), -5)).toHaveLength(4);
  });

  it('starts a plan from nothing', () => {
    expect(insert([], at(LAKE, 18 * 60))).toHaveLength(1);
  });
});

describe('outOfOrder', () => {
  it('is quiet about a plan that runs forwards', () => {
    expect(outOfOrder(PLAN)).toEqual([]);
    expect(outOfOrder([])).toEqual([]);
  });

  // Two pins can contradict each other, and refusing the second would be
  // arguing with a reader who is one tap from fixing the first.
  it('names the stop that reads backwards', () => {
    const pinned = nudge(nudge(PLAN, 1, 120), 2, -240);
    expect(outOfOrder(pinned)).toContain(2);
  });
});

describe('legsOfPlan and windowOf', () => {
  it('gives one journey fewer than there are stops', () => {
    expect(legsOfPlan(PLAN)).toHaveLength(2);
    expect(legsOfPlan(PLAN)[0]!.mode).toBe('walk');
    expect(legsOfPlan(PLAN)[1]!.mode).toBe('ride');
  });

  it('runs from the first arrival to the last departure', () => {
    const [from, to] = windowOf(PLAN);
    expect(from).toBe(PLAN[0].arriveMin);
    expect(to).toBe(PLAN[2].arriveMin + PLAN[2].dwellMin);
  });

  it('is nothing at all for an empty plan', () => {
    expect(windowOf([])).toEqual([0, 0]);
  });
});
