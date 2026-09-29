// Which tip to show, one at a time, in turn.
//
// A screen says which tips apply to what is in front of the reader right
// now: a tip about publishing is only true of a private list. This file
// decides which of those to show, and keeps the record that decides it.
//
// In turn, not at random. Each visit shows the eligible tip that has gone
// longest without being shown, and a tip never seen counts as the longest
// of all. Random would repeat the tip just read about as often as it
// reached the others, and on a screen opened a few times a day, that is
// most of what a reader would see. In turn, every tip is seen, and the
// same one never shows twice running unless it is the only one left.
//
// A tip retires for good when it is closed, or when the reader does what it
// explains. Teaching someone the move they have just made reads as the app
// not noticing. When every tip has retired, nothing is shown.
//
// Pure, so the rule can be tested without a clock or a store. `seq` is a
// counter rather than a time: the order tips were shown in is the whole
// question, and a counter is the same on every clock.

export type TipId = 'reorder' | 'publish' | 'edit' | 'add' | 'copy';

export const TIP_IDS: readonly TipId[] = ['reorder', 'publish', 'edit', 'add', 'copy'];

export type TipLog = {
  /** Bumped each time a tip is shown; the stamp the next one gets. */
  seq: number;
  /** The `seq` each tip was last shown at. */
  last: Partial<Record<TipId, number>>;
  /** Closed, or acted on: never shown again. */
  retired: TipId[];
};

export const EMPTY_LOG: TipLog = { seq: 0, last: {}, retired: [] };

/** Where the log is kept on the device, for a reader with no account. */
export const TIPS_KEY = 'tips.v1';

/**
 * Where one reader's log is kept: one per account, and the device's own
 * for a guest.
 *
 * A tip retires because a person has learned what it says, and a phone is
 * not a person. With one log for the device, signing out and into a
 * second account met a Collections screen with every tip already retired
 * by the first, reported from a phone the day tips shipped. An account
 * signing in for the first time on a device starts with a clean log, so
 * the account that used the old device-wide log sees its tips once more.
 */
export function tipsKey(uid: string | null | undefined): string {
  return uid ? `${TIPS_KEY}:${uid}` : TIPS_KEY;
}

/**
 * The flag the reorder tip kept before there was more than one tip. Read
 * once, so a reader who had closed it or dragged a card does not meet it
 * again under the new key.
 */
export const LEGACY_REORDER_KEY = 'tip.holdToReorder.v1';

const isTipId = (v: unknown): v is TipId => TIP_IDS.includes(v as TipId);

/**
 * The stored log, whatever state it is in. A missing log is an empty one.
 * A log that no longer parses, or holds entries this build does not know,
 * keeps what it can rather than throwing: the worst a bad record should
 * cost is a tip shown once more.
 */
export function parseLog(raw: string | null, legacyReorder: string | null = null): TipLog {
  let log: TipLog = EMPTY_LOG;
  if (raw !== null) {
    try {
      const v = JSON.parse(raw) as Partial<TipLog> | null;
      const last: Partial<Record<TipId, number>> = {};
      for (const [k, n] of Object.entries(v?.last ?? {})) {
        if (isTipId(k) && typeof n === 'number') last[k] = n;
      }
      log = {
        seq: typeof v?.seq === 'number' ? v.seq : 0,
        last,
        retired: Array.isArray(v?.retired) ? v.retired.filter(isTipId) : [],
      };
    } catch {
      log = EMPTY_LOG;
    }
  }
  return legacyReorder !== null ? retire(log, 'reorder') : log;
}

/** The tip to show from the ones that apply, or null if all have retired. */
export function pickTip(eligible: readonly TipId[], log: TipLog): TipId | null {
  let best: TipId | null = null;
  let bestAt = Infinity;
  for (const id of eligible) {
    if (log.retired.includes(id)) continue;
    const at = log.last[id] ?? -1;
    // Strictly older wins, so a tie goes to the screen's own order.
    if (at < bestAt) { best = id; bestAt = at; }
  }
  return best;
}

/** The log once `id` has been shown. */
export function markShown(log: TipLog, id: TipId): TipLog {
  return { ...log, seq: log.seq + 1, last: { ...log.last, [id]: log.seq } };
}

/** The log once `id` will not be shown again. */
export function retire(log: TipLog, id: TipId): TipLog {
  return log.retired.includes(id) ? log : { ...log, retired: [...log.retired, id] };
}
