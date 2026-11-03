// Where a long text is cut so "… Read more" ends its last kept line.
//
// The owner's reference (3 Nov 2026) puts the link on the last line, after
// the words, not on a line of its own. React Native will clamp a Text to N
// lines but will not leave room at the end of the Nth for anything: the
// platform's own "…" takes the end and a link nested after it is cut away.
// So the text is laid out once, whole, and its lines (`onTextLayout`) say
// where it broke and how wide each line ran; this works out how much of
// the last kept line to give up for the link, and where.
//
// ── rejected: a fade under the link ──
// App Store's way — clamp, then lay the link over the end of the last
// line with a gradient into the card behind it. A gradient needs a plain
// colour to end in, and the card is `surfaceCard`, which on every dark
// look is a translucent glass over the page's warmth: no hex is the
// colour behind the words, so the fade would show as a band.

/** One laid-out line: its text, breaks included, and its drawn width. */
export type Line = { text: string; width: number };

/**
 * How much wider the link runs than the same count of body characters:
 * it is set heavier (semibold to the body's regular) and its "…" and the
 * space are full-width glyphs in the count. 1.2 is a margin, not a
 * measurement: a cut that leaves too little room puts the link on a sixth
 * line the clamp then hides, and one that leaves too much costs a word.
 */
export const TAIL_WEIGHT = 1.2;

/**
 * The text up to where "… Read more" (`tail`) should follow it, or null
 * when it fits in `keep` lines and wants no link at all.
 *
 * The room the tail needs is estimated from the text's own average width
 * per character, since the tail is not laid out on its own. The last kept
 * line already has some room — how far it stops short of the widest line,
 * which stands in for the column — and only what is still missing is
 * taken off its end, then back to the word before, so no word is split.
 * A script with no spaces (Japanese, Chinese) is cut at the character.
 * Whatever punctuation or space is left at the cut goes too: "chậm,…"
 * reads as a typo.
 */
export function clampText(lines: readonly Line[], keep: number, tail: string): string | null {
  if (lines.length <= keep) return null;
  const column = Math.max(...lines.map((l) => l.width));
  const chars = lines.reduce((n, l) => n + l.text.length, 0);
  const per = lines.reduce((w, l) => w + l.width, 0) / chars;
  const last = lines[keep - 1];
  const missing = tail.length * per * TAIL_WEIGHT - (column - last.width);
  let kept = last.text.trimEnd();
  if (missing > 0) {
    kept = kept.slice(0, Math.max(0, kept.length - Math.ceil(missing / per)));
    const space = kept.lastIndexOf(' ');
    if (space > 0) kept = kept.slice(0, space);
  }
  const head = lines.slice(0, keep - 1).map((l) => l.text).join('');
  return (head + kept).replace(/[\s,.;:–—-]+$/u, '');
}
