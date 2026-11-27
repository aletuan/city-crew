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
// ── the second cut: a note, and who sees it (owner, 24 Nov 2026) ──
//
// A line of words (`NOTE_MAX`) and an answer, Private or Friends. The
// visit is still written by the one tap, as it always was: the sheet
// that asks for the words comes up *after*, over a visit that already
// exists, so nothing typed or not typed can lose it. Two other ways were
// weighed for the owner the same day. A sheet before the visit (the
// reference he brought) gets more notes and shows who will see it before
// anything is written, and costs a second tap on every visit, the
// regular's fourth this week included, and a visit lost to a sheet
// swiped away. The tap alone with "add a note" behind a further press
// keeps the tap and gets few notes. This is the tap, with the field
// already under the thumb.
//
// The answer is written when the sheet goes, not with the visit, so a
// friend is never shown a visit its owner has not had the chance to keep
// (`20261124120000_checkin_notes.sql`). Photographs are still a later
// cut: storage and moderation of their own.
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
import type { I18nDoc } from './localized';

/** One visit, as the screens hold it: the row's id (to undo it), the
 *  place by slug (the key every screen uses), where, and when. */
export type Checkin = {
  id: string;
  place_slug: string;
  city_id: string | null;
  /** ISO instant, as Postgres hands back `timestamptz`. */
  at: string;
  /** The reader's words about the visit, or none. Absent on a row the
   *  cache kept before the column rode along. */
  note?: string | null;
  /** Who sees it. Null — every visit before 24 Nov 2026, and one whose
   *  sheet never closed — is the question unanswered, and reads as
   *  private (`audienceOf`). */
  audience?: Audience | null;
  /** The place's names and its cover, embedded with the row so the
   *  Visited screen can name and picture a place from a city the catalog
   *  is not holding. Null when the place is gone; absent on a row the
   *  cache kept before the columns rode along. */
  place?: {
    name_en: string; name_vi: string; cover: string | null;
    /** The object, on rows fetched since 13 Oct 2026; a cached row may
     *  carry the old column instead. `lib/localized` reads either. */
    i18n?: I18nDoc | null; name_ja?: string | null;
    /** The place's kinds (`lib/categories`), for the Visited screen's
     *  second row of chips. Empty when the row has none. */
    categories: string[];
  } | null;
  /** The visit's own photos, in order, none hidden (`visitPhotosOf`).
   *  Absent on a row the cache kept before they rode along. */
  photos?: CheckinPhoto[];
};

/** Who a visit is shown to. Two answers until 25 Nov 2026, when the
 *  owner added the collections' third: Public, anybody signed in
 *  (`20261125200000_checkin_public.sql`). Strangers still see no more
 *  than friends do (`docs/collection-feed-plan.md`, principle 5) — the
 *  place, the day, the note, the photos. A new visit opens on Public
 *  since 26 Nov 2026 (`nextAudience`). Offered on the sheet behind
 *  `checkin_public`. */
export type Audience = 'private' | 'friends' | 'public';

/**
 * Whether the sheet asks who sees the visit. On since the change that
 * gave a friend somewhere to see one (24 Nov 2026, the afternoon): the
 * read for friends, by day and never by hour
 * (`20261124150000_checkin_friends.sql`), its sentence in the privacy
 * policy, and the card on a person's page (`person/CheckinAct`).
 *
 * It shipped off for the morning, with the note alone. A control that
 * said "Friends" before any friend could see anything would have been a
 * promise the app did not keep, and an answer collected under it one
 * given about a screen nobody had seen.
 *
 * Still a constant and not an `app_flags` row: off without that code is
 * the only state it could be switched to, and that is a release, not a
 * switch.
 */
export const AUDIENCE_ON: boolean = true;

/** A note's length: a remark's, not a review's — the migration's bound. */
export const NOTE_MAX = 280;

/** Who sees this visit, the unanswered question read as private. */
export const audienceOf = (v: Pick<Checkin, 'audience'>): Audience => v.audience ?? 'private';

