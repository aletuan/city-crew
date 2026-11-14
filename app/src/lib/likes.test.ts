import { describe, expect, it } from 'vitest';
import {
  countsNow, likedNow, likesWorthShowing, LIKES_SHOWN_FROM, NO_PENDING, settled,
  type Pending,
} from './likes';

describe('likesWorthShowing', () => {
  // Zero is the case this exists for: it does not read as "no votes yet",
  // it reads as "nobody liked this", about every list on the shelf.
  it('hides a count that would libel the list', () => {
    expect(likesWorthShowing(0)).toBe(false);
  });

  // A private list is never in the counts at all — `collection_like_counts()`
  // returns public rows only, and the insert policy refuses a like on
  // anything else. So `undefined` is not a gap in the data, it is a list
  // nobody *can* like, and printing `0` beside it would answer a question
  // that was never asked.
  it('hides a list that cannot be liked in the first place', () => {
    expect(likesWorthShowing(undefined)).toBe(false);
  });

  // One, not five. Every count in the database is currently `1`, so a
  // higher floor would not soften the tally, it would delete it — see the
  // constant's own note.
  it('shows the first real like', () => {
    expect(LIKES_SHOWN_FROM).toBe(1);
    expect(likesWorthShowing(1)).toBe(true);
    expect(likesWorthShowing(40)).toBe(true);
  });
});

// Taps happen at t=100 unless a case says otherwise. A counts snapshot at
// t=50 predates them (stale), one at t=150 contains them (fresh).
const tap = (slug: string, liked: boolean, at = 100): Pending[string] => ({ slug, liked, at });
const STALE = 50;
const FRESH = 150;

describe('likedNow', () => {
  it('is the server answer when nothing has been tapped', () => {
    expect(likedNow(['a', 'b'], NO_PENDING).sort()).toEqual(['a', 'b']);
  });

  // The whole point: the heart fills on the tap, not on the round trip.
  it('fills a heart the server has not heard about yet', () => {
    expect(likedNow([], { a: tap('alpha', true) })).toEqual(['a']);
  });

  it('empties one the server still thinks is liked', () => {
    expect(likedNow(['a'], { a: tap('alpha', false) })).toEqual([]);
  });

  // A refused write is not a state: the caller drops the entry and the
  // heart goes back to whatever the database actually holds.
  it('returns to the server answer once a tap is dropped', () => {
    expect(likedNow(['a'], NO_PENDING)).toEqual(['a']);
  });

  it('does not double-count a tap the server has already agreed with', () => {
    expect(likedNow(['a'], { a: tap('alpha', true) })).toEqual(['a']);
  });
});

describe('countsNow', () => {
  it('hands back the very same map when no tap changes anything', () => {
    const counts = { alpha: 7 };
    expect(countsNow(counts, FRESH, { a: tap('alpha', true) })).toBe(counts);
    expect(countsNow(counts, STALE, NO_PENDING)).toBe(counts);
  });

  it('moves the tally with the heart', () => {
    expect(countsNow({ alpha: 7 }, STALE, { a: tap('alpha', true) })).toEqual({ alpha: 8 });
    expect(countsNow({ alpha: 7 }, STALE, { a: tap('alpha', false) })).toEqual({ alpha: 6 });
  });

  // The regression this layer was rebuilt for: the reader's own likes
  // confirmed the row while the counts still rode the slow lane, and the
  // tally flicked 3 → 2 → 3. The claim must outlive that confirmation —
  // only a snapshot fetched after the tap may retire it.
  it('holds the claim over a snapshot older than the tap', () => {
    expect(countsNow({ alpha: 2 }, STALE, { a: tap('alpha', true) })).toEqual({ alpha: 3 });
    expect(countsNow({ alpha: 2 }, null, { a: tap('alpha', true) })).toEqual({ alpha: 3 });
  });

  it('stands down once the snapshot postdates the tap', () => {
    const fresh = { alpha: 3 };
    expect(countsNow(fresh, FRESH, { a: tap('alpha', true) })).toBe(fresh);
  });

  it('counts a first like on a list that has never been counted', () => {
    expect(countsNow({}, null, { a: tap('alpha', true) })).toEqual({ alpha: 1 });
  });

  // The counts are public and a tap is local, so nothing promises the
  // snapshot and the claim describe the same instant.
  it('refuses to print a negative tally', () => {
    expect(countsNow({ alpha: 0 }, STALE, { a: tap('alpha', false) })).toEqual({ alpha: 0 });
  });

  it('leaves every other list alone', () => {
    expect(countsNow({ alpha: 7, beta: 2 }, STALE, { a: tap('alpha', true) }))
      .toEqual({ alpha: 8, beta: 2 });
  });
});

describe('settled', () => {
  it('hands back the very same map while every tap is still in flight', () => {
    const pending: Pending = { a: tap('alpha', true) };
    expect(settled(pending, [], STALE)).toBe(pending);
    expect(settled(NO_PENDING, ['a'], FRESH)).toBe(NO_PENDING);
  });

  it('forgets a tap once both witnesses have caught up', () => {
    expect(settled({ a: tap('alpha', true) }, ['a'], FRESH)).toEqual({});
    expect(settled({ a: tap('alpha', false) }, [], FRESH)).toEqual({});
  });

  // One witness is not enough — this is the drop that caused the flicker.
  it('keeps a tap the likes confirmed while the counts have not', () => {
    const pending: Pending = { a: tap('alpha', true) };
    expect(settled(pending, ['a'], STALE)).toBe(pending);
    expect(settled(pending, ['a'], null)).toBe(pending);
  });

  it('keeps a tap the counts postdate while the likes disagree', () => {
    const pending: Pending = { a: tap('alpha', true) };
    expect(settled(pending, [], FRESH)).toBe(pending);
  });

  it('keeps the ones still in flight when only some have landed', () => {
    const pending: Pending = { a: tap('alpha', true), b: tap('beta', true) };
    expect(settled(pending, ['a', 'b'], 120)).toEqual({});
    expect(settled({ a: tap('alpha', true, 100), b: tap('beta', true, 200) }, ['a', 'b'], 150))
      .toEqual({ b: tap('beta', true, 200) });
  });
});
