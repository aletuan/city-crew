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
import { minutesOf, toISO } from './day';
import { instantOn, openState } from './format';
import { distanceKm } from './geo';
import { isLive } from './live';
import { legsOf, type Leg } from './travel';
import { areaCentre, type Company, type TripDraft } from './trip';
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
  /** What the reader said an outing is worth to them, per person, in dong.
   *  Null and undefined both mean "not said", which is not the same as no
   *  budget and must not become zero.
   *
   *  Nothing in the app asks the question today — `usePlanProfile` explains
   *  why and is where an answer would arrive — so this is null on every
   *  real call and the arithmetic below runs only under test. Kept rather
   *  than deleted: the weighting took care to get right, and the day the
   *  wizard asks, it should not have to be reinvented. */
  budgetVnd?: number | null;
  /** What time the outing begins, minutes past midnight — normally
   *  `startMinFor(draft.when, draft.date, now)`, resolved by the wizard so
   *  every screen that rebuilds the plan rebuilds the same one.
   *
   *  Absent means the shape's own hour, which is right for any day that is
   *  not today and wrong only for the day that is half gone. It is optional
   *  rather than required so a test, or a caller with no clock to hand, can
   *  ask for the shape's natural hours and get them. */
  startMin?: number | null;
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

type Slot = { pref: readonly string[] };

/** Somewhere on the map. Both ways of answering "where does this start"
 *  resolve to one of these — see `originOf`. */
type Point = { lat: number; lng: number };

/**
 * Where the day starts, from whatever the reader gave us.
 *
 * The wizard offers two ways to say it and they arrive in different
 * shapes: a dropped pin is already a coordinate, while a chosen area is a
 * name. Both are answers to the same question, so both become a point
 * here and the scoring function never learns there were two.
 *
 * An area has no boundary anywhere in this app — `areaCentre` takes the
 * mean of its places, which is not a centre in any official sense and does
 * not need to be. The question it feeds is "how far out of my way is
 * this", and a representative point answers that.
 *
 * The pin wins when both are set. Picking an area also drops a pin on it,
 * so the two normally agree; where they do not, the pin is the more
 * specific of the two and the later thing the reader touched.
 *
 * Null is a real answer and not a failure: somebody who has granted no
 * location and picked no area has told us nothing about where they are,
 * and inventing a point for them would be worse than letting the first
 * stop be chosen on merit alone. That is also exactly how this behaved
 * before the origin existed, which is what keeps the change from moving
 * plans nobody asked to move.
 */
function originOf(draft: TripDraft, places: readonly Place[]): Point | null {
  return draft.at ?? areaCentre([...places], draft.district);
}

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
 *
 * A slot used to name the part of day it belonged to as well, and that was
 * a second source of truth for something the clock already knows. See
 * `partAt`.
 */
const EVENING_SLOTS: readonly Slot[] = [
  { pref: ['views', 'heritage'] },
  { pref: ['eats'] },
  { pref: ['nightlife', 'views'] },
];

const DAY_SLOTS: readonly Slot[] = [
  { pref: ['cafes'] },
  { pref: ['nature', 'heritage'] },
  { pref: ['eats'] },
  { pref: ['heritage', 'markets'] },
  { pref: ['views', 'cafes'] },
];

/**
 * Which part of the day an hour falls in.
 *
 * Read off the clock rather than off the slot, and that is the fix for a
 * plan that could call 20:15 "morning". The shapes above are written for
 * their usual hours — a day out from 09:00 lands its first two stops before
 * noon — so at those hours this agrees with the labels they used to carry.
 * It only disagrees where they were lying: an outing whose start the clock
 * pushed later, and a short shape whose stops are taken from the front of a
 * longer one.
 *
 * Boundaries are the ordinary ones and are not trying to be more. Noon
 * divides morning from afternoon; five is where an outing stops being an
 * afternoon, which is early enough that a 15:20 last stop is still one and
 * late enough that dinner never is.
 */