/**
 * The answer a new visit's sheet opens on.
 *
 * With Public offered (`checkin_public`), Public, every time (owner,
 * 26 Nov 2026): a public visit is what the place's page and Explore are
 * built from, and the owner chose to encourage it over remembering each
 * reader's last answer. Weighed and not taken: Public on a reader's first
 * visit and their last answer after it — a reader who chose Friends once
 * would not be pushed back each time. What keeps the default honest is
 * the sheet itself: the answer is in front of the reader with the words
 * under it saying who will see the visit, before anything is written.
 * Until 26 Nov the rule below this paragraph held for Public too, and a
 * sheet never opened on it (`20261125200000_checkin_public.sql`).
 *
 * Without Public on offer, the last one the reader gave, and Friends
 * before they have given any — and Friends after a Public one, which a
 * sheet without Public could not draw.
 *
 * Friends first because a visit kept to oneself is what the app had for
 * six weeks and the count on the page was the whole of it; the point of
 * this cut is the friend who sees it. Remembered because the reader who
 * chose Private once did not choose it for one visit: asked again each
 * time, the default would undo them every time they did not look.
 *
 * Read off the visits themselves — the newest with an answer — rather
 * than kept as a setting: there is nothing to sync, and an old visit
 * (answer null) says nothing either way.
 */
export function nextAudience(rows: readonly Checkin[], publicOn = false): Audience {
  if (publicOn) return 'public';
  let best: Checkin | null = null;
  for (const r of rows) {
    if (!r.audience) continue;
    if (!best || r.at > best.at) best = r;
  }
  const last = best?.audience ?? 'friends';
  return last === 'public' ? 'friends' : last;
}

/** A note as it is stored: trimmed, cut to the bound, and null when
 *  there is nothing left — the column's "no note". */
export function cleanNote(text: string): string | null {
  const said = text.trim().slice(0, NOTE_MAX).trim();
  return said || null;
}

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
/** Every visit at this place, newest first — the sheet on the place's
 *  screen draws them all, each with its own undo, so a reader can take
 *  back the one that was a slip rather than only the newest. Sorted
 *  here for the same reason `latestCheckin` sorts. */
