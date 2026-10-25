import { describe, expect, it } from 'vitest';
import { cutAt, cutScore, moreToTheRight, PEEK_HIDDEN, PEEK_SHOWN, peekGap, rowWidth, type PeekRow } from './peek';

const ROW: PeekRow = { padLeft: 22, base: 22, min: 14, max: 34 };
// The kinds as Explore draws them in Vietnamese, glyph and word: Cà phê,
// Học tập, Ăn uống, Ngắm cảnh, Mua sắm, Thiên nhiên, Văn hóa, Về đêm, Giải trí.
const KINDS_VI = [73, 78, 85, 103, 85, 100, 80, 75, 75];

describe('cutAt', () => {
  // Items at 22–122 and 144–244 with a 22 gap.
  it('says how much of the cut item shows and how much does not, and null in a gap', () => {
    expect(cutAt([100, 100], 22, 72, 22)).toEqual({ shown: 50, hidden: 50 });
    expect(cutAt([100, 100], 22, 184, 22)).toEqual({ shown: 40, hidden: 60 });
    expect(cutAt([100, 100], 22, 133, 22)).toBeNull();
    // Before the first item, or past the last: no item is cut.
    expect(cutAt([100, 100], 22, 10, 22)).toBeNull();
    expect(cutAt([100, 100], 22, 300, 22)).toBeNull();
  });
});

describe('cutScore', () => {
  it('is 1 when both targets are met, the shorter fall otherwise, and 0 for no cut', () => {
    expect(cutScore([100, 100], 22, 22 + 50, 22)).toBe(1);
    expect(cutScore([100, 100], 22, 22 + PEEK_SHOWN / 2, 22)).toBe(0.5);
    expect(cutScore([100, 100], 22, 122 - PEEK_HIDDEN / 4, 22)).toBe(0.25);
    expect(cutScore([100, 100], 22, 133, 22)).toBe(0);
  });
});

describe('rowWidth', () => {
  it('is the paddings, the items and the gaps between them', () => {
    expect(rowWidth([100, 80, 60], 20, 22, 22)).toBe(22 + 240 + 40 + 22);
    expect(rowWidth([100], 20, 22, 22)).toBe(144);
    expect(rowWidth([], 20, 22, 22)).toBe(44);
  });
});

describe('peekGap', () => {
  it('keeps the row’s own gap when everything fits', () => {
    expect(peekGap([60, 60, 60], 390, ROW)).toBe(22);
  });

  it('keeps the row’s own gap when it already cuts an item well', () => {
    // At 22 the fourth item runs 324–427: a 390 edge shows 66 and hides 37.
    expect(cutScore(KINDS_VI, 22, 390, 22)).toBe(1);
    expect(peekGap(KINDS_VI, 390, ROW)).toBe(22);
  });

  // The owner's screenshot: the edge fell in the gap after an item.
  it('moves the gap so an edge that fell in a gap cuts an item instead', () => {
    // At 22 the fourth item ends at 427 and the fifth starts at 449.
    expect(cutAt(KINDS_VI, 22, 438, 22)).toBeNull();
    const gap = peekGap(KINDS_VI, 438, ROW);
    expect(gap).not.toBe(22);
    expect(cutScore(KINDS_VI, gap, 438, 22)).toBe(1);
  });

  // Every phone width from 300 to 440: the gap stays in range and always
  // cuts something — the floor the module's header measured.
  it('cuts an item at every width, never worse than the measured floor', () => {
    for (let edge = 300; edge <= 440; edge++) {
      const gap = peekGap(KINDS_VI, edge, ROW);
      expect(gap).toBeGreaterThanOrEqual(ROW.min);
      expect(gap).toBeLessThanOrEqual(ROW.max);
      expect(cutScore(KINDS_VI, gap, edge, 22)).toBeGreaterThanOrEqual(0.56);
    }
  });

  // Items 100 wide from 22, an edge at 160. At 22 the second item starts
  // at 144, so 16 of it shows: half the target. A wider gap only pushes it
  // further right; a narrower one brings it in, and 6 shows the 32 wanted.
  it('finds the side of its own gap that works, however far', () => {
    const row: PeekRow = { padLeft: 22, base: 22, min: 4, max: 40 };
    expect(cutScore([100, 100, 100], 22, 160, 22)).toBe(0.5);
    const gap = peekGap([100, 100, 100], 160, row);
    expect(gap).toBe(6);
    expect(cutScore([100, 100, 100], gap, 160, 22)).toBe(1);
  });

  it('keeps its own gap when no gap in range cuts anything', () => {
    expect(peekGap([10, 10], 14, { padLeft: 0, base: 22, min: 20, max: 24 })).toBe(22);
  });
});

describe('moreToTheRight', () => {
  it('is true while the row runs past the edge, with a point of slack at the end', () => {
    expect(moreToTheRight(800, 390, 0)).toBe(true);
    expect(moreToTheRight(800, 390, 408)).toBe(true);
    expect(moreToTheRight(800, 390, 409.5)).toBe(false);
    expect(moreToTheRight(390, 390, 0)).toBe(false);
  });
});
