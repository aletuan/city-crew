// Out of `PlanEditScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.
// The screen's state, one concern to a hook.

import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { successHaptic } from '../../components/ui';
import {
  cachedNarration, freshen, narratableOf, prefetchNarration,
  type Narration,
} from '../../lib/assist';
import { reviewAfterTripSaved } from '../../lib/askReview';
import { useSession } from '../../lib/auth';
import { useCollections, usePlaces } from '../../lib/catalog';
import { useCurrentCity } from '../../lib/city';
import { DEFAULT_TZ } from '../../lib/clock';
import { saveTrip } from '../../lib/data';
import { clampDay, todayISO } from '../../lib/day';
import { useI18n } from '../../lib/i18n';
import type { Editable } from '../../lib/itinerary';
import { planTrips } from '../../lib/planner';
import { startMinOf } from '../../lib/remind';
import { scheduleTripReminder } from '../../lib/reminders';
import { useMyLists, useSaveActions } from '../../lib/save';
import { useNoteEvent, usePlanProfile } from '../../lib/tasteProfile';
import { draftFrom, seedMembers, sourceIdsOf, type TripDraft } from '../../lib/trip';
import type { Place } from '../../lib/types';
import type { Nav, RootRoute } from '../../nav';

type Ask = RootRoute<'PlanEdit'>['params'];
export type Picked = ReturnType<typeof planTrips>[number] | null;

/** The plan the reader tapped, rebuilt from what the options screen had. */
export function usePickedPlan(p: Ask) {
  const { data: places } = usePlaces();
  const { city } = useCurrentCity();
  const mine = useMyLists();
  const cols = useCollections();
  const { taste, budgetVnd } = usePlanProfile();

  const day = clampDay(p.date || todayISO());
  const draft: TripDraft = useMemo(() => draftFrom(p, day), [p, day]);

  // Resolved here the way the options screen resolves them, because the
  // rebuild below is only faithful if it gets the same inputs. The planner
  // still has no business knowing what a collection is.
  const pinned = useMemo(() => {
    return seedMembers(p.from, [...mine.data, ...cols.data], places);
  }, [p.from, mine.data, cols.data, places]);

  // Rebuilt from the same pure inputs the options screen used, so the plan
  // the reader tapped is the plan they get. Serialising stops through
  // navigation would work too and would drift the first time either screen
  // changed what a stop holds.
  //
  // "The same inputs" has to mean all of them. This once passed the seed
  // alone, which quietly dropped two: a day seeded from a collection lost
  // its pinned places on the way here, and a plan reached through
  // Regenerate was redrawn without the slugs that draw had been told to
  // avoid — so the reader tapped one evening and opened another.
  const picked = useMemo(() => {
    const plans = planTrips(draft, places, city?.id ?? null, {
      seed: p.seed, startMin: p.startMin, pinned, avoid: p.avoid, taste, budgetVnd, tz: city?.tz ?? DEFAULT_TZ,
    });
    return plans.find((pl) => pl.lens === p.lens) ?? plans[0] ?? null;
  }, [draft, places, city?.id, city?.tz, p.seed, p.startMin, p.lens, p.avoid, pinned, taste, budgetVnd]);
  return { day, picked, city };
}

/** The model's words for the plan, with what editing made stale taken out. */
export function useNarration(picked: Picked, current: Editable<Place>[], p: Ask) {
  const { lang } = useI18n();
  /** What the model was — or would be — asked about, in exactly the shape
   *  the options screen prefetched with, so the cache key matches. */
  const asked = useMemo(() => narratableOf(picked?.stops ?? []), [picked]);

  /**
   * The words, read from the cache the options screen filled.
   *
   * This screen used to ask for them itself, on arrival — the deliberate
   * thrift of narrating only the plan the reader picked — and paid for it
   * in the worst currency: the card rendered its facts, and the model's
   * sentences rewrote them under the reader up to four seconds in. The
   * asking now starts on the sketch screen, whose last step holds until
   * the words settle, with the options screen prefetching again as a
   * backstop for Regenerate — so by the time a card is tapped the answer
   * is normally sitting in `cachedNarration` for the first render to use.
   *
   * The effect covers the two ways that can miss. A tap faster than the
   * model joins the in-flight call — `prefetchNarration` dedupes on key —
   * and lands one update, into lines whose height is already reserved. And
   * a failed generation is *cached as empty*, so this screen opens on
   * facts and stays on facts: the fallback is a state, not a retry loop.
   *
   * Still never re-asked when the reader edits — a line about a place is
   * still true after the place above it moved, and a screen that flickered
   * new prose under every tap would be unreadable. `freshen` below is what
   * retires the lines that editing falsifies.
   */
  const [words, setWords] = useState<Narration>(() => (asked.length
    ? cachedNarration(asked, lang)
    : null) ?? { title: null, why: new Map(), fromModel: false });
  useEffect(() => {
    if (!asked.length) return;
    const hit = cachedNarration(asked, lang);
    // Same object the initial state read — React bails on the no-op. Here
    // for the rare re-run where `picked` itself changed under the screen.
    if (hit) { setWords(hit); return; }
    let live = true;
    void prefetchNarration(
      asked,
      { company: p.company, categories: p.categories, when: p.when, where: p.where },
      lang,
    ).then((n) => { if (live) setWords(n); });
    // Left behind when the screen goes: a plan the reader has walked away
    // from should not set state on its way out.
    return () => { live = false; };
  }, [asked, p.company, p.categories, p.when, p.where, lang]);

  /**
   * The narration with the stale parts taken out.
   *
   * One value for drawing and for saving, deliberately: the bug this fixes
   * put "A second stop to keep the conversation going" under the only stop
   * of a trip, and that sentence did not just render — it went into the
   * database, where nothing downstream can tell it was written about a plan
   * that no longer exists.
   *
   * `picked.stops` is the list the model was handed. It is the planner's
   * output and does not move when the reader edits, so it needs no state of
   * its own — `current` is the edited copy, and the difference between them
   * is exactly what has gone stale.
   */
  const live = useMemo(
    () => freshen(words, picked?.stops.map((st) => st.place.slug) ?? [], current.map((st) => st.place.slug)),
    [words, picked, current],
  );
  return live;
}

