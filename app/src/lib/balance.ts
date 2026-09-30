// Where to break a headline that wraps onto two lines, so the second line
// is not one word.
//
// The city heroes are lines of verse set at 34pt, and none of the eight
// fits one line on any phone: "Mịt mù khói toả ngàn sương" is 460pt wide
// against 386pt of room on the largest. Left to wrap, the line fills to the
// edge and drops what is left — "Mịt mù khói toả ngàn / sương", "Bốn mùa
// trong một / ngày" — and a single word alone under a full line is the
// most visible fault a headline can have. The web's answer is
// `text-wrap: balance`; React Native has none, so the screen measures the
// wrap it got and asks this where the break should have been.
//
// The rule: the latest space at which the top line is still at least as
// long as the bottom one. Top-heavy rather than exactly even, because a
// headline reads down from a full line into a shorter one, and for these
// verses it lands on the caesura: "Mịt mù khói toả / ngàn sương", "Bốn mùa
// trong / một ngày".
//
// Counted in characters, not points. Nothing here can measure a word, and
// it does not need to: the break only ever moves left of where the text
// wrapped by itself, so the top line gets shorter than one that already
// fitted, and the bottom one is no longer than the top. The screen still
// checks the result and gives up if it drew three lines.

/**
 * `text` with a line break at the balanced place, or null to leave it as
 * it wrapped: no space before the natural break that keeps the top line
 * the longer, or a text the desk has already broken by hand.
 *
 * @param firstLine the first line as the layout drew it, trailing space
 *   and all — `onTextLayout`'s `lines[0].text`.
 */
export function balanceBreak(text: string, firstLine: string): string | null {
  if (text.includes('\n')) return null;
  const natural = firstLine.trimEnd().length;
  // The top line must keep at least half of what follows the break.
  const half = (text.length - 1) / 2;
  for (let i = Math.ceil(half); i < natural; i++) {
    if (text[i] === ' ') return `${text.slice(0, i)}\n${text.slice(i + 1)}`;
  }
  return null;
}
