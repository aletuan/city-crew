// Tags while a comment is being written (docs/comments-plan.md, C5).
//
// A tag is not text. It is a place in the words — where it starts, how
// long — and what stands there: a person, or a place on the list
// (`lib/comments.Mention`; the server keeps the same, `comment_mentions`).
// The "@name" the reader sees is ordinary text the tag happens to cover,
// which is why a handle changed later still opens the right page, and why
// everything in this file is about keeping positions true while the
// words under them move.
//
// Positions are characters, as everywhere a comment is measured (see the
// head of `lib/comments`): Postgres counts characters, JavaScript counts
// UTF-16 units, and one emoji before a tag would put it a letter out.
// The field reports its caret in units; `charsBefore` is the one place
// that is converted.
//
// ── one way in: "@" ──
//
// Typing "@" offers the people the writer may tag and the list's places,
// narrowed as more is typed. The plan had a separate button for places.
// Not built: a tag inserted from a button is words with nothing to show
// they are a tag — edit one letter and it silently stops being one —
// while "@Name" says what it is in the field as it does for a person;
// and a second control in a pill that already holds a face, a count and
// a send disc is a control too many. Every app that tags does it from
// "@", so nobody has to be taught.
//
// ── editing a tag unlinks it ──
//
// A change that touches a tag's own characters drops the tag and leaves
// the words (`retag`). The other choice — the whole "@name" deleted by
// one backspace, as Instagram does — needs the field's selection to be
// set from here, which React Native's controlled `selection` does
// unreliably (it fights the keyboard's own caret on iOS). Unlinking
// needs nothing from the field and is never wrong: what is sent is
// exactly what is seen, with fewer links.

import type { Mention } from './comments';
import type { Lang } from './lang';
import { localized, type LocalizedRow } from './localized';
import { fold } from './search';

/** A tag in the words being written. Exactly one of the two is set. */
export type Tag = { at: number; len: number; person: string | null; place: string | null };

/** Somebody the writer may tag — a row of `comment_taggable`. */
export type TagPerson = { id: string; handle: string; full_name: string | null; avatar_url: string | null };

/** A place on the list, named in the reader's language. */
export type TagPlace = { id: string; slug: string; name: string };

/** A place as `comment_taggable` sends it: its id, its slug, and the
 *  columns a name is read from in whichever language the reader has. */
export type TagPlaceRow = LocalizedRow & { id: string; slug: string };

/**
 * What a field is told when it opens on a subject: whom and what may be
 * tagged, and the two things that decide whether there is a field at
 * all — the owner has closed the thread (`off`), and the reader is that
 * owner (`mine`). They travel with the tags because it is the one
 * question asked by exactly the reader who might write, just before
 * they do (20261119070000).
 */
export type Taggable = { people: TagPerson[]; places: TagPlaceRow[]; off: boolean; mine: boolean };

/** The places as the reader's language names them. One with no name in
 *  any language is left out: there would be nothing to write it as. */
export function placesNamed(rows: readonly TagPlaceRow[], lang: Lang): TagPlace[] {
  const out: TagPlace[] = [];
  for (const row of rows) {
    const name = localized(row, 'name', lang);
    if (name) out.push({ id: row.id, slug: row.slug, name });
  }
  return out;
}

/**
 * `comment_taggable`'s answer, read as untrusted: a person is an id and
 * a handle, a place is an id and a slug, and anything else in either
 * list is skipped — an answer that is not the object at all is nobody
 * and nowhere. Closed and the reader's own only on the word `true`: a
 * server from before it said either reads as an open thread on somebody
 * else's list, which is what every thread was then.
 */
export function taggableOf(raw: unknown): Taggable {
  const doc = (raw && typeof raw === 'object' ? raw : {}) as { people?: unknown; places?: unknown; off?: unknown; mine?: unknown };
  const text = (v: unknown) => (typeof v === 'string' ? v : null);
  const people: TagPerson[] = [];
  for (const p of (Array.isArray(doc.people) ? doc.people : []) as Record<string, unknown>[]) {
    if (!p || typeof p.id !== 'string' || typeof p.handle !== 'string') continue;
    people.push({ id: p.id, handle: p.handle, full_name: text(p.full_name), avatar_url: text(p.avatar_url) });
  }
  const places: TagPlaceRow[] = [];
  for (const p of (Array.isArray(doc.places) ? doc.places : []) as Record<string, unknown>[]) {
    if (!p || typeof p.id !== 'string' || typeof p.slug !== 'string') continue;
    places.push(p as TagPlaceRow);
  }
  return { people, places, off: doc.off === true, mine: doc.mine === true };
}