export function partAt(minutes: number): PartKey {
  const at = ((minutes % 1440) + 1440) % 1440;
  if (at < 12 * 60) return 'morning';
  if (at < 17 * 60) return 'afternoon';
  return 'evening';
}

/**
 * How much of the shape the reader actually asked for.
 *
 * The shapes above are a ceiling, not an answer. The number of stops used
 * to come from `when` alone — three for an evening, five for a day, always
 * — and `when` says only *when*, never *what*. Ask for cafés on your own
 * this evening and you were handed **three cafés**, seventy-five minutes
 * each: getting on for four hours of sitting in cafés, which is a contest
 * rather than a plan.
 *
 * That happened because a slot's `pref` is a nudge and the reader's
 * categories are the hard filter — deliberately, so an evening asked for in
 * cafés never has a restaurant wedged into it. The cost of that choice only
 * shows at one category, where every slot collapses onto the same kind.
 *
 * So the count comes from the ask: **one stop per kind of place**, plus one
 * for a day, which has the room. One kind is a destination — a coffee, a
 * meal — and three kinds is an outing. The old ceiling still applies.
 *
 * A draft naming no category at all keeps the whole shape: nothing has been
 * narrowed, so nothing should be.
 *
 * The three lenses still run, so one stop returns *three different cafés* —
 * the best match, the well-known one, the quiet one. That is a better
 * answer to "I want a coffee" than a crawl, and it needs no new code: the
 * duplicate check already refuses a second plan that reuses a place.
 *
 * Slots are taken from the front rather than spread across the shape, and
 * that is deliberate: `dress` packs stops back to back from the start, so a
 * two-stop day really is 09:00 and 10:35 and taking the third and fifth
 * slots would plan around two gaps nobody asked for. What each stop is
 * *called* no longer depends on which slot it came from — see `partAt`.
 *
 * The last bound is the day itself. A shape that starts at its usual hour
 * always fits, so this only bites where the clock has pushed the start
 * later: asking for a five-stop day at eight in the evening used to hand
 * back an outing running to three the next morning, with hours past 24:00
 * that the screens print modulo a day — 01:35, on a card headed with
 * today's date. Two stops and an honest finish is the better answer, and
 * the wizard has already said out loud where the plan starts.
 */
function slotsFor(draft: TripDraft, start: number): readonly Slot[] {
  const shape = draft.when === 'day' ? DAY_SLOTS : EVENING_SLOTS;
  // Nominal, like the pool filter's `middle`: real dwells and legs move
  // every hour a little, and a ceiling that tracked them exactly would
  // change the number of stops on a plan because one café closes at nine.
  const fits = Math.floor((DAY_END - start) / NOMINAL_STEP);
  const wanted = draft.categories.length
    ? draft.categories.length + (draft.when === 'day' ? 1 : 0)
    : shape.length;
  return shape.slice(0, Math.max(1, Math.min(shape.length, wanted, fits)));
}

/** When each shape starts, minutes past midnight. Exported so the wizard
 *  can tell a plan starting at its normal hour from one pushed later by the
 *  clock, and say so. */
export const START_MIN: Record<'day' | 'evening', number> = { day: 9 * 60, evening: 18 * 60 };

/**
 * The last hour at which starting is still the thing the reader asked for.
 *
 * Not a limit on the catalog — plenty is open at ten in the evening — but
 * on the word. A "day out" begun at four in the afternoon is an afternoon,
 * and an "evening" begun at half past ten is a nightcap. Past these, the
 * honest move is to offer the same outing tomorrow rather than a stub of it
 * today, which is what `partGone` is for.
 *
 * Read against the shapes above: the day's five stops run about seven
 * hours, so 15:00 is the point where fewer than half of them fit before the
 * city closes; the evening's three run about three and a half.
 */
