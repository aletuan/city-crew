// The opening-hours slider's arithmetic, and the two-way rule between its
// heads and the three segments above it.
//
// The owner's ask (9 Nov 2026): choosing "Open now" should put the heads
// on the present moment, and moving the heads should say which segment,
// if any, still describes what is chosen. So the segments and the heads
// are two drawings of one answer, and this file is the one place that
// translates between them:
//
//   Any time   ⇔ the heads on both edges, the whole trading day
//   Open now   ⇔ both heads together on the present moment
//   Closed now →  both heads on the present moment, drawn muted: the
//                 slider asks what is open, and has no drawing for its
//                 opposite. Moving a head turns it into a window.
//   (none)     ⇔ any other span: open at some moment of it
//
// Positions are minutes from `DAY_START` (06:00), 0 to 1440 — see
// `DAY_START` for why the axis starts at six.

import type { ExploreFilters, HoursWindow } from './exploreFilters';
import { clockOf, DAY_START } from './format';

/** The axis, end to end: one trading day. */
export const AXIS = 24 * 60;

/**
 * Half an hour a step, 48 steps. Opening hours in the catalog are on the
 * half hour almost without exception: 19,491 of 19,648 times written in
 * the approved places' hours (99.2%), and 23 places of 1,289 with any
 * other minute in them (9 Nov 2026). A quarter-hour step would add a
 * position between every two that hardly any place's hours tell apart,
 * and double the steps a thumb has to cross.
 */
export const STEP = 30;

/** Where a wall-clock minute (0–1439, the city's own clock) sits on the
 *  axis. Half past one in the morning is near the right-hand end: it is
 *  still yesterday's trading day. */
export function axisOf(wallMins: number): number {
  return (wallMins - DAY_START + AXIS) % AXIS;
}

/** A position, to the nearest step and inside the axis. */
export function snap(pos: number): number {
  return Math.min(AXIS, Math.max(0, Math.round(pos / STEP) * STEP));
}

/** "14:30" for a position. Both ends of the axis read 06:00, and the
 *  span between them says which is which. */
export function clockAt(pos: number): string {
  return clockOf(pos + DAY_START);
}

export type Heads = HoursWindow & {
  /** Drawn faded: the heads mark the moment "Closed now" asks about, and
   *  the filled span between them is not a span anything is open in. */
  muted: boolean;
};

/**
 * Where the heads stand for an answer. `now` is the present moment on the
 * axis, unsnapped: "Open now" puts the heads on the minute it is, not on
 * the half hour nearest it, because that is the moment it asks about.
 */
export function headsFor(filters: Pick<ExploreFilters, 'status' | 'window'>, now: number): Heads {
  if (filters.status === 'open') return { from: now, to: now, muted: false };
  if (filters.status === 'closed') return { from: now, to: now, muted: true };
  const span = filters.status === 'window' && filters.window ? filters.window : { from: 0, to: AXIS };
  return { ...span, muted: false };
}

/**
 * The answer a pair of heads gives. "Open now" is recognised on the
 * present moment's own step, since a dragged head can only land on a
 * step: brought back together where the present is, the heads ask the
 * question the segment asks, so the segment lights again. It is kept as
 * a status and not as a minute so the filter stays about now — "open
 * now" applied at 14:30 still means now at 15:10.
 */
export function answerFor(span: HoursWindow, now: number): Pick<ExploreFilters, 'status' | 'window'> {
  if (span.from === 0 && span.to === AXIS) return { status: 'any', window: undefined };
  if (span.from === span.to && span.from === snap(now)) return { status: 'open', window: undefined };
  return { status: 'window', window: { from: span.from, to: span.to } };
}

/**
 * Which head a drag moves. Apart, the one under the finger. Together,
 * there is no telling which the finger is on — they are drawn as one — so
 * the direction decides: left pulls the opening head out, right the
 * closing one. Without this, two heads together could only ever open to
 * one side.
 */
export function headToMove(heads: HoursWindow, touched: 'from' | 'to', delta: number): 'from' | 'to' {
  if (heads.from !== heads.to) return touched;
  return delta < 0 ? 'from' : 'to';
}

/**
 * The span after a head is moved by `delta` minutes from where the drag
 * began. Both heads land on steps — the head left behind too, so a span
 * pulled out of "Open now" at 14:37 starts at 14:30 rather than carrying
 * the odd minute into a window. A head stops at the other one rather than
 * passing it: crossing would swap which end is which under the finger.
 */
export function moveHead(start: HoursWindow, head: 'from' | 'to', delta: number): HoursWindow {
  const from = snap(start.from);
  const to = snap(start.to);
  if (head === 'from') return { from: Math.min(snap(start.from + delta), to), to };
  return { from, to: Math.max(snap(start.to + delta), from) };
}
