// The launch waterfall, readable away from the phone.
//
// `lib/trace` writes each launch's timings to the console, which answers
// the question when somebody is sitting at a terminal watching the log —
// and nobody here is: this app is worked on from a phone. So a launch also
// reports itself, once, to `startup_traces` — one row, inserted well after
// the content is on screen, carrying the same marks the console got.
//
// The rules that keep telemetry from becoming a cost:
//
//   - Never on the critical path. The caller sends seconds after the
//     catalog has drawn, and the insert is fire-and-forget: an error is
//     swallowed, because a launch that fails to report is fine and a
//     launch that breaks over reporting is absurd.
//   - Once per process. The guard lives here, not at the call site, so an
//     effect that re-runs cannot file the same launch twice.
//   - Nothing personal. No user id, no position, no device identifier —
//     platform, OS version, a dev flag, and milliseconds. The table's RLS
//     is write-only for the app roles to match: a phone can file its own
//     row and read nobody's.

import { supabase } from './supabase';
import type { TraceMark } from './trace';

/**
 * The switch for the *upload* — `STARTUP_TRACE` in `lib/trace` governs the
 * console lines and this governs whether they leave the phone, so the
 * local log survives turning the server half off.
 *
 * On by default while the launch is under investigation. There is no
 * dev/sit/prod split to hang this on — the app has one update stream and
 * one database — so the environment story is the `is_dev` column instead:
 * every row says whether it came from a dev session or a published bundle,
 * and the reader filters. The day the app has real channels, this constant
 * is where reading one belongs; the day the investigation closes, `false`
 * here stops the writes without touching the local log.
 */
export const STARTUP_TRACE_UPLOAD = true;

export type Device = { platform: string; osVersion: string; isDev: boolean };

export type TraceRow = {
  platform: string;
  os_version: string;
  is_dev: boolean;
  total_ms: number;
  marks: { name: string; ms: number }[];
};

/**
 * The row a launch files. Null when there is nothing to say — a trace
 * that marked nothing has no waterfall, and an empty row would read as a
 * launch that took 0ms.
 */
export function buildRow(marks: TraceMark[], device: Device): TraceRow | null {
  if (!marks.length) return null;
  return {
    platform: device.platform,
    os_version: device.osVersion,
    is_dev: device.isDev,
    total_ms: marks[marks.length - 1].ms,
    // `at` stays behind: a raw clock reading means nothing off the phone
    // that took it, and shipping it would only invite someone to read it.
    marks: marks.map(({ name, ms }) => ({ name, ms })),
  };
}

/**
 * The once-guard and the failure policy, as a factory so both are
 * testable: the flag and the send are arguments here and the app's values
 * below.
 */
export function makeReporter(enabled: boolean, send: (row: TraceRow) => Promise<unknown>) {
  let sent = false;
  return (marks: TraceMark[], device: Device): void => {
    if (!enabled || sent) return;
    const row = buildRow(marks, device);
    if (!row) return;
    sent = true;
    // Swallowed on purpose — see the rules at the top of the file. `sent`
    // stays true on failure: a launch gets one attempt, not a retry loop
    // against a server that just said no.
    send(row).catch(() => {});
  };
}

/** The insert itself. A refusal becomes a rejection, which the reporter
 *  above turns into silence — split out so a test can hold both halves. */
export async function sendRow(row: TraceRow): Promise<void> {
  const { error } = await supabase.from('startup_traces').insert(row);
  if (error) throw new Error(error.message);
}

/** The app's reporter. One call per launch does anything; the rest no-op. */
export const reportStartup = makeReporter(STARTUP_TRACE_UPLOAD, sendRow);
