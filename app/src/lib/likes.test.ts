import { describe, expect, it } from 'vitest';
import { likesWorthShowing, LIKES_SHOWN_FROM, rankByLikes, type Rankable } from './likes';

const c = (slug: string, created_at?: string | null, sort_order?: number | null): Rankable =>
  ({ slug, created_at, sort_order });

const slugs = (xs: readonly Rankable[]) => xs.map((x) => x.slug);

describe('rankByLikes', () => {
  // The property that makes this safe to ship before anybody has tapped
  // anything: with no likes at all, the shelf is the shelf it is today.
  it('falls back to the old order when nothing is liked', () => {
    const shelf = [
      c('old-desk-1', '2026-08-13', 1),
      c('new-user', '2026-08-16', null),
      c('old-desk-2', '2026-08-13', 2),
    ];
    expect(slugs(rankByLikes(shelf, {}))).toEqual(['new-user', 'old-desk-1', 'old-desk-2']);
  });

  it('puts the most liked first, whatever its date', () => {
    const shelf = [c('new', '2026-08-16'), c('old', '2026-08-01')];
    expect(slugs(rankByLikes(shelf, { old: 3 }))).toEqual(['old', 'new']);
  });

  // The seeded rows all share one timestamp, so time separates none of
  // them and `sort_order` is the only answer they have.
  it('uses the desk sequence for rows sharing a timestamp', () => {
    const same = '2026-08-13';
    const shelf = [c('c', same, 3), c('a', same, 1), c('b', same, 2)];
    expect(slugs(rankByLikes(shelf, {}))).toEqual(['a', 'b', 'c']);
  });

  // A row nobody sequenced must not outrank one somebody did — which is
  // what a numeric fallback would do if it were smaller than a real value.
  it('sinks an unsequenced row below every sequenced one', () => {
    const same = '2026-08-13';
    const shelf = [c('none', same, null), c('last', same, 99)];
    expect(slugs(rankByLikes(shelf, {}))).toEqual(['last', 'none']);
  });

  // Two seeded rows can share a timestamp *and* a null sort_order. Without
  // a final total key the comparator returns 0 and the engine is free to
  // order them differently between two openings of the same screen.
  it('is stable for rows that every other key ties', () => {
    const same = '2026-08-13';
    const shelf = [c('zulu', same, null), c('alpha', same, null), c('mike', same, null)];
    const once = slugs(rankByLikes(shelf, {}));
    const twice = slugs(rankByLikes([...shelf].reverse(), {}));
    expect(once).toEqual(['alpha', 'mike', 'zulu']);
    expect(twice).toEqual(once);
  });

  it('does not disturb the array it was given', () => {
    const shelf = [c('a', '2026-08-01'), c('b', '2026-08-02')];
    const before = slugs(shelf);
    rankByLikes(shelf, { a: 9 });
    expect(slugs(shelf)).toEqual(before);
  });

  it('treats a collection missing from the counts as unliked', () => {
    const shelf = [c('counted', '2026-08-01'), c('absent', '2026-08-02')];
    expect(slugs(rankByLikes(shelf, { counted: 1 }))).toEqual(['counted', 'absent']);
  });

  it('survives a shelf with no dates and no sequence at all', () => {
    expect(slugs(rankByLikes([c('b'), c('a')], {}))).toEqual(['a', 'b']);
  });

  it('returns an empty shelf unchanged', () => {
    expect(rankByLikes([], { anything: 4 })).toEqual([]);
  });
});

describe('likesWorthShowing', () => {
  // Zero is the case this exists for: it does not read as "no votes yet",
  // it reads as "nobody liked this", about every list on the shelf.
  it('hides a count that would libel the list', () => {
    expect(likesWorthShowing(0)).toBe(false);
    expect(likesWorthShowing(undefined)).toBe(false);
    expect(likesWorthShowing(LIKES_SHOWN_FROM - 1)).toBe(false);
  });

  it('shows a count once it cannot be one person and their friends', () => {
    expect(likesWorthShowing(LIKES_SHOWN_FROM)).toBe(true);
    expect(likesWorthShowing(40)).toBe(true);
  });
});
