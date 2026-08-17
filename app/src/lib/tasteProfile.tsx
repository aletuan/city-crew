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
import { usePlaces } from './catalog';
import { useCity } from './city';
import { fetchPassedOver, logPlaceEvent, useMyPreferences, type EventKind } from './data';
import { membersOf } from './place';
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
  /** `preferences.budget_vnd`, straight through. */
  budgetVnd: number | null;
};

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
  const { data: places } = usePlaces();
  const { mine } = useSave();
  const prefs = useMyPreferences(uid);

  const [passedOver, setPassedOver] = useState<string[]>([]);
  useEffect(() => {
    // Recording off means there is nothing to read, and asking anyway would
    // spend a round trip to be told the empty answer by a policy. Also the
    // reset: switching the toggle off must drop what is already in memory,
    // not merely stop adding to it.
    if (!uid || !prefs.data.history_on) { setPassedOver([]); return; }
    let live = true;
    fetchPassedOver(uid, since(new Date()))
      .then((slugs) => { if (live) setPassedOver(slugs); })
      // A signal that could not be read is a signal the reader does not
      // have. It costs a slightly worse ordering, which is not worth an
      // error anywhere on screen.
      .catch(() => {});
    return () => { live = false; };
  }, [uid, prefs.data.history_on]);

  const saved = useMemo(
    () => mine.data.flatMap((c) => membersOf(c, places)),
    [mine.data, places],
  );
  const suggested = useMemo(
    () => (uid ? places.filter((p) => p.submitted_by === uid) : []),
    [places, uid],
  );

  const taste = useMemo(() => {
    if (!uid) return null;
    return tasteFrom({
      preferred: prefs.data.categories,
      saved,
      suggested,
      passedOver,
    });
  }, [uid, prefs.data.categories, saved, suggested, passedOver]);

  const budgetVnd = uid ? prefs.data.budget_vnd : null;
  return useMemo(() => ({ taste, budgetVnd }), [taste, budgetVnd]);
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
  const on = prefs.data.history_on;
  const cityId = city?.id ?? null;

  return useCallback(
    (placeSlug: string, kind: EventKind) => { void logPlaceEvent(uid, placeSlug, kind, cityId, on); },
    [uid, cityId, on],
  );
}