/** One line of what "@" offers. */
export type Offer =
  | { kind: 'person'; person: TagPerson }
  | { kind: 'place'; place: TagPlace };

/** How many lines "@" offers. Five: with the keyboard up and the field
 *  one line tall, five rows of 44 leave the comment being answered in
 *  view on the smallest phone the app supports (667 tall: 291 keyboard,
 *  60 bar, 220 offers, 96 left). The list does not scroll — a scroll
 *  inside a page that scrolls, over a keyboard, is three things to miss
 *  with one thumb — so the way to reach a sixth is to type a letter. */
export const OFFERED = 5;

/** How many of the five are held for places when there are people enough
 *  to fill them all. Two: a bare "@" must show that places can be tagged
 *  at all, and one row reads as an accident. */
export const PLACES_HELD = 2;

/** The server's ceiling on tags in one comment (`post_comment`). At it,
 *  "@" offers nothing: a tag the server would refuse is not offered. */
export const TAGS_MAX = 10;

/** How many characters stand before a UTF-16 index — a field's caret,
 *  turned into the measure tags are kept in. */
export function charsBefore(text: string, units: number): number {
  return Array.from(text.slice(0, Math.max(0, units))).length;
}

/**
 * The tags after `start…end` of the old words became something `delta`
 * characters longer (or shorter): those wholly before stay, those wholly
 * after move, and any the change touched are dropped.
 *
 * Typing right after a tag's last letter leaves it — the letter is not
 * the tag's — and typing right before its first moves it along.
 */
function moved(tags: readonly Tag[], start: number, end: number, delta: number): Tag[] {
  const out: Tag[] = [];
  for (const g of tags) {
    if (g.at + g.len <= start) out.push(g);
    else if (g.at >= end) out.push({ ...g, at: g.at + delta });
  }
  return out;
}

/** Where two versions of the words differ: what both begin with, and
 *  what both end with past that. */
