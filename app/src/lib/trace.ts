// Startup, measured instead of argued about.
//
// The launch waterfall has a known shape — fonts and theme release the
// first frame, the city bootstrap commits a city, the catalog fetches
// against it — but "the app feels slow" names no stage. This module puts a
// timestamped line in the device log at each checkpoint, so a slow launch
// reads as numbers: which gap is wide, on which network, on which phone.
//
// The mechanics are deliberately dull. A trace starts its clock when it is
// created — for the app's singleton below, that is module evaluation,
// close enough to JS start for deltas to mean something — and each named
// mark logs once: milliseconds since the clock started, milliseconds since
// the previous mark, the name. Marks deduplicate by name, first occurrence
// wins, which is what lets call sites live in render bodies and effects
// that re-run: the second render marks nothing, and a catalog refetch an
// hour later cannot append noise to a launch that finished.
//
// The clock and the sink are arguments so a test can hold both; the app
// passes `Date.now` and `console.log`.

import { IS_PRODUCTION_CHANNEL } from './channel';

/**
 * The switch. On, every launch writes its waterfall to the console — a
 * dozen short lines, visible wherever the JS log goes (the `expo start`
 * terminal, or the OS log a release build writes to). Off, `mark` returns
 * before touching the clock and the launch logs nothing.
 *
 * It used to be a hand-flipped `true`, on everywhere, and the comment here
 * said to turn it off "when the waterfall is flat enough that nobody is
 * looking at it". The 64 launches `startup_traces` had collected by then
 * said that day had come, at least for the half a reader waits on:
 *
 *     first-frame:released      14ms
 *     explore:content          342ms   ← content on screen
 *     ────────────────────────────── the refresh lands after this
 *     catalog:collections     1547ms
 *
 * So it now asks the channel, exactly as `STARTUP_TRACE_UPLOAD` does: on
 * in Expo Go, a dev build and the TestFlight "preview" channel, off in the
 * App Store build. That is the half worth keeping — the numbers above were
 * read off a TestFlight install, and nothing was learned from a reader's
 * phone writing the same dozen lines into an OS log nobody opens.
 *
 * The two flags stay separate constants rather than one: the console half
 * and the server half are different costs, and either can be turned off by
 * hand here without taking the other with it.
 */
export const STARTUP_TRACE = !IS_PRODUCTION_CHANNEL;

/** `at` is the clock's raw reading; `ms` is elapsed since the trace
 *  started — the number a report away from this device can use, since raw
 *  clock readings mean nothing off the phone that took them. */
export type TraceMark = { name: string; at: number; ms: number };

export type Trace = {
  /** Log a named checkpoint, once. Repeats of the same name are ignored. */
  mark: (name: string) => void;
  /** What has been marked so far, in order. A copy — mutate freely. */
  marks: () => TraceMark[];
};

/** One log line: total since the clock started, gap since the last mark. */
export function traceLine(name: string, sinceStart: number, sinceLast: number): string {
  return `[startup] ${sinceStart}ms (+${sinceLast}) ${name}`;
}

export function makeTrace(
  enabled: boolean,
  now: () => number,
  sink: (line: string) => void,
): Trace {
  const start = now();
  const seen: TraceMark[] = [];
  return {
    mark(name) {
      if (!enabled) return;
      if (seen.some((m) => m.name === name)) return;
      const at = now();
      const prev = seen.length ? seen[seen.length - 1].at : start;
      seen.push({ name, at, ms: at - start });
      sink(traceLine(name, at - start, at - prev));
    },
    marks: () => [...seen],
  };
}

/** The app's one trace. Its zero is the moment this module evaluates. */
export const startupTrace = makeTrace(STARTUP_TRACE, Date.now, (line) => console.log(line));
