import { describe, expect, it } from 'vitest';
import { AHEAD, nearEnd } from './feed';

const at = (y: number, content: number, screen = 800) => ({
  contentOffset: { y }, contentSize: { height: content }, layoutMeasurement: { height: screen },
});

describe('nearEnd', () => {
  it('is false while more than a screen and a half is left under the screen', () => {
    // 5000 of content, 800 showing from the top: 4200 left, 1200 is the line.
    expect(nearEnd(at(0, 5000))).toBe(false);
    expect(nearEnd(at(3000, 5000))).toBe(false);
  });

  it('turns true exactly where less than a screen and a half is left', () => {
    // left = 5000 - (y + 800); the line is 800 × 1.5 = 1200 → y = 3000.
    expect(AHEAD).toBe(1.5);
    expect(nearEnd(at(3000, 5000))).toBe(false);
    expect(nearEnd(at(3001, 5000))).toBe(true);
    expect(nearEnd(at(4200, 5000))).toBe(true);
  });

  it('is true at once on a page shorter than what it would wait for', () => {
    expect(nearEnd(at(0, 1500))).toBe(true);
  });

  it('takes another distance when given one', () => {
    expect(nearEnd(at(3500, 5000), 0.5)).toBe(false);
    expect(nearEnd(at(3801, 5000), 0.5)).toBe(true);
  });

  it('is false before anything is laid out', () => {
    expect(nearEnd(at(0, 0, 0))).toBe(false);
  });
});
