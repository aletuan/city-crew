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
  /** The place's names, embedded with the row so the Visited screen can
   *  name a place from a city the catalog is not holding. Null when the
   *  place is gone; absent on a row the cache kept before the column
   *  rode along. */
  place?: { name_en: string; name_vi: string; name_ja: string | null } | null;
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

/** One month of visits, newest first inside it. `month` is 1–12. */
export type VisitSection = { key: string; year: number; month: number; data: Checkin[] };

/**
 * The visits filed by month, newest month first — the Visited screen's
 * sections. Months are the phone's, as the sheet's clock is: a visit at
 * 23:30 in Hanoi belongs to the evening the reader remembers, not to
 * the UTC date.
 *
 * Sorted here rather than trusted, for the reason `latestCheckin` sorts;
 * a copy, so the hook's list is left as it was.
 */
export function visitSections(rows: readonly Checkin[]): VisitSection[] {
  const sorted = [...rows].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const out: VisitSection[] = [];
  for (const r of sorted) {
    const d = new Date(r.at);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const last = out[out.length - 1];
    if (last && last.key === key) last.data.push(r);
    else out.push({ key, year, month, data: [r] });
  }
  return out;
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A section's heading. Vietnamese writes the month as a number — "Tháng
 *  10" — the way `dateline` does for the same reason: T1–T12 would read
 *  as weekdays. */
export function monthTitle(lang: string, year: number, month: number): string {
  if (lang === 'vi') return `Tháng ${month}, ${year}`;
  if (lang === 'ja') return `${year}年${month}月`;
  return `${MONTHS_EN[month - 1]} ${year}`;
}

/** How many visits, and at how many distinct places. */
export function visitSummary(rows: readonly Checkin[]): { visits: number; places: number } {
  return { visits: rows.length, places: new Set(rows.map((r) => r.place_slug)).size };
}
