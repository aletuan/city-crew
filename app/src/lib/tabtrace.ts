// What a change of tab actually took, in milliseconds.
//
// The owner reported the bar as slow to answer (17 Nov 2026): the pill's
// move to the pressed tab "a little laggy". Reading `FloatingTabBar` gave
// a hypothesis and no number. The pill starts in an effect keyed on the
// navigator's index, so it cannot leave before React has committed the
// render that the press began — and that render includes the screen
// being arrived at. If that is where the time goes, the pill stands still
// for as long as the JS thread is busy, and a tab's first visit (which
// mounts its whole stack) should be worse than its second.
//
// That is an argument from the code, which is what `lib/decktrace` was
// written to stop: four rounds on the sketching deck were reasoned that
// way and chased a gap that measurement showed was not there. So this
// records the journey and files it to `tab_traces`, the third table of
// docs/tracing.md, by the same arrangement and under the same promise.
//
// ── what one switch records ──
//
// Each figure is milliseconds since the finger came down on the tab:
//
//   press    the finger came up and `onPress` ran. Nothing travels before
//            this — the pill answers a press, not a touch — so it is how
//            long the reader held the cell, and none of it is the app's.
//   commit   the bar's effect ran with the new index and the pill was
//            told to go. `commit - press` is the question this exists to
//            answer: the render the press began, the arriving screen
//            included, with the pill standing where it was.
//   frame    the first animation frame the JS thread was free to take
//            after that. `frame - commit` is what it was still doing once
//            the bar had been told — effects, a second render.
//   settle   the bar's whole choreography came to rest. It is driven
//            natively, so this is not a measure of the JS thread; it is
//            the length of the journey as the phone ran it, which the
//            spring's stiffness and damping imply and nobody has timed.
//
// `press` is taken when JS hears the touch, which is not when the glass
// was touched: a thread that is busy hears late, and the figure cannot
// see that. Every figure here is the JS thread's own account of itself.
//
// ── what is left out, and why ──
//
// A switch nobody pressed for — the guide walking the reader to
// Collections, a notification opening Trips — has no finger to measure
// from, and is not recorded. Nor is a press on the tab already selected:
// nothing travels. A switch interrupted by the next press is kept with a
// null `settle`, because that it was interrupted is itself the answer to
// "how long did the journey take".
//
// ── why it files on a quiet moment, where the deck files on leaving ──
//
// The deck has a visit with an end. The bar has none: it is there for the
// life of the app. So the switches gather, and a row goes once the bar
// has been still for `QUIET_MS` — long enough that the send is not
// competing with the screen the reader has just arrived on, which is the
// very thing being measured.

import { IS_PRODUCTION_CHANNEL } from './channel';
import { insertTabTrace } from './data/traces';
import type { Device } from './decktrace';

/**
 * The switch for the recording, and the one for the upload — two, as
 * `lib/decktrace` keeps two, and both asking the channel: on in Expo Go,
 * a dev build and a `preview` build, off in the App Store one.
 *
 * `lib/legal` promises that the App Store build sends no diagnostics.
 * Neither of these may be a literal `true`; `tabtrace.test.ts` loads this
 * file against a production channel to hold that, as `decktrace.test.ts`
 * does for the deck's pair. See the long note on `DECK_TRACE` for the day
 * that promise was broken.
 */
export const TAB_TRACE = !IS_PRODUCTION_CHANNEL;
export const TAB_TRACE_UPLOAD = !IS_PRODUCTION_CHANNEL;

/** How many switches may wait for one row. A switch is about 110 bytes of
 *  JSON, so sixty is under half of the 16 KB the table will hold. */
export const SWITCH_CAP = 60;
/** How long the bar must be still before a row is sent. Chosen, not
 *  measured: longer than any figure this file expects to record, so the
 *  send cannot land inside a switch it is about to report on. */
export const QUIET_MS = 3000;
/** How many rows one run of the app may send. An open insert from a
 *  shipped key is bounded on the phone as well as in the table. */
export const ROW_CAP = 20;

export type TabSwitch = {
  from: string;
  to: string;
  /** Whether this was the tab's first showing since the app started —
   *  the visit that mounts its stack. Null until the bar commits. */
  first: boolean | null;
  /** Whether the reader had asked for less motion: the pill slides for
   *  160ms and does not spring, so `settle` is a different journey. */
  still: boolean;
  press: number | null;
  commit: number | null;
  frame: number | null;
  settle: number | null;
};

export type TabTrace = {
  /** The finger came down on a tab that is not the selected one. */
  down: (from: string, to: string) => void;
  /** It came up, and the press was delivered. */
  press: () => void;
  /** The bar committed with `to` selected. Called for every change of
   *  tab, pressed for or not, because it is also what knows which tabs
   *  have been shown. */
  commit: (to: string, still: boolean) => void;
  /** The choreography ended; `finished` is false when it was cut short. */
  settle: (finished: boolean) => void;
  /** What is waiting to be sent, handed over and forgotten. */
  drain: () => TabSwitch[];
};

