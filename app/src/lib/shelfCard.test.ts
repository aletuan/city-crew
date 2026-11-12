import { describe, expect, it } from 'vitest';
import { shelfRatio, SQUARE_BELOW } from './shelfCard';

describe('shelfRatio', () => {
  // The 667 class is the one where 4:5 hid the Places heading under the
  // tab bar on first open; see the table in shelfCard.ts.
  it('squares the card on a short phone', () => {
    expect(shelfRatio(667)).toBe(1);
    expect(shelfRatio(SQUARE_BELOW - 1)).toBe(1);
  });

  it('keeps 4:5 from the line up, the mini and X class included', () => {
    expect(shelfRatio(SQUARE_BELOW)).toBe(1.25);
    expect(shelfRatio(812)).toBe(1.25);
    expect(shelfRatio(852)).toBe(1.25);
  });

  it('draws the line where the heading meets the bar, between 746 and 765', () => {
    expect(SQUARE_BELOW).toBeGreaterThan(746);
    expect(SQUARE_BELOW).toBeLessThan(765);
  });
});
