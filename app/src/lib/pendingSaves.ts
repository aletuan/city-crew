// Your lists as you just left them, before the database has said so.
//
// ── why (owner, 23 Oct 2026) ──
//
// A tick in the save sheet used to wait for three round trips in a row
// before it moved: the two ids, the write, and then the whole of your
// lists fetched again — every list, every member's place row and every
// one of their photographs, 440 kB of JSON for the owner's fifteen lists
// and 113 places, measured that day. Only then did `holds()` read the new
// answer and the box fill. "A while later the status changes", on 5G.
//
// So the tap is drawn at once, from here, and the database catches up
// behind it. A pending entry is what the reader asked for one place in
// one list; laid over the lists the database last returned, it is what
// every screen shows — the tick, the count under it, the bookmark, the
// collection screen behind the sheet — until a reload that started after
// the last write lands and says the same thing on its own.
//
// Applied over whatever arrived rather than kept as a second copy of the
// lists, so a reload that lands while a write is still out does not undo
// the tick: the entry is still there on top of it.

import { holds, nextSortOrder } from './place';
import type { Collection, Place } from './types';

/** One place in one list, as the reader last left it. */
export type PendingSave = { collection: string; place: Place; want: boolean };

/** Keyed by `pendingKey`, so a second tap on the same row replaces the first. */
export type PendingSaves = Readonly<Record<string, PendingSave>>;

/** A newline cannot be in a slug, so the pair cannot collide. */
export const pendingKey = (collectionSlug: string, placeSlug: string) => `${collectionSlug}\n${placeSlug}`;

/**
 * The lists with every pending save applied.
 *
 * An entry the lists already agree with changes nothing, so applying the
 * same entries twice, or over a reload that already carries them, is
 * harmless. An addition goes after the last member, where the write
 * puts it (`nextSortOrder`). The members are touched only on a row that
 * carries them — your own do; a row without them resolves its places
 * from the catalog by slug, which the slug list already answers.
 */
export function withPending(lists: Collection[], pending: PendingSaves): Collection[] {
  const entries = Object.values(pending);
  if (entries.length === 0) return lists;
  return lists.map((c) => {
    let out = c;
    for (const e of entries) {
      if (e.collection !== c.slug) continue;
      const slug = e.place.slug;
      const has = holds(out, slug);
      if (e.want && !has) {
        out = {
          ...out,
          collection_places: [...out.collection_places, { sort_order: nextSortOrder(out), places: { slug } }],
          members: out.members && [...out.members, e.place],
        };
      } else if (!e.want && has) {
        out = {
          ...out,
          collection_places: out.collection_places.filter((cp) => cp.places?.slug !== slug),
          members: out.members && out.members.filter((p) => p.slug !== slug),
        };
      }
    }
    return out;
  });
}

/**
 * Several places into one list, each after the one before it.
 *
 * What Google made for a list Search was opened from (owner, 23 Oct
 * 2026), handed to `toggle` one at a time. Each write takes its place
 * from the list it is handed, so the list is handed on with the last one
 * laid in — otherwise every one of them would be written at the same
 * place in the order, and the list keeps no tie-break between them. A
 * place already in the list is left alone: `toggle` would take it out.
 */
export function addAll(
  c: Collection, places: readonly Place[], toggle: (c: Collection, place: Place) => unknown,
): void {
  let into = c;
  for (const place of places) {
    if (holds(into, place.slug)) continue;
    void toggle(into, place);
    [into] = withPending([into], { [pendingKey(into.slug, place.slug)]: { collection: into.slug, place, want: true } });
  }
}
