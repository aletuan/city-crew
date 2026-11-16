// A person's page: what of the catalog is theirs to show.
//
// The page (`PersonScreen`, 16 Nov 2026) is built only from what was
// already public — the profile, and the lists a person published — so it
// asks the database nothing new but the profile's `bio`. These two
// functions are the whole of its arithmetic, kept out of the screen so
// they can be read and tested without one.
import type { Collection } from './types';

/**
 * Whether a person's page draws "In common" — off (owner, 16 Nov 2026).
 *
 * The section shipped that morning: the places two people both keep in
 * public collections and the collections both liked, five of each. On
 * the owner's phone it was a lot for the page — two rows of tiles
 * between a person's name and the collections the page is about — and
 * the owner asked for it hidden, not removed, while that is thought
 * about.
 *
 * So everything behind it stays as it was built and tested: the section
 * (`components/InCommon`), its hook, the two database functions and the
 * paragraph of the privacy policy that describes it (which now promises
 * to show more than the app does — the safe direction to be wrong in).
 * With this off the section is not mounted, so nothing is asked of the
 * database either. Turning it back on is this one word.
 *
 * The "N mutual saves" the count line used to say to a friend is not
 * back: the section replaced it, and the owner had already asked for it
 * off that line.
 */
export const IN_COMMON_ON = false;

/**
 * The public lists a person made, in the order the shelf holds them.
 *
 * The shelf (`useCollections`) is every public list, of every city,
 * newest first, so filtering keeps that order and the first is the
 * newest. `is_public` is asked again although the shelf's query already
 * asks it: a row from the launch cache, or a caller that hands over a
 * library instead of the shelf, must not put a private list on a page
 * anybody can open.
 *
 * Nobody's lists for no id — an editorial list has no owner, and
 * `undefined === undefined` would hand every one of them to a person
 * whose profile has not arrived.
 */
export function listsBy(ownerId: string | null | undefined, shelf: readonly Collection[]): Collection[] {
  if (!ownerId) return [];
  return shelf.filter((c) => c.owner_id === ownerId && c.is_public !== false);
}

/**
 * The photograph across the top of the page: the cover of their newest
 * list that has one.
 *
 * Their own lists and not a picture they upload (owner): the page says
 * where this person goes, a cover the desk has already seen needs no
 * second moderation, and there is no upload to build. The newest that
 * *has* one, because a list made in another city resolves no members
 * against this city's catalog and so has no cover unless its owner chose
 * one — the newest list being bare should not leave the page bare when
 * the one before it is not.
 */
export function coverAmong(
  lists: readonly Collection[],
  coverFor: (c: Collection) => string | undefined,
): string | undefined {
  for (const c of lists) {
    const uri = coverFor(c);
    if (uri) return uri;
  }
  return undefined;
}
