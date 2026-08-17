// Turning the four answers into three ways to spend a day.
//
// Pure, and here rather than in the screen for the reason `place.ts` is: a
// Node process can reach it. The catalog is already in memory by the time
// this runs — `CatalogProvider` holds it — so choosing is arithmetic over
// an array rather than a round trip, and a reader with no signal still
// gets a plan.
//
// The algorithm is ported from `data/scripts/itinerary-runtime.js`, the
// ES5 script the pitch mockup runs, with three things it never did:
// opening hours are honoured, distance shapes the route, and the answer is
// three plans rather than one.
//
// ── on three plans rather than one ──
//
// A reader picking between three drafts and nudging one is in a better
// position than a reader arguing with a single draft, and it costs nothing
// — no model call, no stored conversation. The three come from three
// *lenses*: the same scoring function under different weights, not three
// algorithms. Where the catalog cannot honestly carry three, fewer come
// back; see `gaps.ts` for the counting and `plansAvailable` for the
// ceiling. Three near-identical cards are worse than one, because they
// claim a choice that is not there — and this is the ordinary case rather
// than the edge one: Da Nang holds two places to eat, and two of the three
// cities hold no shopping places at all.
//
// ── on randomness ──
//
// `seed` is an input, the way `now` is an input to `openState`. That keeps
// the function pure and testable while letting Regenerate mean something.
// It matters more than it looks: Hanoi holds 26 cafés, and always taking
// the top-scoring one puts the same café in every plan of every reader
// forever. So the choice step samples within the band of near-equals — a
// 4.6 and a 4.5 on the same street are two good answers, and which you get
// is luck rather than arithmetic — while anything outside the band still
// never appears.

import { categoriesOf } from './categories';
import { instantOn, openState } from './format';
import { distanceKm } from './geo';
import { isLive } from './live';
import { legsOf, type Leg } from './travel';
import type { TripDraft } from './trip';
import type { Place } from './types';

export type PartKey = 'morning' | 'afternoon' | 'evening';
export type LensKey = 'match' | 'iconic' | 'lowkey';

/** Why a pinned place could not be used. The reader chose a collection to
 *  build from and deserves to know what happened to it. */
export type DropReason = 'unlive' | 'city' | 'closed' | 'slot';

export type Stop = {
  place: Place;
  part: PartKey;
  /** Minutes past midnight, on the catalog's clock. */
  arriveMin: number;
  dwellMin: number;
  /** Written by a model later; null until then, and null forever when the
   *  model could not be reached. The screen falls back to facts. */
  why: string | null;
};

export type TripPlan = {
  lens: LensKey;
  /** Named by a model later. Null means the screen names it from the
   *  answers instead. */
  title: string | null;
  stops: Stop[];
  /** One shorter than `stops`; index i is the journey out of stop i.
   *  Nulls stay in place — see `travel.ts`. */
  legs: (Leg | null)[];
  /** Per person, in dong. `price_vnd` comes from Google's price level,
   *  which is per head; transport is per ride, which is not — see
   *  `RIDE_VND`. */
  costVnd: { food: number; activity: number; transport: number };
  /** First arrival to last departure, minutes past midnight. */
  windowMin: [number, number];
  /** Pinned places that did not make it, and why. */
  pinnedDropped: { slug: string; reason: DropReason }[];
};

/** What a reader's history says about a place. Filled in a later phase;
 *  the signature exists now so the scoring function does not have to
 *  change shape when it arrives. */
export type Taste = { affinity: (p: Place) => number };

export type PlanOptions = {
  /** Null as well as undefined, so a screen holding "this reader has no
   *  profile" can pass it straight through instead of converting a null
   *  that means exactly what the absent value means. */
  taste?: Taste | null;
  /** What the reader said an outing is worth to them, per person, in dong
   *  — `preferences.budget_vnd`. Null and undefined both mean "not said",
   *  which is not the same as no budget and must not become zero. */
  budgetVnd?: number | null;
  /** Varies the draw. Same seed, same three plans. */
  seed?: number;
  /** Places from the collections the reader chose to build from. Hard
   *  priority, but still subject to the three gates. */
  pinned?: readonly Place[];
  /** Slugs already shown, penalised so Regenerate moves rather than
   *  relying on luck. A penalty and not an exclusion: a category with one
   *  place in it must still be able to return that place. */
  avoid?: readonly string[];
};

