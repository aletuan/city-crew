import { describe, expect, it } from 'vitest';
import { orderLooks, parseSeen, POPULAR_SHOWN, popularLooks, SEEN_LOOKS_KEY, serializeSeen, unseenLooks } from './lookLabels';
import { PINNED, type Pinned } from './look';

const looks = Object.keys(PINNED) as Pinned[];

describe('popularLooks', () => {
  it('keeps the server’s order, and no more than three', () => {
    expect(popularLooks(['wine', 'coffee', 'cosmic', 'navy', 'rose'], looks)).toEqual(['wine', 'coffee', 'cosmic']);
    expect(POPULAR_SHOWN).toBe(3);
  });

  // Dark can be the most worn setting of all; the grounds are a list and
  // carry no word, and the slot it would take goes to the next look.
  it('passes over a ground the server named, and anything it does not know', () => {
    expect(popularLooks([], looks)).toEqual([]);
    expect(popularLooks(['dark', 'system'], looks)).toEqual([]);
    expect(popularLooks(['dark', 'plum', 'light', 'wine', 'lavender', 'rose', 'coffee'], looks)).toEqual(['plum', 'wine', 'rose']);
  });
});

describe('the ids last shown', () => {
  it('reads back what it wrote', () => {
    expect(parseSeen(serializeSeen(['coffee', 'rose']))).toEqual(['coffee', 'rose']);
    expect(SEEN_LOOKS_KEY).toBe('citycrew.seenLooks');
  });

  // Null is "never opened", and it is the one answer that must survive
  // a memory that cannot be read: a broken value labelling every card
  // "New" is the failure the first-opening rule exists to prevent.
  it('reads nothing, a broken value and a wrong shape as never opened', () => {
    expect(parseSeen(null)).toBeNull();
    expect(parseSeen(undefined)).toBeNull();
    expect(parseSeen('')).toBeNull();
    expect(parseSeen('{not json')).toBeNull();
    expect(parseSeen('{"a":1}')).toBeNull();
    expect(parseSeen('"coffee"')).toBeNull();
  });

  it('keeps only the strings of a list it can read', () => {
    expect(parseSeen('["coffee", 3, null, "rose"]')).toEqual(['coffee', 'rose']);
    expect(parseSeen('[]')).toEqual([]);
  });
});

describe('unseenLooks', () => {
  it('names the looks that were not on the sheet last time', () => {
    const before = looks.filter((l) => l !== 'plum' && l !== 'wine');
    expect(unseenLooks(before, looks)).toEqual(['plum', 'wine']);
    expect(unseenLooks(looks, looks)).toEqual([]);
  });

  it('names nothing on the first opening, when every look would be new', () => {
    expect(unseenLooks(null, looks)).toEqual([]);
    // An empty memory is not the same as none: a sheet that once showed
    // no looks (the web build) and now shows fourteen has fourteen new.
    expect(unseenLooks([], looks)).toEqual(looks);
  });
});

// The sheet's order (18 Oct 2026): the worn look, the popular ones, the
// rest — the last two in the catalogue's order.
describe('orderLooks', () => {
  const L: Pinned[] = ['coffee', 'rose', 'blush', 'slate', 'cosmic', 'wine'];

  it('is the catalogue untouched with nothing worn and nothing popular', () => {
    expect(orderLooks(L, null, [])).toEqual(L);
  });

  it('puts the worn look first, then the popular in the catalogue\'s order, then the rest in it', () => {
    // The server's rank is wine, slate; the front reads slate, wine.
    expect(orderLooks(L, 'cosmic', ['wine', 'slate'])).toEqual(['cosmic', 'slate', 'wine', 'coffee', 'rose', 'blush']);
  });

  it('shows a look that is both worn and popular once, first', () => {
    expect(orderLooks(L, 'wine', ['wine', 'rose'])).toEqual(['wine', 'rose', 'coffee', 'blush', 'slate', 'cosmic']);
  });

  it('ignores a worn or popular id that is not on the sheet', () => {
    expect(orderLooks(L, 'navy', ['maroon'])).toEqual(L);
  });

  // Two looks trading places in the server's rank moves nothing.
  it('does not move when the popular looks only change rank', () => {
    expect(orderLooks(L, null, ['wine', 'rose'])).toEqual(orderLooks(L, null, ['rose', 'wine']));
  });
});
