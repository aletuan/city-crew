// What the sketching deck's animation actually did, in milliseconds.
//
// The deck walks the plans, dissolving one set of photos into the next. It
// has been reported as jerky four times and changed four times, and every
// one of those changes was reasoned from a description of what it looked
// like — because the phone it runs on is not the machine it is written on,
// and nothing on this side can see that console. Every number in it was
// therefore chosen and none was measured.
//
// This is the other half of that conversation. A visit to the screen
// records its own timeline and files one row to `deck_traces`, and the
// investigation reads the table instead of a log nobody can open. It is
// the same arrangement `lib/trace` and `lib/tracereport` already use for
// the launch waterfall, and for the same reason: this app is worked on
// from a phone.
//
// ── what it records, and why only these five ──
//
//   ask      the box was handed its new photo. `expo-image` keeps the one
//            it has until the new one is decoded, so this is when the
//            dissolve is *asked for*, not when it starts.
//   load     the photo is decoded and drawable. `load - ask` is the whole
//            question this exists to answer: a gap there is the old
//            picture standing while the new one catches up, which is what
//            "the picture appears late" looked like from the outside.
//   fail     it could not be fetched at all, so no dissolve happens and
//            the box holds what it had.
//   name     the word under it changed, at the bottom of its own dip.
//   option   the deck moved to the next plan.
//
// A place *leaves* a box at the `ask` of the place that follows it there.
// There is deliberately no event for going: recording one would be
// recording the same instant twice under two names, and a reader of the
// timeline would have to be told they are the same instant anyway.
//
// Nor is there one for the box finishing. That instant is `name` plus
// `NAME_IN`, a constant this file could not be wrong about — a number
// already known is not a measurement, and writing it down would only
// make the timeline longer. Every event above is something the phone
// knows and this side does not.
//
// ── why this appends where `lib/trace` deduplicates ──
//
// A launch passes each checkpoint once, so `makeTrace` keeps the first of
// each name and ignores repeats — which is what lets its call sites sit in
// effects that re-run. A deck passes the same checkpoints once per plan
// per box, and the repeats are the measurement. So this appends, and takes
// a cap instead: a wait cannot grow the array without bound, and a row
// cannot outgrow what the table will hold.
//
// ── one recorder, on purpose ──
//
// A module singleton, like `startupTrace`, because there is one sketching
// screen at a time and threading a recorder down to each box would put a
// prop about logging into a component whose whole contract is four props
// about drawing. `start()` at the top of a visit is what keeps two visits
// from sharing a clock.

import { supabase } from './supabase';

/**
 * The switch. On, every visit records its timeline, says it out loud, and
 * files a row; off, `log` returns before touching the clock.
 *
 * TEMPORARY, and hand-flipped on purpose.
 *
 * It asked the channel first — `!IS_PRODUCTION_CHANNEL`, exactly as the
 * launch trace decided it: on in Expo Go, a dev build and the TestFlight
 * "preview" channel, off in the App Store build. That rule is right in
 * general and was wrong here, and the table said so: the deck filed
 * nothing, and `startup_traces` — gated on the identical condition — had
 * filed nothing for three days either, through a week of the animation
 * being worked on daily. The phone this is being investigated from is
 * running a production-channel build, so the one install whose numbers
 * are wanted is the one install the rule excludes.
 *
 * The cost is that every install reports, App Store readers included. It
 * was weighed and taken: a row carries milliseconds, a platform, an OS
 * version and slugs from a public catalog, and the table's RLS lets a
 * phone file its own row and read nobody's.
 *
 * Put both constants back to `!IS_PRODUCTION_CHANNEL` when the deck's
 * timings are settled — or to `false`, which is where the table's own
 * retention note expects them to end up.
 */
export const DECK_TRACE = true;
/**
 * The switch for the *upload* — `DECK_TRACE` governs the recording and
 * this governs whether it leaves the phone.
 *
 * Two constants rather than one, the way `lib/trace` and `lib/tracereport`
 * keep theirs apart: the console half and the server half are different
 * costs, and either can be turned off by hand here without taking the
 * other with it. Both are on for the reason above.
 */
export const DECK_TRACE_UPLOAD = true;

/** How many events one visit may record. Three plans across three boxes
 *  is about forty; the cap is where a stuck screen stops writing rather
 *  than a limit anything real approaches. */
export const EVENT_CAP = 200;

export type DeckWhat = 'option' | 'ask' | 'load' | 'fail' | 'name';