// ── the shape of a day ───────────────────────────────────────────────

type Slot = { part: PartKey; pref: readonly string[] };

/**
 * Three stops for an evening, five for a day.
 *
 * The wizard stopped asking how long the outing is, so the shape comes
 * from `when` instead. Five in an evening is not an evening.
 *
 * `pref` is a nudge, never a gate. The hard filter is the reader's own
 * categories: somebody who asked for cafés and nightlife gets cafés and
 * bars, not a restaurant wedged in because the middle slot likes dinner.
 * The original script made its meal slot a hard `food: true`, which
 * overrides the answer the reader just gave.
 */
const EVENING_SLOTS: readonly Slot[] = [
  { part: 'evening', pref: ['views', 'heritage'] },
  { part: 'evening', pref: ['eats'] },
  { part: 'evening', pref: ['nightlife', 'views'] },
];

const DAY_SLOTS: readonly Slot[] = [
  { part: 'morning', pref: ['cafes'] },
  { part: 'morning', pref: ['nature', 'heritage'] },
  { part: 'afternoon', pref: ['eats'] },
  { part: 'afternoon', pref: ['heritage', 'markets'] },
  { part: 'afternoon', pref: ['views', 'cafes'] },
];

/** When each shape starts, minutes past midnight. */
const START_MIN: Record<'day' | 'evening', number> = { day: 9 * 60, evening: 18 * 60 };

// ── weights ──────────────────────────────────────────────────────────

type Lens = { key: LensKey; popularity: number; price: number; favour: readonly string[] };

/**
 * The same scoring function three ways.
 *
 * `match` is the plan the answers ask for. `iconic` leans on how many
 * people have rated a place, which is what "the famous one" means in this
 * data. `lowkey` leans away from it and towards cheap, which is what
 * "somewhere quiet" means when the catalog has no word for quiet.
 */
const LENSES: readonly Lens[] = [
  { key: 'match', popularity: 1, price: 0, favour: [] },
  { key: 'iconic', popularity: 2.4, price: 0, favour: ['views', 'heritage'] },
  { key: 'lowkey', popularity: -0.4, price: -0.8, favour: ['cafes', 'nature'] },
];

/** How much a reader's history may move a place. Deliberately below the
 *  weight on the answers they just gave: taste breaks ties and orders,
 *  it does not overrule the question they were asked a moment ago. */
const TASTE_WEIGHT = 2;

/**
 * Charged against a place that costs more than its share of a stated
 * budget, per whole share it runs over, capped.
 *
 * A budget divides by the number of stops rather than being carried as a
 * running total, and that is a deliberate simplification: a running total
 * makes the last slot's choice depend on the first three, which would put
 * the plan's shape at the mercy of the order the slots happen to be
 * walked. Per-stop shares reorder the candidates for every slot alike.
 *
 * The cap sits below the 3 a category match is worth, so a stated budget
 * reorders what the reader asked for and never replaces it. Somebody who
 * asked for cafés and set a low budget gets the cheaper cafés — not a park.
 */
const BUDGET_PENALTY = 2;
const BUDGET_PENALTY_MAX = 2.5;

/** How far apart two scores may be and still count as equally good. Set
 *  against the scale of the terms above — a rating is worth up to 5, a
 *  category match 3 — so this is "about one category apart". */
const EPSILON = 1.2;

/** Charged against a place per kilometre from the previous stop, capped
 *  so a genuinely better place across town can still win. */
const KM_PENALTY = 0.4;
const KM_PENALTY_MAX = 4;

/** Applied to a place another plan in this batch already used, and to
 *  anything the screen asked to avoid. Strong enough to move the answer,
 *  soft enough that a category holding one place still returns it. */
const REPEAT_PENALTY = 3;

/**
 * Credited to a place in the district the reader chose.
 *
 * A nudge and not a gate, which is the whole decision here. Hanoi's
 * busiest district holds a couple of dozen places and its quietest holds
 * two; filtering hard would hand somebody who picked the quiet one an
 * empty screen instead of a day that starts where they asked and drifts.
 * Worth more than a slot preference and less than the categories, so the
 * area shapes the plan without overriding what the reader came for.
 */
