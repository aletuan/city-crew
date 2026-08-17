// Editing a plan after the planner has handed it over.
//
// Pure, and here rather than in the screen for the reason `place.ts` is: a
// Node process can reach it. What is worth getting right is not the drag
// gesture — no test can see a drag — but what happens to the *other* stops
// when one of them moves, and that is arithmetic nobody notices being
// wrong by looking at a screen with plausible times on it.
//
// ── the rule this file exists to keep ──
//
// A time the reader set by hand is never recomputed. Not when a stop is
// added before it, not when the order changes, not when something is
// deleted. Without that rule every edit quietly undoes the last one: you
// nudge dinner to eight, add a bar, and dinner is back at 19:15 with
// nothing on screen admitting it moved.
//
// So a stop carries `pinned`. The planner produces stops with `pinned`
// false — it computed those times and may compute them again — and the
// moment the reader touches one it becomes true and stops being the
// planner's business. Times flow forward from whichever stop is above,
// pinned or not; a pinned stop simply refuses to be the one that changes.
//
// The trade is that a plan can end up out of order in time — pin dinner at
// eight, then pin the bar at seven — and this file does not stop that.
// Refusing the second edit would mean overriding a reader who is holding
// both facts and may be about to fix the first. The screen flags it
// instead; `outOfOrder` is here for that.

import { legBetween, type Leg, type Located } from './travel';

/** A stop as the editor holds it. `Place` is not imported: the editor
 *  needs a name to draw and coordinates to route between, and typing this
 *  structurally keeps the module reachable from a plain Node process. */
export type Editable<P extends Located = Located> = {
  place: P;
  arriveMin: number;
  dwellMin: number;
  /** True once the reader set this time themselves. */
  pinned: boolean;
};

/** Assumed journey when one end has no coordinates — `legBetween` cannot
 *  answer, and the plan still has to put the next stop somewhere. Matches
 *  the planner's own default, so a saved plan and a re-planned one do not
 *  disagree by twenty minutes for no visible reason. */
const HOP_DEFAULT_MIN = 20;

/** How far a nudge moves a time. Fifteen minutes is the granularity the
 *  planner rounds durations to, so a plan edited by hand stays on the same
 *  grid as one it produced. */
export const NUDGE_MIN = 15;

const DAY = 24 * 60;

/**
 * Times recomputed from the top, honouring every pin.
 *
 * The first stop anchors the plan: pinned or not, its arrival is taken as
 * given, because there is nothing above it to flow from. Every stop after
 * it either keeps its own time (pinned) or lands at the previous stop's
 * departure plus the journey.
 *
 * `startMin` overrides that anchor, and every edit that can change *which*
 * stop is first passes it. Without it the plan lurches: drag the café to
 * the front and the evening starts at 19:03, because the café was carrying
 * a time computed from a walk that no longer happens. The reader moved a
 * stop, not their evening.
 *
 * Deliberately not clamped to the original *end*. A reader who adds a
 * fourth stop has made the evening longer, and a plan that silently
 * refused to run past some remembered finish would be arguing with them
 * about arithmetic they can see.
 */
export function retime<P extends Located>(
  stops: readonly Editable<P>[], startMin?: number,
): Editable<P>[] {
  const out: Editable<P>[] = [];
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    if (i === 0) { out.push({ ...s, arriveMin: startMin ?? s.arriveMin }); continue; }
    if (s.pinned) { out.push({ ...s }); continue; }
    const prev = out[i - 1];
    const leg = legBetween(prev.place, s.place);
    out.push({ ...s, arriveMin: prev.arriveMin + prev.dwellMin + (leg?.minutes ?? HOP_DEFAULT_MIN) });
  }
  return out;
}

/**
 * A stop's time, moved by the reader.
 *
 * Pins it, and everything below flows from the new time — which is the
 * whole point of nudging one: a dinner pushed back pushes the bar back
 * too, unless the bar was pinned as well.
 *
 * Clamped into the day rather than allowed to wrap. Nudging 00:00 back
 * fifteen minutes should stop at midnight, not land at a quarter to
 * tomorrow and reorder the plan under the reader's thumb.
 */