export function visitsAt(rows: readonly Checkin[], slug: string): Checkin[] {
  return rows.filter((r) => r.place_slug === slug).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function latestCheckin(rows: readonly Checkin[], slug: string): Checkin | null {
  let best: Checkin | null = null;
  for (const r of rows) {
    if (r.place_slug !== slug) continue;
    if (!best || r.at > best.at) best = r;
  }
  return best;
}

/**
 * Whether the reader's newest visit here was today on the phone's own
 * calendar — the Check-in pill's "Đã qua" is that, and no longer "ever".
 *
 * It was ever (owner, 27 Nov 2026, on a phone): a place visited once
 * wore "Đã qua" for good, and checking in on a later day meant opening
 * the history sheet and finding "again" under it — the reader standing
 * in the place did not know where to press. So the pill is worn for the
 * day the visit was in and a plain "Check-in" the next: a visit is to a
 * day, as the reader counts days.
 *
 * The phone's calendar here, unlike the rolling day the caps keep
 * (`PER_PLACE_PER_DAY`): this is what the reader sees, and "yesterday"
 * at 00:05 is the answer they expect. The caps still hold across that
 * midnight — a visit at 23:55 and a tap at 00:02 is refused, by the
 * ten minutes, with its reason.
 */
export function visitedToday(rows: readonly Checkin[], slug: string, now: Date): boolean {
  const latest = latestCheckin(rows, slug);
  if (!latest) return false;
  const at = new Date(latest.at);
  return at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate();
}

/**
 * How many visits one place may take in a day. Breakfast, lunch and a
 * drink after work are three; a fourth is a tap that got away. A day is
 * the last twenty-four hours, not the calendar day: the server has no
 * clock of the reader's to draw midnight with, and a rolling day is the
 * same rule for a reader in Hanoi and one in Melbourne. The insert
 * policy counts the same window (`20261009090000_checkins_per_place.sql`).
 *
 * Across places there was no cap from 9 Oct to 24 Nov 2026: thirty in a
 * day was a guess at "a script", and a day out that walks a whole lane of
 * cafés is not one. It came back at fifty (`PER_DAY`) when a visit could
 * carry photographs.
 */
export const PER_PLACE_PER_DAY = 3;

/**
 * How many visits an account may make in a day, across places
 * (`20261124210000_checkins_per_day.sql`, where the measurement is: the
 * busiest real day was 29, 95% of days 12 or fewer). A bound on a
 * script, not on a reader.
 */
export const PER_DAY = 50;

/**
 * Why the server refused a visit, read off the reader's visits as they
 * stand *after* the refusal — the caller asks for them afresh
 * (`useCheckIn`). The server refuses all three rules the same way, and
 * the sentence differs.
 *
 * From one phone only the day's fifty can be met: the pill is not offered
 * inside ten minutes or after three here (`canRepeat`). The other two
 * happen when a second phone checked in first, which is why the list
 * must be fresh — the one on screen does not have that visit yet.
 */
export function whyRefused(rows: readonly Checkin[], slug: string, now: Date): 'soon' | 'place' | 'day' {
  const latest = latestCheckin(rows, slug);
  if (latest && now.getTime() - new Date(latest.at).getTime() < REPEAT_AFTER_MIN * 60_000) return 'soon';
  return visitsInDay(rows, slug, now) >= PER_PLACE_PER_DAY ? 'place' : 'day';
}

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
  // Japanese and Chinese write a month the same way.
  if (lang === 'ja' || lang === 'zh' || lang === 'zh-Hant') return `${year}年${month}月`;
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

/**
 * A visit as a person's page holds it (`person_checkins`): the place by
 * what a card draws of it, the **day** — a friend is never told the
 * hour, so the page is not either, your own included — the note, and
 * its hearts.
 */
export type PersonCheckin = {
  id: string;
  place_slug: string;
  place: NonNullable<Checkin['place']>;
  city_id: string | null;
  /** `YYYY-MM-DD`, on the clock of the city the visit was made in. */
  day: string;
  note: string | null;
  /** Who sees it — on your own page. Null on anybody else's: every row
   *  there is one its owner answered 'friends', and the answer is theirs. */
  audience: Audience | null;
  likes: number;
  liked: boolean;
  /** The visit's photos the reader may see, in order: none hidden, at
   *  most three. Absent on a row the cache kept from before they rode. */
  photos?: CheckinPhoto[];
  /** The desk hid the visit, or its note (`20261126090000_checkin_report.sql`).
   *  Only ever true on your own page: nobody else is sent a hidden visit,
   *  or a hidden note. Absent on a row the cache kept from before. */
  hidden?: boolean;
  note_hidden?: boolean;
};

// ── photos on a visit (K3 of docs/checkin-photos-plan.md) ──

/** How many photos a visit may carry: the owner's number (24 Nov 2026),
 *  held by the database too (`checkin_photo_slot`). */
export const PHOTOS_PER_VISIT = 3;

/** A photo of the reader's own visit, as `checkin_photos` hands it back. */
export type CheckinPhoto = {
  id: string;
  path: string;
  width: number;
  height: number;
  /** Taken down by the desk: drawn as a gap its owner may clear, never as
   *  the picture (the bucket will not sign it). */
  hidden?: boolean;
};

/**
 * Why a photo did not go up, in the words the sheet has for it.
 *
 *  · `full`, `day`, `account` — `checkin_photo_slot`'s three caps;
 *  · `image` — `_shared/jpeg.ts` or the size checks said it is not a
 *    picture this can store;
 *  · `signed_out` — the session went;
 *  · `other` — anything else, the network first among them: the one kind
 *    worth trying again as it is.
 */
/**
 * A visit's photos out of whatever the server sent: `person_checkins`'
 * `jsonb`, or `checkins`' embed of `checkin_photos`. Read as untrusted —
 * the generated types call a `jsonb` anything — so an entry without a
 * path or a size is left out rather than drawn as a broken tile. The
 * hidden are left out too: on a card a photo the desk took down is not
 * there (only the sheet, for its owner, draws the gap). In `position`
 * order where the rows carry one; `person_checkins` sends them ordered.
 */
export function visitPhotosOf(raw: unknown): CheckinPhoto[] {
  if (!Array.isArray(raw)) return [];
  type Row = { id?: unknown; path?: unknown; width?: unknown; height?: unknown; position?: unknown; hidden_at?: unknown };
  return (raw as Row[])
    .filter((r) => r && typeof r.id === 'string' && typeof r.path === 'string'
      && typeof r.width === 'number' && typeof r.height === 'number' && r.hidden_at == null)
    .map((r, i) => ({ r, at: typeof r.position === 'number' ? r.position : i }))
    .sort((a, b) => a.at - b.at)
    .slice(0, PHOTOS_PER_VISIT)
    .map(({ r }) => ({ id: r.id as string, path: r.path as string, width: r.width as number, height: r.height as number }));
}

export type PhotoRefusal = 'full' | 'day' | 'account' | 'image' | 'signed_out' | 'other';

const IMAGE_CODES = new Set(['not_jpeg', 'malformed', 'truncated', 'no_image', 'too_large', 'too_big']);

export function photoRefusalOf(status: number | undefined, code: string | undefined): PhotoRefusal {
  if (code === 'photo:full') return 'full';
  if (code === 'photo:day') return 'day';
  if (code === 'photo:account') return 'account';
  if (code && IMAGE_CODES.has(code)) return 'image';
  if (status === 401) return 'signed_out';
  return 'other';
}

/** A refusal carried as a throw, so a caller can tell one from another. */
export class PhotoError extends Error {
  constructor(readonly why: PhotoRefusal) {
    super(why);
    this.name = 'PhotoError';
  }
}