const DISTRICT_BONUS = 2.5;

// ── time and money ───────────────────────────────────────────────────

/** How long a stop takes when the catalog does not say. */
const DWELL_DEFAULT = 75;
const DWELL_MIN = 45;
const DWELL_MAX = 150;

/** Assumed journey when one end has no coordinates and `legBetween`
 *  cannot answer. Long enough not to make the day look tighter than it
 *  is. */
const HOP_DEFAULT_MIN = 20;

/** Nominal spacing used to decide *when* a slot happens, before anything
 *  has been chosen. Opening hours have to be checked against some hour,
 *  and the real arrival is not known until the stop before is picked. */
const NOMINAL_STEP = DWELL_DEFAULT + HOP_DEFAULT_MIN;

/**
 * A ride, in dong. Ported from the mockup's `ITI_TRANSPORT_PER_HOP`.
 *
 * The one figure in `costVnd` that is not per person: four people share
 * one Grab and pay this once. So the per-person total is right for
 * somebody going alone and high for a group — the safer of the two
 * directions to be wrong in, and the screen says the estimate is per
 * person.
 */
const RIDE_VND = 15000;

/** Categories whose spend is food rather than activity, for the donut. */
const FOOD_CATEGORIES = new Set(['eats', 'cafes']);

// ── the draw ─────────────────────────────────────────────────────────

/**
 * A small seeded generator.
 *
 * `Math.random()` cannot be seeded, which would make this module impure
 * and its output impossible to assert. Mulberry32 is five lines, has no
 * dependency, and is far better than this needs.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function overlap(a: readonly string[], b: readonly string[]): number {
  let n = 0;
  for (const x of a) if (b.includes(x)) n++;
  return n;
}

// ── filtering ────────────────────────────────────────────────────────

/**
 * Whether a place can be visited at `minutes` on `day`.
 *
 * `null` from `openState` means *unknown*, not *closed*, and the catalog
 * has exactly one row where that distinction bites: APEC Park in Da Nang,
 * which stores no hours because a public park does not post any. Reading
 * null as closed would bar it from every plan forever. `openState`'s own
 * comment settles it — "showing nothing beats showing 'Closed' to someone
 * standing in the doorway of an open café".
 */
function openAt(p: Place, day: string, minutes: number): boolean {
  if (!p.opening_hours?.length) return true;
  const at = instantOn(day, minutes);
  if (!at) return true;
  const state = openState(p.opening_hours, at);
  return state === null || state.open;
}

/** Why this place cannot be used, or null when it can. Ordered so the
 *  reason the reader can act on comes first. */
function dropReason(p: Place, draft: TripDraft, cityId: string | null, when: number): DropReason | null {
  if (!isLive(p)) return 'unlive';
  if (cityId && p.city_id && p.city_id !== cityId) return 'city';
  if (!openAt(p, draft.date, when)) return 'closed';
  if (draft.categories.length && !overlap(categoriesOf(p), draft.categories)) return 'slot';
  return null;
}

// ── scoring ──────────────────────────────────────────────────────────

function scoreOf(
  p: Place, slot: Slot, draft: TripDraft, lens: Lens,
  prev: Place | null, opts: PlanOptions, used: ReadonlySet<string>,
  /** One stop's share of a stated budget, or null when none was stated. */
  share: number | null,
): number {
  const cats = categoriesOf(p);
  let s = overlap(cats, draft.categories) * 3
    + overlap(cats, slot.pref) * 2
    + overlap(cats, lens.favour) * 1.5
    + (p.rating ?? 0)
    + lens.popularity * Math.min(3, Math.log10(1 + (p.rating_count ?? 0)))
    + lens.price * ((p.price_vnd ?? 0) / 100_000);

  if (draft.district && p.neighborhood_en?.trim() === draft.district) s += DISTRICT_BONUS;

  if (opts.taste) s += opts.taste.affinity(p) * TASTE_WEIGHT;

  if (share) {
    // Only the overrun is charged. A place at or under its share is not
    // rewarded for being cheap — `lowkey` already leans that way, and
    // paying twice for the same fact would make a stated budget quietly
    // turn every plan into the lowkey one.
    const over = Math.max(0, (p.price_vnd ?? 0) - share) / share;
    s -= Math.min(BUDGET_PENALTY_MAX, over * BUDGET_PENALTY);
  }

  if (prev && prev.lat != null && prev.lng != null && p.lat != null && p.lng != null) {
    s -= Math.min(KM_PENALTY_MAX, distanceKm(prev.lat, prev.lng, p.lat, p.lng) * KM_PENALTY);
  }

  if (used.has(p.slug) || opts.avoid?.includes(p.slug)) s -= REPEAT_PENALTY;

  return s;
}