export function nudge<P extends Located>(
  stops: readonly Editable<P>[], index: number, deltaMin: number,
): Editable<P>[] {
  if (index < 0 || index >= stops.length) return [...stops];
  const next = stops.map((s, i) => (
    i === index
      ? { ...s, pinned: true, arriveMin: Math.max(0, Math.min(DAY - 1, s.arriveMin + deltaMin)) }
      : { ...s }
  ));
  return retime(next);
}

/**
 * A stop dragged to another position.
 *
 * The times do **not** travel with it. A stop dragged into third place
 * takes third place's hour, because the reader moved it in the itinerary
 * and not in the day — which is what a list with times down the left
 * means. Pins move with their stops, so a time set by hand survives being
 * reordered around.
 *
 * Out-of-range indices return the list unchanged rather than throwing: a
 * drag that ends outside the list is a gesture the screen already treats
 * as a cancel.
 */
export function move<P extends Located>(
  stops: readonly Editable<P>[], from: number, to: number,
): Editable<P>[] {
  if (from === to || from < 0 || from >= stops.length || to < 0 || to >= stops.length) {
    return [...stops];
  }
  const next = [...stops];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return retime(next, stops[0].arriveMin);
}

/**
 * A stop taken out.
 *
 * Removing the first stop hands the plan's start time to whatever is now
 * first — including a stop that was not pinned, which then anchors the
 * rest. The alternative is a plan that jumps an hour earlier because the
 * new first stop inherited a time computed from a journey that no longer
 * happens.
 */
export function remove<P extends Located>(stops: readonly Editable<P>[], index: number): Editable<P>[] {
  if (index < 0 || index >= stops.length) return [...stops];
  const next = stops.filter((_, i) => i !== index);
  if (!next.length) return [];
  return retime(next, stops[0].arriveMin);
}

/**
 * A stop added at `index`, or at the end when `index` is omitted.
 *
 * Unpinned, so it takes the time the plan gives it. `dwellMin` is the
 * caller's business — the screen reads it off the place the same way the
 * planner does — because this module has no opinion about how long a
 * museum takes.
 */
export function insert<P extends Located>(
  stops: readonly Editable<P>[], stop: Editable<P>, index = stops.length,
): Editable<P>[] {
  const at = Math.max(0, Math.min(stops.length, index));
  const next = [...stops];
  next.splice(at, 0, { ...stop, pinned: false });
  return retime(next, stops.length ? stops[0].arriveMin : undefined);
}

/** Every journey in the plan; index i is the leg out of stop i. Nulls stay
 *  in place — see `travel.ts`. */
export function legsOfPlan<P extends Located>(stops: readonly Editable<P>[]): (Leg | null)[] {
  const out: (Leg | null)[] = [];
  for (let i = 0; i + 1 < stops.length; i++) out.push(legBetween(stops[i].place, stops[i + 1].place));
  return out;
}

/**
 * The stops whose time is earlier than the stop above them.
 *
 * Only pinning can produce this, and only deliberately — pin the bar at
 * seven with dinner pinned at eight and the plan now reads backwards. It
 * is not an error to refuse; the reader is holding both facts and may be
 * one tap from fixing it. But a plan that reads backwards with nothing
 * saying so is a plan that gets somebody to a closed door.
 *
 * Returns indices rather than a boolean so the screen can mark the row
 * rather than printing a warning about a list the reader then has to
 * search.
 */
export function outOfOrder<P extends Located>(stops: readonly Editable<P>[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].arriveMin < stops[i - 1].arriveMin) out.push(i);
  }
  return out;
}

/** First arrival to last departure. `[0, 0]` for an empty plan, which the
 *  screen renders as nothing rather than as midnight. */
export function windowOf<P extends Located>(stops: readonly Editable<P>[]): [number, number] {
  if (!stops.length) return [0, 0];
  const last = stops[stops.length - 1];
  return [stops[0].arriveMin, last.arriveMin + last.dwellMin];
}