const LAST_START: Record<'day' | 'evening', number> = { day: 15 * 60, evening: 21 * 60 };

/** Starts rounded up to this, so a plan never begins at 18:07 and never
 *  begins in the minute the reader was still reading it. */
const START_STEP = 15;

/** Where a day stops being the day it is on. Midnight rather than some
 *  civilised hour: a plan may honestly run late, it may not run onto a
 *  date the card does not carry. */
const DAY_END = 24 * 60;

/**
 * When the outing actually starts, given what the clock says.
 *
 * The bug this exists for: `START_MIN` is fixed, so at five in the
 * afternoon "a day out today" was planned from 09:00 — eight hours gone —
 * and every place in it was checked against its 09:00 opening hours. The
 * plan was not merely mistimed, it was selected wrong: somewhere that opens
 * at seven and shuts at ten in the morning was a legitimate first stop.
 *
 * Only today is affected. A day named for next Saturday starts at the hour
 * that shape starts at, because none of it has gone.
 *
 * Deliberately *not* clamped to `LAST_START`. Clamping would put the start
 * back in the past, which is the whole thing being fixed; a reader who
 * insists on tonight at eleven gets a plan starting at eleven, and the
 * opening-hours gate will tell them the truth about what is left. The
 * wizard's job is to make that a choice rather than an accident, and
 * `partGone` is how it knows.
 *
 * `now` is an input rather than a `new Date()` for the reason `seed` is: a
 * plan rebuilt on the next screen must come out the same, and a function
 * that reads the clock cannot promise that.
 */
export function startMinFor(
  when: 'day' | 'evening', date: string, now: Date = new Date(),
): number {
  const base = START_MIN[when];
  if (date !== toISO(now)) return base;
  const at = minutesOf(now);
  if (at <= base) return base;
  return Math.ceil(at / START_STEP) * START_STEP;
}

/**
 * Has this part of `date` already gone?
 *
 * Only ever true for today — yesterday cannot be picked and tomorrow has
 * not started. The wizard asks this to decide which day to offer by
 * default; see `IdeasScreen`.
 */
export function partGone(
  when: 'day' | 'evening', date: string, now: Date = new Date(),
): boolean {
  return date === toISO(now) && minutesOf(now) > LAST_START[when];
}

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
 * Who is coming, as a lean on the shelf.
 *
 * ── the dead input this revives ──
 *
 * "Who's coming?" is the wizard's first question, and until this table
 * existed nothing in the planner read the answer. It was stored on the
 * trip, worn as a badge, and handed to the model to colour the prose —
 * so a family with children and a couple on a date night were given
 * identical stops, differing only in the sentence underneath. The first
 * question a screen asks should not be the one question the answer to
 * which changes nothing.
 *
 * ── a lean, never a gate, and weighted to lose on purpose ──
 *
 * `favour` earns the same 1.5 a lens's leaning does, `avoid` charges 2 —
 * both strictly below the 3 the reader's own categories carry. The
 * ordering of those three numbers is the contract: what the reader *said*
 * outranks who they are with, which outranks the card's flavour. A family
 * that explicitly picks nightlife has told us something more specific
 * than this table knows, and the gate in `dropReason` already honours it —
 * their chosen categories are the filter, and this term can only reorder
 * inside what survives.
 *
 * The values are deliberately mild and deliberately few. `family` avoids
 * nightlife — the one pairing where a wrong pick is a real cost, a bar in
 * a plan with children in it — and leans to the shelves a day out with
 * kids actually uses. `solo` leans to the two categories built around one
 * person and a seat. `couple` leans to the evening's own shelves.
 * `friends` leans loud. `other` says nothing, because it means "none of
 * the above" and inventing a taste for it would be answering a question
 * the reader deliberately declined.
 *
 * Null falls through to `NOBODY` rather than throwing: `TripDraft`
 * permits it, and a draft built outside the wizard should plan the way
 * every draft did before this table existed.
 */
