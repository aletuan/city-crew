// How far back the Activity feed reads — the one number the feed and
// the profile's count of it have to agree on, kept where both can
// import it without either importing the other.

/** How far back the feed reads, in days. A like is news for about
 *  this long; so is a copy. */
export const APPLAUSE_DAYS = 14;

/** Where the feed's window opens, as an ISO instant. */
export function windowStart(now: Date): string {
  return new Date(now.getTime() - APPLAUSE_DAYS * 86400000).toISOString();
}
