import { describe, expect, it } from 'vitest';
import { dropSlot, moveItem, sameOrder, stepAside } from './order';

const LIST = ['a', 'b', 'c', 'd'];

describe('moveItem', () => {
  it('moves one down and closes the gap', () => {
    expect(moveItem(LIST, 0, 1)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('moves one up', () => {
    expect(moveItem(LIST, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('moves across the middle without losing anything', () => {
    expect(moveItem(LIST, 1, 3)).toEqual(['a', 'c', 'd', 'b']);
    expect(moveItem(LIST, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('leaves the original alone', () => {
    moveItem(LIST, 0, 3);
    expect(LIST).toEqual(['a', 'b', 'c', 'd']);
  });

  // The two buttons at the ends of the list press against these every time
  // somebody taps the one that cannot do anything.
  it('does nothing for a move that goes nowhere or off the end', () => {
    expect(moveItem(LIST, 1, 1)).toEqual(LIST);
    expect(moveItem(LIST, 0, -1)).toEqual(LIST);
    expect(moveItem(LIST, 3, 4)).toEqual(LIST);
    expect(moveItem(LIST, 9, 0)).toEqual(LIST);
  });

  it('has nothing to move in an empty list', () => {
    expect(moveItem([], 0, 0)).toEqual([]);
  });
});

describe('sameOrder', () => {
  it('is true for the same run', () => {
    expect(sameOrder(LIST, ['a', 'b', 'c', 'd'])).toBe(true);
  });

  it('is false once anything has swapped', () => {
    expect(sameOrder(LIST, moveItem(LIST, 0, 1))).toBe(false);
  });

  // Moved and moved back: nothing to write, and the Save button should say
  // so rather than firing four updates that change no row.
  it('is true again after a move is undone', () => {
    expect(sameOrder(LIST, moveItem(moveItem(LIST, 0, 2), 2, 0))).toBe(true);
  });

  it('is false for lists of different lengths', () => {
    expect(sameOrder(LIST, ['a', 'b', 'c'])).toBe(false);
  });

  it('is true for two empty lists', () => {
    expect(sameOrder([], [])).toBe(true);
  });
});

// Rows of different heights on purpose: a place with no neighbourhood is a
// line shorter, and a single row height put the drop a row off.
describe('dropSlot', () => {
  const pitches = [60, 40, 60, 60];

  it('stays put until the centre is past half the next row', () => {
    expect(dropSlot(pitches, 0, 0)).toBe(0);
    expect(dropSlot(pitches, 0, 19)).toBe(0);
    expect(dropSlot(pitches, 0, 20)).toBe(1);
  });

  it('counts the real height of each row it crosses', () => {
    // Past the 40 and half of the next 60: 40 + 30.
    expect(dropSlot(pitches, 0, 69)).toBe(1);
    expect(dropSlot(pitches, 0, 70)).toBe(2);
  });

  it('moves up the same way', () => {
    expect(dropSlot(pitches, 3, -29)).toBe(3);
    expect(dropSlot(pitches, 3, -30)).toBe(2);
    expect(dropSlot(pitches, 3, -80)).toBe(1);
  });

  it('stops at either end however far the finger goes', () => {
    expect(dropSlot(pitches, 1, 10_000)).toBe(3);
    expect(dropSlot(pitches, 2, -10_000)).toBe(0);
  });
});

describe('stepAside', () => {
  it('moves the rows passed on the way down up by the lifted pitch', () => {
    expect([0, 1, 2, 3].map((i) => stepAside(i, 0, 2, 60))).toEqual([0, -60, -60, 0]);
  });

  it('moves the rows passed on the way up down by it', () => {
    expect([0, 1, 2, 3].map((i) => stepAside(i, 3, 1, 60))).toEqual([0, 60, 60, 0]);
  });

  it('moves nothing while the row is over its own place', () => {
    expect([0, 1, 2].map((i) => stepAside(i, 1, 1, 60))).toEqual([0, 0, 0]);
  });
});
