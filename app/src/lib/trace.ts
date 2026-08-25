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

/**
 * The switch. On, every launch writes its waterfall to the console — a
 * dozen short lines, visible wherever the JS log goes (the `expo start`
 * terminal, or the OS log a release build writes to). Off, `mark` returns
 * before touching the clock and the launch logs nothing.
 *
 * On for now on purpose: it exists because launches still feel slow after
 * the stored-city work, and the next fix should be aimed by these numbers
 * rather than by another round of reading the code. When the waterfall is
 * flat enough that nobody is looking at it, turn it off here — one
 * constant, same shape as `RESUME_STORED_CITY` and `WEATHER_EFFECTS`.
 */
export const STARTUP_TRACE = true;

export type TraceMark = { name: string; at: number };

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
      seen.push({ name, at });
      sink(traceLine(name, at - start, at - prev));
    },
    marks: () => [...seen],
  };
}

/** The app's one trace. Its zero is the moment this module evaluates. */
export const startupTrace = makeTrace(STARTUP_TRACE, Date.now, (line) => console.log(line));
