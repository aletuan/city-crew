// Both ends of the personalisation loop: gathering the four signals
// `taste.ts` scores, and writing the one of them the app has to observe
// for itself.
//
// A hook rather than a function, and here rather than in `taste.ts`, for
// the same reason `catalog.tsx` is not `catalog.ts`: this is plumbing
// between providers and has no arithmetic of its own. Every decision worth
// arguing about — what a signal is worth, what the number is bounded to,
// what "no opinion" means — is in `taste.ts`, pure and tested. This file
// just fetches.
//
// Three of the four signals are already in memory: the preferences row is
// one small read, collections come from `SaveProvider`, and the places the
// reader suggested themselves are in the catalog `usePlaces` returns. Only
// the fourth costs a query, and only when recording is switched on.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { useCatalog, usePlaces } from './catalog';
import { useCity } from './city';
import { fetchPassedOver, logPlaceEvent, useMyPreferences, type EventKind } from './data';
import { membersOf } from './place';
import { CATEGORIES } from './categories';
import { cleanTaste } from './tastepick';
import { useSave } from './save';
import { tasteFrom } from './taste';
import type { Taste } from './planner';

/**
 * How far back "opened and walked away from" is allowed to reach.
 *
 * A café passed over last March says nothing about this Saturday, and
 * nothing trims `place_events` yet — so the window is the trim. Ninety
 * days is long enough to hold a few months of ordinary use and short
 * enough that a taste somebody has grown out of stops voting.
 */
const RECENT_DAYS = 90;

/** ISO day `RECENT_DAYS` before `now`. Takes `now` so the caller's clock is
 *  the one that decides, the way every other date in this app works. */
