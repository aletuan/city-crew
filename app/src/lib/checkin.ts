// Check-ins: the rules the pill on a place's screen reads, with no
// renderer and no client — the shape every module under the gate has.
//
// ── what a check-in is, in this first cut ──
//
// A row saying *this account was at this place at this instant*, and
// nothing else. No note, no photograph, no stars — those are the next
// cuts, and each is user content with its own moderation and its own
// screen, which is exactly why they are not folded into the row now.
//
// ── why not `place_events` ──
//
// There is already a per-account log of places, and it is the wrong
// home for this. `place_events` is the taste profile's private signal:
// the policy promises it is never shown to anyone, the reader can
// switch it off (`history_on`, enforced in the insert policy) and wipe
// it in one tap. A check-in is the opposite kind of thing — something
// the reader did on purpose and wants to see again, and may one day
// show a friend — so it has to be writable with history off, visible to
// its owner, and deletable one at a time. Those are the properties of
// user content, like a collection, not of a signal. Hence `checkins`.

/** One visit, as the screens hold it: the row's id (to undo it), the
 *  place by slug (the key every screen uses), where, and when. */
export type Checkin = {
  id: string;
  place_slug: string;
  city_id: string | null;
  /** ISO instant, as Postgres hands back `timestamptz`. */
  at: string;
};

/**
 * How long after a visit the pill offers another one, in minutes.
 *
 * Two taps a minute apart are one visit and a slip, not two visits; two
 * taps an hour apart may well be lunch and then coffee. Ten is the
 * insert policy's number too (`20261008130000_checkins.sql`), so what
 * the pill hides the database would have refused.
 */
export const REPEAT_AFTER_MIN = 10;

/** The newest visit at this place, or null. Sorted here rather than
 *  trusted: the hook answers newest-first, but a cached list or a
 *  reload mid-write need not. */
export function latestCheckin(rows: readonly Checkin[], slug: string): Checkin | null {
  let best: Checkin | null = null;
  for (const r of rows) {
    if (r.place_slug !== slug) continue;
    if (!best || r.at > best.at) best = r;
  }
  return best;
}

/** Whether another visit may be written now — see `REPEAT_AFTER_MIN`.
 *  Compared as instants, not as strings: two ISO offsets of the same
 *  moment sort differently as text. */
export function canRepeat(latest: Checkin | null, now: Date): boolean {
  if (!latest) return true;
  return now.getTime() - new Date(latest.at).getTime() >= REPEAT_AFTER_MIN * 60_000;
}
