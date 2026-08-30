import { describe, expect, it } from 'vitest';
import { bestFirst, shrunk, TASTE_LIFT, type Rated } from './rank';

// 5000 is about p90 of the real catalog. The default matters now that the
// score is shrunk toward the catalog mean: at a count of zero every place
// scores the mean and a test about rating order would be testing nothing.
// Production has no such place — of 385 published rated places, none has a
// null review count and none has zero — so the well-reviewed default is
// also the realistic one. Tests that are about the count pass their own.
const p = (slug: string, rating: number | null, count = 5000): Rated =>
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

  // The shrink does most of what this key used to do — two places sharing
  // a raw rating rarely share a shrunk one — so what is left for it is a
  // genuine tie in the score. Two unrated places are the exact case: both
  // score −1, and the better-known one goes first.
  it('puts the better-known of two equal scores first', () => {
    expect(bestFirst([p('obscure', null, 3), p('known', null, 900)]).map((x) => x.slug))
      .toEqual(['known', 'obscure']);
  });

  // The shelf bug this was written for: `Mậu Dịch Nguyễn Gia` held 5.0
  // from four reviews above every 4.9 in Hanoi.
  it('does not let a five from four reviews outrank a well-reviewed 4.9', () => {
    expect(bestFirst([p('thin', 5.0, 4), p('solid', 4.9, 900)]).map((x) => x.slug))
      .toEqual(['solid', 'thin']);
  });

  // ...and a well-evidenced five still wins, which is the other half of
  // the claim: this discounts thin evidence, not high scores.
  it('leaves a well-reviewed five on top', () => {
    expect(bestFirst([p('solid', 4.9, 900), p('five', 5.0, 218)]).map((x) => x.slug))
      .toEqual(['five', 'solid']);
  });

  // Shrinkage is symmetric, and this is the consequence worth stating
  // rather than discovering: a thin score *below* the catalog mean is
  // pulled up, so 4.5 from a dozen reviews sits above 4.5 from nine
  // hundred. It is the same claim in both directions — little evidence
  // means the catalog's average is the better guess — and it only
  // reorders the bottom of a catalog whose p25 is 4.50, while fixing the
  // top, where readers actually look.
  it('pulls a thinly-reviewed score up toward the mean as readily as down', () => {
    expect(bestFirst([p('thin', 4.5, 12), p('thick', 4.5, 900)]).map((x) => x.slug))
      .toEqual(['thin', 'thick']);
  });

  // The property the last tie exists for: same rating, same count, and
  // the answer must not depend on which order they arrived in.
  it('lands on the same order whichever way the input came', () => {
    expect(bestFirst([p('z', 4.5), p('a', 4.5)]).map((x) => x.slug)).toEqual(['a', 'z']);
    expect(bestFirst([p('a', 4.5), p('z', 4.5)]).map((x) => x.slug)).toEqual(['a', 'z']);
  });

  // The count is optional on the type even though no published place is
  // missing one. A rating that arrives without one claims nothing, which
  // is `shrunk` at a count of zero: the catalog's own average. So a bare
  // five loses to a 4.9 that six hundred people stood behind.
  it('treats a rating with no count behind it as the catalog average', () => {
    const bare: Rated = { slug: 'bare', rating: 5.0 };
    expect(bestFirst([bare, p('solid', 4.9, 900)]).map((x) => x.slug))
      .toEqual(['solid', 'bare']);
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

// The catalog's own numbers are deliberately absent from these: what is
// being proved is the arithmetic, which holds for any mean and any m.
describe('shrunk', () => {
  it('gives an unreviewed place exactly the mean, whatever it claims', () => {
    expect(shrunk(5.0, 0, 4.7, 50)).toBe(4.7);
    expect(shrunk(1.0, 0, 4.7, 50)).toBe(4.7);
  });

  it('leaves a place with its own rating once the reviews pile up', () => {
    expect(shrunk(5.0, 1_000_000, 4.7, 50)).toBeCloseTo(5.0, 4);
  });

  it('splits the difference at exactly m reviews', () => {
    expect(shrunk(5.0, 50, 4.7, 50)).toBeCloseTo(4.85, 10);
  });

  // The property that makes this safe to rank with: it moves a place
  // toward the middle and can never carry it past.
  it('never leaves the interval between the rating and the mean', () => {
    for (const count of [0, 1, 4, 50, 218, 5000]) {
      const up = shrunk(5.0, count, 4.7, 50);
      expect(up).toBeGreaterThanOrEqual(4.7);
      expect(up).toBeLessThanOrEqual(5.0);
      const down = shrunk(3.6, count, 4.7, 50);
      expect(down).toBeGreaterThanOrEqual(3.6);
      expect(down).toBeLessThanOrEqual(4.7);
    }
  });

  it('moves monotonically toward the rating as reviews accumulate', () => {
    const at = (n: number) => shrunk(5.0, n, 4.7, 50);
    expect(at(4)).toBeLessThan(at(50));
    expect(at(50)).toBeLessThan(at(218));
    expect(at(218)).toBeLessThan(at(900));
  });

  // A place that already agrees with the catalog has nothing to shrink.
  it('is a no-op when the rating is the mean', () => {
    for (const count of [0, 7, 400]) expect(shrunk(4.7, count, 4.7, 50)).toBeCloseTo(4.7, 10);
  });

  // The case that started this: the two places from the shelf, side by
  // side. The 218-review five keeps almost all of its score; the
  // four-review five falls below the 4.9 pack it was sitting above.
  it('separates a well-reviewed five from a four-review one', () => {
    const many = shrunk(5.0, 218, 4.7, 50);
    const few = shrunk(5.0, 4, 4.7, 50);
    expect(many).toBeGreaterThan(4.9);
    expect(few).toBeLessThan(4.8);
    expect(many).toBeGreaterThan(few);
  });
});
