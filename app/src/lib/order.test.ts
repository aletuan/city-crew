import { describe, expect, it } from 'vitest';
import { moveItem, sameOrder } from './order';

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