export type DeckEvent = {
  /** Milliseconds since this visit's deck started. */
  ms: number;
  /** Which plan was up when it happened. */
  option: number;
  /** Which box in the row, or null for the deck's own events. */
  slot: number | null;
  what: DeckWhat;
  /** The place it is about, by slug. Null where there is none — an empty
   *  box, or an event about the deck rather than a place. */
  place: string | null;
};

export type DeckTrace = {
  /** Begin a visit. Clears what the last one recorded and restarts the
   *  clock, so two visits to the screen never share a timeline. */
  start: () => void;
  log: (e: Omit<DeckEvent, 'ms'>) => void;
  /** What has been recorded so far, in order. A copy — mutate freely. */
  events: () => DeckEvent[];
};

/** One console line, when anybody is watching one. */
export function deckLine(e: DeckEvent): string {
  const box = e.slot == null ? '' : ` #${e.slot}`;
  return `[deck] ${e.ms}ms opt${e.option}${box} ${e.what}${e.place ? ` ${e.place}` : ''}`;
}

export function makeDeckTrace(
  enabled: boolean,
  now: () => number,
  sink: (line: string) => void,
  cap = EVENT_CAP,
): DeckTrace {
  let start = now();
  let kept: DeckEvent[] = [];
  return {
    start() {
      if (!enabled) return;
      start = now();
      kept = [];
    },
    log(e) {
      if (!enabled || kept.length >= cap) return;
      const full = { ...e, ms: now() - start };
      kept.push(full);
      sink(deckLine(full));
    },
    events: () => [...kept],
  };
}

/** The app's one deck trace. */
export const deckTrace = makeDeckTrace(DECK_TRACE, Date.now, (line) => console.log(line));

export type Device = {
  platform: string;
  osVersion: string;
  isDev: boolean;
  /**
   * The release channel stamped into this build, or null for one with no
   * stamp — Expo Go, or a bare dev build.
   *
   * Here because the two switches above are hand-held on against the rule
   * the launch trace follows, and the reason given was that the device
   * being investigated from *appeared* to be on the production channel.
   * Appeared: inferred twice from the silence of `startup_traces`, and
   * wrong once. A row that says which channel filed it settles in one
   * visit whether putting the switches back would cost the investigation
   * its only device.
   */
  channel: string | null;
};

export type DeckRow = {
  platform: string;
  os_version: string;
  is_dev: boolean;
  channel: string | null;
  options: number;
  span: number;
  still: boolean;
  total_ms: number;
  events: DeckEvent[];
};

/**
 * The row a visit files, or null when there is nothing to say — a deck
 * that recorded nothing has no timeline, and an empty row would read as a
 * visit where nothing happened rather than one that was never measured.
 */
export function buildDeckRow(
  events: DeckEvent[],
  shape: { options: number; span: number; still: boolean },
  device: Device,
): DeckRow | null {
  if (!events.length) return null;
  return {
    platform: device.platform,
    os_version: device.osVersion,
    is_dev: device.isDev,
    channel: device.channel,
    options: shape.options,
    span: shape.span,
    still: shape.still,
    total_ms: events[events.length - 1].ms,
    events,
  };
}

/**
 * The once-guard and the failure policy, as a factory so both are
 * testable — the same shape as `makeReporter` in `lib/tracereport`, and
 * the same rules: never on the critical path, once per visit, and a
 * failure swallowed, because a deck that fails to report is fine and a
 * deck that breaks over reporting is absurd.
 *
 * Once per *visit* rather than once per process, which is where this
 * differs: the launch happens once and a sketching screen can be opened
 * again. `reset` is what a new visit calls.
 */
export function makeDeckReporter(enabled: boolean, send: (row: DeckRow) => Promise<unknown>) {
  let sent = false;
  return {
    reset: () => { sent = false; },
    report(
      events: DeckEvent[],
      shape: { options: number; span: number; still: boolean },
      device: Device,
    ): void {
      if (!enabled || sent) return;
      const row = buildDeckRow(events, shape, device);
      if (!row) return;
      sent = true;
      // Swallowed on purpose. `sent` stays true on failure: a visit gets
      // one attempt, not a retry loop against a server that just said no.
      send(row).catch(() => {});
    },
  };
}

/** The insert itself. A refusal becomes a rejection, which the reporter
 *  above turns into silence — split out so a test can hold both halves. */
export async function sendDeckRow(row: DeckRow): Promise<void> {
  const { error } = await supabase.from('deck_traces').insert(row);
  if (error) throw new Error(error.message);
}

/** The app's reporter. */
export const reportDeck = makeDeckReporter(DECK_TRACE_UPLOAD, sendDeckRow);