type Lean = {
  favour: readonly string[];
  avoid: readonly string[];
  /** Suitability vibes — `kid_friendly`, `romantic`, `quiet`. A different
   *  kind of evidence from the two lists above: those are guesses from a
   *  place's *type*, these are a person's judgement about the *room*,
   *  hand-assigned at the desk the way `chill` always was. The importer
   *  never writes them, so a place that carries one carries it because
   *  somebody meant it. */
  favourVibes: readonly string[];
};
const NOBODY: Lean = { favour: [], avoid: [], favourVibes: [] };
export const COMPANY_LEAN: Record<Company, Lean> = {
  solo: { favour: ['cafes', 'focus'], avoid: [], favourVibes: ['quiet'] },
  couple: { favour: ['views', 'nightlife'], avoid: [], favourVibes: ['romantic'] },
  friends: { favour: ['nightlife', 'fun', 'eats'], avoid: [], favourVibes: [] },
  family: { favour: ['nature', 'fun', 'heritage'], avoid: ['nightlife'], favourVibes: ['kid_friendly'] },
  other: NOBODY,
};
const COMPANY_FAVOUR = 1.5;
const COMPANY_AVOID = 2;
/** Above the category lean, below the reader's own answers — and the gap
 *  is the argument. The category lean is this table guessing from what a
 *  place is; a suitability vibe is the desk having sat in the room. Better
 *  evidence earns more weight, and 2.5 still loses to the 3 the reader's
 *  explicit categories carry, so the contract in the note above holds. */
const COMPANY_VIBE = 2.5;

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

/**
 * The same charge for the first stop, measured from where the day starts —
 * and deliberately more than twice as steep.
 *
 * This exists because the first stop used to be free. `prev` is null on
 * the opening slot, so the only distance term never fired for it: the day
 * was anchored by whichever place scored highest anywhere in the city, and
 * every later stop then clung to that anchor through the penalty above.
 * The visible symptom was a plan whose hops were 50 and 550 metres sitting
 * three kilometres from the pin the reader had just dropped — the route
 * was tight, it was simply tight around the wrong place.
 *
 * Steeper than a mid-day hop because the two are not the same kind of
 * journey. Five hundred metres between two cafés is part of the outing.
 * Three kilometres before it begins is a cost paid before anything has
 * been got in return, and the reader who dropped the pin has already said
 * where they are.
 *
 * Sized against what it has to outweigh rather than picked for feel. The
 * popularity term is worth `min(3, log10(1 + rating_count))`, so a place
 * with a thousand reviews carries about 1.5 points over one with thirty —
 * and in Hanoi that difference tracks the tourist centre almost exactly.
 * At 0.4/km the three kilometres out of Ba Đình cost 1.2 and the centre
 * still won; at 1.0 they cost 3.0, which a near place needs only to be
 * roughly comparable to survive. The cap keeps it a nudge: past five
 * kilometres nothing further is charged, so a genuinely better place
 * across town is still allowed to win.
 */
