// The line under a stop's name on a plan the reader is choosing between.
//
// Three facts, each one only when it is true:
//
// - the district, which is what the line always said, and what the card's
//   heading counts when no model named the plan — but only when the caller
//   asks for it. A plan that never leaves one district said that district
//   under every stop and in its own heading: in Melbourne, where 59 of 66
//   places carry the council's name "Melbourne City" rather than a suburb,
//   that was the same two words four times on one card. `sharedArea`
//   below is the question the card asks before it decides;
// - how long the stop is planned for, but only when the place says how
//   long people stay. Of 800 places, 604 carry no duration, and every one
//   of those gets the planner's 75 minutes — printed, that was the same
//   "75 phút" under every stop of every plan, a figure that described the
//   planner and not the place;
// - whether it is open at the hour the plan arrives. The planner already
//   keeps shut places out, so this is nearly always "open until", and the
//   closing time is the fact that decides how long the evening can run.
//
// Read at the arrival, not at the moment the screen is looked at. A plan
// for Saturday night, drawn on Thursday morning, is about Saturday night;
// the editor's fact line reads `now`, which is right for a plan being run
// and wrong for one being chosen.
//
// The rating is not here any more. It was, on the argument that between
// two evenings it is the first thing a reader compares — and on the phone
// it made the line the fourth thing under every stop, above a sentence
// and a leg, on a card the reader is only choosing from. The star is one
// tap away on the stop itself, and the card's job is the shape of the
// evening, not the merits of each place in it.

import { instantOn } from './clock';
import { clockOf, fmtMinutes, openState } from './format';
import { summaryLine } from './sketch';
import type { Place } from './types';

type T = (en: string, vi: string, ja: string) => string;

export function stopFacts(
  place: Pick<Place, 'neighborhood_en' | 'duration_min' | 'duration_max' | 'opening_hours'>,
  stop: { arriveMin: number; dwellMin: number },
  day: string,
  tz: string,
  lang: string,
  t: T,
  /** `area: false` leaves the district off — for a plan whose stops all
   *  share it, where the heading already says it once. */
  opts: { area?: boolean } = {},
): string {
  const known = place.duration_min != null || place.duration_max != null;
  const at = instantOn(day, stop.arriveMin, tz);
  const state = at ? openState(place.opening_hours, at, tz) : null;
  let hours: string | null = null;
  if (state?.open && state.untilMin != null) {
    const until = clockOf(state.untilMin);
    hours = t(`open until ${until}`, `mở tới ${until}`, `${until}まで営業`);
  } else if (state && !state.open && state.opensAtMin != null) {
    const opens = clockOf(state.opensAtMin);
    hours = t(`opens ${opens}`, `mở lúc ${opens}`, `${opens}開店`);
  }
  return summaryLine([
    opts.area === false ? null : place.neighborhood_en,
    known ? fmtMinutes(stop.dwellMin, lang) : null,
    hours,
  ]);
}

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
