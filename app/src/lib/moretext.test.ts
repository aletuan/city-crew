// Where a long text is cut for "… Read more". The lines are what
// `onTextLayout` would hand back: each line's text, breaks included, and
// its drawn width — here ten points a character, so the arithmetic reads.

import { describe, expect, it } from 'vitest';
import { clampText, TAIL_WEIGHT, type Line } from './moretext';

const TAIL = '… Đọc thêm'; // ten characters
const line = (text: string, width = text.length * 10): Line => ({ text, width });
const full = (n: number) => Array.from({ length: n }, (_, i) => line(`w${i}aa bbbb cccc dddd `));

describe('clampText', () => {
  it('leaves a text of five lines or fewer alone', () => {
    expect(clampText(full(5), 5, TAIL)).toBeNull();
    expect(clampText(full(1), 5, TAIL)).toBeNull();
  });

  // The fifth line runs the full column, so the tail's room — ten
  // characters at the text's own width, times the weight — comes off its
  // end, and the cut steps back to the word before.
  it('gives up the end of a full fifth line for the link, at a word', () => {
    expect(TAIL_WEIGHT).toBe(1.2);
    const got = clampText(full(6), 5, TAIL)!;
    // 20 characters a line; the fifth keeps "w4aa bbbb cccc dddd" (19)
    // less ceil(120 / 10) = 12, "w4aa bb", back to the word: "w4aa".
    expect(got).toBe(full(4).map((l) => l.text).join('') + 'w4aa');
  });

  // A fifth line that already stops short — a paragraph's end — has room
  // of its own and loses nothing but its full stop.
  it('keeps a short fifth line whole and drops its full stop', () => {
    const lines = [...full(4), line('end.\n'), ...full(3)];
    expect(clampText(lines, 5, TAIL)).toBe(full(4).map((l) => l.text).join('') + 'end');
  });

  // Room it has, but not all of it: only what is missing comes off.
  it('takes off only what the line does not already have', () => {
    // 15 characters, 150 wide in a 200 column: 50 of 120 there, 70 missing,
    // seven characters off "w4aa bbbb ccc" (13) is "w4aa b", back to "w4aa".
    const lines = [...full(4), line('w4aa bbbb ccc  ', 150), ...full(2)];
    expect(clampText(lines, 5, TAIL)).toBe(full(4).map((l) => l.text).join('') + 'w4aa');
  });

  it('cuts a text with no spaces at the character', () => {
    const cjk = Array.from({ length: 6 }, () => line('咖啡馆咖啡馆咖啡馆咖啡馆咖啡馆咖啡馆咖'));
    const got = clampText(cjk, 5, TAIL)!;
    // 19 a line, 12 off the fifth: seven kept.
    expect(got.length).toBe(4 * 19 + 7);
  });

  // A part of a character is still a character: 115 missing at ten a
  // character is twelve off, not eleven.
  it('rounds what it gives up upward', () => {
    const cjk = Array.from({ length: 6 }, () => line('咖啡馆咖啡馆咖啡馆咖啡馆咖啡馆咖啡馆咖'));
    cjk[4] = line(cjk[4].text, 185);
    // 190 column, 185 drawn: 5 there, 115 missing, 12 off 19 is 7.
    expect(clampText(cjk, 5, TAIL)!.length).toBe(4 * 19 + 7);
  });

  // The column is the widest line, not the first: a note that opens with
  // a short line of its own would otherwise read as a narrow column and
  // cut the fifth line to nothing.
  it('takes the column from the widest line', () => {
    const lines = [line('Đà Lạt.\n'), ...full(5)];
    expect(clampText(lines, 5, TAIL)).toBe('Đà Lạt.\n' + full(3).map((l) => l.text).join('') + 'w3aa');
  });

  it('leaves no comma or space hanging before the ellipsis', () => {
    const lines = [...full(4), line('aaaa, bbbb cccc dddd'), ...full(1)];
    expect(clampText(lines, 5, TAIL)!.endsWith('aaaa')).toBe(true);
  });
});