const ORIGIN_KM_PENALTY = 1.0;
const ORIGIN_KM_PENALTY_MAX = 5;

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
  prev: Place | null,
  /** Where the day starts, for the opening stop — see `originOf`. Null
   *  when the reader has said nothing that places them, which is the one
   *  case where the first stop genuinely has nothing to be measured
   *  against. */
  origin: Point | null,
  opts: PlanOptions, used: ReadonlySet<string>,
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

  // Who is coming — see COMPANY_LEAN for why this is a lean and not a
  // gate, and why both weights sit below the reader's own categories.
  const lean = draft.company ? COMPANY_LEAN[draft.company] : NOBODY;
  s += overlap(cats, lean.favour) * COMPANY_FAVOUR
    - overlap(cats, lean.avoid) * COMPANY_AVOID
    + overlap(p.vibe_tags, lean.favourVibes) * COMPANY_VIBE;

  if (opts.taste) s += opts.taste.affinity(p) * TASTE_WEIGHT;

  if (share) {
    // Only the overrun is charged. A place at or under its share is not
    // rewarded for being cheap — `lowkey` already leans that way, and
    // paying twice for the same fact would make a stated budget quietly
    // turn every plan into the lowkey one.
    const over = Math.max(0, (p.price_vnd ?? 0) - share) / share;
    s -= Math.min(BUDGET_PENALTY_MAX, over * BUDGET_PENALTY);
  }

  // Two different questions, and the second one used to go unasked. After
  // the first stop the reference is the stop before, because what is being
  // charged is a hop inside the day. On the first stop it is where the day
  // starts, because what is being charged is getting to it at all.
  //
  // `prev` does not fall back to the origin when it lacks coordinates.
  // Once there is a previous stop, the hop is the distance from it; a
  // place with no coordinates cannot answer that, and answering a
  // different question instead would be worse than not answering.
  if (prev) {
    if (prev.lat != null && prev.lng != null && p.lat != null && p.lng != null) {
      s -= Math.min(KM_PENALTY_MAX, distanceKm(prev.lat, prev.lng, p.lat, p.lng) * KM_PENALTY);
    }
  } else if (origin && p.lat != null && p.lng != null) {
    s -= Math.min(
      ORIGIN_KM_PENALTY_MAX,
      distanceKm(origin.lat, origin.lng, p.lat, p.lng) * ORIGIN_KM_PENALTY,
    );
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
  start: number, origin: Point | null,
): Place[] {
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
        .map((p) => ({ p, s: scoreOf(p, slot, draft, lens, prev, origin, opts, used, share) }));
      chosen = draw(cands, rnd);
      if (chosen) pinnedUsed++;
    }
    if (!chosen) {
      const cands = pool.filter(fits)
        .map((p) => ({ p, s: scoreOf(p, slot, draft, lens, prev, origin, opts, used, share) }));
      chosen = draw(cands, rnd);
    }

    if (!chosen) continue;
    taken.add(chosen.slug);
    out.push(chosen);
  }
  return out;
}

/** Times, legs and money, once the places are settled. */
function dress(lens: LensKey, places: Place[], slots: readonly Slot[], start: number,
  pinnedDropped: TripPlan['pinnedDropped']): TripPlan {
  const legs = legsOf(places);
  const stops: Stop[] = [];
  let at = start;

  for (let i = 0; i < places.length; i++) {
    const dwell = dwellOf(places[i]);
    // `slots[i]` is always there: `buildPlan` walks the slots and pushes at
    // most one place per slot, so there are never more places than slots.
    stops.push({ place: places[i], part: partAt(at), arriveMin: at, dwellMin: dwell, why: null });
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
    windowMin: [start, at],
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
  const rnd = mulberry32(opts.seed ?? 1);
  // The shape's own hour unless the caller resolved a later one against the
  // clock. `?? `, not `||`, so a caller that genuinely means midnight is not
  // silently moved to nine — and null is accepted alongside undefined so a
  // screen holding "no start resolved" can pass it straight through.
  const start = opts.startMin ?? START_MIN[draft.when];
  // After the start, because how many stops fit depends on when it begins.
  const slots = slotsFor(draft, start);

  // Once for all three lenses. It is a mean over the catalog when the
  // reader picked an area, and there is no reason to take it three times.
  const origin = originOf(draft, places);

  // Filtered once against the middle of the outing rather than per slot:
  // the pool is what could plausibly appear, and each slot re-checks its
  // own hour when it picks.
  const middle = start + Math.floor(slots.length / 2) * NOMINAL_STEP;
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
    const picked = buildPlan(lens, slots, pool, pinnedOk, draft, opts, used, rnd, start, origin);
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
    plans.push(dress(lens.key, picked, slots, start, pinnedDropped));
  }

  return plans;
}
