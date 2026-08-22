// What the search box remembers.
//
// A recent search is recorded when it *worked* — the reader typed
// something and then opened one of the results — never on keystrokes.
// Recording every keystroke would fill the list with the seven prefixes
// of one word ("p", "ph", "pho"…), and a list of typo fragments is worse
// than no list: it teaches the reader that the memory is noise.
//
// Everything here is pure and takes its inputs, so a Node process can
// prove that "Banh mi" and "Bánh mì" are one memory rather than two. The
// AsyncStorage read/write lives in the screen — the same split every
// other lib module makes, because the coverage gate can see this file
// and cannot see a screen.

import { fold } from './search';

/** How many the zero-state shows. Five, per the reference: a memory is a
 *  shortcut, and a shortcut list longer than a glance stops being one. */
export const RECENTS_SHOWN = 5;

/** How many survive in storage. A few more than are shown, so clearing a
 *  duplicate off the top does not leave the list visibly shorter. */
export const RECENTS_KEPT = 8;

/** One key, global across cities — deliberately. "bánh mì" is worth
 *  re-running in any city, and a per-city list is mostly empty states. */
export const RECENTS_KEY = 'citycrew.recentSearches';

/**
 * Whatever storage handed back, as a list that is safe to render.
 *
 * Storage is the one input this module does not control: an old build,
 * a half-written value, or a key another feature once used can all be
 * under this name. Anything that is not an array of usable strings
 * degrades to the empty list — a lost memory is a shrug, a crash on the
 * search screen's first frame is not.
 */
export function parseRecents(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => x.trim())
      .slice(0, RECENTS_KEPT);
  } catch {
    return [];
  }
}

/**
 * The list with one more search on it.
 *
 * Newest first, deduplicated on the folded form so a query retyped
 * without its diacritics moves the original to the front rather than
 * shadowing it, and capped at RECENTS_KEPT. The surviving spelling is
 * the *new* one: it is what the reader most recently typed, which makes
 * it the version they will recognise.
 *
 * A blank term returns the list it was given — the same reference, so a
 * caller holding it in state does not re-render over nothing.
 */
export function rememberSearch(list: string[], term: string): string[] {
  const t = term.trim();
  if (!t) return list;
  const key = fold(t);
  return [t, ...list.filter((s) => fold(s) !== key)].slice(0, RECENTS_KEPT);
}