/** Save: the trip, its reminder, and what the reader kept and dropped. */
export function useSavePlan({ navigation, p, day, current, picked, live, title, onSaved }: {
  navigation: Nav;
  p: Ask;
  day: string;
  current: Editable<Place>[];
  picked: Picked;
  live: ReturnType<typeof freshen>;
  title: string;
  /** Called the moment the save lands, before the screen leaves. */
  onSaved: () => void;
}) {
  const { t, lang } = useI18n();
  const { city } = useCurrentCity();
  const { session } = useSession();
  const mine = useMyLists();
  const { askToSignIn } = useSaveActions();
  const cols = useCollections();
  const note = useNoteEvent();
  const [saving, setSaving] = useState(false);
  const onSave = async () => {
    // A guest's tap used to fall through this guard to nothing, with only
    // the caption under the button to say why — the same dead control the
    // bookmark and the heart were cured of. They raise the sign-in sheet
    // with the thing reached for named in its title; so does this.
    //
    // Nothing to save is asked first: a guest with an empty plan was
    // invited to sign in to save it (PLAN-02). The button is not offered
    // then either; this is the guard behind it.
    if (!city || !current.length) return;
    if (!session?.user?.id) { askToSignIn('trip'); return; }
    setSaving(true);
    try {
      const tripId = await saveTrip({
        ownerId: session.user.id,
        cityId: city.id,
        title,
        company: p.company,
        categories: p.categories,
        district: p.district,
        atLat: p.atLat,
        atLng: p.atLng,
        day,
        when: p.when,
        generatedBy: live.fromModel ? 'rules+llm' : 'rules',
        // The lists this plan started from, resolved off the same shelves
        // its pins were (`pinned` above), and of those only the ones with
        // a place among the stops saved, so each owner counts a trip their
        // list gave something to.
        fromCollections: sourceIdsOf(p.from, [...mine.data, ...cols.data], current.map((s) => s.place.slug)),
        stops: current.map((s) => ({
          placeSlug: s.place.slug,
          arriveMin: s.arriveMin,
          dwellMin: s.dwellMin,
          // Only a model's sentence is stored. The fact line is derived
          // from the place and would go stale the moment its hours change;
          // saving it would freeze last August's opening time into a trip.
          why: live.why.get(s.place.slug) ?? null,
          whyLang: live.why.has(s.place.slug) ? lang : null,
        })),
      });
      // The verdict the reader just delivered on a drafted evening, which
      // is the clearest signal in the app: these ones they kept, that one
      // they took out. Noted after the write, because a trip that failed to
      // save is not a decision about anything.
      // The evening-before nudge and the day's own, planted while the day
      // and the first stop's hour are known. After the save and
      // fire-and-forget: a reminder is a courtesy, and the reader is not
      // kept waiting on the permission sheet's animation.
      scheduleTripReminder(
        { id: tripId, day, title, startMin: startMinOf(current.map((st) => ({ arrive_min: st.arriveMin }))) },
        t,
      );
      // A rating ask from the second saved plan on; see `lib/review`.
      reviewAfterTripSaved();
      const kept = new Set(current.map((st) => st.place.slug));
      for (const slug of kept) note(slug, 'plan_keep');
      for (const st of picked?.stops ?? []) {
        if (!kept.has(st.place.slug)) note(st.place.slug, 'plan_drop');
      }
      successHaptic();
      // Reset, then leave — and for a long time this comment said "reset"
      // over a line that only left. The Ideas stack kept the whole flow,
      // so the next visit to the tab landed back on this editor with a
      // live Save button: a screen that *looks* like "edit my saved trip"
      // and *is* "insert a duplicate", because nothing here is wired to
      // the saved row and TripDetail is view-only. The pop happens first,
      // while this stack is still the visible one, so by the time the
      // Trips tab shows there is nothing stale behind it; the wizard at
      // the bottom keeps its answers, because it is the same mounted
      // screen — completing the flow discards the flow, not the asks.
      // Same pattern as the auth screens, which popToTop when theirs ends.
      onSaved();
      navigation.popToTop();
      navigation.getParent()?.navigate('Trips');
    } catch (e) {
      Alert.alert(
        t('Could not save', 'Không lưu được', '保存できませんでした', '无法保存', '無法儲存'),
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setSaving(false);
    }
  };
  return { saving, onSave };
}
