import { describe, expect, it } from 'vitest';
import {
  BAYES_PRIOR, bayesRating, type HoldingList, POPULAR_SHOWN, POPULAR_WEIGHTS,
  rankPopular,
} from './popular';

const place = (slug: string, rating: number | null = null, count: number | null = null) => (
  { slug, rating, rating_count: count }
);

const list = (slug: string, ...members: (string | null)[]): HoldingList => ({
  slug,
  collection_places: members.map((m) => ({ places: m == null ? null : { slug: m } })),
});

describe('bayesRating', () => {
  it('shrinks a tiny sample toward the mean', () => {
    // Three perfect reviews against a 4.2 city: the prior's ten phantom
    // votes pull it most of the way back.
    expect(bayesRating(5, 3, 4.2)).toBeCloseTo((3 * 5 + 10 * 4.2) / 13, 10);
  });

  it('lets a large sample keep its own rating', () => {
    expect(bayesRating(4.7, 2000, 4.2)).toBeCloseTo(4.7, 1);
  });

  it('an unrated place sits exactly at the mean', () => {
    expect(bayesRating(null, null, 4.2)).toBe(4.2);
    // A count with no rating is noise, not evidence.
    expect(bayesRating(null, 500, 4.2)).toBe(4.2);
  });

  it('a rating with no count counts as zero reviews', () => {
    expect(bayesRating(5, null, 4)).toBe(4);
  });

  it('takes a custom prior', () => {
    expect(bayesRating(5, 10, 4, 0)).toBe(5);
  });
});

describe('rankPopular', () => {
  it('an empty catalog ranks to nothing', () => {
    expect(rankPopular([], [], {})).toEqual([]);
  });

  it('a well-reviewed 4.7 beats a three-review 5.0', () => {
    const out = rankPopular(
      [place('tiny-perfect', 5, 3), place('crowd-favourite', 4.7, 2000)],
      [], {},
    );
    expect(out.map((p) => p.slug)).toEqual(['crowd-favourite', 'tiny-perfect']);
  });

  it('curation lifts a place the crowd has not found yet', () => {
    // Same rating and volume; one place sits on three lists.
    const places = [place('unlisted', 4.5, 100), place('listed', 4.5, 100)];
    const cols = [list('a', 'listed'), list('b', 'listed'), list('c', 'listed')];
    const out = rankPopular(places, cols, {});
    expect(out[0].slug).toBe('listed');
  });

  it('inherited likes break a curation tie', () => {
    const places = [place('liked', 4.5, 100), place('unliked', 4.5, 100)];
    const cols = [list('loved', 'liked'), list('quiet', 'unliked')];
    const out = rankPopular(places, cols, { loved: 12 });
    expect(out[0].slug).toBe('liked');
  });

  it('a list naming a place twice counts it once', () => {
    const places = [place('twice', 4.5, 100), place('thrice', 4.5, 100)];
    const cols = [
      list('a', 'twice', 'twice'),
      list('b', 'thrice'), list('c', 'thrice'), list('d', 'thrice'),
    ];
    expect(rankPopular(places, cols, {})[0].slug).toBe('thrice');
  });

  it('a membership row with no place resolves to nobody', () => {
    const out = rankPopular(
      [place('a', 4, 10), place('b', 4, 10)],
      [list('broken', null, 'a')], {},
    );
    expect(out[0].slug).toBe('a');
  });

  it('an all-unrated catalog still orders, by what remains', () => {
    // No ratings anywhere: mean is zero, quality and volume are silent,
    // and curation alone decides.
    const places = [place('plain'), place('saved')];
    const out = rankPopular(places, [list('l', 'saved')], {});
    expect(out[0].slug).toBe('saved');
  });

  it('a rated place with no count ranks like an unreviewed one', () => {
    // Google sometimes hands over a star with no tally under it; the
    // volume signal treats that as zero reviews, not as a crash.
    const out = rankPopular(
      [place('counted', 4.5, 200), place('uncounted', 4.5, null)],
      [], {},
    );
    expect(out[0].slug).toBe('counted');
  });

  it('cuts at the limit, default POPULAR_SHOWN', () => {
    const many = Array.from({ length: 9 }, (_, i) => place(`p${i}`, 4, 10));
    expect(rankPopular(many, [], {})).toHaveLength(POPULAR_SHOWN);
    expect(rankPopular(many, [], {}, 2)).toHaveLength(2);
  });

  it('a full tie orders by rating, then slug — stable, not random', () => {
    // Identical signals: rating equal too, so slugs decide.
    const out = rankPopular([place('zeta', 4, 10), place('alpha', 4, 10)], [], {});
    expect(out.map((p) => p.slug)).toEqual(['alpha', 'zeta']);
    // Rating differs but shrinks to the same neighbourhood? No — make the
    // scores tie exactly by giving no signals at all, and let raw rating win.
    const rated = rankPopular([place('low'), place('high', 5, 0), place('none')], [], {}, 3);
    expect(rated[0].slug).toBe('high');
  });

  it('weights sum to one, so the score reads as a share', () => {
    const sum = Object.values(POPULAR_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(BAYES_PRIOR).toBeGreaterThan(0);
  });
});