/**
 * One place from the band of near-equals, or null when there are none.
 *
 * Weighted so a better place is likelier, not certain. Ties beyond the
 * draw break on `slug`: the sort is total, so the same seed replays
 * exactly. The original script broke ties on `id`, which the app never
 * carries.
 */
function draw(scored: { p: Place; s: number }[], rnd: () => number): Place | null {
  if (!scored.length) return null;
  const ranked = [...scored].sort((a, b) => b.s - a.s || (a.p.slug < b.p.slug ? -1 : 1));
  const floor = ranked[0].s - EPSILON;
  const band = ranked.filter((c) => c.s >= floor);

  const weights = band.map((c) => c.s - floor + 0.5);
  const total = weights.reduce((n, w) => n + w, 0);
  let roll = rnd() * total;
  // Stops one short, and the last candidate is the fallthrough rather than
  // a case in the loop. Running the loop to the end instead leaves a
  // `return` after it that only floating-point drift can reach — a line no
  // test can honestly cover, standing in for an outcome the fallthrough
  // already produces.
  for (let i = 0; i < band.length - 1; i++) {
    roll -= weights[i];
    if (roll <= 0) return band[i].p;
  }
  return band[band.length - 1].p;
}

// ── building one plan ────────────────────────────────────────────────

function dwellOf(p: Place): number {
  const lo = p.duration_min;
  const hi = p.duration_max;
  // Spelled out rather than `(lo ?? hi ?? DEFAULT)` twice over. That form
  // reads as three possibilities where there are only four states, and two
  // of its fallbacks can never fire — the desk fills one end, both, or
  // neither, and "neither" leaves before the arithmetic.
  let avg: number;
  if (lo != null && hi != null) avg = (lo + hi) / 2;
  else if (lo != null) avg = lo;
  else if (hi != null) avg = hi;
  else return DWELL_DEFAULT;
  return Math.min(DWELL_MAX, Math.max(DWELL_MIN, Math.round(avg / 15) * 15));
}

function buildPlan(
  lens: Lens, slots: readonly Slot[], pool: readonly Place[], pinnedOk: readonly Place[],
  draft: TripDraft, opts: PlanOptions, used: ReadonlySet<string>, rnd: () => number,
): Place[] {
  const start = START_MIN[draft.when];
  const taken = new Set<string>();
  const out: Place[] = [];
  // A collection that could fill every slot would make all three plans the
  // same plan in three orders, so it may claim all but one. The reader
  // still sees what they saved; the cards stay three real choices.
  const pinnedBudget = Math.max(0, slots.length - 1);
  let pinnedUsed = 0;

  // A budget nobody stated, and a budget of zero, are both "no share to
  // divide" — zero would make every priced place infinitely over.
  const share = opts.budgetVnd ? opts.budgetVnd / slots.length : null;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const prev = out.length ? out[out.length - 1] : null;
    const at = start + i * NOMINAL_STEP;

    const fits = (p: Place) => !taken.has(p.slug) && openAt(p, draft.date, at);

    let chosen: Place | null = null;
    if (pinnedUsed < pinnedBudget) {
      const cands = pinnedOk.filter(fits)
        .map((p) => ({ p, s: scoreOf(p, slot, draft, lens, prev, opts, used, share) }));
      chosen = draw(cands, rnd);
      if (chosen) pinnedUsed++;
    }
    if (!chosen) {
      const cands = pool.filter(fits)
        .map((p) => ({ p, s: scoreOf(p, slot, draft, lens, prev, opts, used, share) }));
      chosen = draw(cands, rnd);
    }

    if (!chosen) continue;
    taken.add(chosen.slug);
    out.push(chosen);
  }
  return out;
}