/** One console line, when anybody is watching one. */
export function tabLine(s: TabSwitch): string {
  return `[tab] ${s.from}→${s.to}${s.first ? ' first' : ''} press ${s.press} commit ${s.commit} frame ${s.frame} settle ${s.settle}`;
}

export function makeTabTrace(
  enabled: boolean,
  now: () => number,
  nextFrame: (then: () => void) => void,
  sink: (line: string) => void,
  cap = SWITCH_CAP,
): TabTrace {
  let pending: TabSwitch | null = null;
  let t0 = 0;
  let kept: TabSwitch[] = [];
  const seen = new Set<string>();
  const keep = (s: TabSwitch) => {
    pending = null;
    if (kept.length >= cap) return;
    kept.push(s);
    sink(tabLine(s));
  };
  return {
    down(from, to) {
      if (!enabled) return;
      seen.add(from);
      // The one before this never came to rest: the reader pressed again
      // mid-journey. Kept, with the null that says so. One that never
      // committed — a finger that slid off the cell — is simply dropped.
      if (pending && pending.commit != null) keep(pending);
      t0 = now();
      pending = { from, to, first: null, still: false, press: null, commit: null, frame: null, settle: null };
    },
    press() {
      if (pending && pending.press == null) pending.press = now() - t0;
    },
    commit(to, still) {
      if (!enabled) return;
      const first = !seen.has(to);
      seen.add(to);
      // Only the switch a press asked for. A stale touch followed by a
      // navigation from somewhere else would otherwise be measured from
      // the touch.
      const p = pending;
      if (!p || p.press == null || p.commit != null || p.to !== to) return;
      const began = t0;
      p.first = first;
      p.still = still;
      p.commit = now() - began;
      // Its own clock: by the time the frame comes, a second press may
      // have restarted `t0`.
      nextFrame(() => { p.frame = now() - began; });
    },
    settle(finished) {
      // A journey cut short reports itself here too, and after the next
      // one has already committed — so an unfinished one says nothing,
      // and `down` is where it is closed.
      if (!finished || !pending || pending.commit == null) return;
      pending.settle = now() - t0;
      keep(pending);
    },
    drain() {
      const out = kept;
      kept = [];
      return out;
    },
  };
}

/** The app's one tab trace. */
export const tabTrace = makeTabTrace(
  TAB_TRACE,
  Date.now,
  (then) => { requestAnimationFrame(then); },
  (line) => console.log(line),
);

export type TabRow = {
  platform: string;
  os_version: string;
  is_dev: boolean;
  channel: string | null;
  switches: TabSwitch[];
};

/** The row a quiet moment files, or null when nothing was pressed. */
export function buildTabRow(switches: TabSwitch[], device: Device): TabRow | null {
  if (!switches.length) return null;
  return {
    platform: device.platform,
    os_version: device.osVersion,
    is_dev: device.isDev,
    channel: device.channel,
    switches,
  };
}

/**
 * When a row goes, and what a failure means — `makeDeckReporter`'s rules
 * (never on the critical path, a failure swallowed) on a different
 * trigger. `soon` is called each time the bar comes to rest; each call
 * puts the send off again, so a reader walking the tabs files one row
 * when they stop rather than one per tab.
 *
 * The timer is an argument, as the clock is above, so a test winds it by
 * hand.
 */
export function makeTabReporter<H>(
  enabled: boolean,
  send: (row: TabRow) => Promise<unknown>,
  later: (then: () => void, ms: number) => H,
  cancel: (handle: H) => void,
  rows = ROW_CAP,
) {
  let waiting: { handle: H } | null = null;
  let sent = 0;
  return {
    soon(take: () => TabSwitch[], device: Device): void {
      if (!enabled || sent >= rows) return;
      if (waiting) cancel(waiting.handle);
      waiting = {
        handle: later(() => {
          waiting = null;
          const row = buildTabRow(take(), device);
          if (!row) return;
          sent += 1;
          // Swallowed on purpose, and the switches are not put back: a
          // trace that fails to report is fine, and one that retries
          // against a server that just said no is not.
          send(row).catch(() => {});
        }, QUIET_MS),
      };
    },
  };
}

/** The insert itself; a refusal becomes a rejection for the reporter to
 *  swallow — split out so a test can hold both halves. */
export async function sendTabRow(row: TabRow): Promise<void> {
  const { error } = await insertTabTrace(row);
  if (error) throw new Error(error.message);
}

/** The app's reporter. */
export const reportTabs = makeTabReporter(
  TAB_TRACE_UPLOAD,
  sendTabRow,
  (then, ms) => setTimeout(then, ms),
  (handle) => clearTimeout(handle),
);

/**
 * What the bar hands its animation as the end callback: close the switch,
 * and ask for a row once things are quiet. Made once per bar with the
 * device it is running on, which is `react-native`'s to say and so not
 * something this file can read.
 */
export function tabSettled(device: Device, trace = tabTrace, reporter = reportTabs) {
  return ({ finished }: { finished: boolean }): void => {
    trace.settle(finished);
    reporter.soon(trace.drain, device);
  };
}