function since(now: Date): string {
  return new Date(now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Everything a screen has to hand `planTrips` beyond the draft itself. */
export type PlanProfile = {
  /** What this reader tends to like, or null when there is nothing to say.
   *  Null is the answer for a signed-out reader and for a signed-in one who
   *  has told us nothing — and `planTrips` skips the term entirely on null,
   *  so both get exactly the plans the app made before any of this
   *  existed. */
  taste: Taste | null;
  /**
   * What a stop may cost before the planner starts marking it down.
   *
   * **Always null today, and that is deliberate rather than unfinished.**
   * The band used to be asked for in Edit profile and is not any more:
   * budget is the most situational thing about an outing — tonight with
   * the family is not tonight alone — and a standing answer buried two
   * screens from the planner was the wrong shape for it. What a plan
   * costs is printed on every plan card, every editor and every saved
   * trip instead, and the reader decides with that.
   *
   * The field, the column and `planTrips`'s arithmetic all stay. The
   * arithmetic is carefully weighted — only the overrun is charged, and
   * being under is never rewarded, so a stated budget cannot quietly turn
   * every plan into the lowkey one — and it is covered by tests. If the
   * wizard ever asks the question, this is where the answer arrives.
   */
  budgetVnd: number | null;
};

/**
 * What this reader has done, as `taste.ts` wants to be told it.
 *
 * One hook rather than two copies. Both profiles below need exactly these
 * three, and they were written out twice before `liked` arrived and would
 * have been written out three times after — which is how two lists that
 * are supposed to be identical stop being identical.
 *
 * Nothing here costs a request. The reader's own collections are already
 * in `SaveProvider`, the catalog is `usePlaces`, and both halves of the
 * likes — which lists exist and which of them you liked — were fetched at
 * launch for the Explore shelf.
 */
function useOwnSignals(uid: string | null) {
  const { data: places } = usePlaces();
  const { mine } = useSave();
  const { collections, myLikes } = useCatalog();

  // Flattened across collections, and `tally` counts each place once — a
  // café filed under both "Weekend" and "Near work" is one café that was
  // saved. See the note there.
  const saved = useMemo(
    () => mine.data.flatMap((c) => membersOf(c, places)),
    [mine.data, places],
  );
  const suggested = useMemo(
    () => (uid ? places.filter((p) => p.submitted_by === uid) : []),
    [places, uid],
  );

  /**
   * The places inside the lists this reader liked.
   *
   * Matched on `id` because that is what a like points at — see the note
   * on `Collection.id`, which says so and says it is not an invitation to
   * key anything else that way.
   *
   * `myLikes` here is the optimistic set, pending taps included, so a
   * heart tapped a second ago counts. And `membersOf` resolves slugs
   * against the in-memory catalog, which holds one city: a list liked in
   * another city contributes nothing until the reader is back in it,
   * exactly as their own collections behave.
   */
  const liked = useMemo(() => {
    if (!uid || !myLikes.length) return [];
    const wanted = new Set(myLikes);
    return collections.data
      .filter((c) => c.id && wanted.has(c.id))
      .flatMap((c) => membersOf(c, places));
  }, [uid, myLikes, collections.data, places]);

  return { saved, suggested, liked };
}

/**
 * Both halves of the profile from one read of the preferences row.
 *
 * One hook rather than two because they share that read: a screen that
 * wanted taste and budget separately would fetch the same row twice and
 * re-render on each.
 */
export function usePlanProfile(): PlanProfile {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  const { saved, suggested, liked } = useOwnSignals(uid);
  const prefs = useMyPreferences(uid);

  const [passedOver, setPassedOver] = useState<string[]>([]);
  useEffect(() => {
    // Recording off means there is nothing to read, and asking anyway would
    // spend a round trip to be told the empty answer by a policy. Also the
    // reset: switching the toggle off must drop what is already in memory,
    // not merely stop adding to it.
    if (!uid || !prefs.data.history_on) { setPassedOver([]); return; }
    // Fetched whether or not it will be read: `tasteFrom` drops it for a
    // reader who has never saved anything (see the gate there), and that
    // decision belongs with the arithmetic rather than here. It costs one
    // query for a reader who switched recording on and has saved nothing
    // yet — a small and shrinking population.
    let live = true;
    fetchPassedOver(uid, since(new Date()))
      .then((slugs) => { if (live) setPassedOver(slugs); })
      // A signal that could not be read is a signal the reader does not
      // have. It costs a slightly worse ordering, which is not worth an
      // error anywhere on screen.
      .catch(() => {});
    return () => { live = false; };
  }, [uid, prefs.data.history_on]);

  /**
   * Taste from what this reader has *done*, and no longer from what they
   * declared.
   *
   * `preferences.categories` used to arrive here as `preferred`, the
   * heaviest of the three category terms. It is not passed any more, and
   * the reason is that the wizard asks the same question with more force:
   * `canPlan` refuses to start a plan without at least one category, and
   * `dropReason` then removes everything outside the chosen ones. A
   * standing set of chips could only ever re-order what that gate had
   * already let through — the same question, asked twice, with the
   * older answer the weaker of the two.
   *
   * What is left is the half a form cannot collect: the categories your
   * saved collections lean towards, the lists you liked, the places you
   * added yourself, and the places you opened and walked away from.
   * `taste.ts` keeps its `preferred` term and its weight; the chips feed
   * it through `useBrowseTaste` and deliberately not through here.
   */
  const taste = useMemo(() => {
    if (!uid) return null;
    return tasteFrom({ saved, suggested, liked, passedOver });
  }, [uid, saved, suggested, liked, passedOver]);

  // See `PlanProfile.budgetVnd`: nothing asks for a band any more, so
  // nothing has one to give.
  const budgetVnd = null;
  return useMemo(() => ({ taste, budgetVnd }), [taste, budgetVnd]);
}

/**
 * The same reader, for the surfaces that browse rather than plan.
 *
 * One difference from `usePlanProfile`, and it is the whole reason this
 * exists separately: **the stated categories are passed here.**
 *
 * They are withheld from the planner on purpose — the wizard asks the
 * same question with more force, `canPlan` refuses to start without an
 * answer, and a standing set of chips could only re-order what that gate
 * had already let through. That argument is about the planner and only
 * the planner. Explore and Search have no wizard, no gate, and nothing
 * that asks at all, so the chips are not a second answer there; they are
 * the only one.
 *
 * Which is why this is a second hook rather than a flag on the first.
 * A `usePlanProfile({ stated: true })` would put the decision at every
 * call site, and the day somebody passes it from a plan screen the thing
 * that was deliberately removed is quietly back.
 */
export function useBrowseTaste(): Taste | null {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  const { saved, suggested, liked } = useOwnSignals(uid);
  const prefs = useMyPreferences(uid);

  // Cleaned on the way in: the column is a bare `text[]` with no foreign
  // key and rows in it were typed by hand before any picker existed, so
  // it holds words the taxonomy has never heard of. See `cleanTaste`.
  const preferred = useMemo(
    () => cleanTaste(prefs.data.categories, Object.keys(CATEGORIES)),
    [prefs.data.categories],
  );

  // `passedOver` is not read here. It costs a query and needs the
  // recording opt-in, and this hook runs on two screens the reader is
  // scrolling — the planner is where that signal is worth a round trip.
  return useMemo(() => {
    if (!uid) return null;
    return tasteFrom({ preferred, saved, suggested, liked });
  }, [uid, preferred, saved, suggested, liked]);
}

/**
 * A function that notes something happened, or quietly does nothing.
 *
 * Screens call this and never look at the result. There is nothing useful
 * to do with a failure — see `logPlaceEvent`, which swallows them on
 * purpose — and nothing to await either: an event is not on the path of
 * anything the reader is waiting for.
 *
 * The opt-in is checked here to save a round trip and again in Postgres,
 * where the insert policy requires `history_on`. That second check is the
 * one that is a guarantee; this one is only a courtesy to the network.
 */
export function useNoteEvent(): (placeSlug: string, kind: EventKind) => void {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  const { city } = useCity();
  const prefs = useMyPreferences(uid);
  // `loaded`, not just the value. The empty preferences now say recording
  // is on (see `NO_PREFERENCES`), so without this the moment before the
  // row lands would send an event for somebody who has turned it off —
  // refused by the insert policy, but a request nobody needed to make.
  // Waiting costs nothing visible: this hook's identity changes when the
  // row arrives, and the effect that calls it lists it in its deps, so
  // the event is noted then instead.
  const on = prefs.loaded && prefs.data.history_on;
  const cityId = city?.id ?? null;

  return useCallback(
    (placeSlug: string, kind: EventKind) => { void logPlaceEvent(uid, placeSlug, kind, cityId, on); },
    [uid, cityId, on],
  );
}
