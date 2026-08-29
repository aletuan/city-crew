// Two marks, and the reason there are only two.
//
// `legal.ts` holds the words for both the app and the two published
// pages, so its markup has to be readable by a React renderer and by an
// HTML one. A whole Markdown dialect would be a second document format
// nobody asked for, and every feature of it would be a shape the sheet
// has to draw. So the vocabulary is exactly what the documents already
// use: **bold** for the phrases a reader must not skim past, and
// [text](href) for the handful of links.
//
// Everything else is prose. No italics, no code, no nesting: `**a [b](c)
// d**` is not supported and nothing in the documents wants it.
//
// No imports, so it runs in a plain Node test and inside the generator.

/** A run of text, and what it is. `bold` and `href` never both appear. */
export type Span = { text: string; bold?: true; href?: string };

// One pass, alternating: the marks cannot nest, so whichever opens first
// wins and the scan resumes after its close. Written as a single regex
// with two arms rather than two passes, because two passes would let a
// link inside a bold run be found and then orphaned.
const MARK = /\*\*(.+?)\*\*|\[(.+?)\]\(([^)]+)\)/g;

/**
 * Split a line into runs. Plain text comes back as one span; an unclosed
 * `**` or a stray `[` is text, not an error — a legal document with a
 * typo in it should render with the typo, not vanish.
 */
export function parseInline(line: string): Span[] {
  const out: Span[] = [];
  let at = 0;
  for (const m of line.matchAll(MARK)) {
    if (m.index > at) out.push({ text: line.slice(at, m.index) });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true });
    else out.push({ text: m[2], href: m[3] });
    at = m.index + m[0].length;
  }
  if (at < line.length) out.push({ text: line.slice(at) });
  return out;
}

/**
 * Is this link one of our own pages rather than somewhere else?
 *
 * The documents cross-reference each other by bare filename, which a
 * browser resolves against the page it is already on. The app has no
 * such page: `privacy.html` there means "show the other document", and
 * everything absolute — https, mailto — means "leave".
 */
export function isDocLink(href: string): boolean {
  return !href.includes(':') && !href.startsWith('#');
}
