import { describe, expect, it } from 'vitest';
import { legBetween, legsOf, totalKm } from './travel';

// Real coordinates from the Hanoi catalog, because a routing rule that
// works on toy inputs and calls a seven-kilometre hop a walk has passed
// nothing. These three are roughly: the lake in the old quarter, a café
// two streets away, and the Long Biên bridge across the river.
const HOAN_KIEM = { lat: 21.0287, lng: 105.8524 };
const NEARBY_CAFE = { lat: 21.0301, lng: 105.8510 };   // ~200 m away
const LONG_BIEN = { lat: 21.0447, lng: 105.8600 };     // ~1.9 km away
const WEST_LAKE = { lat: 21.0587, lng: 105.8180 };     // ~5 km away
const NO_COORDS = { lat: null, lng: null };

describe('legBetween', () => {
  it('walks a couple of streets', () => {
    const leg = legBetween(HOAN_KIEM, NEARBY_CAFE)!;
    expect(leg.mode).toBe('walk');
    expect(leg.km).toBeLessThan(0.3);
    // Two hundred metres, detoured and paced: a few minutes, not seconds.
    expect(leg.minutes).toBeGreaterThanOrEqual(2);
    expect(leg.minutes).toBeLessThan(6);
  });

  it('rides across the river rather than marching', () => {
    const leg = legBetween(HOAN_KIEM, LONG_BIEN)!;
    expect(leg.mode).toBe('ride');
    // The failure this guards is the opposite classification: two
    // kilometres called a walk is twenty-five minutes the plan does not
    // budget for.
    expect(leg.minutes).toBeLessThan(15);
  });

  it('rides five kilometres, and takes longer over it', () => {
    const near = legBetween(HOAN_KIEM, LONG_BIEN)!;
    const far = legBetween(HOAN_KIEM, WEST_LAKE)!;
    expect(far.mode).toBe('ride');
    expect(far.minutes).toBeGreaterThan(near.minutes);
  });

  it('never returns a journey shorter than the walk to the door', () => {
    // Same coordinates: not a zero-minute trip, because two stops at one
    // pin are a data problem and the plan should not claim teleportation.
    expect(legBetween(HOAN_KIEM, HOAN_KIEM)!.minutes).toBeGreaterThanOrEqual(2);
  });

  it('says nothing rather than guessing when a stop has no coordinates', () => {
    expect(legBetween(HOAN_KIEM, NO_COORDS)).toBeNull();
    expect(legBetween(NO_COORDS, HOAN_KIEM)).toBeNull();
    expect(legBetween({}, HOAN_KIEM)).toBeNull();
  });

  it('does not care which way round you ask', () => {
    const there = legBetween(HOAN_KIEM, WEST_LAKE)!;
    const back = legBetween(WEST_LAKE, HOAN_KIEM)!;
    expect(there.minutes).toBe(back.minutes);
    expect(there.mode).toBe(back.mode);
  });

  it('allows for streets rather than measuring through buildings', () => {
    // A straight line at walking pace would be 12 min/km. The detour
    // factor is what stops every leg being optimistic by a third, and a
    // mutation removing it should fail here.
    const leg = legBetween(HOAN_KIEM, LONG_BIEN)!;
    expect(leg.minutes).toBeGreaterThan(leg.km * 2.5);
  });
});

describe('legsOf', () => {
  it('gives one journey fewer than there are stops', () => {
    expect(legsOf([HOAN_KIEM, NEARBY_CAFE, LONG_BIEN])).toHaveLength(2);
    expect(legsOf([HOAN_KIEM])).toHaveLength(0);
    expect(legsOf([])).toHaveLength(0);
  });

  it('keeps an unmeasurable leg in place instead of closing the gap', () => {
    // Index i is the journey *out of* stop i. Dropping the null would
    // attach the second leg's distance to the first stop — an off-by-one
    // that reads as plausible on screen.
    const legs = legsOf([HOAN_KIEM, NO_COORDS, LONG_BIEN, WEST_LAKE]);
    expect(legs).toHaveLength(3);
    expect(legs[0]).toBeNull();
    expect(legs[1]).toBeNull();
    expect(legs[2]).not.toBeNull();
  });
});

describe('totalKm', () => {
  it('adds up what it can measure', () => {
    const legs = legsOf([HOAN_KIEM, LONG_BIEN, WEST_LAKE]);
    expect(totalKm(legs)).toBeCloseTo(legs[0]!.km + legs[1]!.km, 5);
  });

  it('counts an unmeasurable leg as nothing rather than giving up', () => {
    // Four stops out of five known is still a useful total, and the
    // caller printing it already says "about".
    const legs = legsOf([HOAN_KIEM, NO_COORDS, WEST_LAKE]);
    expect(totalKm(legs)).toBe(0);
    expect(totalKm([])).toBe(0);
  });
});
