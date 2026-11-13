// One list's activity, for its owner (owner, 13 Nov 2026): everyone who
// liked it or saved a copy of it, all time, newest first — the shape of
// Threads' "Post activity", on the screen the collection card's "View
// activity" opens (`CollectionActivityScreen`).
//
// Pure, so the gate can hold it: the two fetches arrive as they are
// (`likes_on_mine`, `copies_of_mine`, through `lib/data/people`), each
// across every list the reader owns, and this narrows them to one list
// and lays them out as rows. What a row says is the screen's.
//
// ── one row per act, not per person ──
//
// Someone who liked the list and saved a copy of it gets two rows. Each
// row's badge says one thing that happened and its age says when; a row
// for the person would have to choose one age for two moments and wear
// two badges, and the order — newest first — would put it where one of
// the two acts happened and not the other. Two rows also stay true when
// one act is undone: the like taken back leaves the copy standing, as the
// RPCs already answer. Activity (`buildActivity`) keeps one row per act
// for the same reason.
//
// ── the order ──
//
// Newest first, by the instant, read with `Date.parse` rather than by
// comparing the strings as `buildActivity` does: the two come from two
// functions, and a string compare is only right while both are written
// in one offset and one precision. `Date.parse` keeps milliseconds and
// Postgres keeps microseconds, so two acts a few microseconds apart read
// as one instant here; that is where the tie-break below decides.
//
// At one instant, the copy first: of the two, it is the stronger thing
// to have done with somebody's list (Activity's own words for it, in
// `buildActivity`). Within one kind, the order the server sent, which is
// newest first to the microsecond (`order by created_at desc` in both
// functions) — kept because `Array.prototype.sort` is stable, so the same
// answer lays out the same way on every load.
//
// ── who, in full ──
//
// Each row carries the actor's account id and face as the functions
// return them (`20261113150000_activity_rows_carry_face`): the face is
// drawn from the row rather than from a second read by handle, and the id
// is what the row's friend button asks about. An empty `avatar_url` — a
// face the desk cleared — is no face, the same blank disc as a profile
// that is gone; and a function from before that migration, which sends
// neither column, reads as no id and no face rather than as `undefined`.
import type { Applause, Copy } from './friends';

/** One thing somebody did with the list: who, and when. `handle`,
 *  `name`, `id` and `avatar` are null when their profile is gone — the
 *  screen's "Someone". */
export type ListAct = {
  kind: 'like' | 'copy';
  at: string;
  handle: string | null;
  name: string | null;
  /** Their account id — see the header. */
  id: string | null;
  /** Their face's address, or null for none — see the header. */
  avatar: string | null;
};

/** At one instant, which kind goes first — see the header. */
const FIRST: Record<ListAct['kind'], number> = { copy: 0, like: 1 };

export function actsOn(collectionId: string, likes: readonly Applause[], copies: readonly Copy[]): ListAct[] {
  const acts: ListAct[] = [
    ...likes
      .filter((l) => l.collection_id === collectionId)
      .map((l): ListAct => ({
        kind: 'like', at: l.liked_at, handle: l.liker_handle, name: l.liker_name,
        id: l.liker_id ?? null, avatar: l.liker_avatar_url || null,
      })),
    ...copies
      .filter((c) => c.collection_id === collectionId)
      .map((c): ListAct => ({
        kind: 'copy', at: c.copied_at, handle: c.copier_handle, name: c.copier_name,
        id: c.copier_id ?? null, avatar: c.copier_avatar_url || null,
      })),
  ];
  return acts.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || FIRST[a.kind] - FIRST[b.kind]);
}
