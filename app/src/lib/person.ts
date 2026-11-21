// A person's page: what of the catalog is theirs to show.
//
// The page (`PersonScreen`, 16 Nov 2026) was built only from what was
// already public — the profile, and the lists a person published — so it
// asked the database nothing new but the profile's `bio`. Since 17 Nov
// 2026 it also draws what this reader, and only this reader, may already
// open: every list of your own on your own page, and on a friend's page
// the lists they shared with you (`listsOn`). Still nothing new asked of
// the database: both are reads the Collections tab already makes. These
// functions are the whole of its arithmetic, kept out of the screen so
// they can be read and tested without one.
import { visibilityOf } from './shares';
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
 * Whether a person's page offers Add friend again in its header once the
 * row of acts has scrolled away — off (owner, 16 Nov 2026).
 *
 * It was built that evening and switched off within the hour, before
 * much of anybody had met it: a button arriving beside the ⋯ changes
 * the one corner of the page whose control must be where the thumb left
 * it, and the owner did not want the ⋯ unsettled for a convenience.
 * Hidden, not removed, as "In common" above is: `usePastRow` and the
 * small button in `PersonScreen` are as they were built and tested, and
 * with this off the button is not drawn. The row under the name is
 * unaffected.
 */
export const TOP_FRIEND_ON = false;

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

/** Newest first; a row that does not say when it was made, last. */
const madeAt = (c: Collection): number => Date.parse(c.created_at ?? '') || 0;

/**
 * The lists on a person's page, for this reader (owner, 17 Nov 2026).
 *
 * Until then the page held public lists alone, for everybody — `listsBy`.
 * The owner shared a list with two friends, opened their own page and
 * did not find it there, which reads as a list that was lost. So:
 *
 *   - **your own page** holds every list you made, private and shared
 *     ones too, each marked for who can see it (`seenOn`) so the page
 *     still says what a visitor is shown;
 *   - **somebody else's page** holds their public lists and the ones
 *     they shared with you — which you could already open from the
 *     Collections tab. Nobody is shown a list they could not open
 *     before; the page is a second door to it, where a reader looks.
 *
 * Signed out there is no reader, so no library and nothing shared: the
 * public lists, as before.
 *
 * Your library leads on your own page and the shelf fills in what it
 * lacks: the library is the copy your own edits write to, and before it
 * has loaded the shelf still has your public lists to draw. On another
 * page the shelf leads, so a list both public and shared is the public
 * row and wears no mark.
 *
 * Sorted only when two sources were joined. One source alone is already
 * newest first (both queries order by `created_at`), and a row from a
 * launch cache written before lists carried that stamp would sink to the
 * bottom of a page that had been in the right order without it.
 *
 * `mine` is asked whose it is although the library is the reader's own:
 * a library still in memory from the account signed in before must not
 * put its private lists on this one's page.
 *
 * Somebody else's public list with no place in it yet is not on their
 * page (owner, 20 Nov 2026). Since that day a list can be made public
 * from the start, so one is public for the minutes between "Create" and
 * its first place; drawn, it is a card saying "0 places" over nothing.
 * The Community tab has always drawn only lists with a place; this is
 * that rule on the other door to the same lists. Your own page keeps
 * them: it is where you go to fill one.
 */
export function listsOn(
  ownerId: string | null | undefined,
  reader: string | null,
  from: { shelf: readonly Collection[]; mine: readonly Collection[]; shared: readonly Collection[] },
): Collection[] {
  if (!ownerId) return [];
  const theirs = (c: Collection) => c.owner_id === ownerId;
  const open = listsBy(ownerId, from.shelf);
  const [first, second] = ownerId === reader
    ? [from.mine.filter(theirs), open]
    : [open.filter((c) => c.collection_places.length > 0), from.shared.filter(theirs)];
  const have = new Set(first.map((c) => c.slug));
  const rest = second.filter((c) => !have.has(c.slug));
  if (!rest.length) return first;
  return [...first, ...rest].sort((a, b) => madeAt(b) - madeAt(a));
}

/**
 * Who can see a list that is on the page — the mark its card wears.
 *
 *   - `public`: anybody — the globe;
 *   - `private`: on your own page, a list only you can see;
 *   - `friends`: on your own page, a list shared with `n` friends
 *     (`shares.visibilityOf`, the rule the list's own page goes by);
 *   - `lent`: on somebody else's page, a list they shared with you — so
 *     the reader knows not everybody sees this card.
 *
 * Every card is marked (owner, 18 Nov 2026). For a day a public one wore
 * nothing — "a mark on every card marks none", and the exception alone
 * was marked. The same morning the globe went back under the handle of
 * a public list on its own page, and then onto it for every reader; the
 * owner asked for it here too, so a list says how it stands in the same
 * glyph wherever it is drawn. One rule on two screens was worth more to
 * him than the quieter page.
 *
 * A row that does not say is public, as `listsBy` takes it.
 */
export type ListSeen = { kind: 'public' | 'private' | 'lent' } | { kind: 'friends'; n: number };
export function seenOn(c: Collection, own: boolean, shares: number): ListSeen {
  if (c.is_public !== false) return { kind: 'public' };
  if (!own) return { kind: 'lent' };
  return visibilityOf(false, shares) === 'friends' ? { kind: 'friends', n: shares } : { kind: 'private' };
}

