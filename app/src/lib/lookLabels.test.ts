import { describe, expect, it } from 'vitest';
import { parseSeen, POPULAR_SHOWN, popularLooks, SEEN_LOOKS_KEY, serializeSeen, unseenLooks } from './lookLabels';
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
