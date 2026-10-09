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

import { fold } from './search';

/** One visit, as the screens hold it: the row's id (to undo it), the
 *  place by slug (the key every screen uses), where, and when. */
export type Checkin = {
  id: string;
  place_slug: string;
  city_id: string | null;
  /** ISO instant, as Postgres hands back `timestamptz`. */
  at: string;
  /** The place's names and its cover, embedded with the row so the
   *  Visited screen can name and picture a place from a city the catalog
   *  is not holding. Null when the place is gone; absent on a row the
   *  cache kept before the columns rode along. */
  place?: {
    name_en: string; name_vi: string; name_ja: string | null; cover: string | null;
    /** The place's kinds (`lib/categories`), for the Visited screen's
     *  second row of chips. Empty when the row has none. */
    categories: string[];
  } | null;
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

/**
 * How many visits one place may take in a day. Breakfast, lunch and a
 * drink after work are three; a fourth is a tap that got away. A day is
 * the last twenty-four hours, not the calendar day: the server has no
 * clock of the reader's to draw midnight with, and a rolling day is the
 * same rule for a reader in Hanoi and one in Melbourne. The insert
 * policy counts the same window (`20261009090000_checkins_per_place.sql`).
 *
 * There is no cap across places any more: thirty in a day was a guess at
 * "a script", and a day out that walks a whole lane of cafés is not one.
 */
export const PER_PLACE_PER_DAY = 3;

/** This place's visits in the last twenty-four hours, strictly inside. */
export function visitsInDay(rows: readonly Checkin[], slug: string, now: Date): number {
  const from = now.getTime() - 86_400_000;
  let n = 0;
  for (const r of rows) if (r.place_slug === slug && new Date(r.at).getTime() > from) n += 1;
  return n;
}

/** Whether another visit may be written at this place now — both rules
 *  above, `REPEAT_AFTER_MIN` and `PER_PLACE_PER_DAY`. Compared as
 *  instants, not as strings: two ISO offsets of the same moment sort
 *  differently as text. */
export function canRepeat(rows: readonly Checkin[], slug: string, now: Date): boolean {
  const latest = latestCheckin(rows, slug);
  if (!latest) return true;
  if (now.getTime() - new Date(latest.at).getTime() < REPEAT_AFTER_MIN * 60_000) return false;
  return visitsInDay(rows, slug, now) < PER_PLACE_PER_DAY;
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

/** How many visits, at how many distinct places, in how many cities.
 *  A visit whose place is gone names no city and counts as none. */
export function visitSummary(rows: readonly Checkin[]): { visits: number; places: number; cities: number } {
  return {
    visits: rows.length,
    places: new Set(rows.map((r) => r.place_slug)).size,
    cities: new Set(rows.map((r) => r.city_id).filter((c): c is string => !!c)).size,
  };
}

/** Keys by how often they appear, most first, ties by first appearance
 *  — the order a chip row reads best in: the choice most likely wanted
 *  nearest the thumb. */
function byFrequency(keys: readonly string[]): string[] {
  const count = new Map<string, number>();
  for (const k of keys) count.set(k, (count.get(k) ?? 0) + 1);
  return [...count.keys()].sort((a, b) => count.get(b)! - count.get(a)!);
}

/** The cities visited, most visited first. */
export function visitCities(rows: readonly Checkin[]): string[] {
  return byFrequency(rows.map((r) => r.city_id).filter((c): c is string => !!c));
}

/** The kinds of place visited, most visited first, across every place. */
export function visitCategories(rows: readonly Checkin[]): string[] {
  return byFrequency(rows.flatMap((r) => r.place?.categories ?? []));
}

/** The visits in one city, of one kind, or both; the same list back
 *  when nothing is chosen, so a caller can test identity. */
export function filterVisits(rows: readonly Checkin[], city: string | null, category: string | null): readonly Checkin[] {
  if (!city && !category) return rows;
  return rows.filter((r) => (!city || r.city_id === city) && (!category || (r.place?.categories ?? []).includes(category)));
}

/**
 * Whether every word typed appears somewhere in the haystack — tone
 * marks and case aside, through `lib/search`'s own `fold`, so "cong"
 * finds "Cộng" the way the Search screen's box does. A blank query
 * matches everything, which is what an open box with nothing in it
 * should mean.
 */
export function textMatches(hay: readonly string[], query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = hay.map((h) => fold(h)).join(' ');
  return words.every((w) => text.includes(w));
}