/** Times, legs and money, once the places are settled. */
function dress(lens: LensKey, places: Place[], slots: readonly Slot[], draft: TripDraft,
  pinnedDropped: TripPlan['pinnedDropped']): TripPlan {
  const legs = legsOf(places);
  const stops: Stop[] = [];
  let at = START_MIN[draft.when];

  for (let i = 0; i < places.length; i++) {
    const dwell = dwellOf(places[i]);
    // `slots[i]` is always there: `buildPlan` walks the slots and pushes at
    // most one place per slot, so there are never more places than slots.
    stops.push({ place: places[i], part: slots[i].part, arriveMin: at, dwellMin: dwell, why: null });
    at += dwell + (legs[i]?.minutes ?? (i + 1 < places.length ? HOP_DEFAULT_MIN : 0));
  }

  let food = 0;
  let activity = 0;
  for (const s of stops) {
    const v = s.place.price_vnd ?? 0;
    if (categoriesOf(s.place).some((c) => FOOD_CATEGORIES.has(c))) food += v;
    else activity += v;
  }
  // Walking is free. The mockup charged every hop alike, which quietly
  // added a fare to two stops on the same street.
  const transport = legs.filter((l) => l?.mode === 'ride').length * RIDE_VND;

  return {
    lens,
    title: null,
    stops,
    legs,
    costVnd: { food, activity, transport },
    // The window opens where `at` began, which is also where the first stop
    // was placed — so this is the first arrival when there is one, and the
    // hour the outing would have started when there is not.
    windowMin: [START_MIN[draft.when], at],
    pinnedDropped,
  };
}

// ── the entry point ──────────────────────────────────────────────────

/**
 * Up to three ways to spend the day described by `draft`.
 *
 * Fewer than three when the catalog cannot carry three — Da Nang holds
 * two places to eat — and an empty array when it cannot carry one, which
 * is not hypothetical either: neither Hanoi nor Da Nang holds a single
 * shopping place, so asking for one is a plan that cannot exist. The
 * caller reads the length and says which rung it is on rather than
 * padding to look complete; `gaps.ts` supplies the sentence.
 *
 * `places` should already be the city's live catalog. `cityId` narrows it
 * again for the pinned set, which comes from collections and may reach
 * across cities.
 */
export function planTrips(
  draft: TripDraft, places: readonly Place[], cityId: string | null = null,
  opts: PlanOptions = {},
): TripPlan[] {
  const slots = draft.when === 'day' ? DAY_SLOTS : EVENING_SLOTS;
  const rnd = mulberry32(opts.seed ?? 1);

  // Filtered once against the middle of the outing rather than per slot:
  // the pool is what could plausibly appear, and each slot re-checks its
  // own hour when it picks.
  const middle = START_MIN[draft.when] + Math.floor(slots.length / 2) * NOMINAL_STEP;
  const pool = places.filter((p) => dropReason(p, draft, cityId, middle) === null);

  // Pinned places carry their rejection reason out with them. Somebody who
  // seeded an evening from a café list where everything shuts at six
  // should be told that, not left wondering where their picks went.
  const pinnedOk: Place[] = [];
  const pinnedDropped: TripPlan['pinnedDropped'] = [];
  for (const p of opts.pinned ?? []) {
    const reason = dropReason(p, draft, cityId, middle);
    if (reason) pinnedDropped.push({ slug: p.slug, reason });
    else pinnedOk.push(p);
  }

  const plans: TripPlan[] = [];
  const used = new Set<string>();

  for (const lens of LENSES) {
    const picked = buildPlan(lens, slots, pool, pinnedOk, draft, opts, used, rnd);
    if (!picked.length) continue;

    // Two plans sharing all but one stop are one plan shown twice. Dropping
    // the duplicate is what makes a thin catalog return two cards instead
    // of three lies.
    const slugs = picked.map((p) => p.slug);
    const tooSimilar = plans.some((prev) => {
      const same = prev.stops.filter((s) => slugs.includes(s.place.slug)).length;
      return same > Math.max(0, picked.length - 2);
    });
    if (tooSimilar) continue;

    for (const s of slugs) used.add(s);
    plans.push(dress(lens.key, picked, slots, draft, pinnedDropped));
  }

  return plans;
}
