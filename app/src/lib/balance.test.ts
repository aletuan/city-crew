// The break for a two-line headline. What is pinned: the second line is
// never left as one word when a better space exists; the top line stays
// the longer; the break only moves left of where the text wrapped; and a
// text with no such space, or one the desk broke by hand, is left alone.

import { describe, expect, it } from 'vitest';
import { balanceBreak } from './balance';

describe('balanceBreak', () => {
  // The first lines are the ones a 386pt column draws at 34pt, measured
  // off the font: see the note at the top of `balance.ts`.
  it.each([
    ['Mịt mù khói toả ngàn sương', 'Mịt mù khói toả ngàn ', 'Mịt mù khói toả\nngàn sương'],
    ['Bốn mùa trong một ngày', 'Bốn mùa trong một ', 'Bốn mùa trong\nmột ngày'],
    ['Ngọ Môn năm cửa chín lầu', 'Ngọ Môn năm cửa chín ', 'Ngọ Môn năm cửa\nchín lầu'],
  ])('breaks %j at the caesura, not before its last word', (text, first, want) => {
    expect(balanceBreak(text, first)).toBe(want);
  });

  // Top-heavy: of two spaces near the middle, the one that keeps the top
  // line at least as long as the bottom.
  it('keeps the top line the longer', () => {
    const out = balanceBreak('aaaa bbb cc dd ee', 'aaaa bbb cc dd ')!;
    const [top, bottom] = out.split('\n');
    expect(top).toBe('aaaa bbb');
    expect(top.length).toBeGreaterThanOrEqual(bottom.length);
  });

  // At the middle: an even split is taken, and a break one short of the
  // middle is not, because it would leave the bottom line the longer.
  it('takes an even split, and nothing short of one', () => {
    expect(balanceBreak('aa bb cc dd', 'aa bb cc ')).toBe('aa bb\ncc dd');
    expect(balanceBreak('aaaaa bb ccc', 'aaaaa bb ')).toBeNull();
  });

  // Never right of the natural break: that line was already as long as
  // the column allows.
  it('leaves a wrap that is already balanced alone', () => {
    expect(balanceBreak('Quê em có dải sông Hàn', 'Quê em có dải ')).toBeNull();
  });

  it('leaves a text with nowhere better to break alone', () => {
    expect(balanceBreak('Supercalifragilistic word', 'Supercalifragilistic ')).toBeNull();
    // Japanese has no spaces to break at.
    expect(balanceBreak('煙たなびく千重の霧', '煙たなびく千重')).toBeNull();
  });

  // The desk wrote the break, even one that leaves a word alone; it is
  // not second-guessed.
  it('leaves a headline the desk broke by hand alone', () => {
    expect(balanceBreak('Mịt mù khói toả ngàn\nsương', 'Mịt mù khói toả ngàn')).toBeNull();
  });
});