function changed(before: string[], after: string[]): { head: number; tail: number } {
  const most = Math.min(before.length, after.length);
  let head = 0;
  while (head < most && before[head] === after[head]) head += 1;
  let tail = 0;
  while (tail < most - head && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail += 1;
  return { head, tail };
}

/**
 * The tags, after the field's words changed from `before` to `after`.
 *
 * The field says only what the words are now, so the change is found by
 * what the two still share at each end. Where that is ambiguous — a
 * letter typed into a run of the same letter — every reading moves the
 * same tags by the same amount, so it does not matter which is taken.
 */
export function retag(before: string, after: string, tags: readonly Tag[]): Tag[] {
  const b = Array.from(before);
  const a = Array.from(after);
  const { head, tail } = changed(b, a);
  return moved(tags, head, b.length - tail, a.length - b.length);
}

/**
 * Where the caret is after the words changed, in characters: the end of
 * what was typed or the point of what was deleted.
 *
 * Worked out from the words, not asked of the field, because the field
 * reports its caret in a second event that may come after this one — and
 * the offer for "@tr" has to be right on the keystroke that typed the r.
 */
export function caretAfter(before: string, after: string): number {
  const b = Array.from(before);
  const a = Array.from(after);
  return a.length - changed(b, a).tail;
}

/**
 * The "@…" being typed at the caret, or null: where its "@" is and the
 * letters after it so far.
 *
 * An "@" counts when it opens the words or follows a space or a new
 * line — "a@b.com" is an address — and when it is not already a tag's:
 * the caret resting after a finished "@trang" offers nothing again. A
 * query ends at the first space: names are matched by the start of any
 * word in them, so "@cong" finds "Cộng Cà Phê" and nobody types the
 * second word.
 */
export function tagQuery(text: string, caret: number, tags: readonly Tag[]): { at: number; query: string } | null {
  const chars = Array.from(text);
  let i = Math.min(Math.max(0, caret), chars.length);
  const end = i;
  while (i > 0 && chars[i - 1] !== '@' && !/\s/.test(chars[i - 1])) i -= 1;
  if (i === 0 || chars[i - 1] !== '@') return null;
  const at = i - 1;
  if (at > 0 && !/\s/.test(chars[at - 1])) return null;
  if (tags.some((g) => g.at <= at && at < g.at + g.len)) return null;
  return { at, query: chars.slice(i, end).join('') };
}

/** Whether a name answers what was typed: it, or any word of it, begins
 *  with the letters — without accents or case, as search reads names. */
function answers(name: string | null, q: string): boolean {
  const folded = fold(name);
  return folded.startsWith(q) || folded.split(/[\s\-–]+/).some((w) => w.startsWith(q));
}

/**
 * What "@" and the letters after it offer: people first, in the order
 * the server gave them (the owner, the thread, then friends), then the
 * list's places in the list's order — five lines, two of them held for
 * places when both have more than fit. Nothing once the comment holds as
 * many tags as the server takes.
 */
export function offersFor(
  query: string, people: readonly TagPerson[], places: readonly TagPlace[], tags: readonly Tag[],
): Offer[] {
  if (tags.length >= TAGS_MAX) return [];
  const q = fold(query);
  const who = people.filter((p) => answers(p.handle, q) || answers(p.full_name, q));
  const where = places.filter((p) => answers(p.name, q));
  const held = Math.min(PLACES_HELD, where.length);
  const shownWho = who.slice(0, OFFERED - held);
  const shownWhere = where.slice(0, OFFERED - shownWho.length);
  return [
    ...shownWho.map((person): Offer => ({ kind: 'person', person })),
    ...shownWhere.map((place): Offer => ({ kind: 'place', place })),
  ];
}

/** The words a tag is written as: "@" and the handle, or the place's name. */
export function wordsOf(offer: Offer): string {
  return `@${offer.kind === 'person' ? offer.person.handle : offer.place.name}`;
}

/**
 * The words and tags after an offer is taken: the "@…" being typed gives
 * way to the tag's words and one space, the tag covers the words and not
 * the space, and the caret is after the space, ready for the next word.
 */
export function tagged(
  text: string, tags: readonly Tag[], typing: { at: number; query: string }, offer: Offer,
): { text: string; tags: Tag[]; caret: number } {
  const chars = Array.from(text);
  const words = Array.from(wordsOf(offer));
  const end = typing.at + 1 + Array.from(typing.query).length;
  const next = [...chars.slice(0, typing.at), ...words, ' ', ...chars.slice(end)];
  const kept = moved(tags, typing.at, end, next.length - chars.length);
  const made: Tag = {
    at: typing.at, len: words.length,
    person: offer.kind === 'person' ? offer.person.id : null,
    place: offer.kind === 'place' ? offer.place.id : null,
  };
  return {
    text: next.join(''),
    tags: [...kept, made].sort((x, y) => x.at - y.at),
    caret: typing.at + words.length + 1,
  };
}

/**
 * What is sent: the words without the space around them, and the tags
 * moved to match.
 *
 * The server trims a body before it measures a tag against it
 * (`post_comment`), so a tag counted from a leading space would arrive
 * one out. Trimmed here, by JavaScript's rule, which takes everything
 * Postgres' `btrim` does and new lines besides — the server's trim then
 * finds nothing to take. A tag left outside the trimmed words is dropped;
 * none can be, since a tag begins with "@", but what is sent is checked
 * against what it is sent with and not against that argument.
 */
export function outgoing(text: string, tags: readonly Tag[]): { body: string; mentions: Mention[] } {
  const body = text.trim();
  const lead = Array.from(text.slice(0, text.length - text.trimStart().length)).length;
  const length = Array.from(body).length;
  const mentions: Mention[] = [];
  for (const g of tags) {
    const at = g.at - lead;
    if (at < 0 || at + g.len > length) continue;
    mentions.push({ at, len: g.len, person: g.person, place: g.place, handle: null, slug: null });
  }
  return { body, mentions };
}
