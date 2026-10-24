// The line under a stop's name on a plan the reader is choosing between.
//
// It is the district now, and only when the plan crosses districts: a plan
// that never leaves one district said that district under every stop and
// in its own heading. In Melbourne, where 59 of 66 places carry the
// council's name "Melbourne City" rather than a suburb, that was the same
// two words four times on one card. `sharedArea` below is the question the
// card asks before it decides.
//
// ── what the line used to carry, and why it does not ──
//
// `stopFacts` added two more facts, each only when true: the planned stay,
// when the place says how long people stay (of 800 places 604 carried no
// duration, and printing the planner's 75 minutes for each was a figure
// about the planner), and whether the stop is open at the hour the plan
// arrives, read on the plan's own day in the city's zone. Both went on 24
// Oct 2026 with the card's hours (owner): the card is for choosing a
// shape, and a closing time under a stop with no arrival beside it
// answers a question the card no longer asks. The editor prints both.
//
// The rating went before that, on the same argument: the star is one tap
// away on the stop itself, and the card's job is the shape of the evening,
// not the merits of each place in it.

import type { Place } from './types';

/**
 * Whether every place of a plan sits in one district — the case in which
 * naming it under each stop repeats the card's own heading.
 *
 * Districts the catalog does not know count as equal to each other: a plan
 * of three undistricted stops has nothing to print either way. An empty
 * plan is vacuously one district; it draws no rows for the answer to
 * matter.
 */
export function sharedArea(places: readonly Pick<Place, 'neighborhood_en'>[]): boolean {
  return places.every((p) => (p.neighborhood_en ?? null) === (places[0]?.neighborhood_en ?? null));
}
