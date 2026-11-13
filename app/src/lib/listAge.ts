// How old a list is, for the line under its owner's handle on the
// collection card (owner, 13 Nov 2026).
//
// The owner's table, the one a social post's header uses:
//
//   under a minute      New
//   under an hour       5m
//   under a day         3h
//   this calendar year  the date, without the year
//   an earlier year     the date, with it
//
// The shape rather than the words, as `agoOf` returns it and for its
// reason: the screen owns the sentence, in five languages, and this module
// knows none of them. The minutes and hours are `agoOf`'s own, so a list's
// "5m" and Activity's "5m ago" cannot disagree about where a minute ends.
//
// ── no "n days" ──
//
// Past a day the owner's table goes straight to the date. Activity counts
// a week of days first (`ActivityScreen.agoLabel`), because a timeline is
// read for what happened lately; a list's age is read to place it, and
// "12 Nov" places it where "1d" makes the reader count.
//
// ── the year on the phone's calendar ──
//
// "This year" is the reader's year, from the phone's own clock: the year
// printed on every date they see. A list made at 03:00 on 1 January in
// Hà Nội is 20:00 on 31 December in UTC: read in UTC, a list made this
// year would wear last year's number.
//
// ── a second reader: an act's age (owner, 13 Nov 2026) ──
//
// A list's activity page (`CollectionActivityScreen`) dates each like and
// copy by the same table, as Threads dates a post and the acts on it
// alike. It fits unchanged, so it is this function rather than a sibling:
// an act is placed the way a list is, 5m, 3h, then the date. Only the
// first word differs — a list that has just been made is "New", a like
// that has just been given is "now" — so `ageWord` spells the rest for
// both and takes that word from its caller.
import { numericDate, numericDateWithYear } from './format';
import { agoOf } from './friends';

export type ListAge =
  | { unit: 'new' }
  | { unit: 'minutes' | 'hours'; n: number }
  | { unit: 'date'; at: Date; withYear: boolean };

export function listAgeOf(iso: string, now: Date): ListAge {
  const ago = agoOf(iso, now.getTime());
  // `agoOf` clamps the future to "now", and so does this: a clock a minute
  // fast on the phone that made the list must not date it from tomorrow.
  if (ago.unit === 'now') return { unit: 'new' };
  if (ago.unit === 'minutes' || ago.unit === 'hours') return { unit: ago.unit, n: ago.n };
  const at = new Date(iso);
  return { unit: 'date', at, withYear: at.getFullYear() !== now.getFullYear() };
}

type T = (en: string, vi: string, ja: string, zh?: string, hant?: string) => string;

/** The age as the card head prints it: `first` for under a minute — what
 *  "new" is called depends on what is dated, see the header — then 5m /
 *  5p, 3h, and the date, with its year when it is from an earlier one. */
export function ageWord(age: ListAge, lang: string, t: T, first: string): string {
  if (age.unit === 'new') return first;
  if (age.unit === 'date') return age.withYear ? numericDateWithYear(lang, age.at) : numericDate(lang, age.at);
  if (age.unit === 'minutes') return t(`${age.n}m`, `${age.n}p`, `${age.n}分`, `${age.n}分钟`, `${age.n}分鐘`);
  return t(`${age.n}h`, `${age.n}h`, `${age.n}時間`, `${age.n}小时`, `${age.n}小時`);
}
