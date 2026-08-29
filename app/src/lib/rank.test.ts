import { describe, expect, it } from 'vitest';
import { bestFirst, TASTE_LIFT, type Rated } from './rank';

const p = (slug: string, rating: number | null, count = 0): Rated =>
  ({ slug, rating, rating_count: count });

/** A taste that likes exactly the slugs named, worth a full point each —
 *  the most `taste.ts` can ever return, so these tests exercise the top
 *  of the budget rather than a fraction of it. */
const likes = (slugs: string[]) => ({
  affinity: (x: Rated) => (slugs.includes(x.slug) ? 1 : 0),
});

describe('bestFirst', () => {
  it('puts the better rating first', () => {
    expect(bestFirst([p('b', 4.5), p('a', 4.8)]).map((x) => x.slug)).toEqual(['a', 'b']);
  });

  // Unrated is −1, not 0: a place the desk has not rated yet must not sit
  // among the fours, and must not sit above a 3.6 either.
  it('keeps a rated place above an unrated one', () => {
    expect(bestFirst([p('none', null), p('poor', 3.6)]).map((x) => x.slug))
      .toEqual(['poor', 'none']);
  });

  it('breaks a tied rating on the review count', () => {
    expect(bestFirst([p('few', 4.5, 3), p('many', 4.5, 900)]).map((x) => x.slug))
      .toEqual(['many', 'few']);
  });

  // The property the last tie exists for: same rating, same count, and
  // the answer must not depend on which order they arrived in.
  it('lands on the same order whichever way the input came', () => {
    expect(bestFirst([p('z', 4.5), p('a', 4.5)]).map((x) => x.slug)).toEqual(['a', 'z']);
    expect(bestFirst([p('a', 4.5), p('z', 4.5)]).map((x) => x.slug)).toEqual(['a', 'z']);
  });

  it('does not mutate what it was given', () => {
    const input = [p('b', 4.5), p('a', 4.8)];
    bestFirst(input);
    expect(input.map((x) => x.slug)).toEqual(['b', 'a']);
  });
});

// The whole argument for the size of the lift: it must be decisive inside
// the band the catalog actually occupies, and powerless outside it. Both
// halves are asserted, because a number that only satisfies the first is
// a number that lets a mediocre place lead the guide.
describe('what a taste is allowed to do', () => {
  it('changes nothing without one', () => {
    const places = [p('a', 4.6), p('b', 4.9)];
    expect(bestFirst(places).map((x) => x.slug)).toEqual(['b', 'a']);
    expect(bestFirst(places, null).map((x) => x.slug)).toEqual(['b', 'a']);
  });

  it('reorders the pack rating cannot separate', () => {
    const places = [p('rest', 4.9), p('cafe', 4.8)];
    expect(bestFirst(places).map((x) => x.slug)).toEqual(['rest', 'cafe']);
    expect(bestFirst(places, likes(['cafe'])).map((x) => x.slug)).toEqual(['cafe', 'rest']);
  });

  it('cannot lift a poor place over a good one', () => {
    const places = [p('good', 4.9), p('poor', 3.6)];
    expect(bestFirst(places, likes(['poor'])).map((x) => x.slug)).toEqual(['good', 'poor']);
  });

  // The other end of the same budget: a full point of dislike is −1,
  // and one standard deviation of that is still less than the gap
  // between the top of the pack and the bottom of it.
  it('cannot push a good place below a poor one', () => {
    const cold = { affinity: (x: Rated) => (x.slug === 'good' ? -1 : 0) };
    expect(bestFirst([p('good', 4.9), p('poor', 3.6)], cold).map((x) => x.slug))
      .toEqual(['good', 'poor']);
  });

  it('lifts an unrated place among its own kind and no further', () => {
    const out = bestFirst([p('rated', 3.6), p('liked', null), p('other', null)], likes(['liked']));
    expect(out.map((x) => x.slug)).toEqual(['rated', 'liked', 'other']);
  });

  // Pinned as a number, not just as an ordering: the value is the
  // measured spread of the catalog's ratings, and a change to it is a
  // claim about that measurement rather than a tuning knob.
  it('is worth one standard deviation of the catalog', () => {
    expect(TASTE_LIFT).toBe(0.23);
  });
});
