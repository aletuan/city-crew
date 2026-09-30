// The line under a stop's name on a plan the reader is choosing between.
//
// Four facts, each one only when it is true:
//
// - the district, which is what the line always said, and what the card's
//   heading counts when no model named the plan;
// - the rating, because between two evenings it is the first thing a
//   reader compares, and the plan never showed it;
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

import { instantOn } from './clock';
import { clockOf, fmtMinutes, openState } from './format';
import { summaryLine } from './sketch';
import type { Place } from './types';

type T = (en: string, vi: string, ja: string) => string;

export function stopFacts(
  place: Pick<Place, 'neighborhood_en' | 'rating' | 'duration_min' | 'duration_max' | 'opening_hours'>,
  stop: { arriveMin: number; dwellMin: number },
  day: string,
  tz: string,
  lang: string,
  t: T,
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
    place.neighborhood_en,
    place.rating ? `${place.rating}★` : null,
    known ? fmtMinutes(stop.dwellMin, lang) : null,
    hours,
  ]);
}
