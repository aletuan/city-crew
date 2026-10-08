// What the number on the profile's Activity row means, and the window
// the feed reads.
//
// Not a total. The friends row's number is how many friends you have,
// a fact that is still true tomorrow; a feed's number is how much of it
// you have not seen, which is the one reading that makes a number on an
// inbox worth looking at (Mail, Messages, every badge on the home
// screen). So: likes and copies that landed after the last time the
// feed was opened, and nothing once it has been.
//
// The last look is a timestamp on the phone, per account — not a row
// per item on the server. The feed is fourteen days of somebody else's
// taps; marking each one read would be a table of receipts for news
// that expires by itself, and the one thing the reader does with the
// feed is open it, which is one instant to remember.

/** How far back the feed reads, in days. A like is news for about
 *  this long; so is a copy. Also the farthest back the badge counts. */
export const APPLAUSE_DAYS = 14;

/** The last look, per account: another sign-in on the phone starts
 *  with its own, and a stale one from an old account is never read. */
export const ACTIVITY_SEEN_KEY = 'activity.seen.v1';
export function activitySeenKey(uid: string): string {
  return `${ACTIVITY_SEEN_KEY}:${uid}`;
}

/** Where the feed's window opens, as an ISO instant. */
export function windowStart(now: Date): string {
  return new Date(now.getTime() - APPLAUSE_DAYS * 86400000).toISOString();
}

/** What to ask the server for: everything since the last look, but
 *  never further back than the window — a look six weeks ago must not
 *  turn into six weeks of rows. */
export function freshSince(seenAt: string | null, now: Date): string {
  const start = windowStart(now);
  if (!seenAt) return start;
  return new Date(seenAt).getTime() > new Date(start).getTime() ? seenAt : start;
}

/** How many landed strictly after the last look. Compared as instants:
 *  the server answers with an offset and the phone wrote `Z`. Null is a
 *  feed never opened, and then everything in hand is new. */
export function countFresh(items: readonly { at: string }[], seenAt: string | null): number {
  if (!seenAt) return items.length;
  const seen = new Date(seenAt).getTime();
  let n = 0;
  for (const it of items) if (new Date(it.at).getTime() > seen) n += 1;
  return n;
}
