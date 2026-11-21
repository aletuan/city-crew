// "A comment was written or taken back": a number that goes up, and a
// way to hear it go.
//
// Three things draw what a thread holds — the thread's own page, the
// count and the two previews on a feed card, the figure on the door of a
// list's page — and each asks the server on its own. None of them is the
// screen a comment is written on. So the screen that writes says so here
// (`commentsChanged`), and every query that reads a thread asks again
// (`lib/data/hooks`, which reads `changes()` into its question).
//
// A count, not an event with a subject: a write touches one thread, and
// asking the others again is a request each for a page that is already
// open — cheaper than a second mechanism that knows which thread is
// which, and impossible to get stale. No React here; `useSyncExternalStore`
// is what listens, in the hooks.

let n = 0;
const heard = new Set<() => void>();

/** How many times something has changed since the app started. */
export function changes(): number {
  return n;
}

/** Call back on every change; the return value stops listening. */
export function onChange(f: () => void): () => void {
  heard.add(f);
  return () => { heard.delete(f); };
}

/** Say that a comment was posted or deleted. */
export function commentsChanged(): void {
  n += 1;
  heard.forEach((f) => f());
}

/** Ask every thread again with nothing written: a list's page being
 *  pulled to reload (owner, 21 Nov 2026), so a comment somebody else
 *  left since it opened is counted. The same number moves; the name says
 *  why a caller moves it. */
export function askCommentsAgain(): void {
  commentsChanged();
}
